import { useCallback, useState } from 'react';
import {
  collection,
  getDocs,
  doc,
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

  const restore = useCallback(
    async (payload: BackupPayload, mode: RestoreMode = 'merge') => {
      if (!user) throw new Error('Not signed in.');
      if (!payload || payload.version !== 1 || !payload.data) {
        throw new Error('Invalid backup file: unsupported format.');
      }
      const uid = user.uid;

      setBusy(true);
      setError(null);

      try {
        if (mode === 'replace') {
          setProgress('Clearing existing data…');
          await wipeAll(uid);
        }

        setProgress('Restoring workers…');
        await writeChunks(
          payload.data.workers.map((w) => {
            const { id, ...rest } = w;
            return { ref: doc(db, 'users', uid, 'workers', id), data: rest };
          })
        );

        setProgress('Restoring attendance…');
        await writeChunks(
          payload.data.attendance.map((a) => {
            const { id, ...rest } = a;
            return { ref: doc(db, 'users', uid, 'attendance', id), data: rest };
          })
        );

        setProgress('Restoring advances…');
        await writeChunks(
          payload.data.advances.map((a) => {
            const { id, ...rest } = a;
            return { ref: doc(db, 'users', uid, 'advances', id), data: rest };
          })
        );

        setProgress('Restoring sites…');
        await writeChunks(
          payload.data.sites.map((s) => {
            const { id, ...rest } = s;
            return { ref: doc(db, 'users', uid, 'sites', id), data: rest };
          })
        );

        setProgress('Restoring transactions…');
        for (const [siteId, txs] of Object.entries(
          payload.data.transactionsBySite ?? {}
        )) {
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

        if (payload.data.roles && Array.isArray(payload.data.roles)) {
          setProgress('Restoring roles…');
          await writeChunks([
            {
              ref: doc(db, 'users', uid, 'settings', 'roles'),
              data: { roles: payload.data.roles, updatedAt: Date.now() },
            },
          ]);
        }

        setProgress('Restoring suppliers…');
        await writeChunks(
          (payload.data.suppliers ?? []).map((s) => {
            const { id, ...rest } = s;
            return { ref: doc(db, 'users', uid, 'suppliers', id), data: rest };
          })
        );

        setProgress('Restoring material deliveries…');
        await writeChunks(
          (payload.data.deliveries ?? []).map((d) => {
            const { id, ...rest } = d;
            return { ref: doc(db, 'users', uid, 'deliveries', id), data: rest };
          })
        );

        setProgress('Restoring commissions…');
        await writeChunks(
          (payload.data.commissions ?? []).map((c) => {
            const { id, ...rest } = c;
            return { ref: doc(db, 'users', uid, 'commissions', id), data: rest };
          })
        );

        setProgress('Restoring supplier payments…');
        await writeChunks(
          (payload.data.supplierPayments ?? []).map((p) => {
            const { id, ...rest } = p;
            return {
              ref: doc(db, 'users', uid, 'supplierPayments', id),
              data: rest,
            };
          })
        );

        setProgress('Restoring contractors…');
        await writeChunks(
          (payload.data.contractors ?? []).map((c) => {
            const { id, ...rest } = c;
            return { ref: doc(db, 'users', uid, 'contractors', id), data: rest };
          })
        );

        setProgress('Restoring contractor payments…');
        await writeChunks(
          (payload.data.contractorPayments ?? []).map((p) => {
            const { id, ...rest } = p;
            return {
              ref: doc(db, 'users', uid, 'contractorPayments', id),
              data: rest,
            };
          })
        );

        setProgress('Restore complete.');
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [user]
  );

  /**
   * Wipes ALL of the current user's data — workers, attendance, advances,
   * sites + their transactions, suppliers, deliveries, commissions,
   * supplierPayments, contractors, contractorPayments and role settings.
   *
   * Exposed separately so the "Clear All Data" button doesn't have to fake
   * an empty restore payload.
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

  // 3. Reset roles to defaults by removing the settings/roles document.
  try {
    const settingsSnap = await getDocs(collection(db, 'users', uid, 'settings'));
    if (!settingsSnap.empty) {
      const batch = writeBatch(db);
      settingsSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch {
    /* settings optional — ignore */
  }
}