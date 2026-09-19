import { useState, useMemo } from 'react';
import {
  X, Pencil, Trash2, Phone, Briefcase, CalendarDays, Plus, Download,
  Loader2, Check, Clock, AlertCircle, TrendingDown, Wallet, Zap,
  ChevronLeft, ChevronRight, Save, IndianRupee, Settings2, CalendarOff,
  RotateCcw, ShieldAlert,
} from 'lucide-react';
import type { Worker } from '@/hooks/useWorkers';
import { useWorkerAttendance, type DayRecord } from '@/hooks/useWorkerAttendance';
import { useWorkerAdvances } from '@/hooks/useWorkerAdvances';
import type { AttendanceStatus } from '@/hooks/useAttendance';
import { useRoles } from '@/hooks/useRoles';
import ManageRolesModal from '@/components/ManageRolesModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { rowsToCsv, downloadCsv } from '@/utils/csv';
import { isToday as isTodayFn, monthLabel } from '@/utils/date';
import { calculateAggregateWages } from '@/utils/calculations';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_BADGE: Record<
  AttendanceStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  present: { label: 'P', bg: 'bg-green-500', text: 'text-white', border: 'border-green-500' },
  half: { label: 'HD', bg: 'bg-amber-500', text: 'text-white', border: 'border-amber-500' },
  absent: { label: 'A', bg: 'bg-red-500', text: 'text-white', border: 'border-red-500' },
  holiday: { label: 'H', bg: 'bg-purple-500', text: 'text-white', border: 'border-purple-500' },
};

type Props = {
  worker: Worker;
  onClose: () => void;
  onUpdate: (
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
  onDelete: (id: string) => Promise<void>;
  onPermanentDelete?: (id: string) => Promise<void>;
  onReactivate?: (id: string) => Promise<void>;
};

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function dateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function WorkerProfile({
  worker,
  onClose,
  onUpdate,
  onDelete,
  onPermanentDelete,
  onReactivate,
}: Props) {
  const [monthStr, setMonthStr] = useState(currentMonthStr);
  const [editing, setEditing] = useState(false);
  const [showDayPopup, setShowDayPopup] = useState<string | null>(null);
  const [showAddAdvance, setShowAddAdvance] = useState(false);
  const [confirmSoftDelete, setConfirmSoftDelete] = useState(false);
  const [confirmHardDelete, setConfirmHardDelete] = useState(false);
  const [showRolesModal, setShowRolesModal] = useState(false);

  const { roles, addRole, updateRole, deleteRole } = useRoles();

  const [year, month] = monthStr.split('-').map(Number);
  const { records, loading: attLoading, saveDay, deleteDay } = useWorkerAttendance(
    worker.id,
    monthStr
  );
  const { advances, loading: advLoading, addAdvance, deleteAdvance } = useWorkerAdvances(
    worker.id,
    monthStr
  );

  const [editName, setEditName] = useState(worker.name);
  const [editPhone, setEditPhone] = useState(worker.phone ?? '');
  const [editRole, setEditRole] = useState(worker.role);
  const [editWage, setEditWage] = useState(String(worker.dailyWage));
  const [editOT, setEditOT] = useState(String(worker.overtimeHourlyRate));
  const [savingEdit, setSavingEdit] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    try {
      await onUpdate(worker.id, {
        name: editName,
        phone: editPhone || null,
        role: editRole,
        dailyWage: parseFloat(editWage) || 0,
        overtimeHourlyRate: parseFloat(editOT) || 0,
      });
      setEditing(false);
    } catch (err) {
      setErrorMessage('Failed to save: ' + (err as Error).message);
    }
    setSavingEdit(false);
  };

  const handleSoftDelete = async () => {
    await onDelete(worker.id);
    onClose();
  };

  const handleHardDelete = async () => {
    if (!onPermanentDelete) return;
    await onPermanentDelete(worker.id);
    onClose();
  };

  const handleReactivate = async () => {
    if (!onReactivate) return;
    await onReactivate(worker.id);
    onClose();
  };

  const calendar = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const cells: ({ day: number; date: string } | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, date: dateStr(year, month - 1, d) });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const stats = useMemo(() => {
    let present = 0, half = 0, absent = 0, holiday = 0,
      otHours = 0, dailyPaid = 0, attendanceAdvances = 0;
    Object.values(records).forEach((r) => {
      if (r.status === 'present') present++;
      else if (r.status === 'half') half++;
      else if (r.status === 'holiday') holiday++;
      else absent++;
      otHours += r.overtimeHours;
      dailyPaid += r.amountPaid || 0;
      attendanceAdvances += r.advanceAmount || 0;
    });
    const gross = calculateAggregateWages(
      { present, half, absent, holiday, otHours },
      worker.dailyWage,
      worker.overtimeHourlyRate
    );
    const khataAdvances = advances.reduce((sum, a) => sum + a.amount, 0);
    const totalAdvances = khataAdvances + attendanceAdvances;
    const totalPaid = dailyPaid + totalAdvances;
    const balance = gross - totalPaid;
    return {
      present, half, absent, holiday, otHours, gross, dailyPaid,
      khataAdvances, attendanceAdvances, totalAdvances, totalPaid, balance,
    };
  }, [records, advances, worker]);

  const loading = attLoading || advLoading;

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1, 1);
    d.setMonth(d.getMonth() + delta);
    setMonthStr(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const downloadMonthlySlip = () => {
    const monthLabelText = monthLabel(monthStr);
    const rows: (string | number)[][] = [];
    rows.push(['JC-WMS Monthly Slip']);
    rows.push(['Worker', worker.name]);
    rows.push(['Phone', worker.phone ?? '-']);
    rows.push(['Role', worker.role]);
    rows.push(['Daily Wage', `Rs.${worker.dailyWage.toFixed(2)}`]);
    rows.push(['OT Rate/hr', `Rs.${worker.overtimeHourlyRate.toFixed(2)}`]);
    rows.push(['Month', monthLabelText]);
    rows.push([]);
    rows.push(['Date', 'Status', 'Overtime Hours', 'Amount Paid', 'Advance Given', 'Remark']);
    Object.entries(records)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, r]) => {
        rows.push([
          date,
          r.status,
          r.overtimeHours.toFixed(2),
          `Rs.${(r.amountPaid || 0).toFixed(2)}`,
          `Rs.${(r.advanceAmount || 0).toFixed(2)}`,
          r.remark || '-',
        ]);
      });
    rows.push([]);
    rows.push(['Summary']);
    rows.push(['Present Days', stats.present]);
    rows.push(['Half Days', stats.half]);
    rows.push(['Absent Days', stats.absent]);
    rows.push(['Holiday Days', stats.holiday]);
    rows.push(['Total OT Hours', stats.otHours.toFixed(2)]);
    rows.push(['Gross Wages', `Rs.${stats.gross.toFixed(2)}`]);
    rows.push(['Daily Amount Paid', `Rs.${stats.dailyPaid.toFixed(2)}`]);
    rows.push(['Khata Advances', `Rs.${stats.khataAdvances.toFixed(2)}`]);
    rows.push(['Attendance Advances', `Rs.${stats.attendanceAdvances.toFixed(2)}`]);
    rows.push(['Total Advances', `Rs.${stats.totalAdvances.toFixed(2)}`]);
    rows.push(['Total Amount Paid', `Rs.${stats.totalPaid.toFixed(2)}`]);
    rows.push(['Net Balance Due', `Rs.${stats.balance.toFixed(2)}`]);

    const csv = rowsToCsv(rows);
    downloadCsv(
      `JC-WMS_${worker.name.replace(/\s+/g, '_')}_${monthStr}.csv`,
      csv
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-none sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-screen sm:max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 z-20 bg-white dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center font-bold text-amber-700 dark:text-amber-400 text-xl">
              {worker.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {worker.name}
                {!worker.active && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-zinc-700 text-slate-500 dark:text-slate-400 uppercase">
                    Inactive
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{worker.role}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-100 dark:bg-zinc-800 rounded-2xl p-4 border border-slate-200 dark:border-zinc-700">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-950/40 rounded-lg flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Total Earned Wage
                </p>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                ₹{stats.gross.toFixed(0)}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                {MONTHS[month - 1]} {year}
              </p>
            </div>

            <div className="bg-slate-100 dark:bg-zinc-800 rounded-2xl p-4 border border-slate-200 dark:border-zinc-700">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-950/40 rounded-lg flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Total Amount Paid
                </p>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                ₹{stats.totalPaid.toFixed(0)}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Daily + attendance + khata advances
              </p>
            </div>

            {stats.balance > 0 ? (
              <div className="bg-red-500 dark:bg-red-600 rounded-2xl p-4 border border-red-600 dark:border-red-500">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-red-100/30 dark:bg-red-900/40 rounded-lg flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-xs font-semibold text-white/90 uppercase tracking-wide">
                    Remaining Balance to Pay
                  </p>
                </div>
                <p className="text-2xl font-bold text-white">₹{stats.balance.toFixed(0)}</p>
                <p className="text-xs text-white/80 mt-1">Pending liability to pay worker</p>
              </div>
            ) : stats.balance < 0 ? (
              <div className="bg-green-500 dark:bg-green-600 rounded-2xl p-4 border border-green-600 dark:border-green-500">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-green-100/30 dark:bg-green-900/40 rounded-lg flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-xs font-semibold text-white/90 uppercase tracking-wide">
                    Advance Outstanding
                  </p>
                </div>
                <p className="text-2xl font-bold text-white">₹{Math.abs(stats.balance).toFixed(0)}</p>
                <p className="text-xs text-white/80 mt-1">Advance given in excess</p>
              </div>
            ) : (
              <div className="bg-slate-200 dark:bg-zinc-700 rounded-2xl p-4 border border-slate-300 dark:border-zinc-600">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-slate-300 dark:bg-zinc-600 rounded-lg flex items-center justify-center">
                    <Check className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  </div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Settled / Nil
                  </p>
                </div>
                <p className="text-2xl font-bold text-slate-600 dark:text-slate-300">₹0</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">All accounts clear</p>
              </div>
            )}
          </div>

          {editing ? (
            <div className="space-y-3 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Name
                  </label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Phone
                  </label>
                  <input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Role
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-sm"
                    >
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowRolesModal(true)}
                      className="flex items-center gap-1 px-2.5 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors text-xs font-semibold whitespace-nowrap"
                      title="Manage Roles"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div></div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Daily Wage (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editWage}
                    onChange={(e) => setEditWage(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    OT Rate/hr (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editOT}
                    onChange={(e) => setEditOT(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="flex-1 py-2.5 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm active:scale-95"
                >
                  {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2.5 text-slate-600 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-2xl p-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <DetailItem icon={Phone} label="Phone" value={worker.phone ?? '—'} />
                <DetailItem icon={Briefcase} label="Role" value={worker.role} />
                <DetailItem
                  icon={IndianRupee}
                  label="Daily Wage"
                  value={`₹${worker.dailyWage.toFixed(0)}`}
                />
                <DetailItem
                  icon={Zap}
                  label="OT Rate/hr"
                  value={`₹${worker.overtimeHourlyRate.toFixed(0)}`}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-slate-600 dark:text-slate-300 font-medium text-sm hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                {worker.active ? (
                  <button
                    onClick={() => setConfirmSoftDelete(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-amber-600 dark:text-amber-400 font-medium text-sm hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Deactivate
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleReactivate}
                      className="flex items-center gap-1.5 px-3 py-2 text-emerald-600 dark:text-emerald-400 font-medium text-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Reactivate
                    </button>
                    {onPermanentDelete && (
                      <button
                        onClick={() => setConfirmHardDelete(true)}
                        className="flex items-center gap-1.5 px-3 py-2 text-red-600 dark:text-red-400 font-medium text-sm hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" /> Permanent Delete
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {confirmSoftDelete && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl p-4">
              <div className="flex items-start gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                  Deactivate {worker.name}? They will be hidden from attendance, but their history remains intact. You can reactivate them later.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSoftDelete}
                  className="flex-1 py-2.5 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 transition-colors text-sm active:scale-95"
                >
                  Yes, Deactivate
                </button>
                <button
                  onClick={() => setConfirmSoftDelete(false)}
                  className="px-4 py-2.5 text-slate-600 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {confirmHardDelete && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-2xl p-4">
              <div className="flex items-start gap-2 mb-3">
                <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                  Permanently delete {worker.name}? Their worker profile is removed. Historical attendance and advance documents remain in Firestore (orphaned). This cannot be undone.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleHardDelete}
                  className="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors text-sm active:scale-95"
                >
                  Yes, Delete Forever
                </button>
                <button
                  onClick={() => setConfirmHardDelete(false)}
                  className="px-4 py-2.5 text-slate-600 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> Attendance Calendar
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => shiftMonth(-1)}
                className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors active:scale-90"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 min-w-[120px] text-center">
                {MONTHS[month - 1]} {year}
              </span>
              <button
                onClick={() => shiftMonth(1)}
                className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors active:scale-90"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading calendar…
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                {DOW.map((d) => (
                  <div
                    key={d}
                    className="text-center text-[11px] font-semibold text-slate-400 dark:text-slate-500 py-1"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {calendar.map((cell, i) => {
                  if (!cell) return <div key={i} className="aspect-square" />;
                  const rec = records[cell.date];
                  const today = isTodayFn(cell.date);
                  const isHoliday = rec?.isHoliday === true;
                  return (
                    <button
                      key={i}
                      onClick={() => setShowDayPopup(cell.date)}
                      title={
                        isHoliday
                          ? `Holiday: ${rec?.holidayReason || 'Declared'}`
                          : undefined
                      }
                      className={`aspect-square rounded-lg border flex flex-col items-center justify-center relative transition-all hover:scale-105 active:scale-95 ${
                        rec
                          ? isHoliday
                            ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900'
                            : rec.status === 'present'
                            ? 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900'
                            : rec.status === 'half'
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900'
                            : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900'
                          : 'bg-slate-50 dark:bg-zinc-800/50 border-slate-100 dark:border-zinc-800'
                      } ${today ? 'ring-2 ring-amber-400' : ''}`}
                    >
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 absolute top-1 left-1.5">
                        {cell.day}
                      </span>
                      <div className="flex-1 flex items-center justify-center">
                        {rec ? (
                          <span
                            className={`text-xs font-bold px-1.5 py-0.5 rounded ${STATUS_BADGE[rec.status].bg} ${STATUS_BADGE[rec.status].text}`}
                          >
                            {STATUS_BADGE[rec.status].label}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                        )}
                      </div>
                      {rec && rec.overtimeHours > 0 && (
                        <span className="text-[9px] font-medium text-blue-600 dark:text-blue-400 absolute bottom-0.5 right-1">
                          +{rec.overtimeHours}h
                        </span>
                      )}
                      {rec && (rec.advanceAmount || 0) > 0 && (
                        <span className="text-[9px] font-bold text-red-600 dark:text-red-400 absolute top-0.5 right-1 bg-red-100 dark:bg-red-950/60 px-1 rounded">
                          ₹{rec.advanceAmount} adv
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> Daily Breakdown — {MONTHS[month - 1]} {year}
            </h3>
            <div className="grid grid-cols-3 gap-2.5">
              <FinCard label="Present" value={String(stats.present)} color="text-green-600 dark:text-green-400" bg="bg-green-50 dark:bg-green-950/30" />
              <FinCard label="Half Days" value={String(stats.half)} color="text-amber-600 dark:text-amber-400" bg="bg-amber-50 dark:bg-amber-950/30" />
              <FinCard label="Absent" value={String(stats.absent)} color="text-red-600 dark:text-red-400" bg="bg-red-50 dark:bg-red-950/30" />
              <FinCard label="Holiday" value={String(stats.holiday)} color="text-purple-600 dark:text-purple-400" bg="bg-purple-50 dark:bg-purple-950/30" />
              <FinCard label="OT Hours" value={stats.otHours.toFixed(1)} color="text-blue-600 dark:text-blue-400" bg="bg-blue-50 dark:bg-blue-950/30" />
              <FinCard label="Gross Wages" value={`₹${stats.gross.toFixed(0)}`} color="text-slate-900 dark:text-white" bg="bg-slate-100 dark:bg-zinc-800" />
              <FinCard label="Att. Adv." value={`₹${stats.attendanceAdvances.toFixed(0)}`} color="text-red-600 dark:text-red-400" bg="bg-red-50 dark:bg-red-950/30" />
              <FinCard label="Khata Adv." value={`₹${stats.khataAdvances.toFixed(0)}`} color="text-purple-600 dark:text-purple-400" bg="bg-purple-50 dark:bg-purple-950/30" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" /> Payment & Advance Ledger — {MONTHS[month - 1]} {year}
              </h3>
              <button
                onClick={() => setShowAddAdvance(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-semibold text-xs rounded-lg hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" /> Add Advance
              </button>
            </div>
            {(() => {
              const dailyAdvances = Object.entries(records)
                .filter(([, r]) => (r.advanceAmount || 0) > 0)
                .map(([date, r]) => ({
                  id: `att_adv_${date}`,
                  date,
                  amount: r.advanceAmount,
                  remark: r.remark,
                  source: 'Attendance',
                }));
              const khataAdvances = advances.map((a) => ({
                id: a.id,
                date: a.date,
                amount: a.amount,
                remark: a.reason ?? '',
                source: 'Khata',
              }));
              const allEntries = [...dailyAdvances, ...khataAdvances].sort((a, b) =>
                b.date.localeCompare(a.date)
              );
              if (allEntries.length === 0) {
                return (
                  <p className="text-center py-6 text-slate-400 dark:text-slate-500 text-sm">
                    No advances recorded this month.
                  </p>
                );
              }
              return (
                <div className="space-y-2">
                  {allEntries.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-3 group"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            e.source === 'Attendance'
                              ? 'bg-red-100 dark:bg-red-950/40'
                              : 'bg-purple-100 dark:bg-purple-950/40'
                          }`}
                        >
                          {e.source === 'Attendance' ? (
                            <CalendarDays className="w-4 h-4 text-red-600 dark:text-red-400" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white text-sm">
                            ₹{e.amount.toFixed(0)}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {new Date(e.date + 'T00:00:00').toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                            })}
                            {e.remark && ` · ${e.remark}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            e.source === 'Attendance'
                              ? 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                              : 'bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400'
                          }`}
                        >
                          {e.source}
                        </span>
                        {e.source === 'Khata' && (
                          <button
                            onClick={() => deleteAdvance(e.id)}
                            className="p-2 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          <button
            onClick={downloadMonthlySlip}
            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors active:scale-95"
          >
            <Download className="w-5 h-5" /> Download Monthly Slip
          </button>
        </div>
      </div>

      {showDayPopup && (
        <DayEditPopup
          date={showDayPopup}
          record={records[showDayPopup]}
          onClose={() => setShowDayPopup(null)}
          onSave={async (status, ot, amountPaid, advanceAmount, remark) => {
            await saveDay(showDayPopup, status, ot, amountPaid, advanceAmount, remark);
            setShowDayPopup(null);
          }}
          onDelete={async () => {
            await deleteDay(showDayPopup);
            setShowDayPopup(null);
          }}
        />
      )}

      {showRolesModal && (
        <ManageRolesModal
          roles={roles}
          workerRoles={[]}
          onAdd={addRole}
          onUpdate={updateRole}
          onDelete={deleteRole}
          onClose={() => setShowRolesModal(false)}
        />
      )}

      {showAddAdvance && (
        <AddAdvancePopup
          onClose={() => setShowAddAdvance(false)}
          onAdd={async (amount, date, reason) => {
            await addAdvance(amount, date, reason);
            setShowAddAdvance(false);
          }}
        />
      )}

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

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 mb-0.5">
        <Icon className="w-3 h-3" /> {label}
      </p>
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function FinCard({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <div className={`${bg} rounded-xl p-3 text-center`}>
      <p className={`text-lg font-bold ${color} leading-none`}>{value}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">{label}</p>
    </div>
  );
}

function DayEditPopup({
  date,
  record,
  onClose,
  onSave,
  onDelete,
}: {
  date: string;
  record: DayRecord | undefined;
  onClose: () => void;
  onSave: (
    status: AttendanceStatus,
    ot: number,
    amountPaid: number,
    advanceAmount: number,
    remark: string
  ) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [status, setStatus] = useState<AttendanceStatus>(record?.status ?? 'absent');
  const [ot, setOt] = useState(record?.overtimeHours ?? 0);
  const [amountPaid, setAmountPaid] = useState(String(record?.amountPaid ?? 0));
  const [advanceAmount, setAdvanceAmount] = useState(String(record?.advanceAmount ?? 0));
  const [remark, setRemark] = useState(record?.remark ?? '');
  const [saving, setSaving] = useState(false);

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const isHoliday = record?.isHoliday === true;

  const handleSave = async () => {
    setSaving(true);
    await onSave(
      status,
      ot,
      parseFloat(amountPaid) || 0,
      parseFloat(advanceAmount) || 0,
      remark.trim()
    );
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xs p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">{dateLabel}</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isHoliday && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 flex items-start gap-2">
            <CalendarOff className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">
              Holiday: {record?.holidayReason || 'Declared'}
            </p>
          </div>
        )}

        <div className="flex gap-2 mb-4">
          {(['present', 'half', 'absent'] as AttendanceStatus[]).map((s) => {
            const cfg = STATUS_BADGE[s];
            const isActive = status === s;
            return (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`flex-1 py-3 rounded-xl border-2 font-semibold text-xs transition-all active:scale-95 flex flex-col items-center gap-1 ${
                  isActive
                    ? `${cfg.bg} ${cfg.text} ${cfg.border}`
                    : 'bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-zinc-700'
                }`}
              >
                {s === 'present' && <Check className="w-4 h-4" />}
                {s === 'half' && <Clock className="w-4 h-4" />}
                {s === 'absent' && <X className="w-4 h-4" />}
                {s === 'present' ? 'Present' : s === 'half' ? 'Half' : 'Absent'}
              </button>
            );
          })}
        </div>

        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
            Overtime Hours
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOt(Math.max(0, ot - 0.5))}
              className="p-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 rounded-lg transition-colors active:scale-90"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="number"
              step="0.5"
              min="0"
              value={ot}
              onChange={(e) => setOt(parseFloat(e.target.value) || 0)}
              className="flex-1 text-center py-2 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-zinc-700 outline-none font-semibold text-sm"
            />
            <button
              onClick={() => setOt(ot + 0.5)}
              className="p-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 rounded-lg transition-colors active:scale-90"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
            Advance (₹)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">
              ₹
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={advanceAmount}
              onChange={(e) => setAdvanceAmount(e.target.value)}
              className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none font-semibold text-sm"
              placeholder="0"
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
            Amount Paid Today (₹)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">
              ₹
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none font-semibold text-sm"
              placeholder="0"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
            Remark / Note
          </label>
          <input
            type="text"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-sm"
            placeholder="e.g., Travel fare, Cash advance"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 text-sm active:scale-95"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
          </button>
          {record && (
            <button
              onClick={onDelete}
              className="px-3 py-2.5 text-red-500 dark:text-red-400 font-semibold rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddAdvancePopup({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (amount: number, date: string, reason: string | null) => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date();
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 10);
  });
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onAdd(parseFloat(amount), date, reason || null);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xs p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">Add Khata Advance</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Amount (₹)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-sm"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Date
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Note (optional)
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-sm"
              placeholder="Reason"
            />
          </div>
          {error && (
            <p className="text-red-500 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/30 rounded-lg p-2">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-amber-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 text-sm active:scale-95"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
          </button>
        </form>
      </div>
    </div>
  );
}