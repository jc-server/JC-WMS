import { useState } from 'react';
import {
  Plus, Search, Pencil, Trash2, Phone, Loader2, X, Users, Briefcase,
} from 'lucide-react';
import { useWorkers, type Worker } from '@/hooks/useWorkers';

const ROLES = ['Mason', 'Helper', 'Carpenter', 'Electrician', 'Plumber', 'Painter', 'Welder', 'Driver', 'Supervisor', 'Worker'];

type Props = {
  siteId: string | null;
  onOpenProfile: (worker: Worker) => void;
};

export default function WorkerManagement({ siteId, onOpenProfile }: Props) {
  const { workers, loading, addWorker, updateWorker, deleteWorker } = useWorkers(siteId);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);

  const filtered = workers.filter((w) => {
    const matchesSearch = w.name.toLowerCase().includes(search.toLowerCase()) || (w.phone ?? '').includes(search);
    const matchesRole = roleFilter === 'all' || w.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const roles = [...new Set(workers.map((w) => w.role))].sort();

  const handleEdit = (worker: Worker) => {
    setEditing(worker);
    setShowForm(true);
  };

  const handleDelete = async (worker: Worker) => {
    if (!confirm(`Delete ${worker.name}? This also removes their attendance and advance records.`)) return;
    await deleteWorker(worker.id);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all text-slate-900 dark:text-white"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none transition-all text-slate-900 dark:text-white font-medium text-sm"
        >
          <option value="all">All Roles</option>
          {roles.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          disabled={!siteId}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors whitespace-nowrap disabled:opacity-50"
        >
          <Plus className="w-5 h-5" /> Add Worker
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading workers...
        </div>
      ) : !siteId ? (
        <div className="text-center py-16">
          <Briefcase className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Select a site first to manage workers.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {workers.length === 0 ? 'No workers yet. Add your first worker to get started.' : 'No workers match your search.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((worker) => (
            <div
              key={worker.id}
              className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-slate-200 dark:border-zinc-800 hover:shadow-lg hover:border-slate-300 dark:hover:border-zinc-700 transition-all group cursor-pointer"
              onClick={() => onOpenProfile(worker)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center font-bold text-amber-700 dark:text-amber-400 text-lg">
                    {worker.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-400 transition-colors">{worker.name}</h3>
                    <span className="inline-block mt-0.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300">
                      {worker.role}
                    </span>
                    {worker.phone && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                        <Phone className="w-3 h-3" /> {worker.phone}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEdit(worker); }}
                    className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(worker); }}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 bg-slate-50 dark:bg-zinc-800 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Daily Wage</p>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">
                    &#8377;{worker.dailyWage.toFixed(0)}
                  </p>
                </div>
                <div className="flex-1 bg-slate-50 dark:bg-zinc-800 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">OT Rate/hr</p>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">
                    &#8377;{worker.overtimeHourlyRate.toFixed(0)}
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
    </div>
  );
}

function WorkerForm({
  worker, onClose, onSave,
}: {
  worker: Worker | null;
  onClose: () => void;
  onSave: (data: { name: string; phone: string | null; role: string; dailyWage: number; overtimeHourlyRate: number }) => Promise<void>;
}) {
  const [name, setName] = useState(worker?.name ?? '');
  const [phone, setPhone] = useState(worker?.phone ?? '');
  const [role, setRole] = useState(worker?.role ?? 'Worker');
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
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{worker ? 'Edit Worker' : 'Add Worker'}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all"
              placeholder="Worker name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Trade / Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Daily Wage (&#8377;)</label>
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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">OT Rate / hr (&#8377;)</label>
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
          {error && <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/40 rounded-lg p-3">{error}</p>}
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
