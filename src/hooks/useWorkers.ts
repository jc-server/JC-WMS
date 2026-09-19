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

// Workers are GLOBAL — not site-scoped.
// Path: users/{uid}/workers/{workerId}
function workersPath(user: string) {
  return collection(db, 'users', user, 'workers');
}

export function useWorkers() {
  const { user } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setWorkers([]);
      setLoading(false);
      return;
    }

    const q = query(workersPath(user.uid), orderBy('createdAt', 'asc'));

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
  }, [user]);

  const addWorker = useCallback(
    async (data: {
      name: string;
      phone: string | null;
      role: string;
      dailyWage: number;
      overtimeHourlyRate: number;
    }) => {
      if (!user) return;
      await addDoc(workersPath(user.uid), {
        ...data,
        active: true,
        createdAt: Date.now(),
      });
    },
    [user]
  );

  const updateWorker = useCallback(
    async (
      id: string,
      data: {
        name?: string;
        phone?: string | null;
        role?: string;
        dailyWage?: number;
        overtimeHourlyRate?: number;
        active?: boolean;
      }
    ) => {
      if (!user) return;
      await updateDoc(doc(db, 'users', user.uid, 'workers', id), data);
    },
    [user]
  );

  const deleteWorker = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteDoc(doc(db, 'users', user.uid, 'workers', id));
    },
    [user]
  );

  return { workers, loading, addWorker, updateWorker, deleteWorker };
}