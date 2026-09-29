/**
 * Tests for the sparkline primitive and the review-debt breakdown.
 *
 * Both exist for one reason: to put a real shape next to a real number. The
 * failure mode worth guarding is not a crash — it is a chart that renders
 * confidently from data that does not support it, which is worse than no chart
 * because it looks exactly as trustworthy as the number beside it.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { WrongAnswerItem } from '../../types';

vi.mock('../../hooks/useLang', () => ({
  useLang: () => ({ langMode: 'english' }),
}));

import { Sparkline } from './Sparkline';
import { QueueBreakdown } from './QueueBreakdown';

describe('Sparkline — no invented signal', () => {
  it('draws no line when every value is identical', () => {
    // A flat series drawn as a line pinned to the baseline reads as "you
    // crashed to zero". It must be withheld instead.
    const { container } = render(<Sparkline data={[4, 4, 4, 4]} />);
    expect(container.querySelector('polyline')).toBeNull();
  });

  it('draws a flat line for genuinely flat non-zero data', () => {
    // ...and the flip side: constant non-zero IS a real signal (a steady pace)
    // and is only ambiguous with "nothing recorded", which is all-zero.
    const { container } = render(<Sparkline data={[4, 4, 4, 4]} />);
    expect(container.querySelector('line[stroke-dasharray]')).not.toBeNull();
  });

  it('draws a polyline once there is real variation', () => {
    const { container } = render(<Sparkline data={[1, 5, 2, 8]} />);
    expect(container.querySelector('polyline')).not.toBeNull();
  });

  it('is hidden from assistive tech, since a direction is not a number', () => {
    const { container } = render(<Sparkline data={[1, 5, 2, 8]} />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('survives a single-point series without dividing by zero', () => {
    const { container } = render(<Sparkline data={[3]} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});

/** Minimal queue item; only `boxLevel` matters to the breakdown. */
const item = (boxLevel?: number): WrongAnswerItem =>
  ({ id: String(Math.random()), itemKey: 'k', moduleType: 'rapid', correctAnswer: 'x', boxLevel }) as unknown as WrongAnswerItem;

describe('QueueBreakdown — the distribution is real', () => {
  it('splits focus from solid at the same threshold the filter tabs use', () => {
    // `ReviewSessionManager` splits at box <= 2 / box >= 3. If this chart ever
    // moves its own line, the learner sees two different "focus" groups on one
    // screen.
    const { container } = render(
      <QueueBreakdown queue={[item(1), item(2), item(2), item(3), item(5)]} />,
    );
    // 2 focus (b1+b2) / 3 solid (b3+b4+b5)
    expect(container.textContent).toContain('2');
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toContain(
      'box 1: 1, box 2: 2, box 3: 1, box 4: 0, box 5: 1',
    );
  });

  it('counts a missing box as box 1, matching the queue filter', () => {
    // `filterReviewQueue` defaults an absent box to 1. If this defaulted to 0
    // instead, unboxed items would be excluded from the total and the segments
    // would not sum to the headline count.
    const { container } = render(<QueueBreakdown queue={[item(undefined), item(undefined)]} />);
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toContain('box 1: 2');
  });

  it('shows an empty state rather than a bar of nothing', () => {
    render(<QueueBreakdown queue={[]} />);
    expect(screen.getByText(/review queue is empty/i)).toBeTruthy();
  });
});
