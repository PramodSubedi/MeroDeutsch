/**
 * src/admin/data/analytics.ts
 *
 * Read-only aggregates for the Analytics section.
 *
 * ── WHY THIS PULLS RAW ROWS AND AGGREGATES IN THE BROWSER ─────────────────
 * Not laziness — a deliberate trade at THIS scale. The largest activity table is
 * `user_activity_days`, one row per user per ACTIVE day, so a 30-day window is
 * 30 rows per active learner. At 11 users the whole dataset is a few hundred
 * rows; shipping that to the browser is cheaper than a round trip per chart.
 *
 * The ceiling is real and is documented rather than hidden: this must move
 * behind Postgres RPCs before the user count makes a full `profiles` pull
 * expensive. The SIGNATURE of this module is what the pages depend on, so moving
 * the body to an RPC later is a change no page can see.
 *
 * ── SPARSE DATA IS THE NORMAL CASE, NOT AN ERROR ───────────────────────────
 * The seed data has 11 users, 2 with XP, and every streak at 0. A dashboard that
 * renders an empty chart looks broken; one that renders a correct chart of
 * almost-nothing is simply true. Charts here therefore render a visible
 * "no data yet" state rather than padding a series to look full.
 */
import { supabase } from '../../lib/supabase';

export interface SeriesPoint {
  label: string;
  value: number;
}

export interface AnalyticsData {
  /** Daily active users over the window, dense (gaps are real zeros). */
  dau: { date: string; active: number }[];
  /** Weekly cohort retention: cohort start → how many were active in week N. */
  retention: { cohort: string; weeks: number[] }[];
  /** Count of learners at each A1 unit index (stored 0-based, shown 1-based). */
  unitFunnel: SeriesPoint[];
  /** Mean best checkpoint score per unit, 0..1. Only units anyone has taken. */
  checkpointAverages: SeriesPoint[];
  totalXp: number;
  xpByLevel: SeriesPoint[];
  streakBuckets: SeriesPoint[];
  planSplit: SeriesPoint[];
  contentTypes: SeriesPoint[];
  /** Learners with any a1_path_state row at all. */
  onSpine: number;
  totalLearners: number;
  errors: string[];
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `date` — cohorts must align to week starts. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function addWeeks(isoDate: string, weeks: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Dense daily series. Real zero-fills matter: a learner who skipped three days
 * is a meaningful dip, and a sparse line chart would draw straight through the
 * gap and hide it.
 */
export function denseDaily(
  counts: Map<string, number>,
  days: number,
  today = isoDaysAgo(0)
): { date: string; active: number }[] {
  const end = new Date(`${today}T00:00:00Z`);
  const out: { date: string; active: number }[] = [];
  for (let i = days; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    out.push({ date, active: counts.get(date) ?? 0 });
  }
  return out;
}

/**
 * Weekly retention. Each cohort is the set of learners active in that week;
 * `weeks[n]` is how many of them were still active n weeks later.
 *
 * Trailing zeros are TRIMMED, and that is a correctness point rather than
 * cosmetics. A cohort formed last week has had no chance to be retained in
 * week 1, so a padded zero would assert "100% churned" when the truth is
 * "not observable yet". Those are very different claims and must never be drawn
 * the same way.
 */
export function buildRetention(
  byUser: Map<string, Set<string>>,
  cohortWeeks: number,
  horizon: number
): { cohort: string; weeks: number[] }[] {
  // Map each week to the distinct users active in it. Computed once rather than
  // re-scanning every user for every offset.
  const activeInWeek = new Map<string, Set<string>>();
  for (const [userId, days] of byUser) {
    for (const d of days) {
      const wk = weekStart(d);
      const set = activeInWeek.get(wk);
      if (set) set.add(userId);
      else activeInWeek.set(wk, new Set([userId]));
    }
  }

  const cohorts = Array.from(activeInWeek.keys()).sort().slice(-cohortWeeks);
  return cohorts.map((cohort) => {
    const counts: number[] = [];
    for (let n = 0; n <= horizon; n += 1) {
      counts.push(activeInWeek.get(addWeeks(cohort, n))?.size ?? 0);
    }
    // Trailing zeros mean "no data yet", not churn.
    while (counts.length > 1 && counts[counts.length - 1] === 0) counts.pop();
    return { cohort, weeks: counts };
  });
}

/** Bucket streak values 0..9 individually, with everything ≥10 collapsed. */
export function bucketStreaks(values: number[]): SeriesPoint[] {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const v = Math.min(Math.max(raw || 0, 0), 10);
    const key = v === 10 ? '10+' : String(v);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts, ([label, value]) => ({ label, value })).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true })
  );
}

/** Count rows per distinct key, sorted naturally (so "2" precedes "10"). */
export function tally<T>(rows: T[] | null, key: (row: T) => string | null): SeriesPoint[] {
  const counts = new Map<string, number>();
  for (const row of rows ?? []) {
    const k = key(row);
    if (k === null) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Array.from(counts, ([label, value]) => ({ label, value })).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true })
  );
}

/** Numerically-sorted series — unit numbers must not sort as text ("10" < "2"). */
export function tallyNumeric<T>(rows: T[] | null, key: (row: T) => number | null): SeriesPoint[] {
  return tally(rows, (r) => {
    const k = key(r);
    return k === null ? null : String(k);
  }).sort((a, b) => Number(a.label) - Number(b.label));
}

export async function fetchAnalytics(days = 30): Promise<AnalyticsData> {
  const errors: string[] = [];

  const [profiles, activity, xp, streaks, path, content] = await Promise.all([
    supabase.from('profiles').select('plan').limit(5000),
    supabase.from('user_activity_days').select('user_id, activity_date').limit(20000),
    supabase.from('user_xp').select('user_id, total_xp, level').limit(5000),
    supabase.from('user_streaks').select('current_streak').limit(5000),
    supabase.from('a1_path_state').select('unlocked_unit_index, checkpoint_best_by_unit').limit(5000),
    supabase.from('content_items').select('content_type').limit(5000),
  ]);

  if (profiles.error) errors.push(`profiles: ${profiles.error.message}`);
  if (activity.error) errors.push(`user_activity_days: ${activity.error.message}`);
  if (xp.error) errors.push(`user_xp: ${xp.error.message}`);
  if (streaks.error) errors.push(`user_streaks: ${streaks.error.message}`);
  if (path.error) errors.push(`a1_path_state: ${path.error.message}`);
  if (content.error) errors.push(`content_items: ${content.error.message}`);

  const dailyCounts = new Map<string, number>();
  const byUser = new Map<string, Set<string>>();
  for (const row of activity.data ?? []) {
    dailyCounts.set(row.activity_date, (dailyCounts.get(row.activity_date) ?? 0) + 1);
    if (!row.user_id) continue;
    const set = byUser.get(row.user_id);
    if (set) set.add(row.activity_date);
    else byUser.set(row.user_id, new Set([row.activity_date]));
  }

  // Unit funnel: the stored index is the highest unit whose checkpoint was
  // passed, so it is a STAGE marker and not a visit count. The panel says so.
  const unitCounts = new Map<number, number>();
  const scoreSums = new Map<number, { sum: number; n: number }>();
  for (const row of path.data ?? []) {
    const idx = row.unlocked_unit_index ?? 0;
    unitCounts.set(idx, (unitCounts.get(idx) ?? 0) + 1);
    const best = (row.checkpoint_best_by_unit ?? {}) as Record<string, number>;
    for (const [unit, score] of Object.entries(best)) {
      const u = Number(unit);
      if (!Number.isFinite(u) || typeof score !== 'number') continue;
      const acc = scoreSums.get(u) ?? { sum: 0, n: 0 };
      acc.sum += score;
      acc.n += 1;
      scoreSums.set(u, acc);
    }
  }

  return {
    dau: denseDaily(dailyCounts, days),
    retention: buildRetention(byUser, 6, 5),
    unitFunnel: Array.from(unitCounts, ([idx, value]) => ({ label: String(idx + 1), value }))
      .sort((a, b) => Number(a.label) - Number(b.label)),
    checkpointAverages: Array.from(scoreSums, ([unit, acc]) => ({
      label: String(unit + 1),
      value: Math.round((acc.sum / acc.n) * 100) / 100,
    })).sort((a, b) => Number(a.label) - Number(b.label)),
    totalXp: (xp.data ?? []).reduce((sum, r) => sum + (r.total_xp ?? 0), 0),
    xpByLevel: tallyNumeric(xp.data, (r) => r.level),
    streakBuckets: bucketStreaks((streaks.data ?? []).map((r) => r.current_streak)),
    planSplit: tally(profiles.data, (r) => r.plan ?? 'free'),
    contentTypes: tally(content.data, (r) => r.content_type),
    onSpine: (path.data ?? []).length,
    totalLearners: (profiles.data ?? []).length,
    errors,
  };
}
