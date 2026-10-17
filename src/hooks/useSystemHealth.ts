import { useState, useCallback, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { roundCurrency } from '@/utils/calculations';

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
  contractors: {
    total: number;
    active: number;
    payments: number;
    totalPaid: number;
  };
};

export type SystemHealthState = {
  counts: SystemCounts | null;
  storageBytes: number;
  storageComputedAt: number | null;
  loading: boolean;
  error: string | null;
  lastChecked: number | null;
  refresh: () => Promise<void>;
};

/**
 * Storage size is measured by reading every document under the user's tree
 * and summing the byte length of each JSON-serialized record. This is the
 * only client-side way to get an accurate figure — Firestore does not expose
 * per-document byte sizes through the SDK.
 *
 * To avoid re-reading everything on every mount, the result is cached in
 * `localStorage` for one hour. The Refresh button always recomputes fresh.
 */
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

type CachedHealth = {
  counts: SystemCounts;
  bytes: number;
  at: number;
};

function cacheKey(uid: string) {
  return `jcwms-health-${uid}`;
}

export function useSystemHealth(): SystemHealthState {
  const { user } = useAuth();
  const [counts, setCounts] = useState<SystemCounts | null>(null);
  const [storageBytes, setStorageBytes] = useState(0);
  const [storageComputedAt, setStorageComputedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setCounts(null);
      setStorageBytes(0);
      setStorageComputedAt(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const uid = user.uid;

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
      measure(suppliersSnap);
      measure(deliveriesSnap);
      measure(commissionsSnap);
      measure(supplierPaymentsSnap);
      measure(contractorsSnap);
      measure(contractorPaymentsSnap);

      // Count transactions under each site and measure their bytes too.
      let transactions = 0;
      for (const siteDoc of sitesSnap.docs) {
        const txSnap = await getDocs(collection(siteDoc.ref, 'transactions'));
        transactions += txSnap.size;
        measure(txSnap);
      }

      // Worker active / inactive split.
      let activeWorkers = 0;
      let inactiveWorkers = 0;
      workersSnap.forEach((d) => {
        const w = d.data() as { active?: boolean };
        if (w.active === false) inactiveWorkers++;
        else activeWorkers++;
      });

      // Material ledger derived metrics.
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

      // Contractor derived metrics.
      let activeContractors = 0;
      contractorsSnap.forEach((d) => {
        const c = d.data() as { active?: boolean };
        if (c.active !== false) activeContractors++;
      });

      let totalPaidToContractors = 0;
      contractorPaymentsSnap.forEach((d) => {
        const p = d.data() as { amount?: number };
        totalPaidToContractors += Number(p.amount ?? 0);
      });

      const nextCounts: SystemCounts = {
        workers: {
          total: workersSnap.size,
          active: activeWorkers,
          inactive: inactiveWorkers,
        },
        attendance: attendanceSnap.size,
        advances: advancesSnap.size,
        sites: sitesSnap.size,
        transactions,
        totalDocs:
          workersSnap.size +
          attendanceSnap.size +
          advancesSnap.size +
          sitesSnap.size +
          transactions +
          suppliersSnap.size +
          deliveriesSnap.size +
          commissionsSnap.size +
          supplierPaymentsSnap.size +
          contractorsSnap.size +
          contractorPaymentsSnap.size,
        materials: {
          suppliers: suppliersSnap.size,
          deliveries: deliveriesSnap.size,
          trucks,
          commissions: commissionsSnap.size,
          pendingCommissions,
          supplierPayments: supplierPaymentsSnap.size,
        },
        contractors: {
          total: contractorsSnap.size,
          active: activeContractors,
          payments: contractorPaymentsSnap.size,
          totalPaid: roundCurrency(totalPaidToContractors),
        },
      };

      const now = Date.now();
      setCounts(nextCounts);
      setStorageBytes(bytes);
      setStorageComputedAt(now);
      setLastChecked(now);

      // Cache for next mount.
      try {
        const payload: CachedHealth = {
          counts: nextCounts,
          bytes,
          at: now,
        };
        localStorage.setItem(cacheKey(uid), JSON.stringify(payload));
      } catch {
        /* storage full or blocked — ignore */
      }
    } catch (err) {
      console.error('System health refresh error:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // On mount (or when user changes), use cache if it's still fresh.
  useEffect(() => {
    if (!user) {
      setCounts(null);
      setStorageBytes(0);
      setStorageComputedAt(null);
      setLoading(false);
      return;
    }

    let hydrated = false;
    try {
      const raw = localStorage.getItem(cacheKey(user.uid));
      if (raw) {
        const parsed = JSON.parse(raw) as CachedHealth;
        if (
          parsed &&
          typeof parsed.at === 'number' &&
          Date.now() - parsed.at < CACHE_TTL_MS &&
          parsed.counts
        ) {
          setCounts(parsed.counts);
          setStorageBytes(parsed.bytes);
          setStorageComputedAt(parsed.at);
          setLastChecked(parsed.at);
          setLoading(false);
          hydrated = true;
        }
      }
    } catch {
      /* ignore parse errors */
    }

    if (!hydrated) {
      refresh();
    }
  }, [user, refresh]);

  return {
    counts,
    storageBytes,
    storageComputedAt,
    loading,
    error,
    lastChecked,
    refresh,
  };
}

export function formatBytes(bytes: number): string {
  if (!isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : value >= 10 ? 1 : 2)} ${units[i]}`;
}