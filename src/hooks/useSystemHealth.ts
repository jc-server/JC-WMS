import { useState, useCallback, useEffect } from 'react';
import {
  collection,
  getCountFromServer,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

export type SystemCounts = {
  workers: { total: number; active: number; inactive: number };
  attendance: number;
  advances: number;
  sites: number;
  transactions: number;
  totalDocs: number;
  materials: {
    suppliers: number;
    deliveries: number;
    trucks: number;
    commissions: number;
    pendingCommissions: number;
    supplierPayments: number;
  };
};

export type SystemHealthState = {
  counts: SystemCounts | null;
  loading: boolean;
  error: string | null;
  lastChecked: number | null;
  refresh: () => Promise<void>;
};

/**
 * Uses Firestore aggregation queries (`getCountFromServer`) so refreshing
 * costs O(1) reads per collection regardless of document count, instead of
 * O(n). Derived metrics that require summing/scanning fields (truck counts,
 * pending commissions) are only read from the two small collections that
 * need them — `deliveries` and `commissions`.
 */
export function useSystemHealth(): SystemHealthState {
  const { user } = useAuth();
  const [counts, setCounts] = useState<SystemCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setCounts(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const uid = user.uid;

      // ── Phase 1: parallel fast counts + small-collection reads ──
      const [
        workersTotalRes,
        workersInactiveRes,
        attendanceRes,
        advancesRes,
        sitesRes,
        suppliersRes,
        deliveriesRes,
        commissionsRes,
        paymentsRes,
        deliveriesSnap,
        commissionsSnap,
        sitesSnap,
      ] = await Promise.all([
        getCountFromServer(collection(db, 'users', uid, 'workers')),
        getCountFromServer(
          query(
            collection(db, 'users', uid, 'workers'),
            where('active', '==', false)
          )
        ),
        getCountFromServer(collection(db, 'users', uid, 'attendance')),
        getCountFromServer(collection(db, 'users', uid, 'advances')),
        getCountFromServer(collection(db, 'users', uid, 'sites')),
        getCountFromServer(collection(db, 'users', uid, 'suppliers')),
        getCountFromServer(collection(db, 'users', uid, 'deliveries')),
        getCountFromServer(collection(db, 'users', uid, 'commissions')),
        getCountFromServer(collection(db, 'users', uid, 'supplierPayments')),
        // These two collections are small but need derived metrics.
        getDocs(collection(db, 'users', uid, 'deliveries')),
        getDocs(collection(db, 'users', uid, 'commissions')),
        // We need to enumerate sites to count their transactions.
        getDocs(collection(db, 'users', uid, 'sites')),
      ]);

      // ── Phase 2: per-site transaction counts (parallel) ──
      const txCounts = await Promise.all(
        sitesSnap.docs.map((siteDoc) =>
          getCountFromServer(
            collection(db, 'users', uid, 'sites', siteDoc.id, 'transactions')
          )
        )
      );
      const transactions = txCounts.reduce((sum, c) => sum + c.data().count, 0);

      // ── Derived metrics ──
      let trucks = 0;
      deliveriesSnap.forEach((d) => {
        const data = d.data() as { truckCount?: number };
        trucks += Number(data.truckCount ?? 0);
      });

      let pendingCommissions = 0;
      commissionsSnap.forEach((d) => {
        const data = d.data() as { status?: string };
        if (data.status !== 'received') pendingCommissions++;
      });

      const totalWorkers = workersTotalRes.data().count;
      const inactiveWorkers = workersInactiveRes.data().count;
      const activeWorkers = totalWorkers - inactiveWorkers;

      const attendance = attendanceRes.data().count;
      const advances = advancesRes.data().count;
      const sites = sitesRes.data().count;
      const suppliers = suppliersRes.data().count;
      const deliveries = deliveriesRes.data().count;
      const commissions = commissionsRes.data().count;
      const supplierPayments = paymentsRes.data().count;

      const totalDocs =
        totalWorkers +
        attendance +
        advances +
        sites +
        transactions +
        suppliers +
        deliveries +
        commissions +
        supplierPayments;

      setCounts({
        workers: {
          total: totalWorkers,
          active: activeWorkers,
          inactive: inactiveWorkers,
        },
        attendance,
        advances,
        sites,
        transactions,
        totalDocs,
        materials: {
          suppliers,
          deliveries,
          trucks,
          commissions,
          pendingCommissions,
          supplierPayments,
        },
      });
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

  return { counts, loading, error, lastChecked, refresh };
}