import { useState, useMemo } from 'react';
import {
  Plus, Search, Pencil, Trash2, Phone, Loader2, X, Users, Settings2,
  UserCheck, UserX, RotateCcw,
} from 'lucide-react';
import { useWorkers, type Worker } from '@/hooks/useWorkers';
import { useRoles } from '@/hooks/useRoles';
import ManageRolesModal from '@/components/ManageRolesModal';
import ConfirmDialog from '@/components/ConfirmDialog';

type Props = {
  onOpenProfile: (worker: Worker) => void;
};

export default function WorkerManagement({ onOpenProfile }: Props) {
  const {
    workers,
    loading,
    addWorker,
    updateWorker,
    deleteWorker,
    reactivateWorker,
  } = useWorkers();
  const { roles, addRole, updateRole, deleteRole } = useRoles();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Worker | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return workers.filter((w) => {
      if (statusFilter === 'active' && !w.active) return false;
      if (statusFilter === 'inactive' && w.active) return false;
      const matchesSearch =
        w.name.toLowerCase().includes(search.toLowerCase()) ||
        (w.phone ?? '').includes(search);
      const matchesRole = roleFilter === 'all' || w.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [workers, search, roleFilter, statusFilter]);

  const filterRoles = useMemo(
    () => [...new Set(workers.map((w) => w.role))].sort(),
    [workers]
  );

  const activeCount = workers.filter((w) => w.active).length;
  const inactiveCount = workers.length - activeCount;

  /**
   * Cascade role rename: update the role list AND all workers using it.
   * Prevents orphaned / dangling role strings.
   */
  const handleUpdateRole = async (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    await updateRole(oldName, trimmed);
    const affected = workers.filter((w) => w.role === oldName);
    await Promise.all(
      affected.map((w) => updateWorker(w.id, { role: trimmed }))
    );
  };

  /**
   * Cascade role delete: reassign workers using the deleted role to a fallback.
   */
  const handleDeleteRole = async (role: string) => {
    await deleteRole(role);
    const fallback = roles.filter((r) => r !== role)[0] ?? 'Worker';
    const affected = workers.filter((w) => w.role === role);
    await Promise.all(
      affected.map((w) => updateWorker(w.id, { role: fallback }))
    );
  };

  const handleEdit = (worker: Worker) => {
    setEditing(worker);
    setShowForm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    setDeletingBusy(true);
    try {
      await deleteWorker(pendingDelete.id);
      setPendingDelete(null);
    } catch (err) {
      console.error('Delete worker error:', err);
      setErrorMessage((err as Error).message);
    } finally {
      setDeletingBusy(false);
    }
  };

  const handleReactivate = async (worker: Worker) => {
    try {
      await reactivateWorker(worker.id);
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone…"
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all text-slate-900 dark:text-white"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none transition-all text-slate-900 dark:text-white font-medium text-sm"
        >
          <option value="all">All Roles</option>
          {filterRoles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-4 py-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none transition-all text-slate-900 dark:text-white font-medium text-sm"
        >
          <option value="active">Active ({activeCount})</option>
          <option value="inactive">Inactive ({inactiveCount})</option>
          <option value="all">All ({workers.length})</option>
        </select>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors whitespace-nowrap"
        >
          <Plus className="w-5 h-5" /> Add Worker
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading workers…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {workers.length === 0
              ? 'No workers yet. Add your first worker to get started.'
              : 'No workers match your filters.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((worker) => (
            <div
              key={worker.id}
              className={`bg-white dark:bg-zinc-900 rounded-2xl p-5 border hover:shadow-lg transition-all group cursor-pointer ${
                worker.active
                  ? 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                  : 'border-dashed border-slate-300 dark:border-zinc-700 opacity-75'
              }`}
              onClick={() => onOpenProfile(worker)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg ${
                      worker.active
                        ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                        : 'bg-slate-200 dark:bg-zinc-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {worker.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                      {worker.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300">
                        {worker.role}
                      </span>
                      {!worker.active && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-zinc-700 text-slate-500 dark:text-slate-400 uppercase">
                          <UserX className="w-2.5 h-2.5" /> Inactive
                        </span>
                      )}
                    </div>
                    {worker.phone && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                        <Phone className="w-3 h-3" /> {worker.phone}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(worker);
                    }}
                    className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {worker.active ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDelete(worker);
                      }}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                      title="Deactivate (soft delete)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReactivate(worker);
                      }}
                      className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                      title="Reactivate"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 bg-slate-50 dark:bg-zinc-800 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Daily Wage</p>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">
                    ₹{worker.dailyWage.toFixed(0)}
                  </p>
                </div>
                <div className="flex-1 bg-slate-50 dark:bg-zinc-800 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">OT Rate/hr</p>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">
                    ₹{worker.overtimeHourlyRate.toFixed(0)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <WorkerForm
          worker={editing}
          roles={roles}
          onOpenRoles={() => setShowRolesModal(true)}
          onClose={() => setShowForm(false)}
          onSave={async (data) => {
            if (editing) {
              await updateWorker(editing.id, data);
            } else {
              await addWorker(data);
            }
            setShowForm(false);
          }}
        />
      )}

      {showRolesModal && (
        <ManageRolesModal
          roles={roles}
          workerRoles={workers.filter((w) => w.active).map((w) => w.role)}
          onAdd={addRole}
          onUpdate={handleUpdateRole}
          onDelete={handleDeleteRole}
          onClose={() => setShowRolesModal(false)}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Deactivate Worker?"
        message={
          pendingDelete
            ? `Deactivate ${pendingDelete.name}? They will be hidden from attendance but their history (attendance, advances, wage slips) will remain intact. You can reactivate them anytime.`
            : ''
        }
        confirmLabel="Deactivate"
        cancelLabel="Keep Active"
        variant="warning"
        busy={deletingBusy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDeleteConfirm}
      />

      <ConfirmDialog
        open={errorMessage !== null}
        mode="alert"
        variant="danger"
        title="Something Went Wrong"
        message={errorMessage ?? ''}
        confirmLabel="OK"
        onCancel={() => setErrorMessage(null)}
      />
    </div>
  );
}

function WorkerForm({
  worker,
  roles,
  onOpenRoles,
  onClose,
  onSave,
}: {
  worker: Worker | null;
  roles: string[];
  onOpenRoles: () => void;
  onClose: () => void;
  onSave: (data: {
    name: string;
    phone: string | null;
    role: string;
    dailyWage: number;
    overtimeHourlyRate: number;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(worker?.name ?? '');
  const [phone, setPhone] = useState(worker?.phone ?? '');
  const [role, setRole] = useState(worker?.role ?? roles[0] ?? 'Worker');
  const [dailyWage, setDailyWage] = useState(worker ? String(worker.dailyWage) : '');
  const [otRate, setOtRate] = useState(worker ? String(worker.overtimeHourlyRate) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name,
        phone: phone || null,
        role,
        dailyWage: parseFloat(dailyWage) || 0,
        overtimeHourlyRate: parseFloat(otRate) || 0,
      });
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {worker ? 'Edit Worker' : 'Add Worker'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Name
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all"
              placeholder="Worker name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Phone
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Trade / Role
            </label>
            <div className="flex gap-2">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all"
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onOpenRoles}
                className="flex items-center gap-1 px-3 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors text-xs font-semibold whitespace-nowrap"
                title="Manage Roles"
              >
                <Settings2 className="w-4 h-4" />
                <span className="hidden sm:inline">Manage</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Daily Wage (₹)
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={dailyWage}
                onChange={(e) => setDailyWage(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                OT Rate / hr (₹)
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={otRate}
                onChange={(e) => setOtRate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all"
                placeholder="0"
              />
            </div>
          </div>
          {error && (
            <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/40 rounded-lg p-3">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {saving && <Loader2 className="w-5 h-5 animate-spin" />}
            {worker ? 'Save Changes' : 'Add Worker'}
          </button>
        </form>
      </div>
    </div>
  );
}