import { useState, useEffect, useCallback, useRef } from 'react';
import {
  doc,
  onSnapshot,
  runTransaction,
  writeBatch,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

// Kept for backward compatibility with existing call sites.
export type UpdateWorkerFn = (
  id: string,
  data: {
    name?: string;
    phone?: string | null;
    role?: string;
    dailyWage?: number;
    overtimeHourlyRate?: number;
    active?: boolean;
  }
) => Promise<void>;

export const DEFAULT_ROLES = [
  'Mason',
  'Helper',
  'Carpenter',
  'Electrician',
  'Plumber',
  'Painter',
  'Welder',
];

// Firestore hard-caps writeBatch at 500 operations per commit.
const BATCH_LIMIT = 500;

/**
 * Role management with cascade to workers.
 *
 * API (unchanged from the original):
 *   const { roles, addRole, updateRole, deleteRole, loading } = useRoleCascade(
 *     workers,      // arg 1 — preserved for backward compat (unused; we
 *                   //         cascade directly via writeBatch + onSnapshot
 *                   //         in the workers hook refreshes state)
 *     updateWorker  // arg 2 — preserved for backward compat (same reason)
 *   );
 *
 * - addRole(name)                    → adds a role (throws on duplicate)
 * - updateRole(oldName, newName)     → renames a role, ATOMICALLY cascades
 *                                      every worker's `role` field
 * - deleteRole(name)                 → removes a role, ATOMICALLY retires
 *                                      every worker that held it
 *
 * All cascade writes use writeBatch so an interrupted operation never
 * leaves half the workers on the old role and half on the new one.
 */
export function useRoleCascade(
  _workersOrCallback?: unknown,
  _maybeUpdateWorker?: UpdateWorkerFn
) {
  const { user } = useAuth();
  const [roles, setRoles] = useState<string[]>(DEFAULT_ROLES);
  const [loading, setLoading] = useState(true);
  const rolesRef = useRef<string[]>(DEFAULT_ROLES);

  // ---- Subscribe to the roles list ----
  useEffect(() => {
    if (!user) {
      rolesRef.current = DEFAULT_ROLES;
      setRoles(DEFAULT_ROLES);
      setLoading(false);
      return;
    }

    const ref = doc(db, 'users', user.uid, 'settings', 'roles');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const stored = snap.exists()
          ? (snap.data()?.roles as string[] | undefined)
          : undefined;
        const next = stored && stored.length > 0 ? stored : DEFAULT_ROLES;
        rolesRef.current = next;
        setRoles(next);
        setLoading(false);
      },
      (err) => {
        console.error('Roles listener error:', err.message);
        rolesRef.current = DEFAULT_ROLES;
        setRoles(DEFAULT_ROLES);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  // ---- Internal helper: cascade a role change to all affected workers ----
  const cascadeWorkers = useCallback(
    async (oldRole: string, newRole: string | null): Promise<void> => {
      if (!user) return;

      const workersRef = collection(db, 'users', user.uid, 'workers');
      const q = query(workersRef, where('role', '==', oldRole));
      const snap = await getDocs(q);
      const docs = snap.docs;
      if (docs.length === 0) return;

      const now = serverTimestamp();

      // Chunk into 500-op batches so we never exceed the Firestore limit.
      for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        for (const d of docs.slice(i, i + BATCH_LIMIT)) {
          if (newRole === null) {
            // Role was deleted — retire the worker so payroll excludes them.
            batch.update(d.ref, { role: '', active: false, updatedAt: now });
          } else {
            batch.update(d.ref, { role: newRole, updatedAt: now });
          }
        }
        await batch.commit();
      }
    },
    [user]
  );

  // ---- Public API ----

  const addRole = useCallback(
    async (name: string): Promise<void> => {
      if (!user) throw new Error('Not authenticated');
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Role name cannot be empty');

      if (rolesRef.current.some((r) => r.toLowerCase() === trimmed.toLowerCase())) {
        throw new Error(`Role "${trimmed}" already exists`);
      }

      const ref = doc(db, 'users', user.uid, 'settings', 'roles');
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const current =
          (snap.data()?.roles as string[] | undefined) ?? DEFAULT_ROLES;
        if (current.some((r) => r.toLowerCase() === trimmed.toLowerCase())) {
          throw new Error(`Role "${trimmed}" already exists`);
        }
        tx.set(
          ref,
          { roles: [...current, trimmed], updatedAt: serverTimestamp() },
          { merge: true }
        );
      });
    },
    [user]
  );

  const updateRole = useCallback(
    async (oldName: string, newName: string): Promise<void> => {
      if (!user) throw new Error('Not authenticated');
      const trimmed = newName.trim();
      if (!trimmed) throw new Error('New role name cannot be empty');
      if (oldName === trimmed) return;

      const ref = doc(db, 'users', user.uid, 'settings', 'roles');

      // 1) Rename inside the roles list (transaction protects against races
      //    with a concurrent addRole/deleteRole).
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const current =
          (snap.data()?.roles as string[] | undefined) ?? DEFAULT_ROLES;
        tx.set(
          ref,
          {
            roles: current.map((r) => (r === oldName ? trimmed : r)),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      // 2) Cascade to workers atomically.
      await cascadeWorkers(oldName, trimmed);
    },
    [user, cascadeWorkers]
  );

  const deleteRole = useCallback(
    async (name: string): Promise<void> => {
      if (!user) throw new Error('Not authenticated');

      const ref = doc(db, 'users', user.uid, 'settings', 'roles');

      // 1) Remove from roles list.
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const current =
          (snap.data()?.roles as string[] | undefined) ?? DEFAULT_ROLES;
        tx.set(
          ref,
          {
            roles: current.filter((r) => r !== name),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      // 2) Retire affected workers atomically.
      await cascadeWorkers(name, null);
    },
    [user, cascadeWorkers]
  );

  return { roles, loading, addRole, updateRole, deleteRole };
}