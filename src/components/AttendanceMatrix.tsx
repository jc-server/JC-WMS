import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Calendar, Check, Clock, X, Minus, Plus, Loader2, ChevronLeft, ChevronRight,
  CheckCheck, Save,
} from 'lucide-react';
import { useAttendance, type AttendanceStatus } from '@/hooks/useAttendance';
import type { Worker } from '@/hooks/useWorkers';

type Props = {
  workers: Worker[];
  siteId: string | null;
  onOpenProfile: (worker: Worker) => void;
};

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; color: string; activeColor: string; value: number }> = {
  present: { label: 'Present', color: 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900', activeColor: 'bg-green-600 text-white border-green-600', value: 1.0 },
  half: { label: 'Half', color: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900', activeColor: 'bg-amber-500 text-white border-amber-500', value: 0.5 },
  absent: { label: 'Absent', color: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900', activeColor: 'bg-red-600 text-white border-red-600', value: 0 },
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

export default function AttendanceMatrix({ workers, siteId, onOpenProfile }: Props) {
  const [date, setDate] = useState(todayStr());
  const { records, loading, saveRecord, saveAll } = useAttendance(siteId, date);
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [savingWorkerId, setSavingWorkerId] = useState<string | null>(null);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const localRef = useRef<Record<string, LocalEntry>>({});

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
  }, [records, date]);

  const [, setRenderTick] = useState(0);
  const forceRender = () => setRenderTick((t) => t + 1);

  const getStatus = (workerId: string): AttendanceStatus =>
    localRef.current[workerId]?.status ?? records[workerId]?.status ?? 'absent';

  const getOT = (workerId: string): number =>
    localRef.current[workerId]?.overtimeHours ?? records[workerId]?.overtimeHours ?? 0;

  const getAmountPaid = (workerId: string): number =>
    localRef.current[workerId]?.amountPaid ?? records[workerId]?.amountPaid ?? 0;

  const getRemark = (workerId: string): string =>
    localRef.current[workerId]?.remark ?? records[workerId]?.remark ?? '';

  const updateLocalField = (workerId: string, partial: Partial<LocalEntry>) => {
    const current = localRef.current[workerId] ?? {
      status: 'absent',
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

  const setStatus = (workerId: string, status: AttendanceStatus) => updateLocalField(workerId, { status });
  const setOvertime = (workerId: string, ot: number) => updateLocalField(workerId, { overtimeHours: Math.max(0, Math.round(ot * 100) / 100) });
  const setAmountPaid = (workerId: string, amountPaid: number) => updateLocalField(workerId, { amountPaid: Math.max(0, amountPaid) });
  const setRemarkField = (workerId: string, remark: string) => updateLocalField(workerId, { remark });

  const adjustOT = (workerId: string, delta: number) => setOvertime(workerId, getOT(workerId) + delta);

  const handleSaveWorker = async (workerId: string) => {
    const entry = localRef.current[workerId];
    if (!entry) return;

    setSavingWorkerId(workerId);
    setSavingState('saving');
    try {
      await saveRecord(
        workerId,
        entry.status,
        entry.overtimeHours,
        entry.amountPaid,
        entry.remark
      );
      if (localRef.current[workerId]) {
        localRef.current[workerId].isDirty = false;
      }
      setSavingState('saved');
      setTimeout(() => {
        setSavingState((prev) => (prev === 'saved' ? 'idle' : prev));
      }, 2000);
    } catch (err) {
      console.error('Save worker error:', err);
      setSavingState('idle');
    } finally {
      setSavingWorkerId(null);
    }
  };

  const handleSaveAllDirty = async () => {
    const dirtyEntries = Object.entries(localRef.current)
      .filter(([, p]) => p.isDirty)
      .map(([workerId, p]) => ({
        workerId,
        status: p.status,
        overtimeHours: p.overtimeHours,
        amountPaid: p.amountPaid,
        remark: p.remark,
      }));

    if (dirtyEntries.length === 0) return;

    setIsBulkSaving(true);
    setSavingState('saving');
    try {
      await saveAll(dirtyEntries);
      Object.keys(localRef.current).forEach((id) => {
        if (localRef.current[id]) {
          localRef.current[id].isDirty = false;
        }
      });
      setSavingState('saved');
      setTimeout(() => {
        setSavingState((prev) => (prev === 'saved' ? 'idle' : prev));
      }, 2000);
    } catch (err) {
      console.error('Save all error:', err);
      setSavingState('idle');
    } finally {
      setIsBulkSaving(false);
    }
  };

  const markAllPresent = () => {
    activeWorkers.forEach((w) => {
      const current = localRef.current[w.id] ?? {
        status: 'absent',
        overtimeHours: 0,
        amountPaid: records[w.id]?.amountPaid ?? 0,
        remark: records[w.id]?.remark ?? '',
        isDirty: false,
      };
      localRef.current[w.id] = { ...current, status: 'present', isDirty: true };
    });
    forceRender();
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
      else acc.absent++;
      acc.ot += getOT(w.id);
      return acc;
    },
    { present: 0, half: 0, absent: 0, ot: 0 }
  );

  const hasAnyDirty = Object.values(localRef.current).some((e) => e.isDirty);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4 items-center">
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
          <button
            onClick={markAllPresent}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors whitespace-nowrap active:scale-95"
          >
            <CheckCheck className="w-5 h-5" /> Mark All Present
          </button>
        )}
        <div className="flex-1" />

        {/* Global Save All button if multiple changes */}
        {hasAnyDirty && (
          <button
            onClick={handleSaveAllDirty}
            disabled={isBulkSaving}
            className="flex items-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 animate-pulse"
          >
            {isBulkSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            <span>Save All Changes</span>
          </button>
        )}

        {/* Status indicator */}
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-zinc-700">
          {savingState === 'saving' ? (
            <><Loader2 className="w-4 h-4 animate-spin text-amber-500" /><span>Saving...</span></>
          ) : savingState === 'saved' ? (
            <><Check className="w-4 h-4 text-emerald-500" /><span className="text-emerald-600 dark:text-emerald-400">Saved successfully</span></>
          ) : (
            <span>Manual Save Mode</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Present" value={summary.present} color="text-emerald-600 dark:text-emerald-400" bg="bg-emerald-50 dark:bg-emerald-950/30" />
        <SummaryCard label="Half Day" value={summary.half} color="text-amber-600 dark:text-amber-400" bg="bg-amber-50 dark:bg-amber-950/30" />
        <SummaryCard label="Absent" value={summary.absent} color="text-rose-600 dark:text-rose-400" bg="bg-rose-50 dark:bg-rose-950/30" />
        <SummaryCard label="OT Hours" value={summary.ot.toFixed(1)} color="text-blue-600 dark:text-blue-400" bg="bg-blue-50 dark:bg-blue-950/30" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading attendance...
        </div>
      ) : !siteId ? (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400 font-medium">
          Select a site to mark attendance.
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

            // Live Daily Net Due calculation
            const dailyEarned =
              (status === 'present' ? worker.dailyWage : status === 'half' ? worker.dailyWage * 0.5 : 0) +
              (ot * worker.overtimeHourlyRate);
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
                      <h3 className="font-semibold text-slate-900 dark:text-white text-sm hover:text-amber-600 dark:hover:text-amber-400 transition-colors">{worker.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {worker.role} &#183; &#8377;{worker.dailyWage.toFixed(0)}/day
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2">
                    <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                      dailyBalance > 0
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900'
                        : dailyBalance < 0
                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-zinc-700'
                    }`}>
                      <span>Net Due:</span>
                      <span>&#8377;{dailyBalance.toFixed(0)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mb-3">
                  <div className="flex gap-2 flex-1">
                    {(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map((s) => {
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

                {/* Amount Paid Today (₹) & Remark / Note + Right Corner Save Button */}
                <div className="flex flex-col sm:flex-row gap-3 items-stretch pt-2 border-t border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2 sm:w-72">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      Amount Paid Today (&#8377;)
                    </label>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">&#8377;</span>
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

                  {/* Right Corner Save Button */}
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
    </div>
  );
}

function SummaryCard({ label, value, color, bg }: { label: string; value: string | number; color: string; bg: string }) {
  return (
    <div className={`${bg} rounded-xl p-3 text-center border border-transparent`}>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{label}</p>
    </div>
  );
}
