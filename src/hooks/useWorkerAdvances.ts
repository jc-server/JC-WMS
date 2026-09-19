import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

export type WorkerAdvance = {
  id: string;
  amount: number;
  date: string;
  reason: string | null;
  createdAt: number;
};

// Advances are GLOBAL. Worker filter is client-side.
// Path: users/{uid}/advances/{advanceId}
export function useWorkerAdvances(workerId: string | null, monthStr: string) {
  const { user } = useAuth();
  const [advances, setAdvances] = useState<WorkerAdvance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !workerId) {
      setAdvances([]);
      setLoading(false);
      return;
    }

    const [year, month] = monthStr.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    // Range-only query → no composite index required.
    const q = query(
      collection(db, 'users', user.uid, 'advances'),
      where('date', '>=', startStr),
      where('date', '<=', endStr)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: WorkerAdvance[] = [];
        snap.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          if (data.workerId !== workerId) return;
          list.push({
            id: d.id,
            amount: Number(data.amount ?? 0),
            date: data.date as string,
            reason: (data.reason as string) ?? null,
            createdAt: Number(data.createdAt ?? 0),
          });
        });
        list.sort((a, b) => {
          const dateCmp = b.date.localeCompare(a.date);
          if (dateCmp !== 0) return dateCmp;
          return b.createdAt - a.createdAt;
        });
        setAdvances(list);
        setLoading(false);
      },
      (err) => {
        console.error('Worker advances listener error:', err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user, workerId, monthStr]);

  const addAdvance = useCallback(
    async (amount: number, date: string, reason: string | null) => {
      if (!user || !workerId) return;
      await addDoc(collection(db, 'users', user.uid, 'advances'), {
        workerId,
        amount,
        date,
        reason,
        createdAt: Date.now(),
      });
    },
    [user, workerId]
  );

  const deleteAdvance = useCallback(
    async (advanceId: string) => {
      if (!user) return;
      await deleteDoc(doc(db, 'users', user.uid, 'advances', advanceId));
    },
    [user]
  );

  return { advances, loading, addAdvance, deleteAdvance };
}