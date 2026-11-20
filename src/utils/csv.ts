/**
 * CSV helpers with proper escaping and formula-injection protection.
 *
 * Excel/Sheets execute cells that start with =, +, -, @, \t, \r as formulas.
 * We prefix those with a single quote to neutralize them — but real negative
 * numbers such as "-500" (and "-1.5", "-1e5") pass through unchanged so they
 * remain usable as numbers.
 *
 * Previously, "+5" was left un-quoted because Number("+5") is finite — but
 * Excel interprets any leading "+" as a formula marker, so we now only
 * exempt strings that start with "-" *and* parse to a finite number.
 */

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function sanitizeCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let s = String(value);
  if (FORMULA_PREFIX.test(s)) {
    const asNumber = Number(s);
    const isStrictlyNegativeNumber =
      Number.isFinite(asNumber) && s.startsWith('-');
    if (!isStrictlyNegativeNumber) {
      s = "'" + s;
    }
  }
  return `"${s.replace(/"/g, '""')}"`;
}

export function rowsToCsv(
  rows: (string | number | null | undefined)[][]
): string {
  return rows.map((row) => row.map(sanitizeCell).join(',')).join('\n');
}

export function downloadCsv(filename: string, csv: string): void {
  // Prefix with UTF-8 BOM so Excel opens the file with correct encoding.
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
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
  try {
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
  } finally {
    // Cleanup runs even if `link.click()` throws (e.g. DOM removal on a
    // navigation race) — previously the <a> and object URL leaked.
    if (link.parentNode) link.parentNode.removeChild(link);
    // Delay revocation so Safari has time to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}