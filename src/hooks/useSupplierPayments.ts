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

export type SupplierPaymentMode = 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque';

export const SUPPLIER_PAYMENT_MODES: SupplierPaymentMode[] = [
  'Cash',
  'UPI',
  'Bank Transfer',
  'Cheque',
];

export type SupplierPayment = {
  id: string;
  supplierId: string;
  date: string;
  amount: number;
  paymentMode: SupplierPaymentMode;
  reference: string;
  remark: string;
  createdAt: number;
};

export type SupplierPaymentInput = Omit<SupplierPayment, 'id' | 'createdAt'>;
export type SupplierPaymentUpdate = Partial<Omit<SupplierPayment, 'id' | 'createdAt'>>;

function paymentsPath(user: string) {
  return collection(db, 'users', user, 'supplierPayments');
}

export function useSupplierPayments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setPayments([]);
      setLoading(false);
      return;
    }

    const q = query(
      paymentsPath(user.uid),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: SupplierPayment[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            supplierId: (data.supplierId as string) ?? '',
            date: (data.date as string) ?? '',
            amount: Number(data.amount ?? 0),
            paymentMode: ((data.paymentMode as SupplierPaymentMode) ?? 'Cash'),
            reference: (data.reference as string) ?? '',
            remark: (data.remark as string) ?? '',
            createdAt: Number(data.createdAt ?? 0),
          };
        });
        setPayments(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Supplier payments listener error:', err.message);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const addPayment = useCallback(
    async (input: SupplierPaymentInput) => {
      if (!user) throw new Error('Not signed in.');
      try {
        await addDoc(paymentsPath(user.uid), {
          ...input,
          createdAt: Date.now(),
        });
      } catch (err) {
        console.error('addPayment error:', err);
        throw new Error('Could not save payment. Please check your connection and try again.');
      }
    },
    [user]
  );

  const updatePayment = useCallback(
    async (id: string, updates: SupplierPaymentUpdate) => {
      if (!user) throw new Error('Not signed in.');
      try {
        await updateDoc(doc(db, 'users', user.uid, 'supplierPayments', id), updates);
      } catch (err) {
        console.error('updatePayment error:', err);
        throw new Error('Could not update payment. Please try again.');
      }
    },
    [user]
  );

  const deletePayment = useCallback(
    async (id: string) => {
      if (!user) throw new Error('Not signed in.');
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'supplierPayments', id));
      } catch (err) {
        console.error('deletePayment error:', err);
        throw new Error('Could not delete payment. Please try again.');
      }
    },
    [user]
  );

  return { payments, loading, error, addPayment, updatePayment, deletePayment };
}