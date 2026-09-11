import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

export type Site = {
  id: string;
  name: string;
  createdAt: number;
};

export function useSites() {
  const { user } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSites([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'users', user.uid, 'sites'),
      orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Site[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            name: data.name as string,
            createdAt: Number(data.createdAt ?? 0),
          };
        });
        setSites(list);
        setLoading(false);
      },
      (err) => {
        console.error('Sites listener error:', err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const addSite = useCallback(
    async (name: string) => {
      if (!user) return;
      await addDoc(collection(db, 'users', user.uid, 'sites'), {
        name,
        createdAt: Date.now(),
      });
    },
    [user]
  );

  const deleteSite = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteDoc(doc(db, 'users', user.uid, 'sites', id));
    },
    [user]
  );

  return { sites, loading, addSite, deleteSite };
}
