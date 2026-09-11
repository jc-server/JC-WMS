import { useState } from 'react';
import {
  Download, Loader2, X, TrendingDown, Wallet, BookOpen,
} from 'lucide-react';
import { useAdvances } from '@/hooks/useAdvances';
import { useMonthlyAttendance } from '@/hooks/useAttendance';
import { roundCurrency } from '@/utils/calculations';
import type { Worker } from '@/hooks/useWorkers';

type Props = {
  workers: Worker[];
  siteId: string | null;
  onOpenProfile: (worker: Worker) => void;
};

type WageSummary = {
  worker: Worker;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  otHours: number;
  grossWages: number;
  totalAdvances: number;
  dailyPaid: number;
  totalPaid: number;
  netPayable: number;
};

function getMonthInfo(monthStr: string) {
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  return {
    start: start.toISOString().slice(0, 10),
    label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  };
}

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function WageSummaryView({ workers, siteId, onOpenProfile }: Props) {
  const [month, setMonth] = useState(currentMonthStr());
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [ledgerWorker, setLedgerWorker] = useState<Worker | null>(null);

  const { records: monthAtt, loading: attLoading } = useMonthlyAttendance(siteId, month);
  const { getAdvancesForMonth, getAdvancesForWorker, addAdvance, loading: advLoading } = useAdvances(siteId);

  const monthAdvances = getAdvancesForMonth(month);

  const summaries: WageSummary[] = workers.map((worker) => {
    const att = monthAtt[worker.id] ?? { present: 0, half: 0, absent: 0, otHours: 0, amountPaid: 0 };
    const grossWages = roundCurrency(
      att.present * worker.dailyWage +
      att.half * 0.5 * worker.dailyWage +
      att.otHours * worker.overtimeHourlyRate
    );

    const totalAdvances = monthAdvances
      .filter((a) => a.workerId === worker.id)
      .reduce((sum, a) => sum + a.amount, 0);

    const dailyPaid = att.amountPaid || 0;
    const totalPaid = roundCurrency(dailyPaid + totalAdvances);
    const netPayable = roundCurrency(grossWages - totalPaid);

    return {
      worker,
      presentDays: att.present,
      halfDays: att.half,
      absentDays: att.absent,
      otHours: att.otHours,
      grossWages,
      totalAdvances,
      dailyPaid,
      totalPaid,
      netPayable,
    };
  });

  const totals = summaries.reduce(
    (acc, s) => {
      acc.grossWages = roundCurrency(acc.grossWages + s.grossWages);
      acc.totalAdvances = roundCurrency(acc.totalAdvances + s.totalAdvances);
      acc.dailyPaid = roundCurrency(acc.dailyPaid + s.dailyPaid);
      acc.totalPaid = roundCurrency(acc.totalPaid + s.totalPaid);
      acc.netPayable = roundCurrency(acc.netPayable + s.netPayable);
      acc.otHours = roundCurrency(acc.otHours + s.otHours);
      acc.presentDays += s.presentDays;
      acc.halfDays += s.halfDays;
      return acc;
    },
    { grossWages: 0, totalAdvances: 0, dailyPaid: 0, totalPaid: 0, netPayable: 0, otHours: 0, presentDays: 0, halfDays: 0 }
  );

  const loading = attLoading || advLoading;

  const exportCSV = () => {
    const monthInfo = getMonthInfo(month);
    const headers = [
      'Worker Name', 'Phone', 'Role', 'Daily Wage', 'OT Rate/hr',
      'Present Days', 'Half Days', 'Absent Days', 'OT Hours',
      'Gross Wages', 'Daily Paid', 'Ledger Advances', 'Total Paid', 'Net Payable',
    ];

    const rows = summaries.map((s) => [
      s.worker.name, s.worker.phone ?? '', s.worker.role,
      s.worker.dailyWage.toFixed(2), s.worker.overtimeHourlyRate.toFixed(2),
      s.presentDays, s.halfDays, s.absentDays, s.otHours.toFixed(2),
      s.grossWages.toFixed(2), s.dailyPaid.toFixed(2), s.totalAdvances.toFixed(2), s.totalPaid.toFixed(2), s.netPayable.toFixed(2),
    ]);

    const totalsRow = [
      'TOTAL', '', '', '', '',
      totals.presentDays, totals.halfDays, '', totals.otHours.toFixed(2),
      totals.grossWages.toFixed(2), totals.dailyPaid.toFixed(2), totals.totalAdvances.toFixed(2), totals.totalPaid.toFixed(2), totals.netPayable.toFixed(2),
    ];

    const csv = [headers, ...rows, totalsRow]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `JC-WMS_Wage_Report_${monthInfo.start}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const monthInfo = getMonthInfo(month);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="px-4 py-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all text-slate-900 dark:text-white font-medium"
        />
        <div className="flex-1" />
        <button
          onClick={() => setShowAdvanceModal(true)}
          disabled={!siteId}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap disabled:opacity-50"
        >
          <TrendingDown className="w-5 h-5 text-red-500" /> Log Advance
        </button>
        <button
          onClick={exportCSV}
          disabled={summaries.length === 0}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors whitespace-nowrap disabled:opacity-50 active:scale-95"
        >
          <Download className="w-5 h-5" /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Gross Wages" value={`\u20B9${totals.grossWages.toFixed(0)}`} color="text-blue-600 dark:text-blue-400" bg="bg-blue-50 dark:bg-blue-950/30" />
        <StatCard label="Total Paid" value={`\u20B9${totals.totalPaid.toFixed(0)}`} color="text-slate-900 dark:text-white" bg="bg-slate-100 dark:bg-zinc-800" />
        <StatCard label="Net Payable" value={`\u20B9${Math.abs(totals.netPayable).toFixed(0)}`} color="text-white" bg={totals.netPayable > 0 ? 'bg-red-500 dark:bg-red-600' : totals.netPayable < 0 ? 'bg-green-500 dark:bg-green-600' : 'bg-slate-200 dark:bg-zinc-700'} />
        <StatCard label="OT Hours" value={totals.otHours.toFixed(1)} color="text-blue-600 dark:text-blue-400" bg="bg-blue-50 dark:bg-blue-950/30" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Calculating wages...
        </div>
      ) : !siteId ? (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400 font-medium">
          Select a site to view wages.
        </div>
      ) : summaries.length === 0 ? (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400 font-medium">
          No workers to summarize. Add workers in the Workers tab.
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Worker</th>
                  <th className="text-center px-2 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">P</th>
                  <th className="text-center px-2 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">H</th>
                  <th className="text-center px-2 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">OT</th>
                  <th className="text-right px-2 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Gross</th>
                  <th className="text-right px-2 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Paid</th>
                  <th className="text-right px-2 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Adv.</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Net</th>
                  <th className="px-2 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr key={s.worker.id} className="border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onOpenProfile(s.worker)}
                        className="flex items-center gap-2.5 text-left hover:opacity-80 transition-opacity"
                      >
                        <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/40 rounded-lg flex items-center justify-center font-bold text-amber-700 dark:text-amber-400 text-sm">
                          {s.worker.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white text-sm hover:text-amber-600 dark:hover:text-amber-400 transition-colors">{s.worker.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{s.worker.role} &#183; &#8377;{s.worker.dailyWage.toFixed(0)}/day</p>
                        </div>
                      </button>
                    </td>
                    <td className="text-center px-2 py-3 text-sm font-medium text-green-700 dark:text-green-400">{s.presentDays}</td>
                    <td className="text-center px-2 py-3 text-sm font-medium text-amber-700 dark:text-amber-400">{s.halfDays}</td>
                    <td className="text-center px-2 py-3 text-sm font-medium text-blue-700 dark:text-blue-400">{s.otHours.toFixed(1)}</td>
                    <td className="text-right px-2 py-3 text-sm font-semibold text-slate-900 dark:text-white">&#8377;{s.grossWages.toFixed(0)}</td>
                    <td className="text-right px-2 py-3 text-sm font-medium text-blue-700 dark:text-blue-400">&#8377;{s.dailyPaid.toFixed(0)}</td>
                    <td className="text-right px-2 py-3 text-sm font-medium text-slate-600 dark:text-slate-300">&#8377;{s.totalAdvances.toFixed(0)}</td>
                    <td className={`text-right px-3 py-3 text-sm font-bold ${s.netPayable > 0 ? 'text-red-600 dark:text-red-400' : s.netPayable < 0 ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>&#8377;{s.netPayable.toFixed(0)}</td>
                    <td className="px-2 py-3">
                      <button
                        onClick={() => setLedgerWorker(s.worker)}
                        className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition-colors"
                        title="View Passbook"
                      >
                        <BookOpen className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 dark:bg-zinc-800 font-bold">
                  <td className="px-4 py-3 text-slate-900 dark:text-white text-sm" colSpan={3}>TOTAL ({monthInfo.label})</td>
                  <td className="text-center px-2 py-3 text-sm text-blue-700 dark:text-blue-400">{totals.otHours.toFixed(1)}</td>
                  <td className="text-right px-2 py-3 text-sm text-slate-900 dark:text-white">&#8377;{totals.grossWages.toFixed(0)}</td>
                  <td className="text-right px-2 py-3 text-sm text-blue-700 dark:text-blue-400">&#8377;{totals.dailyPaid.toFixed(0)}</td>
                  <td className="text-right px-2 py-3 text-sm text-slate-600 dark:text-slate-300">&#8377;{totals.totalAdvances.toFixed(0)}</td>
                  <td className={`text-right px-3 py-3 text-sm ${totals.netPayable > 0 ? 'text-red-600 dark:text-red-400' : totals.netPayable < 0 ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>&#8377;{totals.netPayable.toFixed(0)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdvanceModal && (
        <AdvanceModal
          workers={workers}
          onClose={() => setShowAdvanceModal(false)}
          onSaved={() => setShowAdvanceModal(false)}
          addAdvance={addAdvance}
        />
      )}

      {ledgerWorker && (
        <PassbookModal
          worker={ledgerWorker}
          advances={getAdvancesForWorker(ledgerWorker.id)}
          onClose={() => setLedgerWorker(null)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div className={`${bg} rounded-xl p-3 text-center`}>
      <p className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{label}</p>
    </div>
  );
}

function AdvanceModal({
  workers, onClose, onSaved, addAdvance,
}: {
  workers: Worker[];
  onClose: () => void;
  onSaved: () => void;
  addAdvance: (data: { workerId: string; amount: number; date: string; reason: string | null }) => Promise<void>;
}) {
  const [workerId, setWorkerId] = useState(workers[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date();
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 10);
  });
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerId) { setError('Please select a worker.'); return; }
    setSaving(true);
    setError(null);
    try {
      await addAdvance({
        workerId,
        amount: parseFloat(amount) || 0,
        date,
        reason: reason || null,
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-red-100 dark:bg-red-950/40 rounded-lg flex items-center justify-center">
              <Wallet className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Log Cash Advance</h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Worker</label>
            <select
              required
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all"
            >
              {workers.length === 0 && <option value="">No workers available</option>}
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Amount (&#8377;)</label>
            <input
              required
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Note (optional)</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all"
              placeholder="e.g. emergency loan, food advance"
            />
          </div>
          {error && <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/40 rounded-lg p-3">{error}</p>}
          <button
            type="submit"
            disabled={saving || workers.length === 0}
            className="w-full py-3 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {saving && <Loader2 className="w-5 h-5 animate-spin" />}
            Log Advance
          </button>
        </form>
      </div>
    </div>
  );
}

function PassbookModal({
  worker, advances, onClose,
}: {
  worker: Worker;
  advances: { id: string; amount: number; date: string; reason: string | null }[];
  onClose: () => void;
}) {
  const sorted = [...advances].sort((a, b) => b.date.localeCompare(a.date));
  const totalAdvances = sorted.reduce((sum, a) => sum + a.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-amber-100 dark:bg-amber-900/40 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Passbook</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{worker.name} &#183; {worker.role}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">Daily Wage</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">&#8377;{worker.dailyWage.toFixed(0)}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/40 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">Total Advances</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">&#8377;{totalAdvances.toFixed(0)}</p>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Advance History</h3>
          {sorted.length === 0 ? (
            <p className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">No advances recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {sorted.map((a) => (
                <div key={a.id} className="flex items-center justify-between bg-slate-50 dark:bg-zinc-800 rounded-xl p-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">&#8377;{a.amount.toFixed(0)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(a.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {a.reason && ` \u00b7 ${a.reason}`}
                    </p>
                  </div>
                  <TrendingDown className="w-4 h-4 text-red-400" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
