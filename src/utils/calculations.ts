/**
 * Unified wage and financial calculations.
 *
 * ALL wage math MUST go through these functions so that AttendanceMatrix,
 * WageSummary, WorkerProfile and useWageCalculator agree with each other.
 *
 * Rules:
 *   - Present  : dailyWage
 *   - Half     : dailyWage * 0.5
 *   - Absent   : 0
 *   - Holiday  : 0 base, but OT hours are still paid.
 *   - OT       : overtimeHours * overtimeHourlyRate (always additive)
 */

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

  return roundCurrency(base + otH * otR);
}

export type WageCounts = {
  present: number;
  half: number;
  absent: number;
  holiday: number;
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