import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

// Frozen so a consumer that accidentally calls .push()/.splice() on the
// exported default (or a state value that still points at it) can't
// mutate the defaults for every future user.
export const DEFAULT_CONTRACTOR_TRADES: readonly string[] = Object.freeze([
  'Lohar',
  'Electrician',
  'Plumber',
  'Carpenter',
  'Painter',
  'Mason',
  'Welder',
  'Tiles',
  'Other',
]);

// Fresh mutable copy so the state value is never the frozen module-level
// reference (which React/consumers may mutate).
const cloneDefaults = (): string[] => [...DEFAULT_CONTRACTOR_TRADES];

export type AddTradeResult =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'duplicate' | 'write-failed' | 'no-user' };

export type RemoveTradeResult =
  | { ok: true }
  | { ok: false; reason: 'not-found' | 'write-failed' | 'no-user' };

export function useContractorTrades() {
  const { user } = useAuth();
  const [trades, setTrades] = useState<string[]>(cloneDefaults);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const tradesRef = useRef<string[]>(cloneDefaults());
  // Counter instead of a boolean: with a boolean, an add-finishing-while-a-
  // remove-is-in-flight would flip `isSaving` false while the remove is
  // still running. Counter keeps it true until all writes settle.
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
      tradesRef.current = cloneDefaults();
      setTrades(cloneDefaults());
      setLoading(false);
      return;
    }

    const ref = doc(db, 'users', user.uid, 'settings', 'contractorTrades');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const list = data.trades as string[] | undefined;
          const next = list && list.length > 0 ? [...list] : cloneDefaults();
          tradesRef.current = next;
          setTrades(next);
        } else {
          tradesRef.current = cloneDefaults();
          setTrades(cloneDefaults());
        }
        setLoading(false);
      },
      (err) => {
        console.error('Contractor trades listener error:', err.message);
        tradesRef.current = cloneDefaults();
        setTrades(cloneDefaults());
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const addTrade = useCallback(
    async (trade: string): Promise<AddTradeResult> => {
      if (!user) return { ok: false, reason: 'no-user' };
      const trimmed = trade.trim();
      if (!trimmed) return { ok: false, reason: 'empty' };

      const lower = trimmed.toLowerCase();
      if (tradesRef.current.some((t) => t.toLowerCase() === lower)) {
        return { ok: false, reason: 'duplicate' };
      }

      const prev = tradesRef.current;
      const optimistic = [...prev, trimmed];
      tradesRef.current = optimistic;
      setTrades(optimistic);
      beginWrite();

      try {
        const ref = doc(db, 'users', user.uid, 'settings', 'contractorTrades');
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          const current =
            (snap.data()?.trades as string[] | undefined) ?? cloneDefaults();
          if (current.some((t) => t.toLowerCase() === lower)) {
            throw new Error('duplicate');
          }
          tx.set(
            ref,
            { trades: [...current, trimmed], updatedAt: serverTimestamp() },
            { merge: true }
          );
        });
        return { ok: true };
      } catch (err) {
        console.error('Failed to add trade:', err);
        tradesRef.current = prev;
        setTrades(prev);
        const message = err instanceof Error ? err.message : '';
        return { ok: false, reason: message === 'duplicate' ? 'duplicate' : 'write-failed' };
      } finally {
        endWrite();
      }
    },
    [user, beginWrite, endWrite]
  );

  const removeTrade = useCallback(
    async (trade: string): Promise<RemoveTradeResult> => {
      if (!user) return { ok: false, reason: 'no-user' };
      if (!tradesRef.current.includes(trade)) return { ok: false, reason: 'not-found' };

      const prev = tradesRef.current;
      const optimistic = prev.filter((t) => t !== trade);
      tradesRef.current = optimistic;
      setTrades(optimistic);
      beginWrite();

      try {
        const ref = doc(db, 'users', user.uid, 'settings', 'contractorTrades');
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          const current =
            (snap.data()?.trades as string[] | undefined) ?? cloneDefaults();
          tx.set(
            ref,
            { trades: current.filter((t) => t !== trade), updatedAt: serverTimestamp() },
            { merge: true }
          );
        });
        return { ok: true };
      } catch (err) {
        console.error('Failed to remove trade:', err);
        tradesRef.current = prev;
        setTrades(prev);
        return { ok: false, reason: 'write-failed' };
      } finally {
        endWrite();
      }
    },
    [user, beginWrite, endWrite]
  );

  return { trades, loading, isSaving, addTrade, removeTrade };
}