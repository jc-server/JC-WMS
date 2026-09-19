/**
 * CSV helpers with proper escaping and formula-injection protection.
 * Excel/Sheets execute cells that start with =, +, -, @ as formulas.
 * We prefix those with a single quote to neutralize them.
 */

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function sanitizeCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let s = String(value);
  if (FORMULA_PREFIX.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export function rowsToCsv(
  rows: (string | number | null | undefined)[][]
): string {
  return rows.map((row) => row.map(sanitizeCell).join(',')).join('\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8;',
  });
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}