/**
 * Tests for the Dashboard's checkpoint-trajectory chart.
 *
 * WHAT IS WORTH PINNING DOWN HERE
 * -------------------------------
 * This chart is built from one record per unit, and four of its behaviours are
 * easy to "fix" later by accident. Each is a deliberate decision:
 *
 *  1. BEST, NOT LAST. The bar plots `attemptsByUnit[i].best`. A learner who
 *     re-takes a gate after a bad day must not see their line dip.
 *  2. THE 80% LINE COMES FROM THE RULE. `y={PASS_PCT}` is asserted against the
 *     exported `CHECKPOINT_PASS_THRESHOLD` rather than a literal, so changing
 *     the gate to 85% updates the chart without anyone editing a number here.
 *  3. UNATTEMPTED IS AN ABSENCE, NOT A ZERO. A not-yet-reached unit renders
 *     an em dash and a transparent cell, never a 0-height bar, which would read
 *     as "you scored nothing" instead of "you have not been there yet".
 *  4. THE SUPPORT BAND IS A GAP. M16 is `kind: 'support'` and has no gate, so
 *     it must appear as a permanent gap rather than being silently dropped.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

/** Mutable module-level state the mocked hook reads, so a test can reshape it. */
const attemptState: { attemptsByUnit: Record<number, { attempts: number; best: number }> } = {
  attemptsByUnit: {},
};

vi.mock('../../hooks/useLang', () => ({
  useLang: () => ({ langMode: 'english' }),
}));

vi.mock('../../hooks/useA1Path', () => ({
  useA1Path: () => attemptState,
}));

// `useChartTokens` reads CSS custom properties through getComputedStyle, which
// returns '' in jsdom. Stubbing the hook gives the tests real, DISTINCT colour
// strings, which is what makes the pass/fail fill assertion meaningful — with
// '' on both sides every fill would compare equal and the test would pass for
// the wrong reason.
vi.mock('../../hooks/useChartTokens', () => ({
  useChartTokens: () => ({
    accent: 'ACCENT',
    success: 'SUCCESS',
    warning: 'WARNING',
    grid: 'GRID',
    axis: 'AXIS',
    tooltipBg: 'TOOLTIP_BG',
    tooltipText: 'TOOLTIP_TEXT',
    tooltipBorder: 'TOOLTIP_BORDER',
  }),
}));

import { A1_CURRICULUM, CHECKPOINT_PASS_THRESHOLD } from '../../data/a1Path';
import { CheckpointTrajectory } from './CheckpointTrajectory';

const PASS_PCT = Math.round(CHECKPOINT_PASS_THRESHOLD * 100);

afterEach(() => {
  cleanup();
  attemptState.attemptsByUnit = {};
});

const renderIt = () => render(<CheckpointTrajectory />);

/** Best/attempts for one unit, read out of the accessible table. */
function tableRow(code: string) {
  const cell = screen.getByRole('rowheader', { name: code });
  const cells = cell.closest('tr')!.querySelectorAll('td');
  return { best: cells[0]?.textContent, attempts: cells[1]?.textContent };
}

describe('CheckpointTrajectory — the empty state', () => {
  it('says nothing has been attempted instead of drawing a flat zero chart', () => {
    renderIt();
    // An all-zero bar chart reads as "you scored nothing" rather than "there is
    // nothing yet", so the chart is withheld until real data exists.
    expect(screen.getByText(/No checkpoint attempted yet/i)).toBeTruthy();
    expect(screen.queryByTestId('bar-chart')).toBeNull();
  });

  it('still states the pass rule, so an empty chart is not a blank card', () => {
    renderIt();
    expect(screen.getByText(`Gates pass at ${PASS_PCT}%.`)).toBeTruthy();
  });
});

describe('CheckpointTrajectory — the 80% rule is drawn from the rule', () => {
  it('places the reference line exactly at the shared pass threshold', () => {
    attemptState.attemptsByUnit = { 0: { attempts: 1, best: 0.9 } };
    renderIt();
    // Compared to the exported constant, not a literal 80: if the gate ever
    // moves to 85%, this still passes and the chart follows automatically.
    expect(screen.getByTestId('reference-line').getAttribute('y')).toBe(String(PASS_PCT));
  });
});

describe('CheckpointTrajectory — best score, not last score', () => {
  it('plots the best score for a unit retaken several times', () => {
    attemptState.attemptsByUnit = { 0: { attempts: 4, best: 0.92 } };
    renderIt();
    expect(tableRow('M01').best).toBe('92%');
    expect(tableRow('M01').attempts).toBe('4');
  });

  it('rounds a fractional best score to a whole percentage', () => {
    attemptState.attemptsByUnit = { 0: { attempts: 1, best: 0.825 } };
    renderIt();
    expect(tableRow('M01').best).toBe('83%');
  });
});

describe('CheckpointTrajectory — the 80% colouring', () => {
  it('marks a bar at the threshold as passed, using the success token', () => {
    // Exactly 0.8 is the boundary and the rule is ">=", so this must read as
    // passed. An off-by-one here would show a learner green as failed.
    attemptState.attemptsByUnit = { 0: { attempts: 1, best: 0.8 } };
    renderIt();
    expect(screen.getAllByTestId('cell')[0].getAttribute('fill')).toBe('SUCCESS');
  });

  it('marks a bar below the threshold as not yet passed, using the accent token', () => {
    attemptState.attemptsByUnit = { 0: { attempts: 2, best: 0.79 } };
    renderIt();
    expect(screen.getAllByTestId('cell')[0].getAttribute('fill')).toBe('ACCENT');
  });

  it('leaves an unattempted bar transparent rather than drawing a zero', () => {
    attemptState.attemptsByUnit = { 0: { attempts: 1, best: 0.9 } };
    renderIt();
    // Cell 1 is unit 2, never attempted. A 0-height bar or a filled-in zero
    // would both read as a score of nothing.
    expect(screen.getAllByTestId('cell')[1].getAttribute('fill')).toBe('transparent');
  });
});


describe('CheckpointTrajectory — unattempted and support-unit gaps', () => {
  it('renders an em dash, not "0%", for a unit that was never attempted', () => {
    attemptState.attemptsByUnit = { 0: { attempts: 1, best: 0.9 } };
    renderIt();
    expect(tableRow('M02').best).toBe('—');
    expect(tableRow('M02').attempts).toBe('0');
    // Guards against a "0%" fallback creeping back in.
    expect(screen.queryByText('0%')).toBeNull();
  });

  it('keeps the support band visible as a permanent gap', () => {
    attemptState.attemptsByUnit = { 0: { attempts: 1, best: 0.9 } };
    renderIt();
    // M16 is `kind: 'support'` and carries no gate, so it can never acquire a
    // score. It must still occupy a slot, or the x-axis would silently claim
    // the course is shorter than it is.
    const support = A1_CURRICULUM.units.find((u) => u.kind === 'support');
    expect(support).toBeTruthy();
    expect(tableRow(support!.code).best).toBe('—');
  });

  it('plots every unit in course order, so gaps are not compressed away', () => {
    attemptState.attemptsByUnit = { 0: { attempts: 1, best: 0.9 } };
    renderIt();
    // Omitting unattempted units would make M01 look adjacent to M15 and
    // misrepresent where the learner actually is.
    expect(screen.getAllByTestId('cell')).toHaveLength(A1_CURRICULUM.units.length);
    for (const unit of A1_CURRICULUM.units) {
      expect(tableRow(unit.code)).toBeTruthy();
    }
  });
});

describe('CheckpointTrajectory — attempt counts and totals', () => {
  it('sums attempts across units in the caption', () => {
    attemptState.attemptsByUnit = {
      0: { attempts: 3, best: 0.9 },
      1: { attempts: 2, best: 0.85 },
    };
    renderIt();
    // The count is surfaced so "just grind until it passes" is visible rather
    // than hidden behind a flattering best-score line.
    expect(screen.getByText(`5 attempts total · gates pass at ${PASS_PCT}%`)).toBeTruthy();
  });

  it('uses the singular form for a single attempt', () => {
    attemptState.attemptsByUnit = { 0: { attempts: 1, best: 0.9 } };
    renderIt();
    expect(screen.getByText(`1 attempt total · gates pass at ${PASS_PCT}%`)).toBeTruthy();
  });
});

describe('CheckpointTrajectory — the trend readout', () => {
  it('stays hidden for fewer than three attempts, where a trend is noise', () => {
    attemptState.attemptsByUnit = {
      0: { attempts: 1, best: 0.5 },
      1: { attempts: 1, best: 0.95 },
    };
    renderIt();
    // Two points make a line, not a trend. Presenting it as "+45 pts trend"
    // would be inventing an insight out of noise.
    expect(screen.queryByText(/pts trend/)).toBeNull();
  });

  it('appears once at least three units have been attempted', () => {
    attemptState.attemptsByUnit = {
      0: { attempts: 1, best: 0.5 },
      1: { attempts: 1, best: 0.6 },
      2: { attempts: 1, best: 0.95 },
    };
    renderIt();
    // mid = floor(3/2) = 1, so the split is 1 early vs 2 late:
    // early 50, late mean(60, 95) = 77.5 -> +28.
    //
    // The figure and its "pts trend" caption are separate elements, so
    // `getByText('+28')` cannot match and asserting on either half alone would
    // pass with the wrong value. Read the paragraph's full text instead, the
    // same approach `CoursePosition.test.tsx` uses for the course headline.
    const trendPara = screen.getByText(/pts trend/).closest('p');
    expect(trendPara?.textContent).toBe('+28pts trend');
  });

  it('renders a negative trend with a minus sign rather than a bare number', () => {
    // Guards the `trend > 0 ? `+${trend}` : trend` branch: a declining learner
    // must see "-10", not "10", which would invert the meaning entirely.
    // early 95, late mean(90, 80) = 85 -> -10.
    attemptState.attemptsByUnit = {
      0: { attempts: 1, best: 0.95 },
      1: { attempts: 1, best: 0.9 },
      2: { attempts: 1, best: 0.8 },
    };
    renderIt();
    expect(screen.getByText(/pts trend/).closest('p')?.textContent).toBe('-10pts trend');
  });
});

describe('CheckpointTrajectory — accessibility', () => {
  it('hides the chart from assistive tech and keeps the numbers in a table', () => {
    attemptState.attemptsByUnit = { 0: { attempts: 1, best: 0.9 } };
    renderIt();
    // Sixteen unlabelled bars are noise to a screen reader, and every value
    // drawn is repeated as text below.
    expect(screen.getByTestId('bar-chart').closest('[aria-hidden="true"]')).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('labels the table so it is not an unlabelled grid of numbers', () => {
    attemptState.attemptsByUnit = { 0: { attempts: 1, best: 0.9 } };
    renderIt();
    expect(
      screen.getByText('Best checkpoint score and attempt count per unit'),
    ).toBeTruthy();
  });
});
