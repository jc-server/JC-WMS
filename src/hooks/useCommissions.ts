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
import { roundCurrency } from '@/utils/calculations';

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
  status: CommissionStatus;
  receivedAmount: number;
  receivedDate: string | null;
  remark: string;
  createdAt: number;
};

export type CommissionInput = Omit<
  Commission,
  'id' | 'createdAt' | 'status' | 'receivedAmount' | 'receivedDate'
>;

export type CommissionUpdate = Partial<
  Omit<Commission, 'id' | 'createdAt' | 'receivedAmount' | 'status' | 'receivedDate'>
>;

function commissionsPath(user: string) {
  return collection(db, 'users', user, 'commissions');
}

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

    const q = query(
      commissionsPath(user.uid),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Commission[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            supplierId: (data.supplierId as string) ?? '',
            date: (data.date as string) ?? '',
            materialType: (data.materialType as string) ?? '',
            quantity: Number(data.quantity ?? 0),
            unit: (data.unit as string) ?? '',
            ratePerUnit: Number(data.ratePerUnit ?? 0),
            amount: Number(data.amount ?? 0),
            status: ((data.status as CommissionStatus) ?? 'pending'),
            receivedAmount: Number(data.receivedAmount ?? 0),
            receivedDate: (data.receivedDate as string) ?? null,
            remark: (data.remark as string) ?? '',
            createdAt: Number(data.createdAt ?? 0),
          };
        });
        setCommissions(list);
        setError(null);
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
    async (input: CommissionInput) => {
      if (!user) throw new Error('Not signed in.');
      try {
        await addDoc(commissionsPath(user.uid), {
          ...input,
          status: 'pending',
          receivedAmount: 0,
          receivedDate: null,
          createdAt: Date.now(),
        });
      } catch (err) {
        console.error('addCommission error:', err);
        throw new Error('Could not save commission. Please check your connection and try again.');
      }
    },
    [user]
  );

  /**
   * Update editable fields on a commission. Amount is NOT editable here —
   * changing it would invalidate `receivedAmount`/`status`, so the caller
   * must delete and recreate the commission if they need to change the
   * total.
   */
  const updateCommission = useCallback(
    async (id: string, updates: CommissionUpdate) => {
      if (!user) throw new Error('Not signed in.');
      try {
        await updateDoc(doc(db, 'users', user.uid, 'commissions', id), updates);
      } catch (err) {
        console.error('updateCommission error:', err);
        throw new Error('Could not update commission. Please try again.');
      }
    },
    [user]
  );

  const recordReceipt = useCallback(
    async (id: string, amountReceivedNow: number, date: string) => {
      if (!user) throw new Error('Not signed in.');
      const commission = commissions.find((c) => c.id === id);
      if (!commission) throw new Error('Commission not found.');
      if (amountReceivedNow <= 0) throw new Error('Enter a positive amount.');

      const remaining = Math.max(0, commission.amount - commission.receivedAmount);
      const applied = Math.min(amountReceivedNow, remaining);
      const nextReceived = roundCurrency(commission.receivedAmount + applied);

      let nextStatus: CommissionStatus = 'pending';
      if (nextReceived >= commission.amount) nextStatus = 'received';
      else if (nextReceived > 0) nextStatus = 'partial';

      try {
        await updateDoc(doc(db, 'users', user.uid, 'commissions', id), {
          receivedAmount: nextReceived,
          status: nextStatus,
          receivedDate: date,
        });
      } catch (err) {
        console.error('recordReceipt error:', err);
        throw new Error('Could not update commission. Please try again.');
      }
    },
    [user, commissions]
  );

  const resetReceipt = useCallback(
    async (id: string) => {
      if (!user) throw new Error('Not signed in.');
      try {
        await updateDoc(doc(db, 'users', user.uid, 'commissions', id), {
          receivedAmount: 0,
          status: 'pending',
          receivedDate: null,
        });
      } catch (err) {
        console.error('resetReceipt error:', err);
        throw new Error('Could not reset commission. Please try again.');
      }
    },
    [user]
  );

  const deleteCommission = useCallback(
    async (id: string) => {
      if (!user) throw new Error('Not signed in.');
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'commissions', id));
      } catch (err) {
        console.error('deleteCommission error:', err);
        throw new Error('Could not delete commission. Please try again.');
      }
    },
    [user]
  );

  return {
    commissions,
    loading,
    error,
    addCommission,
    updateCommission,
    recordReceipt,
    resetReceipt,
    deleteCommission,
  };
}