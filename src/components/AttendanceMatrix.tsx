import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Calendar, Check, Clock, X, Minus, Plus, Loader2, ChevronLeft, ChevronRight,
  CheckCheck, Save, CalendarOff,
} from 'lucide-react';
import { useAttendance, type AttendanceStatus } from '@/hooks/useAttendance';
import type { Worker } from '@/hooks/useWorkers';

type Props = {
  workers: Worker[];
  onOpenProfile: (worker: Worker) => void;
};

const SELECTABLE_STATUSES: AttendanceStatus[] = ['present', 'half', 'absent'];

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; color: string; activeColor: string; value: number }
> = {
  present: {
    label: 'Present',
    color: 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900',
    activeColor: 'bg-green-600 text-white border-green-600',
    value: 1.0,
  },
  half: {
    label: 'Half',
    color: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900',
    activeColor: 'bg-amber-500 text-white border-amber-500',
    value: 0.5,
  },
  absent: {
    label: 'Absent',
    color: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900',
    activeColor: 'bg-red-600 text-white border-red-600',
    value: 0,
  },
  holiday: {
    label: 'Holiday',
    color: 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900',
    activeColor: 'bg-purple-600 text-white border-purple-600',
    value: 0,
  },
};

function todayStr() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

type LocalEntry = {
  status: AttendanceStatus;
  overtimeHours: number;
  amountPaid: number;
  remark: string;
  isDirty: boolean;
};

type ToastState = { visible: boolean; message: string; type: 'saving' | 'saved' | 'error' };

export default function AttendanceMatrix({ workers, onOpenProfile }: Props) {
  const [date, setDate] = useState(todayStr());
  const { records, loading, saveRecord, saveAll, markHoliday } = useAttendance(date);
  const [savingWorkerId, setSavingWorkerId] = useState<string | null>(null);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [toast, setToast] = useState<ToastState>({ visible: false, message: '', type: 'saving' });
  const localRef = useRef<Record<string, LocalEntry>>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeWorkers = workers.filter((w) => w.active);

  useEffect(() => {
    const fresh: Record<string, LocalEntry> = {};
    activeWorkers.forEach((w) => {
      const r = records[w.id];
      fresh[w.id] = {
        status: r?.status ?? 'absent',
        overtimeHours: r?.overtimeHours ?? 0,
        amountPaid: r?.amountPaid ?? 0,
        remark: r?.remark ?? '',
        isDirty: false,
      };
    });
    localRef.current = fresh;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, date, workers]);

  const [, setRenderTick] = useState(0);
  const forceRender = useCallback(() => setRenderTick((t) => t + 1), []);

  const showToast = useCallback((message: string, type: ToastState['type']) => {
    setToast({ visible: true, message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 1800);
  }, []);

  const getStatus = (workerId: string): AttendanceStatus =>
    localRef.current[workerId]?.status ?? records[workerId]?.status ?? 'absent';

  const getOT = (workerId: string): number =>
    localRef.current[workerId]?.overtimeHours ?? records[workerId]?.overtimeHours ?? 0;

  const getAmountPaid = (workerId: string): number =>
    localRef.current[workerId]?.amountPaid ?? records[workerId]?.amountPaid ?? 0;

  const getRemark = (workerId: string): string =>
    localRef.current[workerId]?.remark ?? records[workerId]?.remark ?? '';

  const isHolidayFor = (workerId: string): boolean =>
    records[workerId]?.isHoliday === true &&
    (localRef.current[workerId]?.status ?? records[workerId]?.status) === 'holiday';

  const updateLocalField = (workerId: string, partial: Partial<LocalEntry>) => {
    const current = localRef.current[workerId] ?? {
      status: 'absent' as AttendanceStatus,
      overtimeHours: 0,
      amountPaid: 0,
      remark: '',
      isDirty: false,
    };
    localRef.current = {
      ...localRef.current,
      [workerId]: { ...current, ...partial, isDirty: true },
    };
    forceRender();
  };

  const autoSave = useCallback(
    async (workerId: string) => {
      const entry = localRef.current[workerId];
      if (!entry) return;
      setSavingWorkerId(workerId);
      showToast('Saving...', 'saving');
      try {
        await saveRecord(workerId, entry.status, entry.overtimeHours, entry.amountPaid, entry.remark);
        if (localRef.current[workerId]) {
          localRef.current[workerId].isDirty = false;
        }
        showToast('Saved', 'saved');
      } catch (err) {
        console.error('Auto-save error:', err);
        showToast('Save failed', 'error');
      } finally {
        setSavingWorkerId(null);
      }
    },
    [saveRecord, showToast]
  );

  const setStatus = (workerId: string, status: AttendanceStatus) => {
    updateLocalField(workerId, { status });
    autoSave(workerId);
  };

  const setOvertime = (workerId: string, ot: number) => {
    updateLocalField(workerId, { overtimeHours: Math.max(0, Math.round(ot * 100) / 100) });
    autoSave(workerId);
  };

  const adjustOT = (workerId: string, delta: number) => setOvertime(workerId, getOT(workerId) + delta);

  const setAmountPaid = (workerId: string, amountPaid: number) =>
    updateLocalField(workerId, { amountPaid: Math.max(0, amountPaid) });
  const setRemarkField = (workerId: string, remark: string) =>
    updateLocalField(workerId, { remark });

  const handleSaveWorker = async (workerId: string) => {
    const entry = localRef.current[workerId];
    if (!entry) return;
    setSavingWorkerId(workerId);
    showToast('Saving...', 'saving');
    try {
      await saveRecord(workerId, entry.status, entry.overtimeHours, entry.amountPaid, entry.remark);
      if (localRef.current[workerId]) {
        localRef.current[workerId].isDirty = false;
      }
      showToast('Saved', 'saved');
    } catch (err) {
      console.error('Save worker error:', err);
      showToast('Save failed', 'error');
    } finally {
      setSavingWorkerId(null);
    }
  };

  const markAllPresent = async () => {
    activeWorkers.forEach((w) => {
      const current = localRef.current[w.id] ?? {
        status: 'absent' as AttendanceStatus,
        overtimeHours: 0,
        amountPaid: records[w.id]?.amountPaid ?? 0,
        remark: records[w.id]?.remark ?? '',
        isDirty: false,
      };
      localRef.current[w.id] = { ...current, status: 'present', isDirty: true };
    });
    forceRender();

    const entries = activeWorkers.map((w) => {
      const e = localRef.current[w.id]!;
      return {
        workerId: w.id,
        status: e.status,
        overtimeHours: e.overtimeHours,
        amountPaid: e.amountPaid,
        remark: e.remark,
      };
    });

    showToast('Saving all...', 'saving');
    try {
      await saveAll(entries);
      activeWorkers.forEach((w) => {
        if (localRef.current[w.id]) localRef.current[w.id].isDirty = false;
      });
      showToast('All marked present', 'saved');
    } catch (err) {
      console.error('Mark all present error:', err);
      showToast('Save failed', 'error');
    }
  };

  const handleDeclareHoliday = async (reason: string) => {
    try {
      const count = await markHoliday(reason, activeWorkers.map((w) => w.id));
      showToast(
        `Holiday marked for ${count} worker${count === 1 ? '' : 's'}.`,
        'saved'
      );
      setShowHolidayModal(false);
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  const shiftDate = (days: number) => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    const tz = d.getTimezoneOffset() * 60000;
    setDate(new Date(d.getTime() - tz).toISOString().slice(0, 10));
  };

  const summary = activeWorkers.reduce(
    (acc, w) => {
      const s = getStatus(w.id);
      if (s === 'present') acc.present++;
      else if (s === 'half') acc.half++;
      else if (s === 'holiday') acc.holiday++;
      else acc.absent++;
      acc.ot += getOT(w.id);
      return acc;
    },
    { present: 0, half: 0, absent: 0, holiday: 0, ot: 0 }
  );

  return (
    <div>
      <div
        className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
          toast.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold ${
            toast.type === 'saved'
              ? 'bg-emerald-600 text-white'
              : toast.type === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-zinc-800 dark:bg-zinc-700 text-white'
          }`}
        >
          {toast.type === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
          {toast.type === 'saved' && <Check className="w-4 h-4" />}
          {toast.type === 'error' && <X className="w-4 h-4" />}
          {toast.message}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4 items-center flex-wrap">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => shiftDate(-1)}
            className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors active:scale-95"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
          <div className="relative flex-1 sm:flex-initial">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full sm:w-auto pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all text-slate-900 dark:text-white font-medium"
            />
          </div>
          <button
            onClick={() => shiftDate(1)}
            className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors active:scale-95"
          >
            <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
        </div>
        <button
          onClick={() => setDate(todayStr())}
          className="px-4 py-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors text-slate-700 dark:text-slate-200 font-medium text-sm"
        >
          Today
        </button>
        {activeWorkers.length > 0 && (
          <>
            <button
              onClick={() => setShowHolidayModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors whitespace-nowrap active:scale-95"
              title="Declare Holiday"
            >
              <CalendarOff className="w-5 h-5" /> Holiday
            </button>
            <button
              onClick={markAllPresent}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors whitespace-nowrap active:scale-95"
            >
              <CheckCheck className="w-5 h-5" /> Mark All Present
            </button>
          </>
        )}
        <div className="flex-1" />

        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-zinc-700">
          <Check className="w-4 h-4 text-emerald-500" />
          <span className="text-emerald-600 dark:text-emerald-400">Auto-saved</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <SummaryCard
          label="Present"
          value={summary.present}
          color="text-emerald-600 dark:text-emerald-400"
          bg="bg-emerald-50 dark:bg-emerald-950/30"
        />
        <SummaryCard
          label="Half Day"
          value={summary.half}
          color="text-amber-600 dark:text-amber-400"
          bg="bg-amber-50 dark:bg-amber-950/30"
        />
        <SummaryCard
          label="Absent"
          value={summary.absent}
          color="text-rose-600 dark:text-rose-400"
          bg="bg-rose-50 dark:bg-rose-950/30"
        />
        <SummaryCard
          label="Holiday"
          value={summary.holiday}
          color="text-purple-600 dark:text-purple-400"
          bg="bg-purple-50 dark:bg-purple-950/30"
        />
        <SummaryCard
          label="OT Hours"
          value={summary.ot.toFixed(1)}
          color="text-blue-600 dark:text-blue-400"
          bg="bg-blue-50 dark:bg-blue-950/30"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading attendance...
        </div>
      ) : activeWorkers.length === 0 ? (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400 font-medium">
          No active workers. Add workers in the Workers tab to mark attendance.
        </div>
      ) : (
        <div className="space-y-3">
          {activeWorkers.map((worker) => {
            const status = getStatus(worker.id);
            const ot = getOT(worker.id);
            const amountPaid = getAmountPaid(worker.id);
            const remark = getRemark(worker.id);
            const isDirty = localRef.current[worker.id]?.isDirty ?? false;
            const isSavingThis = savingWorkerId === worker.id;
            const onHoliday = isHolidayFor(worker.id);
            const holidayReason = records[worker.id]?.holidayReason;

            const dailyEarned =
              status === 'holiday'
                ? 0
                : (status === 'present'
                    ? worker.dailyWage
                    : status === 'half'
                    ? worker.dailyWage * 0.5
                    : 0) +
                  ot * worker.overtimeHourlyRate;
            const dailyBalance = dailyEarned - amountPaid;

            return (
              <div
                key={worker.id}
                className={`bg-white dark:bg-zinc-900 rounded-2xl p-4 border transition-all ${
                  isDirty
                    ? 'border-amber-400 dark:border-amber-500/60 ring-2 ring-amber-400/10'
                    : 'border-slate-200 dark:border-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => onOpenProfile(worker)}
                    className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
                  >
                    <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center font-bold text-amber-700 dark:text-amber-400">
                      {worker.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white text-sm hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                        {worker.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {worker.role} &#183; &#8377;{worker.dailyWage.toFixed(0)}/day
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2">
                    <div
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                        dailyBalance > 0
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900'
                          : dailyBalance < 0
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-zinc-700'
                      }`}
                    >
                      <span>Net Due:</span>
                      <span>&#8377;{dailyBalance.toFixed(0)}</span>
                    </div>
                  </div>
                </div>

                {onHoliday && (
                  <div className="mb-3 px-3 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 flex items-center gap-2">
                    <CalendarOff className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                      Holiday: {holidayReason || 'Declared'}
                    </span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 mb-3">
                  <div className="flex gap-2 flex-1">
                    {SELECTABLE_STATUSES.map((s) => {
                      const cfg = STATUS_CONFIG[s];
                      const isActive = status === s;
                      return (
                        <button
                          key={s}
                          onClick={() => setStatus(worker.id, s)}
                          className={`flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                            isActive ? cfg.activeColor : cfg.color
                          }`}
                        >
                          {s === 'present' && <Check className="w-4 h-4" />}
                          {s === 'half' && <Clock className="w-4 h-4" />}
                          {s === 'absent' && <X className="w-4 h-4" />}
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2 sm:w-44">
                    <div className="flex items-center flex-1 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700">
                      <button
                        onClick={() => adjustOT(worker.id, -0.5)}
                        className="p-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-l-xl transition-colors active:scale-90"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={ot}
                        onChange={(e) => setOvertime(worker.id, parseFloat(e.target.value) || 0)}
                        className="w-full text-center bg-transparent py-2.5 text-slate-900 dark:text-white font-semibold outline-none text-sm"
                      />
                      <button
                        onClick={() => adjustOT(worker.id, 0.5)}
                        className="p-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-r-xl transition-colors active:scale-90"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => adjustOT(worker.id, 1)}
                        className="px-2 py-2 text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors active:scale-90"
                      >
                        +1h
                      </button>
                      <button
                        onClick={() => adjustOT(worker.id, 2)}
                        className="px-2 py-2 text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors active:scale-90"
                      >
                        +2h
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-stretch pt-2 border-t border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2 sm:w-72">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      Amount Paid Today (&#8377;)
                    </label>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">
                        &#8377;
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={amountPaid || ''}
                        onChange={(e) => setAmountPaid(worker.id, parseFloat(e.target.value) || 0)}
                        className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-sm font-semibold"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-1">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      Remark / Note
                    </label>
                    <input
                      type="text"
                      value={remark}
                      onChange={(e) => setRemarkField(worker.id, e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-sm"
                      placeholder="e.g. Weekly cash advance, travel bonus"
                    />
                  </div>

                  <div className="flex justify-end sm:justify-start items-center">
                    <button
                      onClick={() => handleSaveWorker(worker.id)}
                      disabled={isSavingThis}
                      className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
                        isDirty
                          ? 'bg-amber-500 hover:bg-amber-600 text-white active:scale-95 cursor-pointer ring-2 ring-amber-400/20'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {isSavingThis ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : isDirty ? (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Save</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 text-emerald-500" />
                          <span>Saved</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showHolidayModal && (
        <HolidayModal
          date={date}
          workerCount={activeWorkers.length}
          onClose={() => setShowHolidayModal(false)}
          onConfirm={handleDeclareHoliday}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: string | number;
  color: string;
  bg: string;
}) {
  return (
    <div className={`${bg} rounded-xl p-3 text-center border border-transparent`}>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{label}</p>
    </div>
  );
}

function HolidayModal({
  date,
  workerCount,
  onClose,
  onConfirm,
}: {
  date: string;
  workerCount: number;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const presets = ['Sunday', 'Holi', 'Diwali', 'Heavy Rain', 'Site Closed'];

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setSaving(true);
    await onConfirm(reason.trim());
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-purple-100 dark:bg-purple-950/40 rounded-lg flex items-center justify-center">
              <CalendarOff className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Declare Holiday
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{dateLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-5 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Mark this day as a holiday for <span className="font-semibold">{workerCount}</span>{' '}
            active worker{workerCount === 1 ? '' : 's'}. Existing cash-advance entries for this day
            will be preserved.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Reason for Holiday <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all text-sm"
              placeholder="e.g. Diwali, Heavy Rain, Site Closed"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setReason(p)}
                className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !reason.trim() || workerCount === 0}
              className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {saving && <Loader2 className="w-5 h-5 animate-spin" />}
              Declare Holiday
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