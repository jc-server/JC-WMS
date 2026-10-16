import type { AttendanceStatus } from '@/hooks/useAttendance';

export function roundCurrency(num: number): number {
  if (!isFinite(num) || isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export type WageInputs = {
  status: AttendanceStatus;
  dailyWage: number;
  overtimeHours: number;
  overtimeHourlyRate: number;
};

export function calculateDailyEarned({
  status,
  dailyWage,
  overtimeHours,
  overtimeHourlyRate,
}: WageInputs): number {
  const wage = isFinite(dailyWage) ? dailyWage : 0;
  const otH = isFinite(overtimeHours) ? overtimeHours : 0;
  const otR = isFinite(overtimeHourlyRate) ? overtimeHourlyRate : 0;

  let base = 0;
  if (status === 'present') base = wage;
  else if (status === 'half') base = wage * 0.5;
  // absent / holiday => base = 0

  // OT is only paid when the worker was on-site. An absent worker cannot
  // do overtime. Holidays still allow OT pay (called in for emergency work).
  const otPay = status === 'absent' ? 0 : otH * otR;

  return roundCurrency(base + otPay);
}

export type WageCounts = {
  present: number;
  half: number;
  absent: number;
  holiday: number;
  /**
   * IMPORTANT: `otHours` MUST already exclude any hours logged on absent
   * days — callers are responsible for filtering them out.
   */
  otHours: number;
};

export function calculateAggregateWages(
  counts: WageCounts,
  dailyWage: number,
  overtimeHourlyRate: number
): number {
  const wage = isFinite(dailyWage) ? dailyWage : 0;
  const otR = isFinite(overtimeHourlyRate) ? overtimeHourlyRate : 0;
  const gross =
    counts.present * wage +
    counts.half * 0.5 * wage +
    (isFinite(counts.otHours) ? counts.otHours : 0) * otR;
  return roundCurrency(gross);
}