import { useState } from 'react';
import {
  X, User, Phone, Briefcase, Calendar, Wallet, Trash2, Save, AlertTriangle, BookOpen, Download,
} from 'lucide-react';
import { useAdvances } from '@/hooks/useAdvances';
import { useMonthlyAttendance } from '@/hooks/useAttendance';
import { roundCurrency, calculateDailyEarned } from '@/utils/calculations';
import type { Worker } from '@/hooks/useWorkers';

type Props = {
  worker: Worker;
  siteId: string | null;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<Worker>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function WorkerProfile({ worker, siteId, onClose, onUpdate, onDelete }: Props) {
  const [activeTab, setActiveTab] = useState<'profile' | 'ledger'>('profile');
  const [month, setMonth] = useState(currentMonthStr());

  // Edit form state
  const [name, setName] = useState(worker.name);
  const [role, setRole] = useState(worker.role);
  const [phone, setPhone] = useState(worker.phone ?? '');
  const [dailyWage, setDailyWage] = useState(worker.dailyWage.toString());
  const [overtimeHourlyRate, setOvertimeHourlyRate] = useState(worker.overtimeHourlyRate.toString());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { getAdvancesForWorker, addAdvance } = useAdvances(siteId);
  const { records: monthAtt } = useMonthlyAttendance(siteId, month);
  const workerAdvances = getAdvancesForWorker(worker.id);

  const att = monthAtt[worker.id] ?? { present: 0, half: 0, absent: 0, otHours: 0, amountPaid: 0 };
  const baseWageEarned =
    att.present * worker.dailyWage +
    att.half * 0.5 * worker.dailyWage +
    att.otHours * worker.overtimeHourlyRate;
  const grossWages = roundCurrency(baseWageEarned);

  const monthAdvancesTotal = workerAdvances
    .filter((a) => a.date.startsWith(month))
    .reduce((sum, a) => sum + a.amount, 0);

  const dailyPaid = att.amountPaid || 0;
  const totalPaid = roundCurrency(dailyPaid + monthAdvancesTotal);
  const netPayable = roundCurrency(grossWages - totalPaid);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onUpdate(worker.id, {
        name,
        role,
        phone: phone || null,
        dailyWage: parseFloat(dailyWage) || 0,
        overtimeHourlyRate: parseFloat(overtimeHourlyRate) || 0,
      });
      setSaving(false);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(worker.id);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const exportPassbookCSV = () => {
    const headers = ['Date', 'Type', 'Amount (INR)', 'Reason / Remark'];
    const rows = workerAdvances.map((a) => [
      a.date,
      'Advance',
      a.amount.toFixed(2),
      a.reason ?? '',
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${worker.name.replace(/\s+/g, '_')}_Passbook.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center text-amber-700 dark:text-amber-400 font-bold text-lg">
              {worker.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{worker.name}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{worker.role} &#183; &#8377;{worker.dailyWage}/day</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-zinc-800 px-5 bg-slate-50/50 dark:bg-zinc-900/50">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-amber-400 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Worker Profile & Edit
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`py-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
              activeTab === 'ledger'
                ? 'border-amber-400 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Passbook & Ledger
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          {activeTab === 'profile' ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Role / Trade</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    required
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none font-medium"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Daily Wage (&#8377;)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={dailyWage}
                    onChange={(e) => setDailyWage(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">OT Rate / hr (&#8377;)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={overtimeHourlyRate}
                    onChange={(e) => setOvertimeHourlyRate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none font-medium"
                  />
                </div>
              </div>

              {error && <p className="text-red-600 text-sm bg-red-50 dark:bg-red-950/40 p-3 rounded-lg">{error}</p>}

              <div className="flex items-center justify-between pt-2">
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="px-4 py-2.5 bg-red-600 text-white font-bold rounded-xl text-sm hover:bg-red-700 transition-colors"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-2.5 bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 font-medium rounded-xl text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl text-sm font-semibold transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Worker
                  </button>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors active:scale-95"
                >
                  <Save className="w-4 h-4" /> Save Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium text-sm"
                />
                <button
                  onClick={exportPassbookCSV}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-semibold rounded-xl text-xs hover:opacity-90 transition-opacity"
                >
                  <Download className="w-4 h-4" /> Export Ledger
                </button>
              </div>

              {/* Settlement Calculation Box */}
              <div className="bg-slate-50 dark:bg-zinc-800/60 rounded-2xl p-4 border border-slate-200 dark:border-zinc-700 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Gross Wages Earned:</span>
                  <span className="font-bold text-slate-900 dark:text-white">&#8377;{grossWages.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Total Amount Paid:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">&#8377;{totalPaid.toFixed(2)}</span>
                </div>
                <hr className="border-slate-200 dark:border-zinc-700 my-1" />

                {/* Settlement Card logic with exact color coding */}
                {netPayable > 0 ? (
                  <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 rounded-xl p-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider">Remaining Balance to Pay (Liability)</p>
                    <p className="text-xl font-bold mt-0.5">&#8377;{netPayable.toFixed(2)}</p>
                  </div>
                ) : netPayable < 0 ? (
                  <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-400 rounded-xl p-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider">Advance Outstanding (Overpaid)</p>
                    <p className="text-xl font-bold mt-0.5">&#8377;{Math.abs(netPayable).toFixed(2)}</p>
                  </div>
                ) : (
                  <div className="bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-200 rounded-xl p-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider">Settled / Nil</p>
                    <p className="text-xl font-bold mt-0.5">&#8377;0.00</p>
                  </div>
                )}
              </div>

              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-4">Cash Advances Logged</h3>
              {workerAdvances.length === 0 ? (
                <p className="text-center py-6 text-slate-400 text-sm">No advances logged for this worker.</p>
              ) : (
                <div className="space-y-2">
                  {workerAdvances.map((adv) => (
                    <div key={adv.id} className="flex items-center justify-between bg-slate-50 dark:bg-zinc-800 rounded-xl p-3 text-sm">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">&#8377;{adv.amount.toFixed(2)}</p>
                        <p className="text-xs text-slate-500">{adv.date} {adv.reason ? `\u00b7 ${adv.reason}` : ''}</p>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-lg">Advance</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
