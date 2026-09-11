import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

export type Worker = {
  id: string;
  name: string;
  phone: string | null;
  role: string;
  dailyWage: number;
  overtimeHourlyRate: number;
  active: boolean;
  createdAt: number;
};

export function useWorkers(siteId: string | null) {
  const { user } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !siteId) {
      setWorkers([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'users', user.uid, 'sites', siteId, 'workers'),
      orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Worker[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            name: data.name as string,
            phone: (data.phone as string) ?? null,
            role: (data.role as string) ?? 'Worker',
            dailyWage: Number(data.dailyWage ?? 0),
            overtimeHourlyRate: Number(data.overtimeHourlyRate ?? 0),
            active: data.active !== false,
            createdAt: Number(data.createdAt ?? 0),
          };
        });
        setWorkers(list);
        setLoading(false);
      },
      (err) => {
        console.error('Workers listener error:', err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user, siteId]);

  const addWorker = useCallback(
    async (data: { name: string; phone: string | null; role: string; dailyWage: number; overtimeHourlyRate: number }) => {
      if (!user || !siteId) return;
      await addDoc(collection(db, 'users', user.uid, 'sites', siteId, 'workers'), {
        ...data,
        active: true,
        createdAt: Date.now(),
      });
    },
    [user, siteId]
  );

  const updateWorker = useCallback(
    async (id: string, data: { name?: string; phone?: string | null; role?: string; dailyWage?: number; overtimeHourlyRate?: number; active?: boolean }) => {
      if (!user || !siteId) return;
      await updateDoc(doc(db, 'users', user.uid, 'sites', siteId, 'workers', id), data);
    },
    [user, siteId]
  );

  const deleteWorker = useCallback(
    async (id: string) => {
      if (!user || !siteId) return;
      await deleteDoc(doc(db, 'users', user.uid, 'sites', siteId, 'workers', id));
    },
    [user, siteId]
  );

  return { workers, loading, addWorker, updateWorker, deleteWorker };
}
