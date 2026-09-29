/**
 * Tests for the stat tiles.
 *
 * The layout here is the part that rots quietly. A tile now carries five things
 * (icon, label, figure, detail, visual) instead of three, which means a column
 * that used to be comfortably wide can silently start truncating — and
 * truncation is invisible to a type checker and to a DOM-shape test. These
 * tests pin the two things that actually broke during visual QA:
 *
 *   1. `ring` is a 0-100 PERCENTAGE, matching `useXp().xpProgress`. Feeding it
 *      a 0-1 fraction draws an arc 100x too small — a ring that looks empty
 *      while the learner is 62% of the way to the next level.
 *   2. the grid's column count and its divider rules stay in agreement, at all
 *      three breakpoints. They are independent class strings and can drift.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Gauge } from 'lucide-react';
import type { Metric } from './MetricRow';
import { MetricRow } from './MetricRow';

vi.mock('../../hooks/useLang', () => ({ useLang: () => ({ langMode: 'english' }) }));

const m = (over: Partial<Metric>): Metric => ({
  label: 'Metric',
  value: '1',
  icon: Gauge,
  tone: 'accent',
  ...over,
});

const ringDash = (container: HTMLElement) =>
  container.querySelector('svg[viewBox="0 0 40 40"] circle:nth-of-type(2)')?.getAttribute('stroke-dasharray');

describe('MetricRow — the gauge reads xpProgress as a percentage', () => {
  it('draws a proportionate arc for a 0-100 ring value', () => {
    // Circumference is 2*pi*15 = 94.25, so 62% is ~58.4. If this ever comes
    // back as ~0.58 the caller passed a fraction and the ring is 100x too small.
    const { container } = render(<MetricRow metrics={[m({ ring: 62 })]} label="s" />);
    const dash = Number(ringDash(container)?.split(' ')[0]);
    expect(dash).toBeGreaterThan(55);
    expect(dash).toBeLessThan(62);
  });

  it('clamps values above 100 rather than overdrawing the circle', () => {
    const { container } = render(<MetricRow metrics={[m({ ring: 140 })]} label="s" />);
    const dash = Number(ringDash(container)?.split(' ')[0]);
    expect(dash).toBeLessThanOrEqual(95);
  });

  it('renders no gauge at all when no ring is supplied', () => {
    const { container } = render(<MetricRow metrics={[m({ spark: [1, 4, 2] })]} label="s" />);
    expect(container.querySelector('svg[viewBox="0 0 40 40"]')).toBeNull();
  });
});

describe('MetricRow — grid and dividers agree at every breakpoint', () => {
  const four = [0, 1, 2, 3].map((i) => m({ label: `M${i}`, value: String(i) }));
  /** Exact class-token match: 'lg:border-l-0' CONTAINS the text 'lg:border-l',
   *  so a substring assertion silently passes for the opposite of its intent. */
  const has = (el: Element, token: string) =>
    (el.getAttribute('class') ?? '').split(/\s+/).includes(token);

  const setup = () => {
    const { container } = render(<MetricRow metrics={four} label="s" />);
    const cells = Array.from(container.querySelectorAll('li'));
    const grid = container.querySelector('ul')!.getAttribute('class') ?? '';
    return { cells, grid };
  };

  it('uses one, two, then three columns', () => {
    // 3-up from `sm` gave each tile ~197px on a 640px tablet, which truncated
    // four separate strings at once. The third column waits for `lg`.
    const { grid } = setup();
    expect(grid.split(/\s+/)).toEqual(expect.arrayContaining([
      'grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3',
    ]));
  });

  it('stacks on phones: every cell but the first gets a top rule', () => {
    const { cells } = setup();
    expect(has(cells[0], 'border-t')).toBe(false);
    for (const i of [1, 2, 3]) expect(has(cells[i], 'border-t')).toBe(true);
  });

  it('cancels index 1’s top rule at sm, where it is the 2nd column', () => {
    const { cells } = setup();
    expect(has(cells[1], 'sm:border-t-0')).toBe(true);
    expect(has(cells[1], 'sm:border-l')).toBe(true);
    // Index 2 begins a new row when 2-up, so it must KEEP its top rule.
    expect(has(cells[2], 'sm:border-t-0')).toBe(false);
  });

  it('cancels both index 1 and 2 top rules at lg, the first row of 3', () => {
    const { cells } = setup();
    expect(has(cells[1], 'lg:border-t-0')).toBe(true);
    expect(has(cells[2], 'lg:border-t-0')).toBe(true);
    // Index 3 begins the second row at 3-up, so it keeps a top rule...
    expect(has(cells[3], 'lg:border-t-0')).toBe(false);
    // ...and is first in its row, so it drops the left rule `sm` gave it.
    expect(has(cells[3], 'lg:border-l-0')).toBe(true);
  });

  it('leaves the first cell bare at every breakpoint', () => {
    const { cells } = setup();
    for (const token of ['border-t', 'sm:border-l', 'lg:border-l', 'sm:border-l-0']) {
      expect(has(cells[0], token)).toBe(false);
    }
  });

  it('keeps every label on one line, so tiles stay the same height', () => {
    // Wrapping "Reviews due" onto two lines made one tile taller than its
    // neighbour and broke the alignment of the row of figures.
    const { cells } = setup();
    expect(cells[0].querySelector('span.truncate')).not.toBeNull();
  });
});
