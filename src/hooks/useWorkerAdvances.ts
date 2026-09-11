import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
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

export function useWorkerAdvances(siteId: string | null, workerId: string | null, monthStr: string) {
  const { user } = useAuth();
  const [advances, setAdvances] = useState<WorkerAdvance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !siteId || !workerId) {
      setAdvances([]);
      setLoading(false);
      return;
    }

    const [year, month] = monthStr.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const q = query(
      collection(db, 'users', user.uid, 'sites', siteId, 'advances'),
      where('workerId', '==', workerId),
      where('date', '>=', startStr),
      where('date', '<=', endStr),
      orderBy('date', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: WorkerAdvance[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
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
        console.error('Worker advances listener error:', err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user, siteId, workerId, monthStr]);

  const addAdvance = useCallback(
    async (amount: number, date: string, reason: string | null) => {
      if (!user || !siteId || !workerId) return;
      await addDoc(collection(db, 'users', user.uid, 'sites', siteId, 'advances'), {
        workerId,
        amount,
        date,
        reason,
        createdAt: Date.now(),
      });
    },
    [user, siteId, workerId]
  );

  const deleteAdvance = useCallback(
    async (advanceId: string) => {
      if (!user || !siteId) return;
      await deleteDoc(doc(db, 'users', user.uid, 'sites', siteId, 'advances', advanceId));
    },
    [user, siteId]
  );

  return { advances, loading, addAdvance, deleteAdvance };
}
