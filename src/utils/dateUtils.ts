/**
 * Local-timezone date helpers.
 *
 * The app stores "calendar day" keys (activity heatmap, streaks) as local
 * `YYYY-MM-DD` strings. Using `toISOString()` would shift the day for users in
 * positive timezones (e.g. Nepal, UTC+5:45), so we build the string from local
 * date parts instead.
 */

/** Format a Date as a local `YYYY-MM-DD` string (e.g. "2026-08-21"). */
export function toLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Difference in whole calendar days between two local dates (b - a).
 * Uses UTC-noon to avoid DST off-by-one errors from `Math.round`.
 */
export function diffCalendarDays(a: Date, b: Date): number {
  const aUtc = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bUtc = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bUtc - aUtc) / 86_400_000);
}

/** Parse a `YYYY-MM-DD` string into a local Date (midnight local time). */
export function parseLocalDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}