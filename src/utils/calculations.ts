/**
 * Robust financial calculations to prevent floating-point errors (e.g. 0.1 + 0.2)
 * and safely handle NaN / undefined / empty values.
 */

export function roundCurrency(num: number): number {
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function calculateDailyEarned(
  status: 'present' | 'half' | 'absent',
  dailyWage: number,
  overtimeHours: number,
  overtimeHourlyRate: number
): number {
  const wage = isNaN(dailyWage) ? 0 : dailyWage;
  const otHours = isNaN(overtimeHours) ? 0 : overtimeHours;
  const otRate = isNaN(overtimeHourlyRate) ? 0 : overtimeHourlyRate;

  let base = 0;
  if (status === 'present') {
    base = wage;
  } else if (status === 'half') {
    base = wage * 0.5;
  }

  const overtimePay = otHours * otRate;
  return roundCurrency(base + overtimePay);
}
