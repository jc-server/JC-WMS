import { useState, useMemo, useEffect } from 'react';
import {
  HandCoins, Plus, X, Search, Pencil, Trash2, Loader2, Download,
  Wallet, CalendarDays, Filter, Phone, Building2,
} from 'lucide-react';

import ConfirmDialog from '@/components/ConfirmDialog';
import { CustomSelect } from '@/components/CustomSelect';
import { useSites } from '@/hooks/useSites';
import {
  useContractors,
  useContractorPayments,
  CONTRACTOR_TRADES,
  CONTRACTOR_PAYMENT_MODES,
  type Contractor,
  type ContractorTrade,
  type ContractorInput,
  type ContractorPayment,
  type ContractorPaymentMode,
} from '@/hooks/useContractorPayments';
import { rowsToCsv, downloadCsv } from '@/utils/csv';
import {
  todayStr, currentMonthStr, monthStartStr, monthEndStr,
} from '@/utils/date';
import { roundCurrency } from '@/utils/calculations';

type SubTab = 'payments' | 'contractors' | 'summary';
type Toast = { msg: string; type: 'saved' | 'error' } | null;

export default function ContractorPayments() {
  const [subTab, setSubTab] = useState<SubTab>('payments');
  const [toast, setToast] = useState<Toast>(null);

  const {
    contractors,
    loading: contractorsLoading,
    error: contractorsError,
    addContractor,
    updateContractor,
    deleteContractor,
  } = useContractors();
  const {
    payments,
    loading: paymentsLoading,
    error: paymentsError,
    addPayment,
    deletePayment,
  } = useContractorPayments();
  const { sites } = useSites();

  const showToast = (msg: string, type: 'saved' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2600);
  };

  const contractorById = useMemo(() => {
    const m = new Map<string, Contractor>();
    contractors.forEach((c) => m.set(c.id, c));
    return m;
  }, [contractors]);

  const siteName = useMemo(() => {
    const m = new Map<string, string>();
    sites.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [sites]);

  const totals = useMemo(() => {
    const month = currentMonthStr();
    const start = monthStartStr(month);
    const end = monthEndStr(month);
    const allPaid = payments.reduce((s, p) => s + p.amount, 0);
    const monthPaid = payments
      .filter((p) => p.date >= start && p.date <= end)
      .reduce((s, p) => s + p.amount, 0);
    const avg = payments.length > 0 ? allPaid / payments.length : 0;
    const tradesUsed = new Set(
      contractors
        .filter((c) => payments.some((p) => p.contractorId === c.id))
        .map((c) => c.trade)
    ).size;
    return {
      allPaid: roundCurrency(allPaid),
      monthPaid: roundCurrency(monthPaid),
      avg: roundCurrency(avg),
      tradesUsed,
    };
  }, [payments, contractors]);

  const subTabs: { id: SubTab; label: string; icon: typeof HandCoins; badge?: number }[] = [
    { id: 'payments', label: 'Payments', icon: HandCoins, badge: payments.length },
    { id: 'contractors', label: 'Contractors', icon: Building2, badge: contractors.length },
    { id: 'summary', label: 'Summary', icon: Wallet },
  ];

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

      <div className="flex items-center gap-2 mb-4">
        <HandCoins className="w-5 h-5 text-amber-500" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Contractor Payments</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5">
        <SummaryTile
          icon={Building2}
          label="Contractors"
          value={String(contractors.length)}
          sub={`${contractors.filter((c) => c.active).length} active`}
          color="text-slate-700 dark:text-slate-200"
          bg="bg-slate-100 dark:bg-slate-800"
        />
        <SummaryTile
          icon={HandCoins}
          label="Payments"
          value={String(payments.length)}
          color="text-blue-600 dark:text-blue-400"
          bg="bg-blue-50 dark:bg-blue-950/40"
        />
        <SummaryTile
          icon={Wallet}
          label="Total Paid"
          value={`₹${totals.allPaid.toFixed(0)}`}
          color="text-emerald-600 dark:text-emerald-400"
          bg="bg-emerald-50 dark:bg-emerald-950/40"
        />
        <SummaryTile
          icon={CalendarDays}
          label="This Month"
          value={`₹${totals.monthPaid.toFixed(0)}`}
          color="text-orange-600 dark:text-orange-400"
          bg="bg-orange-50 dark:bg-orange-950/40"
        />
        <SummaryTile
          icon={HandCoins}
          label="Avg / Payment"
          value={`₹${totals.avg.toFixed(0)}`}
          color="text-purple-600 dark:text-purple-400"
          bg="bg-purple-50 dark:bg-purple-950/40"
        />
        <SummaryTile
          icon={Filter}
          label="Trades Used"
          value={String(totals.tradesUsed)}
          sub={`of ${CONTRACTOR_TRADES.length}`}
          color="text-cyan-600 dark:text-cyan-400"
          bg="bg-cyan-50 dark:bg-cyan-950/40"
        />
      </div>

      <div className="flex gap-1 mb-5 overflow-x-auto">
        {subTabs.map((t) => {
          const Icon = t.icon;
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 whitespace-nowrap ${
                active
                  ? 'bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 shadow-sm'
                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {typeof t.badge === 'number' && t.badge > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    active
                      ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {subTab === 'payments' && (
        <PaymentsView
          payments={payments}
          contractors={contractors}
          contractorById={contractorById}
          sites={sites}
          siteName={siteName}
          loading={paymentsLoading}
          error={paymentsError}
          onAdd={addPayment}
          onDelete={deletePayment}
          showToast={showToast}
        />
      )}
      {subTab === 'contractors' && (
        <ContractorsView
          contractors={contractors}
          payments={payments}
          loading={contractorsLoading}
          error={contractorsError}
          onAdd={addContractor}
          onUpdate={updateContractor}
          onDelete={deleteContractor}
          showToast={showToast}
        />
      )}
      {subTab === 'summary' && (
        <SummaryView
          contractors={contractors}
          payments={payments}
          contractorById={contractorById}
          loading={contractorsLoading || paymentsLoading}
          error={paymentsError ?? contractorsError}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

function SummaryTile({
  icon: Icon, label, value, sub, color, bg,
}: {
  icon: typeof HandCoins;
  label: string;
  value: string;
  sub?: string;
  color: string;
  bg: string;
}) {
  return (
    <div className={`${bg} rounded-xl p-3 border border-transparent transition-all hover:scale-[1.02]`}>
      <Icon className={`w-4 h-4 ${color} mb-1`} />
      <p className={`text-lg font-bold ${color} leading-none`}>{value}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-xl p-3 mb-4 text-sm">
      Could not load data: {message}
    </div>
  );
}

const inputCls =
  'w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all text-sm';

function Field({
  label, required, children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

function PaymentsView({
  payments, contractors, contractorById, sites, siteName, loading, error,
  onAdd, onDelete, showToast,
}: {
  payments: ContractorPayment[];
  contractors: Contractor[];
  contractorById: Map<string, Contractor>;
  sites: { id: string; name: string }[];
  siteName: Map<string, string>;
  loading: boolean;
  error: string | null;
  onAdd: (
    input: Parameters<ReturnType<typeof useContractorPayments>['addPayment']>[0],
    meta?: { contractorName?: string; trade?: string }
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  showToast: (msg: string, type: 'saved' | 'error') => void;
}) {
  const [contractorFilter, setContractorFilter] = useState('all');
  const [tradeFilter, setTradeFilter] = useState<'all' | ContractorTrade>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ContractorPayment | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (contractorFilter !== 'all' && p.contractorId !== contractorFilter) return false;
      if (tradeFilter !== 'all') {
        const c = contractorById.get(p.contractorId);
        if (c?.trade !== tradeFilter) return false;
      }
      if (fromDate && p.date < fromDate) return false;
      if (toDate && p.date > toDate) return false;
      return true;
    });
  }, [payments, contractorFilter, tradeFilter, fromDate, toDate, contractorById]);

  const filteredTotal = filtered.reduce((s, p) => s + p.amount, 0);

  const exportCSV = () => {
    const headers = [
      'Date', 'Contractor', 'Trade', 'Work Description', 'Amount',
      'Payment Mode', 'Reference', 'Site', 'Remark',
    ];
    const rows = filtered.map((p) => {
      const c = contractorById.get(p.contractorId);
      return [
        p.date,
        c?.name ?? '—',
        c?.trade ?? '—',
        p.workDescription || '—',
        p.amount.toFixed(2),
        p.paymentMode,
        p.reference || '—',
        p.siteId ? siteName.get(p.siteId) ?? '—' : '—',
        p.remark || '—',
      ];
    });
    const csv = rowsToCsv([headers, ...rows]);
    downloadCsv(`JC-WMS_Contractor_Payments_${Date.now()}.csv`, csv);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeletingBusy(true);
    try {
      await onDelete(pendingDelete.id);
      showToast('Payment deleted.', 'saved');
      setPendingDelete(null);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div>
      <ErrorBanner message={error} />

      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap">
        <CustomSelect
          value={contractorFilter}
          onChange={setContractorFilter}
          options={[
            { value: 'all', label: 'All Contractors' },
            ...contractors.map((c) => ({ value: c.id, label: c.name })),
          ]}
          className="min-w-[180px]"
        />
        <CustomSelect
          value={tradeFilter}
          onChange={(val) => setTradeFilter(val as 'all' | ContractorTrade)}
          options={[
            { value: 'all', label: 'All Trades' },
            ...CONTRACTOR_TRADES.map((t) => ({ value: t, label: t })),
          ]}
          className="min-w-[150px]"
        />
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="px-4 py-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-slate-900 dark:text-white text-sm"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="px-4 py-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-slate-900 dark:text-white text-sm"
        />
        <div className="flex-1" />
        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors text-sm whitespace-nowrap disabled:opacity-50 active:scale-95"
        >
          <Download className="w-4 h-4" /> Export
        </button>
        <button
          onClick={() => setShowForm(true)}
          disabled={contractors.length === 0}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors whitespace-nowrap disabled:opacity-50"
          title={contractors.length === 0 ? 'Add a contractor first' : 'Log a payment'}
        >
          <Plus className="w-5 h-5" /> Log Payment
        </button>
      </div>

      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 leading-none">
              ₹{filteredTotal.toFixed(0)}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">Paid (filtered)</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/40 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400 leading-none">
              {filtered.length}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">Payments</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-950/40 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-purple-600 dark:text-purple-400 leading-none">
              ₹{filtered.length ? (filteredTotal / filtered.length).toFixed(0) : 0}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">Average</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading payments…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <HandCoins className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {payments.length === 0
              ? 'No payments yet. Add a contractor, then log your first payment.'
              : 'No payments match your filters.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Date</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Contractor / Work</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider hidden md:table-cell">Mode</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider hidden md:table-cell">Site</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Amount</th>
                  <th className="px-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const c = contractorById.get(p.contractorId);
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {new Date(p.date + 'T00:00:00').toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: '2-digit',
                        })}
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {c?.name ?? '—'}
                          {c?.trade && (
                            <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 uppercase">
                              {c.trade}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {p.workDescription || p.remark || '—'}
                          {p.reference && ` · Ref ${p.reference}`}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400 hidden md:table-cell whitespace-nowrap">
                        {p.paymentMode}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400 hidden md:table-cell">
                        {p.siteId ? siteName.get(p.siteId) ?? '—' : '—'}
                      </td>
                      <td className="text-right px-3 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ₹{p.amount.toFixed(0)}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <button
                          onClick={() => setPendingDelete(p)}
                          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                          title="Delete payment"
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

      {showForm && (
        <PaymentFormModal
          contractors={contractors}
          sites={sites}
          onClose={() => setShowForm(false)}
          onSave={async (input, meta) => {
            await onAdd(input, meta);
            showToast('Payment recorded.', 'saved');
            setShowForm(false);
          }}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete Payment?"
        message={
          pendingDelete
            ? `Delete this ₹${pendingDelete.amount.toFixed(0)} payment to "${
                contractorById.get(pendingDelete.contractorId)?.name ?? 'contractor'
              }"? Any Site Ledger entry created from it will remain — you must remove it separately if needed.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Keep it"
        variant="danger"
        busy={deletingBusy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function PaymentFormModal({
  contractors, sites, onClose, onSave,
}: {
  contractors: Contractor[];
  sites: { id: string; name: string }[];
  onClose: () => void;
  onSave: (
    input: Parameters<ReturnType<typeof useContractorPayments>['addPayment']>[0],
    meta?: { contractorName?: string; trade?: string }
  ) => Promise<void>;
}) {
  const [contractorId, setContractorId] = useState(contractors[0]?.id ?? '');
  const [date, setDate] = useState(todayStr);
  const [amount, setAmount] = useState('');
  const [workDescription, setWorkDescription] = useState('');
  const [paymentMode, setPaymentMode] = useState<ContractorPaymentMode>('Cash');
  const [reference, setReference] = useState('');
  const [siteId, setSiteId] = useState<string>('');
  const [logToSite, setLogToSite] = useState(true);
  const [remark, setRemark] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contractorId && contractors.length > 0) {
      setContractorId(contractors[0].id);
    }
  }, [contractors, contractorId]);

  const amtNum = parseFloat(amount) || 0;
  const canBridge = Boolean(siteId) && amtNum > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractorId) {
      setError('Please select a contractor.');
      return;
    }
    if (amtNum <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const c = contractors.find((x) => x.id === contractorId);
      await onSave(
        {
          contractorId,
          date,
          amount: roundCurrency(amtNum),
          workDescription: workDescription.trim(),
          paymentMode,
          reference: reference.trim(),
          siteId: siteId || null,
          remark: remark.trim(),
          logToSiteLedger: logToSite && canBridge,
        },
        { contractorName: c?.name, trade: c?.trade }
      );
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
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-100 dark:bg-emerald-950/40">
              <HandCoins className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Log Contractor Payment</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contractor" required>
              <CustomSelect
                value={contractorId}
                onChange={setContractorId}
                options={contractors.map((c) => ({ value: c.id, label: `${c.name} · ${c.trade}` }))}
              />
            </Field>
            <Field label="Payment Date" required>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₹)" required>
              <input
                autoFocus
                required
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputCls}
                placeholder="0"
              />
            </Field>
            <Field label="Payment Mode">
              <CustomSelect
                value={paymentMode}
                onChange={(val) => setPaymentMode(val as ContractorPaymentMode)}
                options={CONTRACTOR_PAYMENT_MODES}
              />
            </Field>
          </div>

          <Field label="Work Description">
            <input
              value={workDescription}
              onChange={(e) => setWorkDescription(e.target.value)}
              className={inputCls}
              placeholder="e.g. Wiring for 2nd floor, gate fabrication"
            />
          </Field>

          <Field label="Reference">
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className={inputCls}
              placeholder="Cheque #, UPI txn ID, invoice #, etc."
            />
          </Field>

          <Field label="Link to Site (optional)">
            <CustomSelect
              value={siteId}
              onChange={setSiteId}
              options={[
                { value: '', label: '— Not linked to any site —' },
                ...sites.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </Field>

          {canBridge && (
            <label className="flex items-start gap-2.5 cursor-pointer bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-3">
              <input
                type="checkbox"
                checked={logToSite}
                onChange={(e) => setLogToSite(e.target.checked)}
                className="mt-0.5 accent-amber-500"
              />
              <div className="text-xs">
                <p className="font-semibold text-amber-800 dark:text-amber-300">
                  Also log ₹{amtNum.toFixed(0)} to site ledger
                </p>
                <p className="text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                  Creates a debit entry under "Contractor - Trade" for the selected site.
                </p>
              </div>
            </label>
          )}

          <Field label="Remark">
            <input
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className={inputCls}
              placeholder="Optional"
            />
          </Field>

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
            Save Payment
          </button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Contractors directory                                               */
/* ------------------------------------------------------------------ */

const TRADE_COLORS: Record<ContractorTrade, string> = {
  Lohar: 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
  Electrician: 'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400',
  Plumber: 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400',
  Carpenter: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400',
  Painter: 'bg-pink-100 dark:bg-pink-950/40 text-pink-700 dark:text-pink-400',
  Mason: 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400',
  Welder: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400',
  Tiles: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400',
  Other: 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-slate-300',
};

function ContractorsView({
  contractors, payments, loading, error, onAdd, onUpdate, onDelete, showToast,
}: {
  contractors: Contractor[];
  payments: ContractorPayment[];
  loading: boolean;
  error: string | null;
  onAdd: (input: ContractorInput) => Promise<void>;
  onUpdate: (
    id: string,
    updates: Partial<ContractorInput & { active: boolean }>
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  showToast: (msg: string, type: 'saved' | 'error') => void;
}) {
  const [search, setSearch] = useState('');
  const [tradeFilter, setTradeFilter] = useState<'all' | ContractorTrade>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Contractor | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Contractor | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const paymentsByContractor = useMemo(() => {
    const map = new Map<string, { count: number; total: number; lastDate: string | null }>();
    payments.forEach((p) => {
      const cur = map.get(p.contractorId) ?? { count: 0, total: 0, lastDate: null };
      cur.count++;
      cur.total = roundCurrency(cur.total + p.amount);
      if (!cur.lastDate || p.date > cur.lastDate) cur.lastDate = p.date;
      map.set(p.contractorId, cur);
    });
    return map;
  }, [payments]);

  const filtered = useMemo(() => {
    return contractors.filter((c) => {
      if (statusFilter === 'active' && !c.active) return false;
      if (statusFilter === 'inactive' && c.active) return false;
      if (tradeFilter !== 'all' && c.trade !== tradeFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.phone.includes(q);
    });
  }, [contractors, search, tradeFilter, statusFilter]);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeletingBusy(true);
    try {
      await onDelete(pendingDelete.id);
      showToast('Contractor deleted.', 'saved');
      setPendingDelete(null);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div>
      <ErrorBanner message={error} />

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
        <CustomSelect
          value={tradeFilter}
          onChange={(val) => setTradeFilter(val as 'all' | ContractorTrade)}
          options={[
            { value: 'all', label: 'All Trades' },
            ...CONTRACTOR_TRADES.map((t) => ({ value: t, label: t })),
          ]}
          className="min-w-[150px]"
        />
        <CustomSelect
          value={statusFilter}
          onChange={(val) => setStatusFilter(val as 'all' | 'active' | 'inactive')}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'all', label: 'All' },
          ]}
          className="min-w-[130px]"
        />
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors whitespace-nowrap"
        >
          <Plus className="w-5 h-5" /> Add Contractor
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading contractors…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {contractors.length === 0
              ? 'No contractors yet. Add your first lohar, electrician, plumber, etc.'
              : 'No contractors match your filters.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const stat = paymentsByContractor.get(c.id);
            return (
              <div
                key={c.id}
                className={`bg-white dark:bg-zinc-900 rounded-2xl p-5 border hover:shadow-lg transition-all group ${
                  c.active
                    ? 'border-slate-200 dark:border-zinc-800'
                    : 'border-dashed border-slate-300 dark:border-zinc-700 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 dark:text-white truncate">{c.name}</h3>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${TRADE_COLORS[c.trade]}`}>
                          {c.trade}
                        </span>
                        {!c.active && (
                          <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-zinc-700 text-slate-500 dark:text-slate-400 uppercase">
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditing(c); setShowForm(true); }}
                      className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPendingDelete(c)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {c.phone && (
                  <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mb-3">
                    <Phone className="w-3 h-3" /> {c.phone}
                  </p>
                )}

                <div className="flex gap-2">
                  <div className="flex-1 bg-slate-50 dark:bg-zinc-800 rounded-lg px-3 py-2">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Total Paid</p>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">
                      ₹{(stat?.total ?? 0).toFixed(0)}
                    </p>
                  </div>
                  <div className="flex-1 bg-slate-50 dark:bg-zinc-800 rounded-lg px-3 py-2">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Payments</p>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">
                      {stat?.count ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <ContractorFormModal
          contractor={editing}
          onClose={() => setShowForm(false)}
          onSave={async (input) => {
            if (editing) await onUpdate(editing.id, input);
            else await onAdd(input);
            showToast(editing ? 'Contractor updated.' : 'Contractor added.', 'saved');
            setShowForm(false);
          }}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete Contractor?"
        message={
          pendingDelete
            ? `Delete "${pendingDelete.name}"? Payments already recorded for this contractor will NOT be deleted, but they will no longer be linked to a contractor. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete Contractor"
        cancelLabel="Keep it"
        variant="danger"
        busy={deletingBusy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function ContractorFormModal({
  contractor, onClose, onSave,
}: {
  contractor: Contractor | null;
  onClose: () => void;
  onSave: (input: ContractorInput) => Promise<void>;
}) {
  const [name, setName] = useState(contractor?.name ?? '');
  const [trade, setTrade] = useState<ContractorTrade>(contractor?.trade ?? 'Lohar');
  const [phone, setPhone] = useState(contractor?.phone ?? '');
  const [notes, setNotes] = useState(contractor?.notes ?? '');
  const [active, setActive] = useState(contractor?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        trade,
        phone: phone.trim(),
        notes: notes.trim(),
        active,
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
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {contractor ? 'Edit Contractor' : 'Add Contractor'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Field label="Name" required>
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              placeholder="e.g. Ramesh (Lohar)"
            />
          </Field>

          <Field label="Trade" required>
            <CustomSelect
              value={trade}
              onChange={(val) => setTrade(val as ContractorTrade)}
              options={CONTRACTOR_TRADES}
            />
          </Field>

          <Field label="Phone">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputCls}
              placeholder="Optional"
            />
          </Field>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={`${inputCls} resize-none`}
              placeholder="Payment terms, rate notes, etc."
            />
          </Field>

          <Field label="Status">
            <CustomSelect
              value={active ? 'active' : 'inactive'}
              onChange={(val) => setActive(val === 'active')}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          </Field>

          {error && (
            <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/40 rounded-lg p-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full py-3 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {saving && <Loader2 className="w-5 h-5 animate-spin" />}
            {contractor ? 'Save Changes' : 'Add Contractor'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */

function SummaryView({
  contractors, payments, contractorById, loading, error,
}: {
  contractors: Contractor[];
  payments: ContractorPayment[];
  contractorById: Map<string, Contractor>;
  loading: boolean;
  error: string | null;
}) {
  const contractorTotals = useMemo(() => {
    type Row = { contractor: Contractor; count: number; total: number; lastDate: string | null };
    const map = new Map<string, Row>();
    contractors.forEach((c) => map.set(c.id, { contractor: c, count: 0, total: 0, lastDate: null }));
    payments.forEach((p) => {
      const row = map.get(p.contractorId);
      if (!row) return;
      row.count++;
      row.total = roundCurrency(row.total + p.amount);
      if (!row.lastDate || p.date > row.lastDate) row.lastDate = p.date;
    });
    return Array.from(map.values())
      .filter((r) => r.count > 0)
      .sort((a, b) => b.total - a.total);
  }, [contractors, payments]);

  const tradeTotals = useMemo(() => {
    type Row = { trade: ContractorTrade; contractors: number; payments: number; total: number };
    const map = new Map<ContractorTrade, Row>();
    contractors.forEach((c) => {
      const cur = map.get(c.trade) ?? { trade: c.trade, contractors: 0, payments: 0, total: 0 };
      cur.contractors++;
      map.set(c.trade, cur);
    });
    payments.forEach((p) => {
      const c = contractorById.get(p.contractorId);
      if (!c) return;
      const cur = map.get(c.trade) ?? { trade: c.trade, contractors: 0, payments: 0, total: 0 };
      cur.payments++;
      cur.total = roundCurrency(cur.total + p.amount);
      map.set(c.trade, cur);
    });
    return Array.from(map.values())
      .filter((r) => r.payments > 0)
      .sort((a, b) => b.total - a.total);
  }, [contractors, payments, contractorById]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading summary…
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-16">
        <Wallet className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
        <p className="text-slate-500 dark:text-slate-400 font-medium">
          No payments recorded yet. Log a payment to see the summary.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ErrorBanner message={error} />

      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">By Contractor</h3>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Contractor</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider hidden sm:table-cell">Trade</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Payments</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Total Paid</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider hidden md:table-cell">Last Paid</th>
                </tr>
              </thead>
              <tbody>
                {contractorTotals.map(({ contractor, count, total, lastDate }) => (
                  <tr key={contractor.id} className="border-b border-slate-100 dark:border-zinc-800">
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">
                      {contractor.name}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                      <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${TRADE_COLORS[contractor.trade]}`}>
                        {contractor.trade}
                      </span>
                    </td>
                    <td className="text-right px-3 py-3 text-sm text-slate-700 dark:text-slate-300">
                      {count}
                    </td>
                    <td className="text-right px-3 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{total.toFixed(0)}
                    </td>
                    <td className="text-right px-3 py-3 text-xs text-slate-500 dark:text-slate-400 hidden md:table-cell">
                      {lastDate
                        ? new Date(lastDate + 'T00:00:00').toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: '2-digit',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">By Trade</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tradeTotals.map((t) => (
            <div key={t.trade} className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${TRADE_COLORS[t.trade]}`}>
                  {t.trade}
                </span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  ₹{t.total.toFixed(0)}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.contractors} contractor{t.contractors === 1 ? '' : 's'} · {t.payments} payment{t.payments === 1 ? '' : 's'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}