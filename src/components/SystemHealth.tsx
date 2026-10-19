import { useState, useRef, useEffect } from 'react';
import {
  Activity, Database, HardDriveDownload, HardDriveUpload, RefreshCw,
  CheckCircle2, AlertTriangle, Users, CalendarCheck, Wallet, Building2,
  Receipt, Loader2, ShieldCheck, Wifi, WifiOff, Trash2,
  Clock, Package, FileStack, HardDrive, HandCoins,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSystemHealth, formatBytes } from '@/hooks/useSystemHealth';
import { useBackup, type BackupPayload } from '@/hooks/useBackup';
import { downloadJson } from '@/utils/csv';
import ConfirmDialog from '@/components/ConfirmDialog';

const FIREBASE_FREE_TIER_BYTES = 1 * 1024 * 1024 * 1024; // 1 GiB

function relativeTime(ts: number | null): string {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

type PendingRestore = {
  payload: BackupPayload;
  crossAccount: boolean;
};

export default function SystemHealth() {
  const { user } = useAuth();
  const {
    counts,
    storageBytes,
    storageComputedAt,
    loading,
    error,
    lastChecked,
    refresh,
  } = useSystemHealth();
  const {
    backup,
    restore,
    wipeEverything,
    busy,
    progress,
    error: backupError,
  } = useBackup();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [toast, setToast] = useState<{ msg: string; type: 'saved' | 'error' } | null>(null);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const showToast = (msg: string, type: 'saved' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2600);
  };

  const handleBackup = async () => {
    try {
      const payload = await backup();
      const filename = `JCWMS_Backup_${new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19)}.json`;
      downloadJson(filename, payload);
      showToast('Backup downloaded successfully.', 'saved');
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BackupPayload;
      if (parsed.version !== 1 || parsed.app !== 'JCWMS' || !parsed.data) {
        throw new Error('This file does not look like a JCWMS backup.');
      }
      // Backup from a different account is now allowed — it will be
      // imported into whichever account is signed in. We surface a
      // warning in the confirm dialog instead of blocking.
      const crossAccount = parsed.exportedBy !== user?.uid;
      setPendingRestore({ payload: parsed, crossAccount });
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmRestore = async () => {
    if (!pendingRestore) return;
    try {
      await restore(pendingRestore.payload, restoreMode);
      showToast('Restore completed successfully.', 'saved');
      setPendingRestore(null);
      await refresh();
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  const handleClearAll = async () => {
    try {
      await wipeEverything();
      showToast('All data cleared.', 'saved');
      setShowClearConfirm(false);
      await refresh();
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  const storagePercent = Math.min(
    100,
    (storageBytes / FIREBASE_FREE_TIER_BYTES) * 100
  );
  const storageBarColor =
    storagePercent > 80
      ? 'bg-red-500'
      : storagePercent > 50
      ? 'bg-amber-500'
      : 'bg-emerald-500';

  const storageBarWidth = Math.max(storagePercent, storageBytes > 0 ? 1 : 0);

  const health = loading
    ? 'checking'
    : error
    ? 'error'
    : isOnline
    ? 'healthy'
    : 'offline';

  const healthMeta = {
    healthy: {
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      border: 'border-emerald-200 dark:border-emerald-900',
      label: 'All Systems Operational',
      detail: 'Database connected. Data sync is active.',
    },
    offline: {
      icon: WifiOff,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      border: 'border-amber-200 dark:border-amber-900',
      label: 'Offline Mode',
      detail: 'Changes are being queued locally and will sync when reconnected.',
    },
    error: {
      icon: AlertTriangle,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-950/30',
      border: 'border-red-200 dark:border-red-900',
      label: 'Connection Problem',
      detail: error ?? 'Could not reach Firestore.',
    },
    checking: {
      icon: Loader2,
      color: 'text-slate-600 dark:text-slate-300',
      bg: 'bg-slate-100 dark:bg-zinc-800',
      border: 'border-slate-200 dark:border-zinc-700',
      label: 'Checking…',
      detail: 'Gathering system information.',
    },
  }[health];

  const HealthIcon = healthMeta.icon;

  /* ------------------------------------------------------------------ */
  /* Restore dialog message                                              */
  /* ------------------------------------------------------------------ */

  const buildRestoreMessage = (): string => {
    if (!pendingRestore) return '';
    const d = pendingRestore.payload.data;
    const parts = [
      `${d.workers.length} worker${d.workers.length === 1 ? '' : 's'}`,
      `${d.attendance.length} attendance record${d.attendance.length === 1 ? '' : 's'}`,
      `${d.advances.length} advance${d.advances.length === 1 ? '' : 's'}`,
      `${d.sites.length} site${d.sites.length === 1 ? '' : 's'}`,
    ];
    const suppliers = d.suppliers ?? [];
    const deliveries = d.deliveries ?? [];
    const commissions = d.commissions ?? [];
    const payments = d.supplierPayments ?? [];
    const contractors = d.contractors ?? [];
    const contractorPayments = d.contractorPayments ?? [];

    if (suppliers.length > 0)
      parts.push(`${suppliers.length} supplier${suppliers.length === 1 ? '' : 's'}`);
    if (deliveries.length > 0)
      parts.push(
        `${deliveries.length} material deliver${deliveries.length === 1 ? 'y' : 'ies'}`
      );
    if (commissions.length > 0)
      parts.push(`${commissions.length} commission${commissions.length === 1 ? '' : 's'}`);
    if (payments.length > 0)
      parts.push(`${payments.length} supplier payment${payments.length === 1 ? '' : 's'}`);
    if (contractors.length > 0)
      parts.push(`${contractors.length} contractor${contractors.length === 1 ? '' : 's'}`);
    if (contractorPayments.length > 0)
      parts.push(
        `${contractorPayments.length} contractor payment${contractorPayments.length === 1 ? '' : 's'}`
      );

    return `This will restore ${parts.join(', ')}.`;
  };

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

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">System Health</h2>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors text-xs active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className={`${healthMeta.bg} ${healthMeta.border} border rounded-2xl p-4 mb-5 flex items-center gap-3`}>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${healthMeta.bg} border ${healthMeta.border}`}>
          <HealthIcon className={`w-5 h-5 ${healthMeta.color} ${health === 'checking' ? 'animate-spin' : ''}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-sm ${healthMeta.color}`}>{healthMeta.label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{healthMeta.detail}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          {isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-500" /> Online
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-500" /> Offline
            </>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-slate-200 dark:border-zinc-800 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Storage Usage</h3>
          </div>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            {formatBytes(storageBytes)} / 1 GiB
          </span>
        </div>
        <div className="w-full h-3 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${storageBarColor}`}
            style={{ width: `${storageBarWidth}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {storageBytes > 0
              ? `${storagePercent < 0.01 ? '<0.01' : storagePercent.toFixed(2)}% of Firebase free-tier limit`
              : 'Not yet measured'}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {storageComputedAt ? `measured ${relativeTime(storageComputedAt)}` : ''}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-slate-200 dark:border-zinc-800 mb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileStack className="w-5 h-5 text-indigo-500" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Total Documents</h3>
          </div>
          <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {counts?.totalDocs ?? 0}
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Every worker, attendance record, advance, site, transaction, supplier,
          delivery, commission, payment, contractor and settings document across your account.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        <MetricCard
          icon={Users}
          label="Workers"
          value={counts?.workers.total ?? 0}
          sub={
            counts
              ? `${counts.workers.active} active · ${counts.workers.inactive} inactive`
              : ''
          }
          color="text-amber-600 dark:text-amber-400"
          bg="bg-amber-50 dark:bg-amber-950/30"
        />
        <MetricCard
          icon={CalendarCheck}
          label="Attendance"
          value={counts?.attendance ?? 0}
          color="text-emerald-600 dark:text-emerald-400"
          bg="bg-emerald-50 dark:bg-emerald-950/30"
        />
        <MetricCard
          icon={Wallet}
          label="Advances"
          value={counts?.advances ?? 0}
          color="text-purple-600 dark:text-purple-400"
          bg="bg-purple-50 dark:bg-purple-950/30"
        />
        <MetricCard
          icon={Building2}
          label="Sites"
          value={counts?.sites ?? 0}
          color="text-blue-600 dark:text-blue-400"
          bg="bg-blue-50 dark:bg-blue-950/30"
        />
        <MetricCard
          icon={Receipt}
          label="Transactions"
          value={counts?.transactions ?? 0}
          color="text-orange-600 dark:text-orange-400"
          bg="bg-orange-50 dark:bg-orange-950/30"
        />
      </div>

      {counts?.materials && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <MetricCard
            icon={Building2}
            label="Suppliers"
            value={counts.materials.suppliers}
            color="text-red-600 dark:text-red-400"
            bg="bg-red-50 dark:bg-red-950/30"
          />
          <MetricCard
            icon={Package}
            label="Deliveries"
            value={counts.materials.deliveries}
            sub={
              counts.materials.trucks > 0
                ? `${counts.materials.trucks} truck${counts.materials.trucks === 1 ? '' : 's'}`
                : ''
            }
            color="text-cyan-600 dark:text-cyan-400"
            bg="bg-cyan-50 dark:bg-cyan-950/30"
          />
          <MetricCard
            icon={Receipt}
            label="Commissions"
            value={counts.materials.commissions}
            sub={
              counts.materials.pendingCommissions > 0
                ? `${counts.materials.pendingCommissions} pending`
                : ''
            }
            color="text-fuchsia-600 dark:text-fuchsia-400"
            bg="bg-fuchsia-50 dark:bg-fuchsia-950/30"
          />
          <MetricCard
            icon={Wallet}
            label="Supplier Payments"
            value={counts.materials.supplierPayments}
            color="text-teal-600 dark:text-teal-400"
            bg="bg-teal-50 dark:bg-teal-950/30"
          />
        </div>
      )}

      {counts?.contractors && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          <MetricCard
            icon={Building2}
            label="Contractors"
            value={counts.contractors.total}
            sub={
              counts.contractors.total > 0
                ? `${counts.contractors.active} active`
                : ''
            }
            color="text-amber-600 dark:text-amber-400"
            bg="bg-amber-50 dark:bg-amber-950/30"
          />
          <MetricCard
            icon={HandCoins}
            label="Contractor Payments"
            value={counts.contractors.payments}
            color="text-emerald-600 dark:text-emerald-400"
            bg="bg-emerald-50 dark:bg-emerald-950/30"
          />
          <MetricCard
            icon={Wallet}
            label="Paid to Contractors"
            value={`₹${counts.contractors.totalPaid.toFixed(0)}`}
            color="text-sky-600 dark:text-sky-400"
            bg="bg-sky-50 dark:bg-sky-950/30"
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <InfoTile
          icon={Clock}
          label="Last Checked"
          value={lastChecked ? new Date(lastChecked).toLocaleTimeString() : '—'}
        />
        <InfoTile
          icon={ShieldCheck}
          label="Auth Status"
          value={user?.email ?? 'Signed in'}
        />
        <InfoTile
          icon={Database}
          label="Project ID"
          value={import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'not configured'}
        />
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-slate-200 dark:border-zinc-800 mb-5">
        <div className="flex items-center gap-2 mb-1">
          <HardDriveDownload className="w-5 h-5 text-emerald-500" />
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">Backup & Restore</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
          Download a complete JSON snapshot of all your workers, attendance, advances, sites,
          transactions, material ledger (suppliers, deliveries, commissions, payments),
          contractor payments and role settings. Keep it safe — you can restore it at any time
          (after an app update, device reset, or to move to a new account).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleBackup}
            disabled={busy}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors active:scale-95 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDriveDownload className="w-4 h-4" />}
            Download Backup
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors active:scale-95 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDriveUpload className="w-4 h-4" />}
            Restore From File
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileChosen}
            className="hidden"
          />
        </div>

        {progress && (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {progress}
          </p>
        )}

        {backupError && (
          <p className="mt-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
            {backupError}
          </p>
        )}
      </div>

      <div className="bg-red-50 dark:bg-red-950/20 rounded-2xl p-5 border border-red-200 dark:border-red-900">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h3 className="font-bold text-red-700 dark:text-red-300 text-sm">Danger Zone</h3>
        </div>
        <p className="text-xs text-red-600/80 dark:text-red-400/80 mb-3">
          Permanently delete ALL data (workers, attendance, advances, sites, transactions,
          material ledger, contractor payments and role settings). This action cannot be undone.
          Take a backup first.
        </p>
        <button
          onClick={() => setShowClearConfirm(true)}
          disabled={busy}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors active:scale-95 disabled:opacity-50 text-sm"
        >
          <Trash2 className="w-4 h-4" /> Clear All Data
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Restore confirmation — mode selector embedded INSIDE the dialog.    */}
      {/* ------------------------------------------------------------------ */}
      <ConfirmDialog
        open={pendingRestore !== null}
        title="Restore Backup?"
        message={buildRestoreMessage()}
        confirmLabel="Restore Now"
        cancelLabel="Cancel"
        variant="warning"
        busy={busy}
        onCancel={() => setPendingRestore(null)}
        onConfirm={confirmRestore}
      >
        {pendingRestore?.crossAccount && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg p-2.5 mb-2">
            <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
              <strong>Cross-account backup.</strong> This file was created by a different
              account and will be imported into your current account.
            </p>
          </div>
        )}
        <div>
          <p className="text-xs font-bold text-slate-900 dark:text-white mb-1.5">
            Restore Mode
          </p>
          <label className="flex items-start gap-2 py-1 cursor-pointer">
            <input
              type="radio"
              checked={restoreMode === 'merge'}
              onChange={() => setRestoreMode('merge')}
              className="mt-0.5 accent-amber-500"
            />
            <span className="text-xs text-slate-700 dark:text-slate-200 leading-snug">
              <strong>Merge</strong> — keep existing data, add or overwrite matching IDs.
            </span>
          </label>
          <label className="flex items-start gap-2 py-1 cursor-pointer">
            <input
              type="radio"
              checked={restoreMode === 'replace'}
              onChange={() => setRestoreMode('replace')}
              className="mt-0.5 accent-red-500"
            />
            <span className="text-xs text-slate-700 dark:text-slate-200 leading-snug">
              <strong>Replace</strong> — wipe existing data first. Auto-rolls back on
              failure (a safety backup is taken automatically).
            </span>
          </label>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={showClearConfirm}
        title="Clear All Data?"
        message="This will permanently delete every worker, attendance record, advance, site, transaction, supplier, delivery, commission, supplier payment, contractor, contractor payment and role setting. This action CANNOT be undone. Make a backup first."
        confirmLabel="Yes, Delete Everything"
        cancelLabel="Cancel"
        variant="danger"
        busy={busy}
        onCancel={() => setShowClearConfirm(false)}
        onConfirm={handleClearAll}
      />
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  bg,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
  bg: string;
}) {
  return (
    <div className={`${bg} rounded-xl p-3 border border-transparent`}>
      <Icon className={`w-5 h-5 ${color} mb-2`} />
      <p className={`text-2xl font-bold ${color} leading-none`}>{value}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">{label}</p>
      {sub && (
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>
      )}
    </div>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl p-3 border border-slate-200 dark:border-zinc-800">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">
          {label}
        </p>
      </div>
      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{value}</p>
    </div>
  );
}