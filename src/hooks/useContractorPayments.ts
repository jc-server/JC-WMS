import { useState, useEffect, useCallback } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query,
  orderBy, writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { roundCurrency } from '@/utils/calculations';

export type ContractorTrade =
  | 'Lohar'
  | 'Electrician'
  | 'Plumber'
  | 'Carpenter'
  | 'Painter'
  | 'Mason'
  | 'Welder'
  | 'Tiles'
  | 'Other';

export const CONTRACTOR_TRADES: ContractorTrade[] = [
  'Lohar', 'Electrician', 'Plumber', 'Carpenter', 'Painter',
  'Mason', 'Welder', 'Tiles', 'Other',
];

export type Contractor = {
  id: string;
  name: string;
  trade: ContractorTrade;
  phone: string;
  notes: string;
  active: boolean;
  createdAt: number;
};

export type ContractorInput = Omit<Contractor, 'id' | 'createdAt' | 'active'>;

export type ContractorPaymentMode = 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque';

export const CONTRACTOR_PAYMENT_MODES: ContractorPaymentMode[] = [
  'Cash', 'UPI', 'Bank Transfer', 'Cheque',
];

export type ContractorPayment = {
  id: string;
  contractorId: string;
  date: string;
  amount: number;
  workDescription: string;
  paymentMode: ContractorPaymentMode;
  reference: string;
  siteId: string | null;
  remark: string;
  createdAt: number;
};

export type ContractorPaymentInput = Omit<ContractorPayment, 'id' | 'createdAt'> & {
  logToSiteLedger?: boolean;
};

function contractorsPath(user: string) {
  return collection(db, 'users', user, 'contractors');
}
function contractorPaymentsPath(user: string) {
  return collection(db, 'users', user, 'contractorPayments');
}

/* ------------------------------------------------------------------ */
/* Contractor directory                                                */
/* ------------------------------------------------------------------ */

export function useContractors() {
  const { user } = useAuth();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setContractors([]); setLoading(false); return; }

    const q = query(contractorsPath(user.uid), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Contractor[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            name: (data.name as string) ?? '',
            trade: ((data.trade as ContractorTrade) ?? 'Other'),
            phone: (data.phone as string) ?? '',
            notes: (data.notes as string) ?? '',
            active: data.active !== false,
            createdAt: Number(data.createdAt ?? 0),
          };
        });
        setContractors(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Contractors listener error:', err.message);
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  const addContractor = useCallback(async (input: ContractorInput) => {
    if (!user) throw new Error('Not signed in.');
    try {
      await addDoc(contractorsPath(user.uid), {
        ...input,
        active: true,
        createdAt: Date.now(),
      });
    } catch (err) {
      console.error('addContractor error:', err);
      throw new Error('Could not add contractor. Please check your connection and try again.');
    }
  }, [user]);

  const updateContractor = useCallback(
    async (id: string, updates: Partial<ContractorInput & { active: boolean }>) => {
      if (!user) throw new Error('Not signed in.');
      try {
        await updateDoc(doc(db, 'users', user.uid, 'contractors', id), updates);
      } catch (err) {
        console.error('updateContractor error:', err);
        throw new Error('Could not update contractor. Please try again.');
      }
    },
    [user]
  );

  const deleteContractor = useCallback(async (id: string) => {
    if (!user) throw new Error('Not signed in.');
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'contractors', id));
    } catch (err) {
      console.error('deleteContractor error:', err);
      throw new Error('Could not delete contractor. Please try again.');
    }
  }, [user]);

  return { contractors, loading, error, addContractor, updateContractor, deleteContractor };
}

/* ------------------------------------------------------------------ */
/* Contractor payments                                                 */
/* ------------------------------------------------------------------ */

export function useContractorPayments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<ContractorPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setPayments([]); setLoading(false); return; }

    const q = query(
      contractorPaymentsPath(user.uid),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: ContractorPayment[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            contractorId: (data.contractorId as string) ?? '',
            date: (data.date as string) ?? '',
            amount: Number(data.amount ?? 0),
            workDescription: (data.workDescription as string) ?? '',
            paymentMode: ((data.paymentMode as ContractorPaymentMode) ?? 'Cash'),
            reference: (data.reference as string) ?? '',
            siteId: (data.siteId as string) ?? null,
            remark: (data.remark as string) ?? '',
            createdAt: Number(data.createdAt ?? 0),
          };
        });
        setPayments(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Contractor payments listener error:', err.message);
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  /**
   * Saves a payment, and (optionally) mirrors it as a debit entry on the
   * linked site's ledger in the SAME Firestore batch. Both writes commit
   * atomically — the payment is never left without its site-ledger entry,
   * and the site-ledger entry is never left without its payment.
   */
  const addPayment = useCallback(
    async (
      input: ContractorPaymentInput,
      meta?: { contractorName?: string; trade?: string }
    ) => {
      if (!user) throw new Error('Not signed in.');
      const { logToSiteLedger, ...payload } = input;
      const uid = user.uid;

      const batch = writeBatch(db);
      const paymentRef = doc(collection(db, 'users', uid, 'contractorPayments'));
      batch.set(paymentRef, { ...payload, createdAt: Date.now() });

      if (logToSiteLedger && payload.siteId && payload.amount > 0) {
        const txRef = doc(
          collection(db, 'users', uid, 'sites', payload.siteId, 'transactions')
        );
        const category = `Contractor${meta?.trade ? ` - ${meta.trade}` : ''}`;
        batch.set(txRef, {
          type: 'debit',
          amount: roundCurrency(payload.amount),
          date: payload.date,
          category,
          paymentMode: payload.paymentMode,
          remark: [
            meta?.contractorName ?? 'Contractor',
            payload.workDescription,
            payload.reference ? `Ref ${payload.reference}` : '',
          ].filter(Boolean).join(' · '),
          createdAt: Date.now(),
        });
      }

      try {
        await batch.commit();
      } catch (err) {
        console.error('addPayment error:', err);
        throw new Error('Could not save payment. Please check your connection and try again.');
      }
    },
    [user]
  );

  const deletePayment = useCallback(async (id: string) => {
    if (!user) throw new Error('Not signed in.');
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'contractorPayments', id));
    } catch (err) {
      console.error('deletePayment error:', err);
      throw new Error('Could not delete payment. Please try again.');
    }
  }, [user]);

  return { payments, loading, error, addPayment, deletePayment };
}