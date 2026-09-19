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

export type TransactionType = 'credit' | 'debit';
export type PaymentMode = 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque';

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  date: string; // YYYY-MM-DD
  category: string;
  paymentMode: PaymentMode;
  remark: string;
  createdAt: number;
};

export type TransactionInput = Omit<Transaction, 'id' | 'createdAt'>;

export const CREDIT_CATEGORIES = ['Advance', 'Running Bill', 'Final Settlement'] as const;
export const DEBIT_CATEGORIES = [
  'Cement',
  'Steel',
  'Sand/Aggregate',
  'Bricks',
  'Transport',
  'Machinery',
  'Food/Misc',
] as const;
export const PAYMENT_MODES: PaymentMode[] = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'];

function siteTxPath(user: string, siteId: string) {
  return collection(db, 'users', user, 'sites', siteId, 'transactions');
}

export function useTransactions(siteId: string | null) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !siteId) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    const q = query(
      siteTxPath(user.uid, siteId),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Transaction[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            type: (data.type as TransactionType) ?? 'debit',
            amount: Number(data.amount ?? 0),
            date: (data.date as string) ?? '',
            category: (data.category as string) ?? '',
            paymentMode: (data.paymentMode as PaymentMode) ?? 'Cash',
            remark: (data.remark as string) ?? '',
            createdAt: Number(data.createdAt ?? 0),
          };
        });
        setTransactions(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Transactions listener error:', err.message);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user, siteId]);

  const addTransaction = useCallback(
    async (input: TransactionInput) => {
      if (!user || !siteId) throw new Error('No active site selected.');
      try {
        await addDoc(siteTxPath(user.uid, siteId), {
          ...input,
          createdAt: Date.now(),
        });
      } catch (err) {
        console.error('addTransaction error:', err);
        throw new Error('Could not save transaction. Please check your connection and try again.');
      }
    },
    [user, siteId]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      if (!user || !siteId) throw new Error('No active site selected.');
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'sites', siteId, 'transactions', id));
      } catch (err) {
        console.error('deleteTransaction error:', err);
        throw new Error('Could not delete transaction. Please try again.');
      }
    },
    [user, siteId]
  );

  return { transactions, loading, error, addTransaction, deleteTransaction };
}