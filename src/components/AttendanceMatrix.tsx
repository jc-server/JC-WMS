import { useState, useRef, useEffect } from 'react';
import {
  Calendar, Check, Clock, X, Minus, Plus, Loader2, Save, ChevronLeft, ChevronRight,
  CheckCheck,
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

type PendingEntry = { status: AttendanceStatus; overtimeHours: number; amountPaid: number; remark: string; dirty: boolean };

export default function AttendanceMatrix({ workers, siteId, onOpenProfile }: Props) {
  const [date, setDate] = useState(todayStr());
  const { records, loading, saveAll } = useAttendance(siteId, date);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const pendingRef = useRef<Record<string, PendingEntry>>({});

  const activeWorkers = workers.filter((w) => w.active);

  useEffect(() => {
    const pending: Record<string, PendingEntry> = {};
    activeWorkers.forEach((w) => {
      const r = records[w.id];
      pending[w.id] = {
        status: r?.status ?? 'absent',
        overtimeHours: r?.overtimeHours ?? 0,
        amountPaid: r?.amountPaid ?? 0,
        remark: r?.remark ?? '',
        dirty: false,
      };
    });
    pendingRef.current = pending;
  }, [records, date, activeWorkers]);

  const [, setRenderTick] = useState(0);
  const forceRender = () => setRenderTick((t) => t + 1);

  const getStatus = (workerId: string): AttendanceStatus =>
    pendingRef.current[workerId]?.status ?? records[workerId]?.status ?? 'absent';

  const getOT = (workerId: string): number =>
    pendingRef.current[workerId]?.overtimeHours ?? records[workerId]?.overtimeHours ?? 0;

  const getPaid = (workerId: string): number =>
    pendingRef.current[workerId]?.amountPaid ?? records[workerId]?.amountPaid ?? 0;

  const getRemark = (workerId: string): string =>
    pendingRef.current[workerId]?.remark ?? records[workerId]?.remark ?? '';

  const isDirty = () => Object.values(pendingRef.current).some((p) => p.dirty);

  const setStatus = (workerId: string, status: AttendanceStatus) => {
    const current = pendingRef.current[workerId] ?? { status: 'absent' as AttendanceStatus, overtimeHours: 0, amountPaid: 0, remark: '', dirty: false };
    pendingRef.current = { ...pendingRef.current, [workerId]: { ...current, status, dirty: true } };
    forceRender();
  };

  const setOvertime = (workerId: string, ot: number) => {
    const safeOt = isNaN(ot) ? 0 : Math.max(0, Math.round(ot * 100) / 100);
    const current = pendingRef.current[workerId] ?? { status: 'absent' as AttendanceStatus, overtimeHours: 0, amountPaid: 0, remark: '', dirty: false };
    pendingRef.current = { ...pendingRef.current, [workerId]: { ...current, overtimeHours: safeOt, dirty: true } };
    forceRender();
  };

  const setPaid = (workerId: string, amount: number) => {
    const safeAmount = isNaN(amount) ? 0 : Math.max(0, amount);
    const current = pendingRef.current[workerId] ?? { status: 'absent' as AttendanceStatus, overtimeHours: 0, amountPaid: 0, remark: '', dirty: false };
    pendingRef.current = { ...pendingRef.current, [workerId]: { ...current, amountPaid: safeAmount, dirty: true } };
    forceRender();
  };

  const setRemarkField = (workerId: string, remark: string) => {
    const current = pendingRef.current[workerId] ?? { status: 'absent' as AttendanceStatus, overtimeHours: 0, amountPaid: 0, remark: '', dirty: false };
    pendingRef.current = { ...pendingRef.current, [workerId]: { ...current, remark, dirty: true } };
    forceRender();
  };

  const adjustOT = (workerId: string, delta: number) => setOvertime(workerId, getOT(workerId) + delta);

  const markAllPresent = () => {
    activeWorkers.forEach((w) => {
      const current = pendingRef.current[w.id] ?? { status: 'absent' as AttendanceStatus, overtimeHours: records[w.id]?.overtimeHours ?? 0, amountPaid: records[w.id]?.amountPaid ?? 0, remark: records[w.id]?.remark ?? '', dirty: false };
      pendingRef.current = { ...pendingRef.current, [w.id]: { ...current, status: 'present', dirty: true } };
    });
    forceRender();
  };

  const save = async () => {
    setSaving(true);
    const dirtyEntries = Object.entries(pendingRef.current)
      .filter(([, p]) => p.dirty)
      .map(([workerId, p]) => ({ workerId, status: p.status, overtimeHours: p.overtimeHours, amountPaid: p.amountPaid, remark: p.remark }));
    await saveAll(dirtyEntries);
    Object.keys(pendingRef.current).forEach((id) => {
      if (pendingRef.current[id]) pendingRef.current[id].dirty = false;
    });
    setSaving(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
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

  const dirty = isDirty();

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftDate(-1)}
            className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors active:scale-95"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all text-slate-900 dark:text-white font-medium"
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
            className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors whitespace-nowrap active:scale-95"
          >
            <CheckCheck className="w-5 h-5" /> Mark All Present
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={save}
          disabled={!dirty || saving}
          className={`flex items-center justify-center gap-2 px-5 py-3 font-semibold rounded-xl transition-all whitespace-nowrap active:scale-95 ${
            savedFlash
              ? 'bg-green-600 text-white'
              : dirty
              ? 'bg-amber-400 text-slate-900 hover:bg-amber-300'
              : 'bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
          }`}
        >
          {saving ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
          ) : savedFlash ? (
            <><Check className="w-5 h-5" /> Saved!</>
          ) : (
            <><Save className="w-5 h-5" /> Save</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Present" value={summary.present} color="text-green-600 dark:text-green-400" bg="bg-green-50 dark:bg-green-950/30" />
        <SummaryCard label="Half Day" value={summary.half} color="text-amber-600 dark:text-amber-400" bg="bg-amber-50 dark:bg-amber-950/30" />
        <SummaryCard label="Absent" value={summary.absent} color="text-red-600 dark:text-red-400" bg="bg-red-50 dark:bg-red-950/30" />
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
            const paid = getPaid(worker.id);
            const remark = getRemark(worker.id);

            return (
              <div
                key={worker.id}
                className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800"
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
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
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

                {/* Paid + Remark row */}
                <div className="flex flex-col sm:flex-row gap-3 mt-3">
                  <div className="flex items-center gap-2 flex-1">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Paid (&#8377;)</label>
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">&#8377;</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={paid || ''}
                        onChange={(e) => setPaid(worker.id, parseFloat(e.target.value) || 0)}
                        className="w-full pl-6 pr-3 py-2 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-sm font-medium"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Remark</label>
                    <input
                      type="text"
                      value={remark}
                      onChange={(e) => setRemarkField(worker.id, e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-lg border border-slate-200 dark:border-zinc-700 focus:border-amber-400 outline-none text-sm"
                      placeholder="Purpose / Note"
                    />
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
    <div className={`${bg} rounded-xl p-3 text-center`}>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{label}</p>
    </div>
  );
}
