/**
 * src/admin/data/csv.ts
 *
 * One CSV cell encoder for the whole control centre.
 *
 * ── WHY THIS IS SHARED, AND WHY IT EXISTS ───────────────────────────────────
 * Two admin exports already had their own encoders and they disagreed:
 * `reviewQueue` neutralised formula injection, `vocabulary` only quoted. That
 * second one is a real hole — the vocabulary table holds IMPORTED and
 * learner-visible text, so a row whose `word` or `translation_np` began with
 * `=`, `+`, `-` or `@` would be executed as a formula the moment an admin
 * opened the export in Excel or Sheets.
 *
 * Quoting alone does NOT prevent that. Excel evaluates a quoted cell that
 * starts with `=`. The leading apostrophe is what forces text.
 *
 * Two independent CSV-injection vectors are handled here:
 *   1. `=`, `+`, `-`, `@`  — the classic DDE/formula triggers
 *   2. `\t` and `\r`       — a leading tab or CR is also treated as a formula
 *      prefix by some spreadsheet parsers, so it is caught too
 */

// Anything that makes a spreadsheet treat a cell as a formula rather than text.
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * Encode one value as a CSV cell, neutralising formula injection.
 *
 * The apostrophe is inserted BEFORE quoting, and only when the value actually
 * starts with a trigger character, so ordinary values are byte-for-byte
 * unchanged and the export stays clean to read.
 */
export function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  const safe = FORMULA_LEAD.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Join already-encoded cells into one line. */
export function csvLine(cells: unknown[]): string {
  return cells.map(csvCell).join(',');
}

/** Build a complete CSV document from a header and data rows. */
export function csvDocument(header: string[], rows: unknown[][]): string {
  return [header.join(','), ...rows.map(csvLine)].join('\n');
}

/**
 * Trigger a client-side file download.
 *
 * Shared for the same reason `csvCell` is: `VocabularyPage` and
 * `ReviewQueuePage` each carried their own copy, and a third would be a third
 * place for the blob type or the object-URL cleanup to differ.
 *
 * The `revokeObjectURL` is not optional bookkeeping — without it every export
 * pins its blob in memory for the lifetime of the tab, and an admin exporting
 * the user list repeatedly would leak a copy of the table each time.
 */
export function downloadTextFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the click a tick to start before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
