import { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp, TrendingDown, Wallet, Plus, Download, Loader2, X,
  Trash2, Filter, Users, Package, Building2, Phone, CalendarDays,
  IndianRupee, HardHat, Calculator,
} from 'lucide-react';
import SiteSelector from '@/components/SiteSelector';
import { useSites } from '@/hooks/useSites';
import { useWorkers } from '@/hooks/useWorkers';
import {
  useTransactions, CREDIT_CATEGORIES, DEBIT_CATEGORIES, PAYMENT_MODES,
  type TransactionInput, type TransactionType, type PaymentMode,
} from '@/hooks/useTransactions';
import { useWageCalculator } from '@/hooks/useWageCalculator';
import type { Worker } from '@/hooks/useWorkers';
import ConfirmDialog from '@/components/ConfirmDialog';
import { todayStr, monthStartStr } from '@/utils/date';
import { rowsToCsv, downloadCsv } from '@/utils/csv';

const LABOUR_CATEGORY = 'Labour / Worker Wages';
const DEBIT_CATEGORIES_WITH_LABOUR: string[] = [LABOUR_CATEGORY, ...DEBIT_CATEGORIES];

export default function SiteLedger() {
  const [siteId, setSiteId] = useState<string | null>(
    () => localStorage.getItem('jcwms-ledger-site')
  );

  useEffect(() => {
    if (siteId) localStorage.setItem('jcwms-ledger-site', siteId);
  }, [siteId]);

  const { sites } = useSites();
  const site = sites.find((s) => s.id === siteId);

  const {
    transactions,
    loading: txLoading,
    error: txError,
    addTransaction,
    deleteTransaction,
  } = useTransactions(siteId);

  const { workers } = useWorkers();

  const [showReceive, setShowReceive] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [showBookLabour, setShowBookLabour] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    category: string;
    amount: number;
  } | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'saved' | 'error' } | null>(null);

  const [filterType, setFilterType] = useState<'all' | 'credit' | 'debit' | 'labour'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const showToast = (msg: string, type: 'saved' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2600);
  };

  const totals = useMemo(() => {
    const credits = transactions.filter((t) => t.type === 'credit');
    const debits = transactions.filter((t) => t.type === 'debit');
    const labourDebits = debits.filter((t) => t.category === LABOUR_CATEGORY);
    const materialDebits = debits.filter((t) => t.category !== LABOUR_CATEGORY);

    const totalRevenue = credits.reduce((s, t) => s + t.amount, 0);
    const totalLabour = labourDebits.reduce((s, t) => s + t.amount, 0);
    const totalMaterial = materialDebits.reduce((s, t) => s + t.amount, 0);
    const totalCombined = totalLabour + totalMaterial;
    const net = totalRevenue - totalCombined;

    return { totalRevenue, totalLabour, totalMaterial, totalCombined, net };
  }, [transactions]);

  const filteredRows = useMemo(() => {
    return transactions.filter((t) => {
      const isLabour = t.type === 'debit' && t.category === LABOUR_CATEGORY;
      if (filterType === 'credit' && t.type !== 'credit') return false;
      if (filterType === 'debit' && (t.type !== 'debit' || isLabour)) return false;
      if (filterType === 'labour' && !isLabour) return false;
      if (filterCategory !== 'all' && t.category !== filterCategory) return false;
      if (fromDate && t.date < fromDate) return false;
      if (toDate && t.date > toDate) return false;
      return true;
    });
  }, [transactions, filterType, filterCategory, fromDate, toDate]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => set.add(t.category));
    return Array.from(set).sort();
  }, [transactions]);

  const exportCSV = () => {
    const headers = ['Date', 'Type', 'Category', 'Payment Mode', 'Remark', 'Amount (INR)'];
    const rows = filteredRows.map((t) => [
      t.date,
      t.type,
      t.category,
      t.paymentMode,
      t.remark,
      t.type === 'credit' ? `+${t.amount.toFixed(2)}` : `-${t.amount.toFixed(2)}`,
    ]);
    const csv = rowsToCsv([headers, ...rows]);
    downloadCsv(
      `JC-WMS_Site_Ledger_${site?.name?.replace(/\s+/g, '_') ?? 'site'}_${Date.now()}.csv`,
      csv
    );
  };

  if (!siteId || !site) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Site Ledger</h2>
          </div>
          <SiteSelector currentSiteId={siteId} onSelectSite={setSiteId} />
        </div>
        <div className="text-center py-16">
          <Building2 className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Select or create a site to view its ledger.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold text-white ${
              toast.type === 'saved' ? 'bg-emerald-600' : 'bg-rose-600'
            }`}
          >
            {toast.msg}
          </div>
        </div>
      )}

      {/* Site header */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-500" /> {site.name}
          </h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500 dark:text-slate-400">
            {site.clientName && (
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> {site.clientName}
              </span>
            )}
            {site.clientPhone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> {site.clientPhone}
              </span>
            )}
            {site.startDate && (
              <span className="flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" /> Started {site.startDate}
              </span>
            )}
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                site.status === 'Active'
                  ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                  : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {site.status}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <SiteSelector currentSiteId={siteId} onSelectSite={setSiteId} />
          <button
            onClick={() => setShowReceive(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors text-sm active:scale-95"
          >
            <Plus className="w-4 h-4" /> Receive Client Payment
          </button>
          <button
            onClick={() => setShowExpense(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors text-sm active:scale-95"
          >
            <Plus className="w-4 h-4" /> Add Site Expense
          </button>
          <button
            onClick={() => setShowBookLabour(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors text-sm active:scale-95"
          >
            <HardHat className="w-4 h-4" /> Book Labour Payout
          </button>
        </div>
      </div>

      {txError && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-xl p-3 mb-4 text-sm">
          Could not load transactions: {txError}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <SummaryCard
          icon={TrendingUp}
          label="Total Revenue"
          value={`₹${totals.totalRevenue.toFixed(0)}`}
          accent="text-emerald-600 dark:text-emerald-400"
          bg="bg-emerald-50 dark:bg-emerald-950/30"
        />
        <SummaryCard
          icon={HardHat}
          label="Labour Expenses"
          value={`₹${totals.totalLabour.toFixed(0)}`}
          accent="text-purple-600 dark:text-purple-400"
          bg="bg-purple-50 dark:bg-purple-950/30"
        />
        <SummaryCard
          icon={Package}
          label="Material / Other"
          value={`₹${totals.totalMaterial.toFixed(0)}`}
          accent="text-orange-600 dark:text-orange-400"
          bg="bg-orange-50 dark:bg-orange-950/30"
        />
        <SummaryCard
          icon={Wallet}
          label="Combined Expenses"
          value={`₹${totals.totalCombined.toFixed(0)}`}
          accent="text-slate-900 dark:text-white"
          bg="bg-slate-100 dark:bg-zinc-800"
        />
        {totals.net > 0 ? (
          <div className="bg-green-500 dark:bg-green-600 rounded-xl p-3 text-center">
            <TrendingUp className="w-5 h-5 text-white mx-auto mb-1" />
            <p className="text-xl font-bold text-white leading-none">
              ₹{totals.net.toFixed(0)}
            </p>
            <p className="text-[11px] text-white/90 font-semibold mt-1">Net Profit</p>
          </div>
        ) : totals.net < 0 ? (
          <div className="bg-red-500 dark:bg-red-600 rounded-xl p-3 text-center">
            <TrendingDown className="w-5 h-5 text-white mx-auto mb-1" />
            <p className="text-xl font-bold text-white leading-none">
              ₹{Math.abs(totals.net).toFixed(0)}
            </p>
            <p className="text-[11px] text-white/90 font-semibold mt-1">Net Loss</p>
          </div>
        ) : (
          <div className="bg-slate-200 dark:bg-zinc-700 rounded-xl p-3 text-center">
            <IndianRupee className="w-5 h-5 text-slate-600 dark:text-slate-300 mx-auto mb-1" />
            <p className="text-xl font-bold text-slate-700 dark:text-slate-200 leading-none">₹0</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-1">
              Break-Even
            </p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-3 border border-slate-200 dark:border-zinc-800 mb-4 flex flex-col sm:flex-row gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 px-1">
          <Filter className="w-3.5 h-3.5" /> Filters
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as typeof filterType)}
          className={selectCls}
        >
          <option value="all">All Types</option>
          <option value="credit">Client Receipts</option>
          <option value="labour">Labour Expenses</option>
          <option value="debit">Material / Other</option>
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className={selectCls}
        >
          <option value="all">All Categories</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className={selectCls}
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className={selectCls}
        />
        <div className="flex-1" />
        <button
          onClick={exportCSV}
          disabled={filteredRows.length === 0}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors text-xs whitespace-nowrap disabled:opacity-50 active:scale-95"
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      {/* Transactions table */}
      {txLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading ledger...
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400 font-medium">
          No transactions match your filters. Log a payment or expense to get started.
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
                  <th className="text-left  px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Date</th>
                  <th className="text-left  px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Category</th>
                  <th className="text-left  px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider hidden sm:table-cell">Mode</th>
                  <th className="text-left  px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider hidden md:table-cell">Remark</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Amount</th>
                  <th className="px-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const isCredit = r.type === 'credit';
                  const isLabour = !isCredit && r.category === LABOUR_CATEGORY;
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-slate-100 dark:border-zinc-800 transition-colors ${
                        isLabour
                          ? 'bg-purple-50/40 dark:bg-purple-950/20'
                          : isCredit
                          ? 'hover:bg-emerald-50/40 dark:hover:bg-emerald-950/10'
                          : 'hover:bg-slate-50/50 dark:hover:bg-zinc-800/50'
                      }`}
                    >
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: '2-digit',
                        })}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                            isLabour
                              ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400'
                              : isCredit
                              ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                              : 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400'
                          }`}
                        >
                          {r.category}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                        {r.paymentMode}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400 hidden md:table-cell max-w-[200px] truncate">
                        {r.remark || '—'}
                      </td>
                      <td
                        className={`px-3 py-3 text-sm font-bold text-right whitespace-nowrap ${
                          isLabour
                            ? 'text-purple-700 dark:text-purple-400'
                            : isCredit
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-orange-600 dark:text-orange-400'
                        }`}
                      >
                        {isCredit ? '+' : '−'}₹{r.amount.toFixed(0)}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <button
                          onClick={() =>
                            setPendingDelete({
                              id: r.id,
                              category: r.category,
                              amount: r.amount,
                            })
                          }
                          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                          title="Delete transaction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showReceive && (
        <TransactionModal
          mode="credit"
          onClose={() => setShowReceive(false)}
          onSave={async (input) => {
            await addTransaction(input);
            showToast('Payment recorded', 'saved');
            setShowReceive(false);
          }}
        />
      )}
      {showExpense && (
        <TransactionModal
          mode="debit"
          onClose={() => setShowExpense(false)}
          onSave={async (input) => {
            await addTransaction(input);
            showToast('Expense recorded', 'saved');
            setShowExpense(false);
          }}
        />
      )}
      {showBookLabour && (
        <BookLabourPayoutModal
          workers={workers}
          onClose={() => setShowBookLabour(false)}
          onSave={async (input) => {
            await addTransaction(input);
            showToast('Labour payout booked', 'saved');
            setShowBookLabour(false);
          }}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete Transaction?"
        message={
          pendingDelete
            ? `This will permanently remove the ₹${pendingDelete.amount.toFixed(
                0
              )} entry under "${pendingDelete.category}". This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Keep it"
        variant="danger"
        busy={deletingBusy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          setDeletingBusy(true);
          try {
            await deleteTransaction(pendingDelete.id);
            showToast('Transaction deleted', 'saved');
            setPendingDelete(null);
          } catch (err) {
            showToast((err as Error).message, 'error');
          } finally {
            setDeletingBusy(false);
          }
        }}
      />
    </div>
  );
}

const selectCls =
  'px-3 py-2 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-xs font-medium';

function SummaryCard({
  icon: Icon,
  label,
  value,
  accent,
  bg,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  accent: string;
  bg: string;
}) {
  return (
    <div className={`${bg} rounded-xl p-3 text-center border border-transparent`}>
      <Icon className={`w-5 h-5 ${accent} mx-auto mb-1`} />
      <p className={`text-xl font-bold ${accent} leading-none`}>{value}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">{label}</p>
    </div>
  );
}

function TransactionModal({
  mode,
  onClose,
  onSave,
}: {
  mode: TransactionType;
  onClose: () => void;
  onSave: (input: TransactionInput) => Promise<void>;
}) {
  const isCredit = mode === 'credit';
  const categories: string[] = isCredit ? [...CREDIT_CATEGORIES] : DEBIT_CATEGORIES_WITH_LABOUR;

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr);
  const [category, setCategory] = useState<string>(categories[0]);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [remark, setRemark] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        type: mode,
        amount: amt,
        date,
        category,
        paymentMode,
        remark: remark.trim(),
      });
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 rounded-t-2xl z-10">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                isCredit
                  ? 'bg-emerald-100 dark:bg-emerald-950/40'
                  : 'bg-orange-100 dark:bg-orange-950/40'
              }`}
            >
              {isCredit ? (
                <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {isCredit ? 'Receive Client Payment' : 'Add Site Expense'}
            </h2>
          </div>
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
              Amount (₹) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">
                ₹
              </span>
              <input
                autoFocus
                required
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all font-semibold"
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none transition-all text-sm"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Payment Mode
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_MODES.map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setPaymentMode(m)}
                  className={`py-2.5 rounded-xl border-2 text-xs font-semibold transition-all active:scale-95 ${
                    paymentMode === m
                      ? 'bg-amber-400 text-slate-900 border-amber-400'
                      : 'bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-zinc-700'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Remark (optional)
            </label>
            <input
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none transition-all text-sm"
              placeholder={
                isCredit ? 'e.g. 1st running bill received' : 'e.g. 50 bags from Sharma Traders'
              }
            />
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
            {isCredit ? 'Record Payment' : 'Record Expense'}
          </button>
        </form>
      </div>
    </div>
  );
}

function BookLabourPayoutModal({
  workers,
  onClose,
  onSave,
}: {
  workers: Worker[];
  onClose: () => void;
  onSave: (input: TransactionInput) => Promise<void>;
}) {
  const [fromDate, setFromDate] = useState(monthStartStr);
  const [toDate, setToDate] = useState(todayStr);
  const { total, breakdown, loading } = useWageCalculator(workers, fromDate, toDate);

  const [amount, setAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userEdited, setUserEdited] = useState(false);

  const computedAmount = total;
  const displayAmount = userEdited
    ? amount
    : computedAmount > 0
    ? String(computedAmount.toFixed(0))
    : '';

  const activeRows = breakdown.filter((b) => b.wage > 0);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(displayAmount);
    if (!amt || amt <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        type: 'debit',
        amount: amt,
        date: toDate,
        category: LABOUR_CATEGORY,
        paymentMode: 'Cash',
        remark:
          remark.trim() ||
          `Labour payout (${fromDate} → ${toDate}, ${activeRows.length} worker${
            activeRows.length === 1 ? '' : 's'
          })`,
      });
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 rounded-t-2xl z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-purple-100 dark:bg-purple-950/40">
              <HardHat className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Book Labour Payout
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Auto-compute from attendance, or enter a manual amount.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                From Date
              </label>
              <input
                type="date"
                required
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setUserEdited(false);
                }}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                To Date
              </label>
              <input
                type="date"
                required
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setUserEdited(false);
                }}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-sm"
              />
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
                <Calculator className="w-3.5 h-3.5" />
                Computed from global attendance
              </div>
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600 dark:text-purple-400" />
              ) : (
                <span className="text-sm font-bold text-purple-700 dark:text-purple-300">
                  ₹{computedAmount.toFixed(0)}
                </span>
              )}
            </div>
            {!loading && activeRows.length === 0 ? (
              <p className="text-xs text-purple-600/70 dark:text-purple-400/70">
                No attendance records in this range for any worker.
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                {activeRows.map((b) => (
                  <div
                    key={b.worker.id}
                    className="flex items-center justify-between text-xs text-purple-700 dark:text-purple-300"
                  >
                    <span className="truncate">
                      {b.worker.name}
                      <span className="text-purple-600/70 dark:text-purple-400/70 ml-1">
                        ({b.present}P{b.half ? `, ${b.half}H` : ''}
                        {b.otHours ? `, ${b.otHours}OT` : ''})
                      </span>
                    </span>
                    <span className="font-semibold whitespace-nowrap ml-2">
                      ₹{b.wage.toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Amount to Book (₹) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">
                ₹
              </span>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={displayAmount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setUserEdited(true);
                }}
                className="w-full pl-8 pr-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all font-semibold"
                placeholder="0"
              />
            </div>
            {userEdited && computedAmount > 0 && (
              <button
                type="button"
                onClick={() => setUserEdited(false)}
                className="mt-1.5 text-xs text-purple-600 dark:text-purple-400 hover:underline font-semibold"
              >
                Reset to computed ₹{computedAmount.toFixed(0)}
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Remark (optional)
            </label>
            <input
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none transition-all text-sm"
              placeholder={`Labour payout (${fromDate} → ${toDate})`}
            />
          </div>

          {error && (
            <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/40 rounded-lg p-3">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !displayAmount}
              className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {saving && <Loader2 className="w-5 h-5 animate-spin" />}
              Book as Labour Expense
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 text-slate-600 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}