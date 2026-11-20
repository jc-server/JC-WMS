import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

// ----------------------------------------------------------------------
// TYPES & CONSTANTS
// ----------------------------------------------------------------------

export const CONTRACTOR_PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'] as const;
export type ContractorPaymentMode = typeof CONTRACTOR_PAYMENT_MODES[number];

export type ContractorTrade = string; // e.g. 'Lohar', 'Mistri', etc.

export type Contractor = {
  id: string;
  name: string;
  trade: ContractorTrade;
  phone: string;
  notes: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
};

export type ContractorInput = Omit<Contractor, 'id' | 'createdAt' | 'updatedAt'>;

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
  updatedAt: number;
};

export type ContractorPaymentInput = Omit<ContractorPayment, 'id' | 'createdAt' | 'updatedAt'> & {
  logToSiteLedger?: boolean;
};

// Firestore security rules cap `remark` at 500 chars for transaction
// documents. Truncating here defensively so a long work description or
// remark can never fail the whole batch and silently lose the payment.
const MAX_REMARK_LEN = 500;

// ----------------------------------------------------------------------
// HOOK: useContractors
// ----------------------------------------------------------------------

export function useContractors() {
  const { user } = useAuth();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setContractors([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = collection(db, 'users', user.uid, 'contractors');
    const q = query(ref, orderBy('name', 'asc'));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Contractor[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: (data.name as string) ?? '',
            trade: (data.trade as string) ?? 'Other',
            phone: (data.phone as string) ?? '',
            notes: (data.notes as string) ?? '',
            active: (data.active as boolean) ?? true,
            createdAt: (data.createdAt as number) ?? 0,
            updatedAt: (data.updatedAt as number) ?? 0,
          };
        });
        setContractors(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Contractors listener error:', err.message);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const addContractor = useCallback(
    async (input: ContractorInput) => {
      if (!user) throw new Error('Not authenticated');
      const ref = collection(db, 'users', user.uid, 'contractors');
      const now = Date.now();
      await addDoc(ref, {
        ...input,
        createdAt: now,
        updatedAt: now,
      });
    },
    [user]
  );

  const updateContractor = useCallback(
    async (id: string, input: Partial<ContractorInput>) => {
      if (!user) throw new Error('Not authenticated');
      const ref = doc(db, 'users', user.uid, 'contractors', id);
      await updateDoc(ref, {
        ...input,
        updatedAt: Date.now(),
      });
    },
    [user]
  );

  const deleteContractor = useCallback(
    async (id: string) => {
      if (!user) throw new Error('Not authenticated');
      const ref = doc(db, 'users', user.uid, 'contractors', id);
      await deleteDoc(ref);
    },
    [user]
  );

  return {
    contractors,
    loading,
    error,
    addContractor,
    updateContractor,
    deleteContractor,
  };
}

// ----------------------------------------------------------------------
// HOOK: useContractorPayments
// ----------------------------------------------------------------------

export function useContractorPayments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<ContractorPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setPayments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = collection(db, 'users', user.uid, 'contractorPayments');
    const q = query(ref, orderBy('date', 'desc'));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: ContractorPayment[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            contractorId: (data.contractorId as string) ?? '',
            date: (data.date as string) ?? '',
            amount: (data.amount as number) ?? 0,
            workDescription: (data.workDescription as string) ?? '',
            paymentMode: (data.paymentMode as ContractorPaymentMode) ?? 'Cash',
            reference: (data.reference as string) ?? '',
            siteId: (data.siteId as string | null) ?? null,
            remark: (data.remark as string) ?? '',
            createdAt: (data.createdAt as number) ?? 0,
            updatedAt: (data.updatedAt as number) ?? 0,
          };
        });
        setPayments(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Contractor payments listener error:', err.message);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const addPayment = useCallback(
    async (
      input: ContractorPaymentInput,
      meta?: { contractorName?: string; trade?: string }
    ) => {
      if (!user) throw new Error('Not authenticated');
      const now = Date.now();
      const batch = writeBatch(db);

      // 1. Contractor payment document.
      const paymentRef = doc(collection(db, 'users', user.uid, 'contractorPayments'));
      batch.set(paymentRef, {
        contractorId: input.contractorId,
        date: input.date,
        amount: input.amount,
        workDescription: input.workDescription,
        paymentMode: input.paymentMode,
        reference: input.reference,
        siteId: input.siteId || null,
        remark: input.remark,
        createdAt: now,
        updatedAt: now,
      });

      // 2. Optional bridge into the Site Ledger.
      //
      // The ledger is stored at `users/{uid}/sites/{siteId}/transactions`
      // (see useTransactions.ts `siteTxPath`) — NOT at
      // `users/{uid}/transactions`. The field shape must also match the
      // `Transaction` type consumed by <SiteLedger />:
      //   { type: 'debit' | 'credit', amount, date, category,
      //     paymentMode, remark, createdAt }
      //
      // `ContractorPaymentMode` is exactly the same union as the ledger's
      // `PaymentMode`, so `input.paymentMode` passes straight through.
      if (input.logToSiteLedger && input.siteId && input.amount > 0) {
        const txRef = doc(
          collection(db, 'users', user.uid, 'sites', input.siteId, 'transactions')
        );

        // Fold every human-readable label into `remark` (the only free-text
        // field the ledger type supports), then clamp to the rules' 500-char
        // cap so the whole batch can't be rejected by validation.
        const remark = (
          `Contractor - ${meta?.trade || 'Work'}` +
          `${meta?.contractorName ? ` (${meta.contractorName})` : ''}` +
          `${input.workDescription ? ` · ${input.workDescription}` : ''}` +
          `${input.remark && input.remark !== input.workDescription ? ` · ${input.remark}` : ''}`
        ).slice(0, MAX_REMARK_LEN);

        batch.set(txRef, {
          type: 'debit',
          amount: input.amount,
          date: input.date,
          category: 'Contractor',
          paymentMode: input.paymentMode,
          remark,
          createdAt: now,
        });
      }

      await batch.commit();
    },
    [user]
  );

  const updatePayment = useCallback(
    async (
      id: string,
      input: ContractorPaymentInput,
      // Kept for API symmetry with `addPayment`. Intentionally unused: on
      // edit we do not touch the linked ledger row (the UI disables the
      // "log to site ledger" toggle while editing, so no duplicate is
      // created). Prefixed with `_` to satisfy the lint rule.
      _meta?: { contractorName?: string; trade?: string }
    ) => {
      if (!user) throw new Error('Not authenticated');
      const ref = doc(db, 'users', user.uid, 'contractorPayments', id);

      // We only update the payment document here.
      // If you need to update the linked site ledger entry on edit, you
      // would need to query `users/{uid}/sites/{siteId}/transactions` for
      // the row whose `referenceId === id` and update it too. For now the
      // UI disables the bridge toggle on edit, so we leave the ledger alone.
      await updateDoc(ref, {
        contractorId: input.contractorId,
        date: input.date,
        amount: input.amount,
        workDescription: input.workDescription,
        paymentMode: input.paymentMode,
        reference: input.reference,
        siteId: input.siteId || null,
        remark: input.remark,
        updatedAt: Date.now(),
      });
    },
    [user]
  );

  const deletePayment = useCallback(
    async (id: string) => {
      if (!user) throw new Error('Not authenticated');
      const ref = doc(db, 'users', user.uid, 'contractorPayments', id);
      await deleteDoc(ref);
    },
    [user]
  );

  return {
    payments,
    loading,
    error,
    addPayment,
    updatePayment,
    deletePayment,
  };
}