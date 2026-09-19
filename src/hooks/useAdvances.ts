import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { monthRange } from '@/utils/date';

export type Advance = {
  id: string;
  workerId: string;
  amount: number;
  date: string;
  reason: string | null;
  createdAt: number;
};

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
      const { start, end } = monthRange(monthStr);
      return advances.filter((a) => a.date >= start && a.date <= end);
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