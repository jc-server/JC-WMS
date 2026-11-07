import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

export const DEFAULT_CONTRACTOR_TRADES = [
  'Lohar', 'Electrician', 'Plumber', 'Carpenter', 'Painter', 'Mason', 'Welder', 'Tiles', 'Other'
];

export function useContractorTrades() {
  const { user } = useAuth();
  const [trades, setTrades] = useState<string[]>(DEFAULT_CONTRACTOR_TRADES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTrades(DEFAULT_CONTRACTOR_TRADES);
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
          setTrades(list && list.length > 0 ? list : DEFAULT_CONTRACTOR_TRADES);
        } else {
          setTrades(DEFAULT_CONTRACTOR_TRADES);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Contractor trades listener error:', err.message);
        setTrades(DEFAULT_CONTRACTOR_TRADES);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const saveTrades = useCallback(
    async (newTrades: string[]) => {
      if (!user) return;
      const ref = doc(db, 'users', user.uid, 'settings', 'contractorTrades');
      await setDoc(ref, { trades: newTrades, updatedAt: Date.now() }, { merge: true });
    },
    [user]
  );

  const addTrade = useCallback(
    async (trade: string) => {
      const trimmed = trade.trim();
      if (!trimmed) return;
      const lower = trimmed.toLowerCase();
      if (trades.some((t) => t.toLowerCase() === lower)) return;
      const next = [...trades, trimmed];
      setTrades(next);
      await saveTrades(next);
    },
    [trades, saveTrades]
  );

  const removeTrade = useCallback(
    async (trade: string) => {
      const next = trades.filter((t) => t !== trade);
      setTrades(next);
      await saveTrades(next);
    },
    [trades, saveTrades]
  );

  return { trades, loading, addTrade, removeTrade };
}