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
import { denseDailySeries, windowStartIso } from './dayMath';
import { callAdminRpc, shouldFallBack, LEGACY_PATH_NOTICE } from './rpc';

export interface SeriesPoint {
  label: string;
  value: number;
}

/** A read that hit a hard row cap, so the page can admit it rather than hide it. */
export interface Truncation {
  source: string;
  shown: number;
  total: number;
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
  /** Non-empty when a read hit a row cap; see `Truncation`. */
  truncated: Truncation[];
  errors: string[];
}

const EMPTY_TRUNCATED: Truncation[] = [];

/** The `profiles` read cap. Mirrors `useAdminData`'s so the two cannot disagree. */
export const PROFILE_ROW_CAP = 100_000;

/** The activity-table read cap. */
export const ACTIVITY_ROW_CAP = 200_000;

// ═══════════════════════════════════════════════════════════════════════════
// THE REFERENCE IMPLEMENTATION — READ BEFORE CHANGING THE SQL
// ═══════════════════════════════════════════════════════════════════════════
//
// `weekStart`, `buildRetention`, `denseDaily`, `bucketStreaks`, `tally` and
// `tallyNumeric` are no longer called in production. `fetchAnalytics` issues ONE
// call to `admin_analytics` and the database does all of this arithmetic.
//
// They are kept, and `analytics.check.ts` still runs them, for one reason:
//
// ── THEY ARE THE SPECIFICATION THE SQL CANNOT BE TESTED AGAINST ──────────────
// The 30 check suites execute in `tsx` with no database. `admin_analytics` is
// therefore UNVERIFIED — a function that counted the wrong day would pass every
// check in this repository, and `check:adminrpcs` says so explicitly in its
// final section. So when someone changes the SQL — a cohort boundary, the
// trailing-zero trim, whether streak 10 collapses — these functions say what
// the answer is supposed to be, in a language CI can execute.
//
// A second implementation with no first-class role is duplication that drifts.
// A reference implementation with a stated purpose is documentation that runs.
//
// IF YOU CHANGE ONE, CHANGE THE OTHER, and note it in the migration.

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
 *
 * Delegates to `denseDailySeries`, so the point count is `days` and the window
 * bound is `days - 1`. It used to be a local loop of its own that emitted
 * `days + 1` points — which is how the Analytics page plotted a 31-point series
 * under the heading "Last 30 days". `analytics.check.ts` pins the count.
 */
export function denseDaily(
  counts: Map<string, number>,
  days: number,
  today?: string,
): { date: string; active: number }[] {
  const end = today ? new Date(`${today}T00:00:00Z`) : new Date();
  return denseDailySeries(counts, days, end);
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

/** The row `admin_analytics` returns. One row, or nothing. */
interface AnalyticsRpcRow {
  dau: { date: string; active: number }[];
  retention: { cohort: string; weeks: number[] }[];
  unit_funnel: SeriesPoint[];
  checkpoint_averages: SeriesPoint[];
  total_xp: number;
  xp_by_level: SeriesPoint[];
  streak_buckets: SeriesPoint[];
  plan_split: SeriesPoint[];
  content_types: SeriesPoint[];
  on_spine: number;
  total_learners: number;
}

/**
 * Coerce one RPC row into the shape the page renders.
 *
 * PURE and exported, so it is testable with no network and no Supabase client.
 * Every field is read defensively: a renamed column becomes a 0, which is
 * visibly wrong on a dashboard, rather than `NaN`, which is not.
 */
export function mapAnalyticsRow(row: AnalyticsRpcRow | null | undefined): AnalyticsData {
  const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const points = (v: unknown): SeriesPoint[] =>
    Array.isArray(v)
      ? v
          .filter((p): p is SeriesPoint => !!p && typeof p.label === 'string' && typeof p.value === 'number')
          .map((p) => ({ label: p.label, value: p.value }))
      : [];
  if (!row) {
    return {
      dau: [],
      retention: [],
      unitFunnel: [],
      checkpointAverages: [],
      totalXp: 0,
      xpByLevel: [],
      streakBuckets: [],
      planSplit: [],
      contentTypes: [],
      onSpine: 0,
      totalLearners: 0,
      truncated: [],
      errors: [],
    };
  }
  return {
    dau: Array.isArray(row.dau) ? row.dau : [],
    retention: Array.isArray(row.retention) ? row.retention : [],
    unitFunnel: points(row.unit_funnel),
    checkpointAverages: points(row.checkpoint_averages),
    totalXp: n(row.total_xp),
    xpByLevel: points(row.xp_by_level),
    streakBuckets: points(row.streak_buckets),
    planSplit: points(row.plan_split),
    contentTypes: points(row.content_types),
    onSpine: n(row.on_spine),
    totalLearners: n(row.total_learners),
    // Permanently empty. These RPCs return exact counts, so a capped read is no
    // longer a state the data can be in. The field survives only because
    // `AnalyticsPage` destructures it, and deleting it there is a separate edit.
    truncated: EMPTY_TRUNCATED,
    errors: [],
  };
}

/**
 * The Analytics page's entire read, in one call.
 *
 * Was SIX capped queries with every aggregate computed in JavaScript — including
 * a 100 000-row cap on `user_xp` to compute a SUM, which is always a lower
 * bound presented as a total.
 *
 * Two properties this gained beyond speed:
 *
 *   · a REFUSAL rather than zero rows. RLS can only exclude rows, so the old
 *     reads handed a demoted or suspended admin an empty page with no error. A
 *     SECURITY DEFINER function can raise, and does.
 *   · the numbers are exact, so `truncated` is permanently empty and the
 *     "showing N of M" banner this page could previously render is gone.
 */
export async function fetchAnalytics(days = 30): Promise<AnalyticsData> {
  const outcome = await callAdminRpc<AnalyticsRpcRow[]>(supabase, 'admin_analytics', { p_days: days });

  if (outcome.kind === 'ok') {
    return mapAnalyticsRow((outcome.data as AnalyticsRpcRow[] | null)?.[0]);
  }

  if (shouldFallBack(outcome)) {
    // The RPC is not deployed. The previous implementation is six capped reads
    // aggregated here, and it is correct — bounded, but correct.
    const legacy = await fetchAnalyticsLegacy(days);
    return { ...legacy, errors: [LEGACY_PATH_NOTICE, ...legacy.errors] };
  }

  // A refusal is the RPC working correctly. Falling back would replace "you may
  // not see this" with an empty Analytics page, which is the silent failure the
  // RPC exists to prevent.
  return { ...mapAnalyticsRow(null), errors: [`admin_analytics: ${outcome.message}`] };
}

/**
 * The previous implementation, kept as a fallback.
 *
 * Six capped reads with every aggregate computed in JavaScript, including a
 * 100 000-row cap on `user_xp` to compute a SUM — always a lower bound presented
 * as a total. Reached only when the RPC is absent, and the caps are reported in
 * `truncated` so the bound is visible rather than assumed.
 */
async function fetchAnalyticsLegacy(days: number): Promise<AnalyticsData> {
  const errors: string[] = [];
  const truncated: Truncation[] = [];
  const CAP = 100_000;

  const [profiles, activity, xp, streaks, path, content] = await Promise.all([
    supabase.from('profiles').select('plan', { count: 'exact' }).limit(CAP),
    supabase
      .from('user_activity_days')
      .select('user_id, activity_date', { count: 'exact' })
      .gte('activity_date', windowStartIso(days))
      .order('activity_date', { ascending: true })
      .limit(200_000),
    supabase.from('user_xp').select('user_id, total_xp, level', { count: 'exact' }).limit(CAP),
    supabase.from('user_streaks').select('current_streak', { count: 'exact' }).limit(CAP),
    supabase
      .from('a1_path_state')
      .select('unlocked_unit_index, checkpoint_best_by_unit', { count: 'exact' })
      .limit(CAP),
    supabase.from('content_items').select('content_type', { count: 'exact' }).limit(CAP),
  ]);

  const note = (source: string, res: { error: unknown; count: number | null; data: unknown[] | null }) => {
    if (res.error) return;
    const total = res.count ?? res.data?.length ?? 0;
    if (total > (res.data?.length ?? 0)) {
      truncated.push({ source, shown: res.data?.length ?? 0, total });
    }
  };
  if (profiles.error) errors.push(`profiles: ${profiles.error.message}`); else note('profiles', profiles);
  if (activity.error) errors.push(`user_activity_days: ${activity.error.message}`); else note('user_activity_days', activity);
  if (xp.error) errors.push(`user_xp: ${xp.error.message}`); else note('user_xp', xp);
  if (streaks.error) errors.push(`user_streaks: ${streaks.error.message}`); else note('user_streaks', streaks);
  if (path.error) errors.push(`a1_path_state: ${path.error.message}`); else note('a1_path_state', path);
  if (content.error) errors.push(`content_items: ${content.error.message}`); else note('content_items', content);

  const dailyCounts = new Map<string, number>();
  const byUser = new Map<string, Set<string>>();
  for (const row of activity.data ?? []) {
    dailyCounts.set(row.activity_date, (dailyCounts.get(row.activity_date) ?? 0) + 1);
    if (!row.user_id) continue;
    const set = byUser.get(row.user_id);
    if (set) set.add(row.activity_date);
    else byUser.set(row.user_id, new Set([row.activity_date]));
  }

  const unitCounts = new Map<number, number>();
  const scoreSums = new Map<number, { sum: number; n: number }>();
  for (const row of path.data ?? []) {
    const idx = row.unlocked_unit_index ?? 0;
    unitCounts.set(idx, (unitCounts.get(idx) ?? 0) + 1);
    for (const [unit, score] of Object.entries((row.checkpoint_best_by_unit ?? {}) as Record<string, number>)) {
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
    unitFunnel: Array.from(unitCounts, ([idx, value]) => ({ label: String(idx + 1), value })).sort(
      (a, b) => Number(a.label) - Number(b.label),
    ),
    checkpointAverages: Array.from(scoreSums, ([unit, acc]) => ({
      label: String(unit + 1),
      value: Math.round((acc.sum / acc.n) * 100) / 100,
    })).sort((a, b) => Number(a.label) - Number(b.label)),
    totalXp: (xp.data ?? []).reduce((sum, r) => sum + (r.total_xp ?? 0), 0),
    xpByLevel: tallyNumeric(xp.data, (r) => r.level),
    streakBuckets: bucketStreaks((streaks.data ?? []).map((r) => r.current_streak)),
    planSplit: tally(profiles.data, (r) => r.plan ?? 'free'),
    contentTypes: tally(content.data, (r) => r.content_type),
    onSpine: path.count ?? (path.data ?? []).length,
    totalLearners: profiles.count ?? (profiles.data ?? []).length,
    truncated,
    errors,
  };
}
