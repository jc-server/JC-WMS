import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

export const DEFAULT_MATERIAL_TYPES = ['Brick', 'Sand', 'Aggregate', 'Cement', 'Steel', 'Stone', 'Other'];

export function useMaterialTypes() {
  const { user } = useAuth();
  const [types, setTypes] = useState<string[]>(DEFAULT_MATERIAL_TYPES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTypes(DEFAULT_MATERIAL_TYPES);
      setLoading(false);
      return;
    }

    const ref = doc(db, 'users', user.uid, 'settings', 'materialTypes');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const list = data.types as string[] | undefined;
          setTypes(list && list.length > 0 ? list : DEFAULT_MATERIAL_TYPES);
        } else {
          setTypes(DEFAULT_MATERIAL_TYPES);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Material types listener error:', err.message);
        setTypes(DEFAULT_MATERIAL_TYPES);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const saveTypes = useCallback(
    async (newTypes: string[]) => {
      if (!user) return;
      const ref = doc(db, 'users', user.uid, 'settings', 'materialTypes');
      await setDoc(ref, { types: newTypes, updatedAt: Date.now() }, { merge: true });
    },
    [user]
  );

  const addType = useCallback(
    async (type: string) => {
      const trimmed = type.trim();
      if (!trimmed) return;
      const lower = trimmed.toLowerCase();
      if (types.some((t) => t.toLowerCase() === lower)) return;
      const next = [...types, trimmed];
      setTypes(next);
      await saveTypes(next);
    },
    [types, saveTypes]
  );

  const removeType = useCallback(
    async (type: string) => {
      const next = types.filter((t) => t !== type);
      setTypes(next);
      await saveTypes(next);
    },
    [types, saveTypes]
  );

  return { types, loading, addType, removeType };
}