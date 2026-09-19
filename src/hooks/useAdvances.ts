import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  getDocs,
  addDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

export type Advance = {
  id: string;
  workerId: string;
  amount: number;
  date: string;
  reason: string | null;
  createdAt: number;
};

// Advances are GLOBAL — not site-scoped.
// Path: users/{uid}/advances/{advanceId}
function advancesPath(user: string) {
  return collection(db, 'users', user, 'advances');
}

export function useAdvances() {
  const { user } = useAuth();
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAdvances([]);
      setLoading(false);
      return;
    }

    const q = query(advancesPath(user.uid), orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Advance[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            workerId: data.workerId as string,
            amount: Number(data.amount ?? 0),
            date: data.date as string,
            reason: (data.reason as string) ?? null,
            createdAt: Number(data.createdAt ?? 0),
          };
        });
        setAdvances(list);
        setLoading(false);
      },
      (err) => {
        console.error('Advances listener error:', err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const addAdvance = useCallback(
    async (data: {
      workerId: string;
      amount: number;
      date: string;
      reason: string | null;
    }) => {
      if (!user) return;
      await addDoc(advancesPath(user.uid), {
        ...data,
        createdAt: Date.now(),
      });
    },
    [user]
  );

  const getAdvancesForMonth = useCallback(
    (monthStr: string) => {
      const [year, month] = monthStr.split('-').map(Number);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      const startStr = start.toISOString().slice(0, 10);
      const endStr = end.toISOString().slice(0, 10);
      return advances.filter((a) => a.date >= startStr && a.date <= endStr);
    },
    [advances]
  );

  const getAdvancesForWorker = useCallback(
    (workerId: string) => advances.filter((a) => a.workerId === workerId),
    [advances]
  );

  return {
    advances,
    loading,
    addAdvance,
    getAdvancesForMonth,
    getAdvancesForWorker,
  };
}

// Kept as a named export to satisfy any lingering imports in older code.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export { getDocs };