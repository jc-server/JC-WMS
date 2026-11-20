import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

// Frozen so accidental .push()/.splice() by a consumer can't mutate the
// defaults for every future user.
export const DEFAULT_MATERIAL_TYPES: readonly string[] = Object.freeze([
  'Brick',
  'Sand',
  'Aggregate',
  'Cement',
  'Steel',
  'Stone',
  'Other',
]);

const cloneDefaults = (): string[] => [...DEFAULT_MATERIAL_TYPES];

export type AddTypeResult =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'duplicate' | 'write-failed' | 'no-user' };

export type RemoveTypeResult =
  | { ok: true }
  | { ok: false; reason: 'not-found' | 'write-failed' | 'no-user' };

export function useMaterialTypes() {
  const { user } = useAuth();
  const [types, setTypes] = useState<string[]>(cloneDefaults);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const typesRef = useRef<string[]>(cloneDefaults());
  const inFlightRef = useRef(0);

  const beginWrite = useCallback(() => {
    inFlightRef.current += 1;
    setIsSaving(true);
  }, []);

  const endWrite = useCallback(() => {
    inFlightRef.current = Math.max(0, inFlightRef.current - 1);
    if (inFlightRef.current === 0) setIsSaving(false);
  }, []);

  useEffect(() => {
    if (!user) {
      typesRef.current = cloneDefaults();
      setTypes(cloneDefaults());
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
          const next = list && list.length > 0 ? [...list] : cloneDefaults();
          typesRef.current = next;
          setTypes(next);
        } else {
          typesRef.current = cloneDefaults();
          setTypes(cloneDefaults());
        }
        setLoading(false);
      },
      (err) => {
        console.error('Material types listener error:', err.message);
        typesRef.current = cloneDefaults();
        setTypes(cloneDefaults());
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const addType = useCallback(
    async (type: string): Promise<AddTypeResult> => {
      if (!user) return { ok: false, reason: 'no-user' };
      const trimmed = type.trim();
      if (!trimmed) return { ok: false, reason: 'empty' };

      const lower = trimmed.toLowerCase();
      if (typesRef.current.some((t) => t.toLowerCase() === lower)) {
        return { ok: false, reason: 'duplicate' };
      }

      const prev = typesRef.current;
      const optimistic = [...prev, trimmed];
      typesRef.current = optimistic;
      setTypes(optimistic);
      beginWrite();

      try {
        const ref = doc(db, 'users', user.uid, 'settings', 'materialTypes');
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          const current =
            (snap.data()?.types as string[] | undefined) ?? cloneDefaults();
          if (current.some((t) => t.toLowerCase() === lower)) {
            throw new Error('duplicate');
          }
          tx.set(
            ref,
            { types: [...current, trimmed], updatedAt: serverTimestamp() },
            { merge: true }
          );
        });
        return { ok: true };
      } catch (err) {
        console.error('Failed to add material type:', err);
        typesRef.current = prev;
        setTypes(prev);
        const message = err instanceof Error ? err.message : '';
        return { ok: false, reason: message === 'duplicate' ? 'duplicate' : 'write-failed' };
      } finally {
        endWrite();
      }
    },
    [user, beginWrite, endWrite]
  );

  const removeType = useCallback(
    async (type: string): Promise<RemoveTypeResult> => {
      if (!user) return { ok: false, reason: 'no-user' };
      if (!typesRef.current.includes(type)) return { ok: false, reason: 'not-found' };

      const prev = typesRef.current;
      const optimistic = prev.filter((t) => t !== type);
      typesRef.current = optimistic;
      setTypes(optimistic);
      beginWrite();

      try {
        const ref = doc(db, 'users', user.uid, 'settings', 'materialTypes');
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          const current =
            (snap.data()?.types as string[] | undefined) ?? cloneDefaults();
          tx.set(
            ref,
            { types: current.filter((t) => t !== type), updatedAt: serverTimestamp() },
            { merge: true }
          );
        });
        return { ok: true };
      } catch (err) {
        console.error('Failed to remove material type:', err);
        typesRef.current = prev;
        setTypes(prev);
        return { ok: false, reason: 'write-failed' };
      } finally {
        endWrite();
      }
    },
    [user, beginWrite, endWrite]
  );

  return { types, loading, isSaving, addType, removeType };
}