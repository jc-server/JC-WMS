import { useCallback, useState } from 'react';
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

export type BackupDoc = { id: string } & Record<string, unknown>;

export type BackupPayload = {
  version: 1;
  exportedAt: string;
  exportedBy: string;
  app: 'JCWMS';
  data: {
    workers: BackupDoc[];
    attendance: BackupDoc[];
    advances: BackupDoc[];
    sites: BackupDoc[];
    transactionsBySite: Record<string, BackupDoc[]>;
    roles: string[] | null;
    suppliers?: BackupDoc[];
    deliveries?: BackupDoc[];
    commissions?: BackupDoc[];
    supplierPayments?: BackupDoc[];
    contractors?: BackupDoc[];
    contractorPayments?: BackupDoc[];
  };
};

type RestoreMode = 'merge' | 'replace';

/**
 * Validates that a parsed JSON object conforms to the `BackupPayload`
 * shape. Throws a user-friendly error if anything is missing or malformed
 * so we never start writing to Firestore with a partial payload.
 */
function validatePayload(
  payload: unknown
): asserts payload is BackupPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid backup file: not a JSON object.');
  }
  const p = payload as Partial<BackupPayload>;
  if (p.version !== 1) {
    throw new Error('Invalid backup file: unsupported version.');
  }
  if (p.app !== 'JCWMS') {
    throw new Error('Invalid backup file: not a JCWMS backup.');
  }
  if (!p.data || typeof p.data !== 'object') {
    throw new Error('Invalid backup file: missing "data" section.');
  }
  const d = p.data;

  const requiredArrays = ['workers', 'attendance', 'advances', 'sites'] as const;
  for (const key of requiredArrays) {
    if (!Array.isArray(d[key])) {
      throw new Error(`Invalid backup file: "${key}" must be an array.`);
    }
  }

  const optionalArrays = [
    'suppliers',
    'deliveries',
    'commissions',
    'supplierPayments',
    'contractors',
    'contractorPayments',
  ] as const;
  for (const key of optionalArrays) {
    const val = d[key];
    if (val !== undefined && !Array.isArray(val)) {
      throw new Error(`Invalid backup file: "${key}" must be an array if present.`);
    }
  }

  if (
    d.transactionsBySite !== undefined &&
    (typeof d.transactionsBySite !== 'object' || d.transactionsBySite === null)
  ) {
    throw new Error('Invalid backup file: "transactionsBySite" must be an object.');
  }
}

export function useBackup() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const collectAll = useCallback(async (): Promise<BackupPayload> => {
    if (!user) throw new Error('Not signed in.');
    const uid = user.uid;

    const toDocs = (
      snap: { docs: { id: string; data: () => unknown }[] }
    ): BackupDoc[] =>
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }));

    const [
      workersSnap,
      attendanceSnap,
      advancesSnap,
      sitesSnap,
      suppliersSnap,
      deliveriesSnap,
      commissionsSnap,
      supplierPaymentsSnap,
      contractorsSnap,
      contractorPaymentsSnap,
    ] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'workers')),
      getDocs(collection(db, 'users', uid, 'attendance')),
      getDocs(collection(db, 'users', uid, 'advances')),
      getDocs(collection(db, 'users', uid, 'sites')),
      getDocs(collection(db, 'users', uid, 'suppliers')),
      getDocs(collection(db, 'users', uid, 'deliveries')),
      getDocs(collection(db, 'users', uid, 'commissions')),
      getDocs(collection(db, 'users', uid, 'supplierPayments')),
      getDocs(collection(db, 'users', uid, 'contractors')),
      getDocs(collection(db, 'users', uid, 'contractorPayments')),
    ]);

    const transactionsBySite: Record<string, BackupDoc[]> = {};
    for (const siteDoc of sitesSnap.docs) {
      const txSnap = await getDocs(collection(siteDoc.ref, 'transactions'));
      transactionsBySite[siteDoc.id] = toDocs(txSnap);
    }

    let roles: string[] | null = null;
    try {
      const rolesSnap = await getDocs(collection(db, 'users', uid, 'settings'));
      rolesSnap.forEach((d) => {
        if (d.id === 'roles') {
          const data = d.data() as { roles?: string[] };
          if (Array.isArray(data.roles)) roles = data.roles;
        }
      });
    } catch {
      /* settings optional */
    }

    return {
      version: 1,
      app: 'JCWMS',
      exportedAt: new Date().toISOString(),
      exportedBy: uid,
      data: {
        workers: toDocs(workersSnap),
        attendance: toDocs(attendanceSnap),
        advances: toDocs(advancesSnap),
        sites: toDocs(sitesSnap),
        transactionsBySite,
        roles,
        suppliers: toDocs(suppliersSnap),
        deliveries: toDocs(deliveriesSnap),
        commissions: toDocs(commissionsSnap),
        supplierPayments: toDocs(supplierPaymentsSnap),
        contractors: toDocs(contractorsSnap),
        contractorPayments: toDocs(contractorPaymentsSnap),
      },
    };
  }, [user]);

  const backup = useCallback(async (): Promise<BackupPayload> => {
    setBusy(true);
    setError(null);
    setProgress('Collecting data…');
    try {
      const payload = await collectAll();
      setProgress('Backup ready.');
      return payload;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setBusy(false);
    }
  }, [collectAll]);

  /**
   * Restore.
   *
   * `replace` mode now takes an in-memory safety backup of the current
   * data BEFORE wiping. If the write fails partway through, we roll back
   * to that safety snapshot so the user is never left with an empty or
   * half-restored account after a network blip.
   */
  const restore = useCallback(
    async (payload: BackupPayload, mode: RestoreMode = 'merge') => {
      if (!user) throw new Error('Not signed in.');
      validatePayload(payload);
      const uid = user.uid;

      setBusy(true);
      setError(null);

      try {
        if (mode === 'replace') {
          setProgress('Preparing safety backup of current data…');
          const safety = await collectAll();

          setProgress('Clearing existing data…');
          await wipeAll(uid);

          try {
            await applyRestoreData(uid, payload.data, setProgress);
          } catch (writeErr) {
            setProgress('Restore failed — rolling back to previous data…');
            let rollbackSucceeded = false;
            try {
              await wipeAll(uid);
              await applyRestoreData(uid, safety.data, () => {});
              rollbackSucceeded = true;
            } catch (rollbackErr) {
              console.error('Rollback error:', rollbackErr);
            }
            setProgress('');
            if (rollbackSucceeded) {
              throw new Error(
                'Restore failed, but your previous data was rolled back ' +
                  'successfully. Original error: ' +
                  (writeErr as Error).message
              );
            }
            throw new Error(
              'Restore failed AND rollback failed — your data may be in an ' +
                'inconsistent state. Try restoring again, or restore from a ' +
                'backup file. Restore error: ' +
                (writeErr as Error).message
            );
          }
        } else {
          await applyRestoreData(uid, payload.data, setProgress);
        }

        setProgress('Restore complete.');
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [user, collectAll]
  );

  /**
   * Wipes ALL of the current user's data — workers, attendance, advances,
   * sites + their transactions, suppliers, deliveries, commissions,
   * supplierPayments, contractors, contractorPayments and role settings.
   */
  const wipeEverything = useCallback(async () => {
    if (!user) throw new Error('Not signed in.');
    setBusy(true);
    setError(null);
    setProgress('Clearing existing data…');
    try {
      await wipeAll(user.uid);
      setProgress('All data cleared.');
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setBusy(false);
    }
  }, [user]);

  return { backup, restore, wipeEverything, busy, progress, error };
}

/* ------------------------------------------------------------------ */
/* Internal helpers                                                    */
/* ------------------------------------------------------------------ */

type WriteItem = { ref: DocumentReference; data: Record<string, unknown> };

async function writeChunks(items: WriteItem[]) {
  const CHUNK = 400;
  for (let i = 0; i < items.length; i += CHUNK) {
    const batch = writeBatch(db);
    items.slice(i, i + CHUNK).forEach(({ ref, data }) =>
      batch.set(ref, data, { merge: true })
    );
    await batch.commit();
  }
}

/**
 * Writes all collections from a backup `data` block into Firestore under
 * the given user. Extracted so it can be reused by the rollback path.
 */
async function applyRestoreData(
  uid: string,
  data: BackupPayload['data'],
  setProgress: (s: string) => void
) {
  setProgress('Restoring workers…');
  await writeChunks(
    data.workers.map((w) => {
      const { id, ...rest } = w;
      return { ref: doc(db, 'users', uid, 'workers', id), data: rest };
    })
  );

  setProgress('Restoring attendance…');
  await writeChunks(
    data.attendance.map((a) => {
      const { id, ...rest } = a;
      return { ref: doc(db, 'users', uid, 'attendance', id), data: rest };
    })
  );

  setProgress('Restoring advances…');
  await writeChunks(
    data.advances.map((a) => {
      const { id, ...rest } = a;
      return { ref: doc(db, 'users', uid, 'advances', id), data: rest };
    })
  );

  setProgress('Restoring sites…');
  await writeChunks(
    data.sites.map((s) => {
      const { id, ...rest } = s;
      return { ref: doc(db, 'users', uid, 'sites', id), data: rest };
    })
  );

  setProgress('Restoring transactions…');
  for (const [siteId, txs] of Object.entries(data.transactionsBySite ?? {})) {
    await writeChunks(
      txs.map((t) => {
        const { id, ...rest } = t;
        return {
          ref: doc(db, 'users', uid, 'sites', siteId, 'transactions', id),
          data: rest,
        };
      })
    );
  }

  if (data.roles && Array.isArray(data.roles)) {
    setProgress('Restoring roles…');
    await writeChunks([
      {
        ref: doc(db, 'users', uid, 'settings', 'roles'),
        data: { roles: data.roles, updatedAt: Date.now() },
      },
    ]);
  }

  setProgress('Restoring suppliers…');
  await writeChunks(
    (data.suppliers ?? []).map((s) => {
      const { id, ...rest } = s;
      return { ref: doc(db, 'users', uid, 'suppliers', id), data: rest };
    })
  );

  setProgress('Restoring material deliveries…');
  await writeChunks(
    (data.deliveries ?? []).map((d) => {
      const { id, ...rest } = d;
      return { ref: doc(db, 'users', uid, 'deliveries', id), data: rest };
    })
  );

  setProgress('Restoring commissions…');
  await writeChunks(
    (data.commissions ?? []).map((c) => {
      const { id, ...rest } = c;
      return { ref: doc(db, 'users', uid, 'commissions', id), data: rest };
    })
  );

  setProgress('Restoring supplier payments…');
  await writeChunks(
    (data.supplierPayments ?? []).map((p) => {
      const { id, ...rest } = p;
      return {
        ref: doc(db, 'users', uid, 'supplierPayments', id),
        data: rest,
      };
    })
  );

  setProgress('Restoring contractors…');
  await writeChunks(
    (data.contractors ?? []).map((c) => {
      const { id, ...rest } = c;
      return { ref: doc(db, 'users', uid, 'contractors', id), data: rest };
    })
  );

  setProgress('Restoring contractor payments…');
  await writeChunks(
    (data.contractorPayments ?? []).map((p) => {
      const { id, ...rest } = p;
      return {
        ref: doc(db, 'users', uid, 'contractorPayments', id),
        data: rest,
      };
    })
  );
}

async function wipeAll(uid: string) {
  // 1. Wipe transactions under each site first.
  const sitesSnap = await getDocs(collection(db, 'users', uid, 'sites'));
  for (const siteDoc of sitesSnap.docs) {
    const txSnap = await getDocs(collection(siteDoc.ref, 'transactions'));
    for (let i = 0; i < txSnap.docs.length; i += 400) {
      const batch = writeBatch(db);
      txSnap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }

  // 2. Wipe every top-level collection under the user.
  const topLevel = [
    'workers',
    'attendance',
    'advances',
    'sites',
    'suppliers',
    'deliveries',
    'commissions',
    'supplierPayments',
    'contractors',
    'contractorPayments',
  ];

  for (const name of topLevel) {
    const snap = await getDocs(collection(db, 'users', uid, name));
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }

  // 3. Reset roles to defaults by removing ONLY the settings/roles doc.
  //    Other settings documents (if added later) are deliberately preserved.
  try {
    await deleteDoc(doc(db, 'users', uid, 'settings', 'roles'));
  } catch {
    /* roles doc may not exist — ignore */
  }
}