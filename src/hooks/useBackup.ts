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

    const [workersSnap, attendanceSnap, advancesSnap, sitesSnap] =
      await Promise.all([
        getDocs(collection(db, 'users', uid, 'workers')),
        getDocs(collection(db, 'users', uid, 'attendance')),
        getDocs(collection(db, 'users', uid, 'advances')),
        getDocs(collection(db, 'users', uid, 'sites')),
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

  return { backup, restore, busy, progress, error };
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
  // 1. Wipe transactions under each site first (sites must exist to find them).
  const sitesSnap = await getDocs(collection(db, 'users', uid, 'sites'));
  for (const siteDoc of sitesSnap.docs) {
    const txSnap = await getDocs(collection(siteDoc.ref, 'transactions'));
    for (let i = 0; i < txSnap.docs.length; i += 400) {
      const batch = writeBatch(db);
      txSnap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }

  // 2. Wipe top-level collections.
  for (const name of ['workers', 'attendance', 'advances', 'sites']) {
    const snap = await getDocs(collection(db, 'users', uid, name));
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
}