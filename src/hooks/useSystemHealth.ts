import { useState, useCallback, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

export type SystemCounts = {
  workers: { total: number; active: number; inactive: number };
  attendance: number;
  advances: number;
  sites: number;
  transactions: number;
};

export type SystemHealthState = {
  counts: SystemCounts | null;
  storageBytes: number;
  loading: boolean;
  error: string | null;
  lastChecked: number | null;
  refresh: () => Promise<void>;
};

export function useSystemHealth(): SystemHealthState {
  const { user } = useAuth();
  const [counts, setCounts] = useState<SystemCounts | null>(null);
  const [storageBytes, setStorageBytes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setCounts(null);
      setStorageBytes(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [workersSnap, attendanceSnap, advancesSnap, sitesSnap] =
        await Promise.all([
          getDocs(collection(db, 'users', user.uid, 'workers')),
          getDocs(collection(db, 'users', user.uid, 'attendance')),
          getDocs(collection(db, 'users', user.uid, 'advances')),
          getDocs(collection(db, 'users', user.uid, 'sites')),
        ]);

      let transactions = 0;
      let bytes = 0;

      const measure = (snap: typeof workersSnap) => {
        snap.docs.forEach((d) => {
          bytes += new Blob([
            JSON.stringify({ id: d.id, ...(d.data() as object) }),
          ]).size;
        });
      };

      measure(workersSnap);
      measure(attendanceSnap);
      measure(advancesSnap);
      measure(sitesSnap);

      for (const siteDoc of sitesSnap.docs) {
        const txSnap = await getDocs(collection(siteDoc.ref, 'transactions'));
        transactions += txSnap.size;
        measure(txSnap);
      }

      let activeWorkers = 0;
      let inactiveWorkers = 0;
      workersSnap.forEach((d) => {
        const w = d.data() as { active?: boolean };
        if (w.active === false) inactiveWorkers++;
        else activeWorkers++;
      });

      setCounts({
        workers: {
          total: workersSnap.size,
          active: activeWorkers,
          inactive: inactiveWorkers,
        },
        attendance: attendanceSnap.size,
        advances: advancesSnap.size,
        sites: sitesSnap.size,
        transactions,
      });
      setStorageBytes(bytes);
      setLastChecked(Date.now());
    } catch (err) {
      console.error('System health refresh error:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { counts, storageBytes, loading, error, lastChecked, refresh };
}

export function formatBytes(bytes: number): string {
  if (!isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : value >= 10 ? 1 : 2)} ${units[i]}`;
}