import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

export type MaterialUnit = 'cft' | 'pieces' | 'tons' | 'bags' | 'kg' | 'nos';

export const MATERIAL_UNITS: MaterialUnit[] = ['cft', 'pieces', 'tons', 'bags', 'kg', 'nos'];

export const COMMON_MATERIALS = [
  'Bricks',
  'Sand',
  'Aggregate',
  'Cement',
  'Steel',
  'Stone',
  'Other',
] as const;

export type MaterialDelivery = {
  id: string;
  supplierId: string;
  siteId: string | null;
  date: string;
  materialType: string;
  quantity: number;
  unit: MaterialUnit;
  truckCount: number;
  ratePerUnit: number;
  billAmount: number;
  driverPaid: number;
  billNumber: string;
  remark: string;
  createdAt: number;
};

export type MaterialDeliveryInput = Omit<MaterialDelivery, 'id' | 'createdAt'> & {
  logToSiteLedger?: boolean;
};

export type MaterialDeliveryUpdate = Partial<
  Omit<MaterialDelivery, 'id' | 'createdAt'>
>;

function deliveriesPath(user: string) {
  return collection(db, 'users', user, 'deliveries');
}

export function useMaterialDeliveries() {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState<MaterialDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setDeliveries([]);
      setLoading(false);
      return;
    }

    const q = query(
      deliveriesPath(user.uid),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: MaterialDelivery[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            supplierId: (data.supplierId as string) ?? '',
            siteId: (data.siteId as string) ?? null,
            date: (data.date as string) ?? '',
            materialType: (data.materialType as string) ?? '',
            quantity: Number(data.quantity ?? 0),
            unit: ((data.unit as MaterialUnit) ?? 'cft'),
            truckCount: Number(data.truckCount ?? 0),
            ratePerUnit: Number(data.ratePerUnit ?? 0),
            billAmount: Number(data.billAmount ?? 0),
            driverPaid: Number(data.driverPaid ?? 0),
            billNumber: (data.billNumber as string) ?? '',
            remark: (data.remark as string) ?? '',
            createdAt: Number(data.createdAt ?? 0),
          };
        });
        setDeliveries(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Deliveries listener error:', err.message);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  /**
   * Saves a delivery and (optionally) its Site Ledger bridge transaction
   * in a single Firestore batch. Both writes commit atomically — the
   * delivery is never left without its matching ledger entry, and the
   * ledger entry is never left without its delivery.
   */
  const addDelivery = useCallback(
    async (input: MaterialDeliveryInput, supplierName?: string) => {
      if (!user) throw new Error('Not signed in.');
      const { logToSiteLedger, ...payload } = input;
      const uid = user.uid;

      const batch = writeBatch(db);
      const deliveryRef = doc(collection(db, 'users', uid, 'deliveries'));
      batch.set(deliveryRef, { ...payload, createdAt: Date.now() });

      if (logToSiteLedger && payload.siteId && payload.driverPaid > 0) {
        const txRef = doc(
          collection(db, 'users', uid, 'sites', payload.siteId, 'transactions')
        );
        batch.set(txRef, {
          type: 'debit',
          amount: payload.driverPaid,
          date: payload.date,
          category: `Material - ${payload.materialType}`,
          paymentMode: 'Cash',
          remark: `Driver paid${supplierName ? ` · ${supplierName}` : ''}${
            payload.billNumber ? ` · Bill #${payload.billNumber}` : ''
          }`,
          createdAt: Date.now(),
        });
      }

      try {
        await batch.commit();
      } catch (err) {
        console.error('addDelivery error:', err);
        throw new Error(
          'Could not save delivery. Please check your connection and try again.'
        );
      }
    },
    [user]
  );

  /**
   * Updates an existing delivery's fields. Does NOT touch the site ledger
   * bridge — if you need to alter the linked transaction, delete and
   * recreate the delivery, or edit the site transaction separately.
   */
  const updateDelivery = useCallback(
    async (id: string, updates: MaterialDeliveryUpdate) => {
      if (!user) throw new Error('Not signed in.');
      try {
        await updateDoc(doc(db, 'users', user.uid, 'deliveries', id), updates);
      } catch (err) {
        console.error('updateDelivery error:', err);
        throw new Error('Could not update delivery. Please try again.');
      }
    },
    [user]
  );

  const deleteDelivery = useCallback(
    async (id: string) => {
      if (!user) throw new Error('Not signed in.');
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'deliveries', id));
      } catch (err) {
        console.error('deleteDelivery error:', err);
        throw new Error('Could not delete delivery. Please try again.');
      }
    },
    [user]
  );

  return {
    deliveries,
    loading,
    error,
    addDelivery,
    updateDelivery,
    deleteDelivery,
  };
}