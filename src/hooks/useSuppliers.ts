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

export type SupplierType =
  | 'Brick'
  | 'Sand'
  | 'Aggregate'
  | 'Cement'
  | 'Steel'
  | 'Stone'
  | 'Other';

export const SUPPLIER_TYPES: SupplierType[] = [
  'Brick',
  'Sand',
  'Aggregate',
  'Cement',
  'Steel',
  'Stone',
  'Other',
];

export type Supplier = {
  id: string;
  name: string;
  types: SupplierType[];
  contactName: string;
  phone: string;
  address: string;
  gstin: string;
  notes: string;
  active: boolean;
  createdAt: number;
};

export type SupplierInput = Omit<Supplier, 'id' | 'createdAt' | 'active'> & {
  active?: boolean;
};

function suppliersPath(user: string) {
  return collection(db, 'users', user, 'suppliers');
}

export function useSuppliers() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setSuppliers([]);
      setLoading(false);
      return;
    }

    const q = query(suppliersPath(user.uid), orderBy('createdAt', 'asc'));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Supplier[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          
          // Backwards compatibility: map legacy `type` to `types` array
          const rawTypes = data.types as SupplierType[] | undefined;
          const legacyType = data.type as SupplierType | undefined;
          
          // FIX: Explicitly type the variable so TypeScript knows the fallback
          // string array conforms to SupplierType[]
          const types: SupplierType[] = rawTypes && rawTypes.length > 0 
            ? rawTypes 
            : (legacyType ? [legacyType] : ['Other']);

          return {
            id: d.id,
            name: (data.name as string) ?? '',
            types,
            contactName: (data.contactName as string) ?? '',
            phone: (data.phone as string) ?? '',
            address: (data.address as string) ?? '',
            gstin: (data.gstin as string) ?? '',
            notes: (data.notes as string) ?? '',
            active: data.active !== false,
            createdAt: Number(data.createdAt ?? 0),
          };
        });
        setSuppliers(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Suppliers listener error:', err.message);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const addSupplier = useCallback(
    async (input: SupplierInput) => {
      if (!user) throw new Error('Not signed in.');
      try {
        await addDoc(suppliersPath(user.uid), {
          name: input.name,
          types: input.types,
          contactName: input.contactName,
          phone: input.phone,
          address: input.address,
          gstin: input.gstin,
          notes: input.notes,
          active: input.active ?? true,
          createdAt: Date.now(),
        });
      } catch (err) {
        console.error('addSupplier error:', err);
        throw new Error('Could not add supplier. Please check your connection and try again.');
      }
    },
    [user]
  );

  const updateSupplier = useCallback(
    async (
      id: string,
      updates: Partial<SupplierInput & { active: boolean }>
    ) => {
      if (!user) throw new Error('Not signed in.');
      try {
        await updateDoc(doc(db, 'users', user.uid, 'suppliers', id), updates);
      } catch (err) {
        console.error('updateSupplier error:', err);
        throw new Error('Could not update supplier. Please try again.');
      }
    },
    [user]
  );

  const deleteSupplier = useCallback(
    async (id: string) => {
      if (!user) throw new Error('Not signed in.');
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'suppliers', id));
      } catch (err) {
        console.error('deleteSupplier error:', err);
        throw new Error('Could not delete supplier. Please try again.');
      }
    },
    [user]
  );

  return {
    suppliers,
    loading,
    error,
    addSupplier,
    updateSupplier,
    deleteSupplier,
  };
}