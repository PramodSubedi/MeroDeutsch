/**
 * src/lib/activitySeries.ts
 *
 * Turns the sparse `{date, count}[]` from `useActivityLog` into a DENSE,
 * ordered series of exactly the last N days.
 *
 * WHY THIS IS ITS OWN MODULE
 * --------------------------
 * Three surfaces need this exact shape — the activity trend chart, the
 * stat-tile sparklines, and (indirectly) the heatmap's windowing — and each
 * one needs it for a different N. The failure mode of duplicating it is
 * subtle and specific: a copy that forgets to fill missing days with zero
 * makes three charts disagree about the same week. One implementation means
 * they cannot.
 *
 * WHY THE GAPS MUST BE FILLED
 * ---------------------------
 * A day with no row is a REAL observation: the learner did not study. Leaving
 * it out of the array would compress the x-axis, so a chart of ten active days
 * would render as ten evenly spaced bars and imply continuous work. Filling
 * with an explicit 0 is what makes the gap visible as a gap.
 *
 * WHY `toLocalDateKey` AND NOT `toISOString`
 * ---------------------------------------
 * The stored keys are local dates. `toISOString().split('T')[0]` converts to
 * UTC, which shifts the key for anyone east or west of Greenwich — the same
 * bug class already fixed in `ActivityHeatmap`. Both sides must agree or a
 * study session at 11pm silently files under yesterday.
 */
import { toLocalDateKey } from '../utils/dateUtils';

export interface ActivityPoint {
  /** Local YYYY-MM-DD. */
  date: string;
  /** Engagement events that day. Explicitly 0 when nothing was recorded. */
  count: number;
}

/**
 * @param activities sparse records from `useActivityLog`
 * @param days window length, counting back from today inclusive
 */
export function denseActivitySeries(
  activities: { date: string; count: number }[],
  days: number,
): ActivityPoint[] {
  const byDate = new Map(activities.map((a) => [a.date, a.count]));
  const out: ActivityPoint[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = toLocalDateKey(d);
    out.push({ date: key, count: byDate.get(key) ?? 0 });
  }
  return out;
}

/** Convenience: the dense series reduced to bare counts, for a sparkline. */
export function activityCounts(activities: { date: string; count: number }[], days: number): number[] {
  return denseActivitySeries(activities, days).map((d) => d.count);
}