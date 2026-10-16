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
  /**
   * When true (and `driverPaid > 0` and `siteId` is set), a matching `debit`
   * transaction is also written to the selected site's subcollection so the
   * Site Ledger reflects the upfront material cost automatically.
   */
  logToSiteLedger?: boolean;
};

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

  const addDelivery = useCallback(
    async (input: MaterialDeliveryInput, supplierName?: string) => {
      if (!user) throw new Error('Not signed in.');
      const { logToSiteLedger, ...payload } = input;

      try {
        await addDoc(deliveriesPath(user.uid), {
          ...payload,
          createdAt: Date.now(),
        });
      } catch (err) {
        console.error('addDelivery error:', err);
        throw new Error('Could not save delivery. Please check your connection and try again.');
      }

      // Site Ledger bridge — only fires when explicitly requested, a site is
      // chosen, and there was an upfront driver payment.
      if (logToSiteLedger && payload.siteId && payload.driverPaid > 0) {
        try {
          await addDoc(
            collection(db, 'users', user.uid, 'sites', payload.siteId, 'transactions'),
            {
              type: 'debit',
              amount: payload.driverPaid,
              date: payload.date,
              category: `Material - ${payload.materialType}`,
              paymentMode: 'Cash',
              remark: `Driver paid${supplierName ? ` · ${supplierName}` : ''}${
                payload.billNumber ? ` · Bill #${payload.billNumber}` : ''
              }`,
              createdAt: Date.now(),
            }
          );
        } catch (bridgeErr) {
          console.error('Site ledger bridge error:', bridgeErr);
          throw new Error(
            'Delivery saved, but the Site Ledger entry could not be created. Please verify the site still exists and try again.'
          );
        }
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
    deleteDelivery,
  };
}
