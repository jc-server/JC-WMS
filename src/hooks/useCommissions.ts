import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

export type CommissionStatus = 'pending' | 'partial' | 'received';

export type Commission = {
  id: string;
  supplierId: string;
  date: string;
  materialType: string;
  quantity: number;
  unit: string;
  ratePerUnit: number;
  amount: number;
  remark: string;
  siteId?: string | null;
  status: CommissionStatus;
  receivedAmount: number;
  receivedDate: string | null;
  createdAt: number;
  updatedAt: number;
};

export type CommissionInput = Omit<
  Commission,
  'id' | 'status' | 'receivedAmount' | 'receivedDate' | 'createdAt' | 'updatedAt'
>;

export function useCommissions() {
  const { user } = useAuth();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setCommissions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = collection(db, 'users', user.uid, 'commissions');
    const q = query(ref, orderBy('date', 'desc'));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Commission[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            supplierId: (data.supplierId as string) ?? '',
            date: (data.date as string) ?? '',
            materialType: (data.materialType as string) ?? '',
            quantity: (data.quantity as number) ?? 0,
            unit: (data.unit as string) ?? '',
            ratePerUnit: (data.ratePerUnit as number) ?? 0,
            amount: (data.amount as number) ?? 0,
            remark: (data.remark as string) ?? '',
            siteId: (data.siteId as string | null | undefined) ?? null,
            status: (data.status as CommissionStatus) ?? 'pending',
            receivedAmount: (data.receivedAmount as number) ?? 0,
            receivedDate: (data.receivedDate as string | null) ?? null,
            createdAt: (data.createdAt as number) ?? 0,
            updatedAt: (data.updatedAt as number) ?? 0,
          };
        });
        setCommissions(list);
        setLoading(false);
      },
      (err) => {
        console.error('Commissions listener error:', err.message);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const addCommission = useCallback(
    async (input: CommissionInput): Promise<void> => {
      if (!user) throw new Error('Not authenticated');
      const ref = collection(db, 'users', user.uid, 'commissions');
      const now = Date.now();
      await addDoc(ref, {
        ...input,
        siteId: input.siteId ?? null,
        status: 'pending',
        receivedAmount: 0,
        receivedDate: null,
        createdAt: now,
        updatedAt: now,
      });
    },
    [user]
  );

  const updateCommission = useCallback(
    async (id: string, input: CommissionInput): Promise<void> => {
      if (!user) throw new Error('Not authenticated');
      const ref = doc(db, 'users', user.uid, 'commissions', id);
      
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Commission not found');
        
        const current = snap.data();
        const received = Number(current.receivedAmount) || 0;
        
        // Recalculate status if the new amount is lower than what's already been paid
        let status: CommissionStatus = 'pending';
        if (received >= input.amount && input.amount > 0) status = 'received';
        else if (received > 0) status = 'partial';

        tx.update(ref, {
          ...input,
          siteId: input.siteId ?? null,
          status,
          updatedAt: Date.now(),
        });
      });
    },
    [user]
  );

  const recordReceipt = useCallback(
    async (id: string, amount: number, date: string): Promise<void> => {
      if (!user) throw new Error('Not authenticated');
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Receipt amount must be positive.');
      
      const ref = doc(db, 'users', user.uid, 'commissions', id);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Commission not found.');
        const data = snap.data();
        const total = Number(data.amount) || 0;
        const current = Number(data.receivedAmount) || 0;
        const next = current + amount;
        
        tx.update(ref, {
          receivedAmount: next,
          receivedDate: date,
          status: next >= total ? 'received' : 'partial',
          updatedAt: Date.now(),
        });
      });
    },
    [user]
  );

  const resetReceipt = useCallback(
    async (id: string): Promise<void> => {
      if (!user) throw new Error('Not authenticated');
      const ref = doc(db, 'users', user.uid, 'commissions', id);
      await updateDoc(ref, {
        receivedAmount: 0,
        receivedDate: null,
        status: 'pending',
        updatedAt: Date.now(),
      });
    },
    [user]
  );

  const deleteCommission = useCallback(
    async (id: string): Promise<void> => {
      if (!user) throw new Error('Not authenticated');
      await deleteDoc(doc(db, 'users', user.uid, 'commissions', id));
    },
    [user]
  );

  return {
    commissions, loading, error,
    addCommission, updateCommission, recordReceipt, resetReceipt, deleteCommission,
  };
}