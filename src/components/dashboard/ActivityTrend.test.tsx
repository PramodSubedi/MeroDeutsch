/**
 * Tests for the activity trend chart.
 *
 * This is the one new component that is NOT tested by DOM shape alone, because
 * its data work (windowing, moving average) happens inside `useMemo` and is only
 * observable through the summary text below the chart. The chart body itself is
 * recharts, which the test setup mocks to divs — so what is asserted here is the
 * arithmetic and the states, not the drawing.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { toLocalDateKey } from '../../utils/dateUtils';

vi.mock('../../hooks/useLang', () => ({
  useLang: () => ({ langMode: 'english' }),
}));

// `useChartTokens` reads computed CSS custom properties, which jsdom does not
// resolve from the Tailwind `@theme` block — every token comes back ''. Stub it
// so the assertions test THIS component's logic, not the hook's theming.
vi.mock('../../hooks/useChartTokens', () => ({
  useChartTokens: () => ({
    accent: '#2563eb',
    success: '#16a34a',
    warning: '#f59e0b',
    grid: '#e2e8f0',
    axis: '#64748b',
    tooltipBg: '#0f172a',
    tooltipText: '#f8fafc',
    tooltipBorder: '#334155',
  }),
}));

import { ActivityTrend } from './ActivityTrend';

const keyDaysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toLocalDateKey(d);
};

describe('ActivityTrend', () => {
  it('shows an empty state rather than a flat chart at zero', () => {
    render(<ActivityTrend activities={[]} />);
    expect(screen.getByText(/no activity yet/i)).toBeTruthy();
    // The zero-state must NOT also print "0 activities over 30 days · 0/day",
    // which would be a second, contradictory statement about the same data.
    expect(screen.queryByText(/activities over 30 days/i)).toBeNull();
  });

  it('sums counts and reports the daily average across the window', () => {
    // 3 events today over a 30-day window is 0.1/day. The average divides by
    // the FULL window, not by active days — otherwise a learner who studied
    // twice this month would be told they average 1.5/day.
    render(<ActivityTrend activities={[{ date: keyDaysAgo(0), count: 3 }]} />);
    expect(screen.getByText(/3 activities over 30 days · 0\.1\/day average/)).toBeTruthy();
  });

  it('ignores records older than the 30-day window', () => {
    render(
      <ActivityTrend
        activities={[
          { date: keyDaysAgo(45), count: 500 },
          { date: keyDaysAgo(0), count: 2 },
        ]}
      />,
    );
    expect(screen.getByText(/2 activities over 30 days/)).toBeTruthy();
  });

  it('explains the dashed line, so it is not a mystery decoration', () => {
    render(<ActivityTrend activities={[{ date: keyDaysAgo(0), count: 4 }]} />);
    expect(screen.getByText(/dashed line is the 7-day moving average/i)).toBeTruthy();
  });

  it('labels the chart as raw activity, never as XP', () => {
    // The heatmap shows "XP earned" from a flat x10 estimate. This chart plots
    // the stored count, and must not borrow that wording.
    const { container } = render(<ActivityTrend activities={[{ date: keyDaysAgo(0), count: 4 }]} />);
    expect(container.textContent).not.toMatch(/\bXP\b/);
  });

  it('renders both series and the average reference line', () => {
    const { container } = render(<ActivityTrend activities={[{ date: keyDaysAgo(0), count: 4 }]} />);
    expect(container.querySelectorAll('[data-testid="area"]').length).toBe(2);
    expect(container.querySelector('[data-testid="reference-line"]')).toBeTruthy();
  });
});
