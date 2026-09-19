/**
 * Centralized date utilities.
 *
 * All date strings are stored as YYYY-MM-DD in the user's LOCAL timezone.
 * NEVER use `toISOString()` for date-only values — it shifts by the UTC offset
 * and causes an off-by-one bug for users east of UTC (e.g. IST = UTC+5:30).
 */

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthStartStr(monthStr?: string): string {
  if (monthStr) return `${monthStr}-01`;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function monthEndStr(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${monthStr}-${String(lastDay).padStart(2, '0')}`;
}

export function monthRange(monthStr: string): { start: string; end: string } {
  return { start: `${monthStr}-01`, end: monthEndStr(monthStr) };
}

/** Parse a YYYY-MM-DD string as a LOCAL date (not UTC). */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(
  dateStr: string,
  opts?: Intl.DateTimeFormatOptions
): string {
  if (!dateStr) return '';
  return parseLocalDate(dateStr).toLocaleDateString('en-IN', opts);
}

export function isToday(dateStr: string): boolean {
  return dateStr === todayStr();
}

export function shiftDate(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

export function addMonths(monthStr: string, delta: number): string {
  const [year, month] = monthStr.split('-').map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}