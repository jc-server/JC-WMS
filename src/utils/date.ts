/**
 * Centralized date & formatting utilities.
 *
 * All date strings are stored as YYYY-MM-DD in the user's LOCAL timezone.
 * NEVER use `toISOString()` for date-only values — it shifts by the UTC offset
 * and causes an off-by-one bug for users east of UTC (e.g. IST = UTC+5:30).
 */

const DEFAULT_LOCALE = 'en-IN';

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

/** Returns true if the string is a valid YYYY-MM-DD calendar date. */
export function isValidDateStr(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

export function formatDate(
  dateStr: string,
  opts?: Intl.DateTimeFormatOptions,
  locale: string = DEFAULT_LOCALE
): string {
  if (!isValidDateStr(dateStr)) return '';
  return parseLocalDate(dateStr).toLocaleDateString(locale, opts);
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

export function monthLabel(monthStr: string, locale: string = DEFAULT_LOCALE): string {
  const [year, month] = monthStr.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Format a number as Indian Rupee currency.
 * Uses Intl.NumberFormat so thousands separators match Indian convention
 * (e.g. ₹1,23,456) and decimals are handled correctly.
 *
 * Non-finite inputs are returned as sentinel glyphs rather than masked as
 * ₹0 (which hid bugs in money math). `decimals` is clamped to a safe range
 * because a negative value would throw a RangeError from Intl.NumberFormat.
 */
export function formatCurrency(
  value: number,
  opts: { decimals?: number; compact?: boolean } = {}
): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '-∞';
  const decimals = Math.max(0, Math.min(20, opts.decimals ?? 0));
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    notation: opts.compact ? 'compact' : 'standard',
  }).format(value);
}