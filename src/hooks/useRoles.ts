import { useState, useEffect, useCallback } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

const DEFAULT_ROLES = ['Supervisor', 'Mason', 'Helper', 'Carpenter', 'Electrician'];

export function useRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<string[]>(DEFAULT_ROLES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoles(DEFAULT_ROLES);
      setLoading(false);
      return;
    }

    const ref = doc(db, 'users', user.uid, 'settings', 'roles');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const list = data.roles as string[] | undefined;
          setRoles(list && list.length > 0 ? list : DEFAULT_ROLES);
        } else {
          setRoles(DEFAULT_ROLES);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Roles listener error:', err.message);
        setRoles(DEFAULT_ROLES);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const saveRoles = useCallback(
    async (newRoles: string[]) => {
      if (!user) return;
      const ref = doc(db, 'users', user.uid, 'settings', 'roles');
      await setDoc(ref, { roles: newRoles, updatedAt: Date.now() }, { merge: true });
    },
    [user]
  );

  const addRole = useCallback(
    async (role: string) => {
      const trimmed = role.trim();
      if (!trimmed) return;
      const lower = trimmed.toLowerCase();
      const exists = roles.some((r) => r.toLowerCase() === lower);
      if (exists) return;
      const next = [...roles, trimmed];
      setRoles(next);
      await saveRoles(next);
    },
    [roles, saveRoles]
  );

  const updateRole = useCallback(
    async (oldName: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) return;
      const next = roles.map((r) => (r === oldName ? trimmed : r));
      setRoles(next);
      await saveRoles(next);
    },
    [roles, saveRoles]
  );

  const deleteRole = useCallback(
    async (role: string) => {
      const next = roles.filter((r) => r !== role);
      setRoles(next);
      await saveRoles(next);
    },
    [roles, saveRoles]
  );

  return { roles, loading, addRole, updateRole, deleteRole };
}
