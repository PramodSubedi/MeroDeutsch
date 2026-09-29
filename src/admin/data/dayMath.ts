/**
 * src/admin/data/dayMath.ts
 *
 * Calendar-day arithmetic for the control centre, in ONE place.
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
 * Four copies of the same five-line `isoDaysAgo` had accumulated across the admin
 * surface — `useAdminData.ts`, `analytics.ts`, `filterUsers.ts`, and an inlined
 * one in `userDetail.ts` — plus a fifth `denseDaily`/`denseDailySeries` pair
 * doing the same job with different signatures. Duplication like that is not
 * merely untidy here; it is where the bugs lived.
 *
 * Two of them did:
 *
 *   1. `for (let i = days; i >= 0; i--)` emits `days + 1` points, so a "30-day"
 *      series had 31 entries and the dashboard printed "31" under a "30d" label.
 *   2. `active24h` was computed as `activity_date >= isoDaysAgo(1)` — that is
 *      "yesterday or today", a 24-to-48-hour window wearing the name of a
 *      24-hour one. And `>= isoDaysAgo(7)` covers EIGHT calendar days.
 *
 * Neither was visible to a check, because each copy lived inside an async
 * closure. Extracting them is what made the arithmetic assertable, and the
 * assertions are in `dayMath.check.ts`.
 *
 * ── WHY DAYS, NOT HOURS ──────────────────────────────────────────────────────
 * `user_activity_days` is one row per user per active DAY. There is no
 * sub-day signal to aggregate, so a "24h" figure derived from it is a fiction
 * dressed as a precision. The function below is named for what it measures.
 */

/** `YYYY-MM-DD`, `days` before `now`, in UTC. */
export function isoDaysAgo(days: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Today, in UTC. */
export function isoToday(now: Date = new Date()): string {
  return isoDaysAgo(0, now);
}

/**
 * The oldest date a window of `days` days should include, as a `gte` filter
 * bound.
 *
 * A window of `days` days that ENDS today includes `days - 1` days back. Using
 * `isoDaysAgo(days)` here is the off-by-one: it silently widens every window by
 * one day, which is what made "active in the last 7 days" an 8-day figure.
 */
export function windowStartIso(days: number, now: Date = new Date()): string {
  return isoDaysAgo(Math.max(0, days - 1), now);
}

/**
 * A dense daily series ending today, `days` points long, oldest first.
 *
 * DENSITY IS THE POINT. A sparse list of the days somebody happened to be active
 * looks the same whether they were busy all week or not, so a gap is information
 * and is rendered as a real zero rather than omitted.
 *
 * `days` is the number of POINTS, not the number of intervals — which is what a
 * reader of `denseDaily(counts, 30)` expects, and is the whole point of the
 * helper existing.
 */
export function denseDailySeries(
  counts: ReadonlyMap<string, number>,
  days: number,
  now: Date = new Date(),
): { date: string; active: number }[] {
  const out: { date: string; active: number }[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = isoDaysAgo(i, now);
    out.push({ date, active: counts.get(date) ?? 0 });
  }
  return out;
}

/**
 * How many distinct users were active within a window, given their active days.
 *
 * `days` is the window LENGTH, so `activeUserCount(users, 7)` is the last 7
 * calendar days including today — not 8. Inclusive of the start bound, which is
 * what makes the count match the `gte` bound the caller sent to Postgres.
 */
export function activeUserCount(
  byUser: ReadonlyMap<string, ReadonlySet<string>>,
  days: number,
  now: Date = new Date(),
): number {
  const start = windowStartIso(days, now);
  const active = new Set<string>();
  for (const [userId, dates] of byUser) {
    for (const date of dates) {
      if (date >= start) {
        active.add(userId);
        break;
      }
    }
  }
  return active.size;
}

/**
 * The FIRST day in a window that contains an activity date.
 *
 * `user_activity_days` holds one row per active day, so "distinct days active"
 * is a count of rows, and "last seen" is the max. Both are questions the control
 * centre asks constantly, and both were being answered inconsistently by hand.
 */
export function lastActiveDay(dates: readonly string[]): string | null {
  let latest: string | null = null;
  for (const date of dates) {
    if (typeof date !== 'string' || date === '') continue;
    if (latest === null || date > latest) latest = date;
  }
  return latest;
}
