/**
 * Tests for the shared activity-series builder.
 *
 * The whole point of this module is that three surfaces derive the same window
 * from it. That only holds if it fills gaps with explicit zeros and agrees with
 * itself about which days those are — both of which are easy to break with a
 * refactor that looks like a simplification.
 */
import { describe, it, expect } from 'vitest';
import { denseActivitySeries, activityCounts } from './activitySeries';
import { toLocalDateKey } from '../utils/dateUtils';

/** `daysAgo` as the local YYYY-MM-DD key the hook stores. */
const keyDaysAgo = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return toLocalDateKey(d);
};

describe('denseActivitySeries', () => {
  it('returns exactly N days, oldest first, ending today', () => {
    const series = denseActivitySeries([], 7);
    expect(series).toHaveLength(7);
    expect(series[0].date).toBe(keyDaysAgo(6));
    expect(series[6].date).toBe(keyDaysAgo(0));
  });

  it('fills days with no record as an explicit zero', () => {
    // A day with no row means "did not study". Omitting it would compress the
    // x-axis and make ten active days look like continuous work.
    const series = denseActivitySeries(
      [{ date: keyDaysAgo(0), count: 5 }],
      4,
    );
    expect(series.map((d) => d.count)).toEqual([0, 0, 0, 5]);
  });

  it('ignores records outside the window', () => {
    // The hook keeps up to 120 days. A 7-day window must not render 120 points.
    const series = denseActivitySeries(
      [
        { date: keyDaysAgo(40), count: 99 },
        { date: keyDaysAgo(1), count: 3 },
      ],
      7,
    );
    expect(series).toHaveLength(7);
    expect(series.reduce((s, d) => s + d.count, 0)).toBe(3);
  });

  it('uses local date keys, so a late session is not filed under yesterday', () => {
    // The bug this guards: deriving the key with toISOString() converts to UTC,
    // shifting it for anyone not on Greenwich, and the activity silently lands
    // on the wrong day.
    const series = denseActivitySeries([], 1);
    expect(series[0].date).toBe(toLocalDateKey(new Date()));
  });
});

describe('activityCounts', () => {
  it('reduces the dense series to bare counts for a sparkline', () => {
    // In a 3-day window `keyDaysAgo(2)` is the FIRST slot, so the 7 lands first.
    const counts = activityCounts([{ date: keyDaysAgo(2), count: 7 }], 3);
    expect(counts).toEqual([7, 0, 0]);
  });
});
