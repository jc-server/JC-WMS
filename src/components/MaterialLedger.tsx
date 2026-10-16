import { useState, useMemo, useEffect } from 'react';
import {
  Truck, Building2, Package, IndianRupee, Plus, X, Search, Pencil,
  Trash2, Loader2, Download, TrendingUp, TrendingDown, Wallet, Phone,
  MapPin, FileText, Calendar, Percent, Check, AlertCircle, Filter,
  ChevronRight, BookOpen, BadgeCheck,
} from 'lucide-react';

import ConfirmDialog from '@/components/ConfirmDialog';
import { useSites } from '@/hooks/useSites';
import {
  useSuppliers,
  SUPPLIER_TYPES,
  type Supplier,
  type SupplierType,
  type SupplierInput,
} from '@/hooks/useSuppliers';
import {
  useMaterialDeliveries,
  MATERIAL_UNITS,
  COMMON_MATERIALS,
  type MaterialDelivery,
  type MaterialUnit,
} from '@/hooks/useMaterialDeliveries';
import {
  useCommissions,
  type Commission,
} from '@/hooks/useCommissions';
import {
  useSupplierPayments,
  SUPPLIER_PAYMENT_MODES,
  type SupplierPaymentMode,
} from '@/hooks/useSupplierPayments';
import { rowsToCsv, downloadCsv } from '@/utils/csv';
import { todayStr, monthStartStr, monthEndStr, currentMonthStr } from '@/utils/date';
import { roundCurrency } from '@/utils/calculations';

type SubTab = 'suppliers' | 'deliveries' | 'commissions' | 'khata';

type Toast = { msg: string; type: 'saved' | 'error' } | null;

export default function MaterialLedger() {
  const [subTab, setSubTab] = useState<SubTab>('suppliers');
  const [toast, setToast] = useState<Toast>(null);

  const { suppliers, loading: suppliersLoading, addSupplier, updateSupplier, deleteSupplier } =
    useSuppliers();
  const {
    deliveries,
    loading: deliveriesLoading,
    addDelivery,
    deleteDelivery,
  } = useMaterialDeliveries();
  const {
    commissions,
    loading: commissionsLoading,
    addCommission,
    recordReceipt,
    resetReceipt,
    deleteCommission,
  } = useCommissions();
  const {
    payments,
    loading: paymentsLoading,
    addPayment,
    deletePayment,
  } = useSupplierPayments();
  const { sites } = useSites();

  const showToast = (msg: string, type: 'saved' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2600);
  };

  const supplierById = useMemo(() => {
    const m = new Map<string, Supplier>();
    suppliers.forEach((s) => m.set(s.id, s));
    return m;
  }, [suppliers]);

  const siteName = useMemo(() => {
    const m = new Map<string, string>();
    sites.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [sites]);

  // Khata aggregation (per supplier)
  const khata = useMemo(() => {
    const map = new Map<
      string,
      { billed: number; paid: number; due: number; deliveries: number; payments: number }
    >();
    suppliers.forEach((s) =>
      map.set(s.id, { billed: 0, paid: 0, due: 0, deliveries: 0, payments: 0 })
    );
    deliveries.forEach((d) => {
      const e = map.get(d.supplierId);
      if (!e) return;
      e.billed = roundCurrency(e.billed + d.billAmount);
      e.deliveries++;
    });
    payments.forEach((p) => {
      const e = map.get(p.supplierId);
      if (!e) return;
      e.paid = roundCurrency(e.paid + p.amount);
      e.payments++;
    });
    map.forEach((e) => {
      e.due = roundCurrency(e.billed - e.paid);
    });
    return map;
  }, [suppliers, deliveries, payments]);

  const totals = useMemo(() => {
    const totalBilled = deliveries.reduce((s, d) => s + d.billAmount, 0);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const totalDue = roundCurrency(totalBilled - totalPaid);
    const totalCommission = commissions.reduce((s, c) => s + c.amount, 0);
    const pendingCommission = commissions
      .filter((c) => c.status !== 'received')
      .reduce((s, c) => s + (c.amount - c.receivedAmount), 0);
    const totalDriverPaid = deliveries.reduce((s, d) => s + d.driverPaid, 0);
    const totalTrucks = deliveries.reduce((s, d) => s + d.truckCount, 0);
    return {
      totalBilled: roundCurrency(totalBilled),
      totalPaid: roundCurrency(totalPaid),
      totalDue,
      totalCommission: roundCurrency(totalCommission),
      pendingCommission: roundCurrency(pendingCommission),
      totalDriverPaid: roundCurrency(totalDriverPaid),
      totalTrucks,
    };
  }, [deliveries, payments, commissions]);

  const subTabs: { id: SubTab; label: string; icon: typeof Truck; badge?: number }[] = [
    { id: 'suppliers', label: 'Suppliers', icon: Building2, badge: suppliers.length },
    { id: 'deliveries', label: 'Deliveries', icon: Truck, badge: deliveries.length },
    {
      id: 'commissions',
      label: 'Commissions',
      icon: Percent,
      badge: commissions.filter((c) => c.status !== 'received').length,
    },
    { id: 'khata', label: 'Khata', icon: BookOpen },
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

      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Package className="w-5 h-5 text-amber-500" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Material Ledger</h2>
      </div>

      {/* Summary ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5">
        <SummaryTile
          icon={Truck}
          label="Deliveries"
          value={String(deliveries.length)}
          sub={`${totals.totalTrucks} truck${totals.totalTrucks === 1 ? '' : 's'}`}
          color="text-blue-600 dark:text-blue-400"
          bg="bg-blue-50 dark:bg-blue-950/40"
        />
        <SummaryTile
          icon={Building2}
          label="Suppliers"
          value={String(suppliers.length)}
          sub={`${suppliers.filter((s) => s.active).length} active`}
          color="text-slate-700 dark:text-slate-200"
          bg="bg-slate-100 dark:bg-slate-800"
        />
        <SummaryTile
          icon={FileText}
          label="Total Billed"
          value={`₹${totals.totalBilled.toFixed(0)}`}
          color="text-orange-600 dark:text-orange-400"
          bg="bg-orange-50 dark:bg-orange-950/40"
        />
        <SummaryTile
          icon={Wallet}
          label="Total Paid"
          value={`₹${totals.totalPaid.toFixed(0)}`}
          color="text-emerald-600 dark:text-emerald-400"
          bg="bg-emerald-50 dark:bg-emerald-950/40"
        />
        <SummaryTile
          icon={TrendingDown}
          label="Net Due"
          value={`₹${totals.totalDue.toFixed(0)}`}
          color={totals.totalDue > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}
          bg={totals.totalDue > 0 ? 'bg-red-50 dark:bg-red-950/40' : 'bg-slate-100 dark:bg-slate-800'}
        />
        <SummaryTile
          icon={Percent}
          label="Pending Commission"
          value={`₹${totals.pendingCommission.toFixed(0)}`}
          sub={`Earned ₹${totals.totalCommission.toFixed(0)}`}
          color="text-purple-600 dark:text-purple-400"
          bg="bg-purple-50 dark:bg-purple-950/40"
        />
      </div>

      {/* Sub-tab nav */}
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

      {subTab === 'suppliers' && (
        <SuppliersView
          suppliers={suppliers}
          loading={suppliersLoading}
          khata={khata}
          onAdd={addSupplier}
          onUpdate={updateSupplier}
          onDelete={deleteSupplier}
          showToast={showToast}
        />
      )}

      {subTab === 'deliveries' && (
        <DeliveriesView
          deliveries={deliveries}
          suppliers={suppliers}
          supplierById={supplierById}
          sites={sites}
          siteName={siteName}
          loading={deliveriesLoading}
          onAdd={(input, supplierName) => addDelivery(input, supplierName)}
          onDelete={deleteDelivery}
          showToast={showToast}
        />
      )}

      {subTab === 'commissions' && (
        <CommissionsView
          commissions={commissions}
          suppliers={suppliers}
          supplierById={supplierById}
          loading={commissionsLoading}
          onAdd={addCommission}
          onRecordReceipt={recordReceipt}
          onResetReceipt={resetReceipt}
          onDelete={deleteCommission}
          showToast={showToast}
        />
      )}

      {subTab === 'khata' && (
        <KhataView
          suppliers={suppliers}
          supplierById={supplierById}
          khata={khata}
          deliveries={deliveries}
          payments={payments}
          loading={suppliersLoading || deliveriesLoading || paymentsLoading}
          onAddPayment={addPayment}
          onDeletePayment={deletePayment}
          showToast={showToast}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function SummaryTile({
  icon: Icon,
  label,
  value,
  sub,
  color,
  bg,
}: {
  icon: typeof Truck;
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
      {sub && (
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{sub}</p>
      )}
    </div>
  );
}

const inputCls =
  'w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all text-sm';
const selectCls =
  'px-3 py-2 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-xs font-medium';

function Field({
  label,
  required,
  children,
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
/* Suppliers                                                           */
/* ------------------------------------------------------------------ */

const SUPPLIER_TYPE_COLORS: Record<SupplierType, string> = {
  Brick: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400',
  Sand: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400',
  Aggregate: 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-slate-300',
  Cement: 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400',
  Steel: 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
  Stone: 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400',
  Other: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400',
};

function SuppliersView({
  suppliers,
  loading,
  khata,
  onAdd,
  onUpdate,
  onDelete,
  showToast,
}: {
  suppliers: Supplier[];
  loading: boolean;
  khata: Map<string, { billed: number; paid: number; due: number }>;
  onAdd: (input: SupplierInput) => Promise<void>;
  onUpdate: (id: string, updates: Partial<SupplierInput & { active: boolean }>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  showToast: (msg: string, type: 'saved' | 'error') => void;
}) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | SupplierType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Supplier | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const filtered = useMemo(() => {
    return suppliers.filter((s) => {
      if (statusFilter === 'active' && !s.active) return false;
      if (statusFilter === 'inactive' && s.active) return false;
      if (typeFilter !== 'all' && s.type !== typeFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.contactName.toLowerCase().includes(q) ||
        s.phone.includes(q)
      );
    });
  }, [suppliers, search, typeFilter, statusFilter]);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeletingBusy(true);
    try {
      await onDelete(pendingDelete.id);
      showToast('Supplier deleted.', 'saved');
      setPendingDelete(null);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setDeletingBusy(false);
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
            placeholder="Search suppliers by name, contact or phone…"
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all text-slate-900 dark:text-white"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | SupplierType)}
          className="px-4 py-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-slate-900 dark:text-white font-medium text-sm"
        >
          <option value="all">All Types</option>
          {SUPPLIER_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
          }
          className="px-4 py-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-slate-900 dark:text-white font-medium text-sm"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </select>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors whitespace-nowrap"
        >
          <Plus className="w-5 h-5" /> Add Supplier
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading suppliers…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {suppliers.length === 0
              ? 'No suppliers yet. Add your first kiln, mine or dealer to get started.'
              : 'No suppliers match your filters.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => {
            const k = khata.get(s.id);
            const due = k?.due ?? 0;
            return (
              <div
                key={s.id}
                className={`bg-white dark:bg-zinc-900 rounded-2xl p-5 border hover:shadow-lg transition-all group ${
                  s.active
                    ? 'border-slate-200 dark:border-zinc-800'
                    : 'border-dashed border-slate-300 dark:border-zinc-700 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 shrink-0">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                        {s.name}
                      </h3>
                      <span
                        className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full mt-0.5 ${
                          SUPPLIER_TYPE_COLORS[s.type]
                        }`}
                      >
                        {s.type}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditing(s);
                        setShowForm(true);
                      }}
                      className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPendingDelete(s)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {(s.contactName || s.phone) && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mb-3">
                    {s.contactName && <span>{s.contactName}</span>}
                    {s.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {s.phone}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <div className="flex-1 bg-slate-50 dark:bg-zinc-800 rounded-lg px-3 py-2">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Billed</p>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">
                      ₹{(k?.billed ?? 0).toFixed(0)}
                    </p>
                  </div>
                  <div
                    className={`flex-1 rounded-lg px-3 py-2 ${
                      due > 0
                        ? 'bg-red-50 dark:bg-red-950/40'
                        : 'bg-emerald-50 dark:bg-emerald-950/40'
                    }`}
                  >
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Net Due</p>
                    <p
                      className={`font-bold text-sm ${
                        due > 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      ₹{due.toFixed(0)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <SupplierFormModal
          supplier={editing}
          onClose={() => setShowForm(false)}
          onSave={async (input) => {
            if (editing) await onUpdate(editing.id, input);
            else await onAdd(input);
            showToast(editing ? 'Supplier updated.' : 'Supplier added.', 'saved');
            setShowForm(false);
          }}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete Supplier?"
        message={
          pendingDelete
            ? `Delete "${pendingDelete.name}"? Deliveries, commissions and payments already recorded under this supplier will NOT be deleted, but they will no longer be linked to a supplier. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete Supplier"
        cancelLabel="Keep it"
        variant="danger"
        busy={deletingBusy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function SupplierFormModal({
  supplier,
  onClose,
  onSave,
}: {
  supplier: Supplier | null;
  onClose: () => void;
  onSave: (input: SupplierInput) => Promise<void>;
}) {
  const [name, setName] = useState(supplier?.name ?? '');
  const [type, setType] = useState<SupplierType>(supplier?.type ?? 'Brick');
  const [contactName, setContactName] = useState(supplier?.contactName ?? '');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [address, setAddress] = useState(supplier?.address ?? '');
  const [gstin, setGstin] = useState(supplier?.gstin ?? '');
  const [notes, setNotes] = useState(supplier?.notes ?? '');
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
        type,
        contactName: contactName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        gstin: gstin.trim(),
        notes: notes.trim(),
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
            {supplier ? 'Edit Supplier' : 'Add Supplier'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Field label="Supplier Name" required>
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              placeholder="e.g. Sharma Brick Kiln"
            />
          </Field>

          <Field label="Type" required>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as SupplierType)}
              className={inputCls}
            >
              {SUPPLIER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact Person">
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className={inputCls}
                placeholder="Optional"
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
          </div>

          <Field label="Address">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={inputCls}
              placeholder="Optional"
            />
          </Field>

          <Field label="GSTIN">
            <input
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
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
              placeholder="Payment terms, credit period, etc."
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
            {supplier ? 'Save Changes' : 'Add Supplier'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Deliveries                                                          */
/* ------------------------------------------------------------------ */

function DeliveriesView({
  deliveries,
  suppliers,
  supplierById,
  sites,
  siteName,
  loading,
  onAdd,
  onDelete,
  showToast,
}: {
  deliveries: MaterialDelivery[];
  suppliers: Supplier[];
  supplierById: Map<string, Supplier>;
  sites: { id: string; name: string }[];
  siteName: Map<string, string>;
  loading: boolean;
  onAdd: (
    input: Parameters<ReturnType<typeof useMaterialDeliveries>['addDelivery']>[0],
    supplierName?: string
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  showToast: (msg: string, type: 'saved' | 'error') => void;
}) {
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MaterialDelivery | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const filtered = useMemo(() => {
    return deliveries.filter((d) => {
      if (supplierFilter !== 'all' && d.supplierId !== supplierFilter) return false;
      if (fromDate && d.date < fromDate) return false;
      if (toDate && d.date > toDate) return false;
      return true;
    });
  }, [deliveries, supplierFilter, fromDate, toDate]);

  const filteredTotalBilled = filtered.reduce((s, d) => s + d.billAmount, 0);
  const filteredTotalDriver = filtered.reduce((s, d) => s + d.driverPaid, 0);
  const filteredTrucks = filtered.reduce((s, d) => s + d.truckCount, 0);

  const exportCSV = () => {
    const headers = [
      'Date',
      'Supplier',
      'Material',
      'Quantity',
      'Unit',
      'Trucks',
      'Rate/Unit',
      'Bill Amount',
      'Driver Paid',
      'Bill #',
      'Site',
      'Remark',
    ];
    const rows = filtered.map((d) => [
      d.date,
      supplierById.get(d.supplierId)?.name ?? '—',
      d.materialType,
      d.quantity,
      d.unit,
      d.truckCount,
      d.ratePerUnit.toFixed(2),
      d.billAmount.toFixed(2),
      d.driverPaid.toFixed(2),
      d.billNumber || '—',
      d.siteId ? siteName.get(d.siteId) ?? '—' : '—',
      d.remark || '—',
    ]);
    const csv = rowsToCsv([headers, ...rows]);
    downloadCsv(`JC-WMS_Material_Deliveries_${Date.now()}.csv`, csv);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeletingBusy(true);
    try {
      await onDelete(pendingDelete.id);
      showToast('Delivery deleted.', 'saved');
      setPendingDelete(null);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap">
        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="px-4 py-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-slate-900 dark:text-white font-medium text-sm"
        >
          <option value="all">All Suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
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
          disabled={suppliers.length === 0}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors whitespace-nowrap disabled:opacity-50"
          title={suppliers.length === 0 ? 'Add a supplier first' : 'Log a new delivery'}
        >
          <Plus className="w-5 h-5" /> Log Delivery
        </button>
      </div>

      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-orange-50 dark:bg-orange-950/40 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-orange-600 dark:text-orange-400 leading-none">
              ₹{filteredTotalBilled.toFixed(0)}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
              Billed
            </p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 leading-none">
              ₹{filteredTotalDriver.toFixed(0)}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
              Driver Paid
            </p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/40 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400 leading-none">
              {filteredTrucks}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
              Truck Loads
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading deliveries…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Truck className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {deliveries.length === 0
              ? 'No deliveries yet. Log your first truck load to get started.'
              : 'No deliveries match your filters.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Supplier / Material
                  </th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider hidden md:table-cell">
                    Qty
                  </th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Bill
                  </th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Driver Paid
                  </th>
                  <th className="px-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const sup = supplierById.get(d.supplierId);
                  return (
                    <tr
                      key={d.id}
                      className="border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: '2-digit',
                        })}
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {sup?.name ?? '—'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {d.materialType}
                          {d.truckCount > 0 && ` · ${d.truckCount} truck${d.truckCount > 1 ? 's' : ''}`}
                          {d.billNumber && ` · #${d.billNumber}`}
                          {d.siteId && ` · ${siteName.get(d.siteId) ?? ''}`}
                        </p>
                      </td>
                      <td className="text-right px-3 py-3 text-xs text-slate-600 dark:text-slate-300 hidden md:table-cell whitespace-nowrap">
                        {d.quantity} {d.unit}
                        <span className="text-slate-400 dark:text-slate-500 ml-1">
                          @₹{d.ratePerUnit.toFixed(0)}
                        </span>
                      </td>
                      <td className="text-right px-3 py-3 text-sm font-bold text-orange-600 dark:text-orange-400 whitespace-nowrap">
                        ₹{d.billAmount.toFixed(0)}
                      </td>
                      <td className="text-right px-3 py-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {d.driverPaid > 0 ? `₹${d.driverPaid.toFixed(0)}` : '—'}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <button
                          onClick={() => setPendingDelete(d)}
                          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                          title="Delete delivery"
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
        <DeliveryFormModal
          suppliers={suppliers}
          sites={sites}
          onClose={() => setShowForm(false)}
          onSave={async (input, supplierName) => {
            await onAdd(input, supplierName);
            showToast('Delivery logged.', 'saved');
            setShowForm(false);
          }}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete Delivery?"
        message={
          pendingDelete
            ? `Delete this ₹${pendingDelete.billAmount.toFixed(
                0
              )} delivery? Any Site Ledger entry created from it will remain in place — you must remove it separately if needed.`
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

function DeliveryFormModal({
  suppliers,
  sites,
  onClose,
  onSave,
}: {
  suppliers: Supplier[];
  sites: { id: string; name: string }[];
  onClose: () => void;
  onSave: (
    input: Parameters<ReturnType<typeof useMaterialDeliveries>['addDelivery']>[0],
    supplierName?: string
  ) => Promise<void>;
}) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [siteId, setSiteId] = useState<string>('');
  const [date, setDate] = useState(todayStr);
  const [materialType, setMaterialType] = useState<string>('Bricks');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<MaterialUnit>('pieces');
  const [truckCount, setTruckCount] = useState('');
  const [ratePerUnit, setRatePerUnit] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [driverPaid, setDriverPaid] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [remark, setRemark] = useState('');
  const [logToSite, setLogToSite] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-compute bill amount whenever qty × rate changes, unless the user has
  // manually edited the bill field. `billManuallyEdited` tracks that intent.
  const [billManuallyEdited, setBillManuallyEdited] = useState(false);

  useEffect(() => {
    if (billManuallyEdited) return;
    const q = parseFloat(quantity) || 0;
    const r = parseFloat(ratePerUnit) || 0;
    if (q > 0 && r > 0) setBillAmount(String(roundCurrency(q * r)));
  }, [quantity, ratePerUnit, billManuallyEdited]);

  const driverPaidNum = parseFloat(driverPaid) || 0;
  const canBridge = Boolean(siteId) && driverPaidNum > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      setError('Please select a supplier.');
      return;
    }
    const bill = parseFloat(billAmount) || 0;
    if (bill <= 0) {
      setError('Enter a valid bill amount.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const sup = suppliers.find((s) => s.id === supplierId);
      await onSave(
        {
          supplierId,
          siteId: siteId || null,
          date,
          materialType: materialType.trim() || 'Other',
          quantity: parseFloat(quantity) || 0,
          unit,
          truckCount: parseFloat(truckCount) || 0,
          ratePerUnit: parseFloat(ratePerUnit) || 0,
          billAmount: bill,
          driverPaid: driverPaidNum,
          billNumber: billNumber.trim(),
          remark: remark.trim(),
          logToSiteLedger: logToSite && canBridge,
        },
        sup?.name
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
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-100 dark:bg-blue-950/40">
              <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Log Material Delivery
            </h2>
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
            <Field label="Supplier" required>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className={inputCls}
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.type}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Delivery Date" required>
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
            <Field label="Material" required>
              <input
                list="common-materials"
                value={materialType}
                onChange={(e) => setMaterialType(e.target.value)}
                className={inputCls}
                placeholder="e.g. Bricks"
              />
              <datalist id="common-materials">
                {COMMON_MATERIALS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            <Field label="Bill / Challan Number">
              <input
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                className={inputCls}
                placeholder="Optional"
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Quantity">
              <input
                type="number"
                step="0.01"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={inputCls}
                placeholder="0"
              />
            </Field>
            <Field label="Unit">
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as MaterialUnit)}
                className={inputCls}
              >
                {MATERIAL_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Truck Count">
              <input
                type="number"
                step="1"
                min="0"
                value={truckCount}
                onChange={(e) => setTruckCount(e.target.value)}
                className={inputCls}
                placeholder="0"
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Rate / Unit (₹)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={ratePerUnit}
                onChange={(e) => setRatePerUnit(e.target.value)}
                className={inputCls}
                placeholder="0"
              />
            </Field>
            <Field label="Bill Amount (₹)" required>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={billAmount}
                onChange={(e) => {
                  setBillAmount(e.target.value);
                  setBillManuallyEdited(true);
                }}
                className={inputCls}
                placeholder="0"
              />
            </Field>
            <Field label="Driver Paid (₹)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={driverPaid}
                onChange={(e) => setDriverPaid(e.target.value)}
                className={inputCls}
                placeholder="0"
              />
            </Field>
          </div>

          <Field label="Link to Site (optional)">
            <select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className={inputCls}
            >
              <option value="">— Not linked to any site —</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
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
                  Also log ₹{driverPaidNum.toFixed(0)} driver payment to site ledger
                </p>
                <p className="text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                  Creates a debit entry under "Material - {materialType || 'Material'}" for the
                  selected site.
                </p>
              </div>
            </label>
          )}

          <Field label="Remark">
            <input
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className={inputCls}
              placeholder="Optional — e.g. 50% advance, balance on next trip"
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
            Save Delivery
          </button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Commissions                                                         */
/* ------------------------------------------------------------------ */

const COMMISSION_STATUS_STYLE: Record<
  Commission['status'],
  { label: string; bg: string; text: string }
> = {
  pending: {
    label: 'Pending',
    bg: 'bg-amber-100 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-400',
  },
  partial: {
    label: 'Partial',
    bg: 'bg-blue-100 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-400',
  },
  received: {
    label: 'Received',
    bg: 'bg-emerald-100 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
};

function CommissionsView({
  commissions,
  suppliers,
  supplierById,
  loading,
  onAdd,
  onRecordReceipt,
  onResetReceipt,
  onDelete,
  showToast,
}: {
  commissions: Commission[];
  suppliers: Supplier[];
  supplierById: Map<string, Supplier>;
  loading: boolean;
  onAdd: (input: Parameters<ReturnType<typeof useCommissions>['addCommission']>[0]) => Promise<void>;
  onRecordReceipt: (id: string, amount: number, date: string) => Promise<void>;
  onResetReceipt: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  showToast: (msg: string, type: 'saved' | 'error') => void;
}) {
  const [statusFilter, setStatusFilter] = useState<'all' | Commission['status']>('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [receiving, setReceiving] = useState<Commission | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Commission | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const filtered = useMemo(() => {
    return commissions.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (supplierFilter !== 'all' && c.supplierId !== supplierFilter) return false;
      return true;
    });
  }, [commissions, statusFilter, supplierFilter]);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeletingBusy(true);
    try {
      await onDelete(pendingDelete.id);
      showToast('Commission deleted.', 'saved');
      setPendingDelete(null);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | Commission['status'])}
          className="px-4 py-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-slate-900 dark:text-white font-medium text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="received">Received</option>
        </select>
        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="px-4 py-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-slate-900 dark:text-white font-medium text-sm"
        >
          <option value="all">All Suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <button
          onClick={() => setShowForm(true)}
          disabled={suppliers.length === 0}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors whitespace-nowrap disabled:opacity-50"
          title={suppliers.length === 0 ? 'Add a supplier first' : 'Add a commission'}
        >
          <Plus className="w-5 h-5" /> Add Commission
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading commissions…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Percent className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {commissions.length === 0
              ? 'No commissions yet. Add one to track what the quarries owe you.'
              : 'No commissions match your filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const sup = supplierById.get(c.supplierId);
            const style = COMMISSION_STATUS_STYLE[c.status];
            const remaining = Math.max(0, c.amount - c.receivedAmount);
            return (
              <div
                key={c.id}
                className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-950/40 rounded-xl flex items-center justify-center shrink-0">
                      <Percent className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">
                          {sup?.name ?? 'Unknown supplier'}
                        </p>
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${style.bg} ${style.text}`}
                        >
                          {style.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {c.materialType} · {c.quantity} {c.unit || 'units'} @ ₹
                        {c.ratePerUnit.toFixed(2)}/{c.unit || 'unit'} ·{' '}
                        {new Date(c.date + 'T00:00:00').toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: '2-digit',
                        })}
                      </p>
                      {c.remark && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                          {c.remark}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-slate-900 dark:text-white leading-none">
                      ₹{c.amount.toFixed(0)}
                    </p>
                    {c.status !== 'received' && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
                        ₹{remaining.toFixed(0)} pending
                      </p>
                    )}
                    {c.status === 'received' && (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center justify-end gap-1">
                        <BadgeCheck className="w-3 h-3" /> Fully received
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap items-center gap-2">
                  {c.status !== 'received' ? (
                    <button
                      onClick={() => setReceiving(c)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors text-xs active:scale-95"
                    >
                      <Check className="w-3.5 h-3.5" /> Record Receipt
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        try {
                          await onResetReceipt(c.id);
                          showToast('Commission reset to pending.', 'saved');
                        } catch (err) {
                          showToast((err as Error).message, 'error');
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors text-xs active:scale-95"
                    >
                      <AlertCircle className="w-3.5 h-3.5" /> Undo Receipt
                    </button>
                  )}
                  <div className="flex-1" />
                  {c.receivedAmount > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Received ₹{c.receivedAmount.toFixed(0)} / ₹{c.amount.toFixed(0)}
                      {c.receivedDate && ` · last on ${c.receivedDate}`}
                    </p>
                  )}
                  <button
                    onClick={() => setPendingDelete(c)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                    title="Delete commission"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <CommissionFormModal
          suppliers={suppliers}
          onClose={() => setShowForm(false)}
          onSave={async (input) => {
            await onAdd(input);
            showToast('Commission added.', 'saved');
            setShowForm(false);
          }}
        />
      )}

      {receiving && (
        <ReceiptModal
          commission={receiving}
          onClose={() => setReceiving(null)}
          onConfirm={async (amount, date) => {
            await onRecordReceipt(receiving.id, amount, date);
            showToast('Receipt recorded.', 'saved');
            setReceiving(null);
          }}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete Commission?"
        message={
          pendingDelete
            ? `Delete this ₹${pendingDelete.amount.toFixed(0)} commission from "${
                supplierById.get(pendingDelete.supplierId)?.name ?? 'supplier'
              }"? This cannot be undone.`
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

function CommissionFormModal({
  suppliers,
  onClose,
  onSave,
}: {
  suppliers: Supplier[];
  onClose: () => void;
  onSave: (input: Parameters<ReturnType<typeof useCommissions>['addCommission']>[0]) => Promise<void>;
}) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [date, setDate] = useState(todayStr);
  const [materialType, setMaterialType] = useState('Sand');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('cft');
  const [ratePerUnit, setRatePerUnit] = useState('');
  const [amount, setAmount] = useState('');
  const [amountManuallyEdited, setAmountManuallyEdited] = useState(false);
  const [remark, setRemark] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (amountManuallyEdited) return;
    const q = parseFloat(quantity) || 0;
    const r = parseFloat(ratePerUnit) || 0;
    if (q > 0 && r > 0) setAmount(String(roundCurrency(q * r)));
  }, [quantity, ratePerUnit, amountManuallyEdited]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      setError('Please select a supplier.');
      return;
    }
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) {
      setError('Enter a valid commission amount.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        supplierId,
        date,
        materialType: materialType.trim() || 'Other',
        quantity: parseFloat(quantity) || 0,
        unit,
        ratePerUnit: parseFloat(ratePerUnit) || 0,
        amount: amt,
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
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-purple-100 dark:bg-purple-950/40">
              <Percent className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Add Commission
            </h2>
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
            <Field label="Supplier" required>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className={inputCls}
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date" required>
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
            <Field label="Material" required>
              <input
                list="common-materials-comm"
                value={materialType}
                onChange={(e) => setMaterialType(e.target.value)}
                className={inputCls}
              />
              <datalist id="common-materials-comm">
                {COMMON_MATERIALS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            <Field label="Unit">
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className={inputCls}
                placeholder="cft / pieces / tons"
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Quantity">
              <input
                type="number"
                step="0.01"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={inputCls}
                placeholder="0"
              />
            </Field>
            <Field label="Rate / Unit (₹)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={ratePerUnit}
                onChange={(e) => setRatePerUnit(e.target.value)}
                className={inputCls}
                placeholder="0"
              />
            </Field>
            <Field label="Amount (₹)" required>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setAmountManuallyEdited(true);
                }}
                className={inputCls}
                placeholder="0"
              />
            </Field>
          </div>

          <Field label="Remark">
            <input
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className={inputCls}
              placeholder="e.g. Per-truck commission for site A"
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
            Save Commission
          </button>
        </form>
      </div>
    </div>
  );
}

function ReceiptModal({
  commission,
  onClose,
  onConfirm,
}: {
  commission: Commission;
  onClose: () => void;
  onConfirm: (amount: number, date: string) => Promise<void>;
}) {
  const remaining = Math.max(0, commission.amount - commission.receivedAmount);
  const [amount, setAmount] = useState(String(remaining.toFixed(0)));
  const [date, setDate] = useState(todayStr);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) {
      setError('Enter a positive amount.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm(amt, date);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xs p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">Record Receipt</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Commission of ₹{commission.amount.toFixed(0)} · ₹{commission.receivedAmount.toFixed(0)}{' '}
          already received · <span className="font-semibold">₹{remaining.toFixed(0)} remaining</span>
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Amount Received Now (₹)" required>
            <input
              autoFocus
              required
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Receipt Date" required>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
            />
          </Field>
          {error && (
            <p className="text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/40 rounded-lg p-2">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 text-sm active:scale-95"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Record
          </button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Khata (passbook + payments)                                         */
/* ------------------------------------------------------------------ */

function KhataView({
  suppliers,
  supplierById,
  khata,
  deliveries,
  payments,
  loading,
  onAddPayment,
  onDeletePayment,
  showToast,
}: {
  suppliers: Supplier[];
  supplierById: Map<string, Supplier>;
  khata: Map<string, { billed: number; paid: number; due: number; deliveries: number; payments: number }>;
  deliveries: MaterialDelivery[];
  payments: ReturnType<typeof useSupplierPayments>['payments'];
  loading: boolean;
  onAddPayment: (input: Parameters<ReturnType<typeof useSupplierPayments>['addPayment']>[0]) => Promise<void>;
  onDeletePayment: (id: string) => Promise<void>;
  showToast: (msg: string, type: 'saved' | 'error') => void;
}) {
  const [openSupplier, setOpenSupplier] = useState<Supplier | null>(null);

  const rows = useMemo(() => {
    return suppliers
      .map((s) => ({ supplier: s, k: khata.get(s.id)! }))
      .filter((r) => r.k)
      .sort((a, b) => b.k.due - a.k.due);
  }, [suppliers, khata]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading khata…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-16">
        <BookOpen className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
        <p className="text-slate-500 dark:text-slate-400 font-medium">
          No suppliers yet. Add one to start tracking their khata.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider hidden sm:table-cell">
                  Deliveries
                </th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Total Billed
                </th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Total Paid
                </th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Net Due
                </th>
                <th className="px-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ supplier, k }) => (
                <tr
                  key={supplier.id}
                  className="border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/40 rounded-lg flex items-center justify-center font-bold text-amber-700 dark:text-amber-400 text-sm">
                        {supplier.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {supplier.name}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {supplier.type}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="text-right px-3 py-3 text-xs text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                    {k.deliveries} / {k.payments} pay
                  </td>
                  <td className="text-right px-3 py-3 text-sm font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                    ₹{k.billed.toFixed(0)}
                  </td>
                  <td className="text-right px-3 py-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    ₹{k.paid.toFixed(0)}
                  </td>
                  <td
                    className={`text-right px-3 py-3 text-sm font-bold whitespace-nowrap ${
                      k.due > 0
                        ? 'text-red-600 dark:text-red-400'
                        : k.due < 0
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    ₹{k.due.toFixed(0)}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <button
                      onClick={() => setOpenSupplier(supplier)}
                      className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition-colors"
                      title="Open passbook"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {openSupplier && (
        <SupplierPassbookModal
          supplier={openSupplier}
          deliveries={deliveries.filter((d) => d.supplierId === openSupplier.id)}
          payments={payments.filter((p) => p.supplierId === openSupplier.id)}
          onClose={() => setOpenSupplier(null)}
          onAddPayment={async (input) => {
            await onAddPayment({ ...input, supplierId: openSupplier.id });
            showToast('Payment recorded.', 'saved');
          }}
          onDeletePayment={onDeletePayment}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function SupplierPassbookModal({
  supplier,
  deliveries,
  payments,
  onClose,
  onAddPayment,
  onDeletePayment,
  showToast,
}: {
  supplier: Supplier;
  deliveries: MaterialDelivery[];
  payments: ReturnType<typeof useSupplierPayments>['payments'];
  onClose: () => void;
  onAddPayment: (
    input: Omit<
      Parameters<ReturnType<typeof useSupplierPayments>['addPayment']>[0],
      'supplierId'
    >
  ) => Promise<void>;
  onDeletePayment: (id: string) => Promise<void>;
  showToast: (msg: string, type: 'saved' | 'error') => void;
}) {
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const { timeline, totalBilled, totalPaid, netDue } = useMemo(() => {
    type Row =
      | { kind: 'delivery'; id: string; date: string; amount: number; label: string; sub: string; createdAt: number }
      | { kind: 'payment'; id: string; date: string; amount: number; label: string; sub: string; createdAt: number };

    const rows: Row[] = [];
    deliveries.forEach((d) =>
      rows.push({
        kind: 'delivery',
        id: d.id,
        date: d.date,
        amount: d.billAmount,
        label: d.materialType,
        sub: `${d.quantity} ${d.unit}${d.truckCount ? ` · ${d.truckCount} truck${d.truckCount > 1 ? 's' : ''}` : ''}${
          d.billNumber ? ` · #${d.billNumber}` : ''
        }`,
        createdAt: d.createdAt,
      })
    );
    payments.forEach((p) =>
      rows.push({
        kind: 'payment',
        id: p.id,
        date: p.date,
        amount: p.amount,
        label: `${p.paymentMode}${p.reference ? ` · ${p.reference}` : ''}`,
        sub: p.remark || 'Payment to supplier',
        createdAt: p.createdAt,
      })
    );
    rows.sort((a, b) => {
      const c = a.date.localeCompare(b.date);
      if (c !== 0) return c;
      return a.createdAt - b.createdAt;
    });

    let running = 0;
    const timeline = rows.map((r) => {
      if (r.kind === 'delivery') running += r.amount;
      else running -= r.amount;
      return { ...r, running: roundCurrency(running) };
    });

    const billed = roundCurrency(deliveries.reduce((s, d) => s + d.billAmount, 0));
    const paid = roundCurrency(payments.reduce((s, p) => s + p.amount, 0));

    return { timeline, totalBilled: billed, totalPaid: paid, netDue: roundCurrency(billed - paid) };
  }, [deliveries, payments]);

  const handleDeletePayment = async () => {
    if (!pendingDelete) return;
    setDeletingBusy(true);
    try {
      await onDeletePayment(pendingDelete);
      showToast('Payment deleted.', 'saved');
      setPendingDelete(null);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center font-bold text-amber-700 dark:text-amber-400 text-lg shrink-0">
              {supplier.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                {supplier.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{supplier.type} Khata</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Totals */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-orange-50 dark:bg-orange-950/30 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-orange-600 dark:text-orange-400 leading-none">
                ₹{totalBilled.toFixed(0)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                Total Billed
              </p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 leading-none">
                ₹{totalPaid.toFixed(0)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                Total Paid
              </p>
            </div>
            <div
              className={`rounded-xl p-3 text-center ${
                netDue > 0
                  ? 'bg-red-500 dark:bg-red-600'
                  : netDue < 0
                  ? 'bg-blue-500 dark:bg-blue-600'
                  : 'bg-slate-200 dark:bg-zinc-700'
              }`}
            >
              <p
                className={`text-lg font-bold leading-none ${
                  netDue !== 0 ? 'text-white' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                ₹{Math.abs(netDue).toFixed(0)}
              </p>
              <p
                className={`text-[11px] font-semibold mt-1 ${
                  netDue !== 0 ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {netDue > 0 ? 'Net Due' : netDue < 0 ? 'Advance Paid' : 'Settled'}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setShowAddPayment(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors text-sm active:scale-95"
            >
              <Plus className="w-4 h-4" /> Record Payment
            </button>
          </div>

          {/* Timeline */}
          {timeline.length === 0 ? (
            <p className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
              No transactions yet for this supplier.
            </p>
          ) : (
            <div className="space-y-2">
              {timeline.map((row) => (
                <div
                  key={`${row.kind}-${row.id}`}
                  className="flex items-center justify-between bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        row.kind === 'delivery'
                          ? 'bg-orange-100 dark:bg-orange-950/40'
                          : 'bg-emerald-100 dark:bg-emerald-950/40'
                      }`}
                    >
                      {row.kind === 'delivery' ? (
                        <Truck className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      ) : (
                        <IndianRupee className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {row.label}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {new Date(row.date + 'T00:00:00').toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: '2-digit',
                        })}{' '}
                        · {row.sub}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p
                      className={`text-sm font-bold whitespace-nowrap ${
                        row.kind === 'delivery'
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {row.kind === 'delivery' ? '+' : '−'}₹{row.amount.toFixed(0)}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      Bal ₹{row.running.toFixed(0)}
                    </p>
                  </div>
                  {row.kind === 'payment' && (
                    <button
                      onClick={() => setPendingDelete(row.id)}
                      className="ml-2 p-1.5 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete payment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAddPayment && (
        <PaymentFormModal
          onClose={() => setShowAddPayment(false)}
          onSave={async (input) => {
            await onAddPayment(input);
            setShowAddPayment(false);
          }}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete Payment?"
        message="Delete this payment? The khata balance will be recalculated automatically. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Keep it"
        variant="danger"
        busy={deletingBusy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDeletePayment}
      />
    </div>
  );
}

function PaymentFormModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (input: {
    date: string;
    amount: number;
    paymentMode: SupplierPaymentMode;
    reference: string;
    remark: string;
  }) => Promise<void>;
}) {
  const [date, setDate] = useState(todayStr);
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<SupplierPaymentMode>('Cash');
  const [reference, setReference] = useState('');
  const [remark, setRemark] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) {
      setError('Enter a positive amount.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        date,
        amount: amt,
        paymentMode,
        reference: reference.trim(),
        remark: remark.trim(),
      });
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">Record Payment</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
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
          <Field label="Date" required>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Payment Mode">
            <div className="grid grid-cols-4 gap-1.5">
              {SUPPLIER_PAYMENT_MODES.map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setPaymentMode(m)}
                  className={`py-2 rounded-lg border-2 text-[11px] font-semibold transition-all active:scale-95 ${
                    paymentMode === m
                      ? 'bg-amber-400 text-slate-900 border-amber-400'
                      : 'bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-zinc-700'
                  }`}
                >
                  {m.split(' ')[0]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Reference">
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className={inputCls}
              placeholder="Cheque #, UPI txn ID, etc."
            />
          </Field>
          <Field label="Remark">
            <input
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className={inputCls}
              placeholder="Optional"
            />
          </Field>
          {error && (
            <p className="text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/40 rounded-lg p-2">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 text-sm active:scale-95"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <IndianRupee className="w-4 h-4" />}
            Save Payment
          </button>
        </form>
      </div>
    </div>
  );
}