import { useCallback } from 'react';
import { useRoles } from '@/hooks/useRoles';
import type { Worker } from '@/hooks/useWorkers';

type UpdateWorkerFn = (
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

/**
 * Role management with cascade to workers.
 *
 * When a role is renamed or deleted, every worker currently assigned that
 * role is updated in the same operation, so we never leave orphaned /
 * dangling role strings in the workers collection.
 *
 * Takes `workers` and `updateWorker` as arguments so we don't spin up a
 * second `useWorkers` listener in whichever component consumes this hook.
 */
export function useRoleCascade(
  workers: Worker[],
  updateWorker: UpdateWorkerFn
) {
  const { roles, loading, addRole, updateRole, deleteRole } = useRoles();

  const cascadeUpdateRole = useCallback(
    async (oldName: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed || trimmed === oldName) return;

      await updateRole(oldName, trimmed);

      const affected = workers.filter((w) => w.role === oldName);
      await Promise.all(
        affected.map((w) => updateWorker(w.id, { role: trimmed }))
      );
    },
    [roles, workers, updateRole, updateWorker]
  );

  const cascadeDeleteRole = useCallback(
    async (role: string) => {
      await deleteRole(role);

      const fallback = roles.filter((r) => r !== role)[0] ?? 'Worker';
      const affected = workers.filter((w) => w.role === role);
      await Promise.all(
        affected.map((w) => updateWorker(w.id, { role: fallback }))
      );
    },
    [roles, workers, deleteRole, updateWorker]
  );

  return {
    roles,
    loading,
    addRole,
    updateRole: cascadeUpdateRole,
    deleteRole: cascadeDeleteRole,
  };
}