import { useState } from 'react';
import { X, Plus, Pencil, Trash2, Check, AlertCircle, Loader2 } from 'lucide-react';

type Props = {
  roles: string[];
  workerRoles: string[];
  onAdd: (role: string) => Promise<void>;
  onUpdate: (oldName: string, newName: string) => Promise<void>;
  onDelete: (role: string) => Promise<void>;
  onClose: () => void;
};

export default function ManageRolesModal({ roles, workerRoles, onAdd, onUpdate, onDelete, onClose }: Props) {
  const [newRole, setNewRole] = useState('');
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRole.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onAdd(newRole);
      setNewRole('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (oldName: string) => {
    if (!editValue.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onUpdate(oldName, editValue);
      setEditingRole(null);
      setEditValue('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (role: string) => {
    setBusy(true);
    setError(null);
    try {
      await onDelete(role);
      setConfirmDelete(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Manage Roles</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Add new role */}
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              placeholder="Add new role..."
              className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all text-sm"
            />
            <button
              type="submit"
              disabled={busy || !newRole.trim()}
              className="px-4 py-2.5 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors disabled:opacity-50 flex items-center gap-1.5 text-sm active:scale-95"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </button>
          </form>

          {error && (
            <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/40 rounded-lg p-3">{error}</p>
          )}

          {/* Roles list */}
          <div className="space-y-2">
            {roles.length === 0 && (
              <p className="text-center py-6 text-slate-400 dark:text-slate-500 text-sm">No roles yet. Add one above.</p>
            )}
            {roles.map((role) => {
              const workerCount = workerRoles.filter((r) => r === role).length;
              const isEditing = editingRole === role;
              const isConfirming = confirmDelete === role;

              if (isConfirming) {
                return (
                  <div key={role} className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-3">
                    <div className="flex items-start gap-2 mb-3">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                        {workerCount > 0
                          ? `${workerCount} worker${workerCount > 1 ? 's' : ''} currently assigned as "${role}". Deleting this role will not change existing worker assignments, but the role will no longer appear in the dropdown.`
                          : `Delete "${role}"?`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(role)}
                        disabled={busy}
                        className="flex-1 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors text-sm active:scale-95 disabled:opacity-50"
                      >
                        Yes, Delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-4 py-2 text-slate-600 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={role}
                  className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-3 group"
                >
                  {isEditing ? (
                    <>
                      <input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdate(role);
                          if (e.key === 'Escape') setEditingRole(null);
                        }}
                        className="flex-1 px-3 py-1.5 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-sm font-medium"
                      />
                      <button
                        onClick={() => handleUpdate(role)}
                        disabled={busy}
                        className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors active:scale-90"
                      >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setEditingRole(null)}
                        className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{role}</span>
                        {workerCount > 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-slate-300">
                            {workerCount} worker{workerCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setEditingRole(role);
                          setEditValue(role);
                        }}
                        className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(role)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
