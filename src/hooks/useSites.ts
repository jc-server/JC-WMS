import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

export type SiteStatus = 'Active' | 'Completed';

export type Site = {
  id: string;
  name: string;
  clientName: string;
  clientPhone: string;
  startDate: string; // YYYY-MM-DD
  status: SiteStatus;
  createdAt: number;
};

export type SiteInput = {
  name: string;
  clientName: string;
  clientPhone: string;
  startDate: string;
  status: SiteStatus;
};

export function useSites() {
  const { user } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            name: (data.name as string) ?? 'Untitled Site',
            clientName: (data.clientName as string) ?? '',
            clientPhone: (data.clientPhone as string) ?? '',
            startDate: (data.startDate as string) ?? '',
            status: (data.status as SiteStatus) ?? 'Active',
            createdAt: Number(data.createdAt ?? 0),
          };
        });
        setSites(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Sites listener error:', err.message);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const addSite = useCallback(
    async (input: SiteInput) => {
      if (!user) throw new Error('Not signed in.');
      try {
        await addDoc(collection(db, 'users', user.uid, 'sites'), {
          ...input,
          createdAt: Date.now(),
        });
      } catch (err) {
        console.error('addSite error:', err);
        throw new Error('Could not add site. Please check your connection and try again.');
      }
    },
    [user]
  );

  const updateSite = useCallback(
    async (id: string, updates: Partial<SiteInput>) => {
      if (!user) throw new Error('Not signed in.');
      try {
        await updateDoc(doc(db, 'users', user.uid, 'sites', id), updates);
      } catch (err) {
        console.error('updateSite error:', err);
        throw new Error('Could not update site. Please try again.');
      }
    },
    [user]
  );

  const deleteSite = useCallback(
    async (id: string) => {
      if (!user) throw new Error('Not signed in.');
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'sites', id));
      } catch (err) {
        console.error('deleteSite error:', err);
        throw new Error('Could not delete site. Please try again.');
      }
    },
    [user]
  );

  return { sites, loading, error, addSite, updateSite, deleteSite };
}