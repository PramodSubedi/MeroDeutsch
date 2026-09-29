/**
 * Regression tests for the Dashboard's course-position block.
 *
 * The defect these exist to prevent: the page showed the same course progress
 * twice with DIFFERENT denominators — "Modules 3/15" in a stat tile and "3 of
 * 16" in the ring strip below it. Both numbers were locally correct (15 = core
 * units, 16 = all units) and together they were a contradiction the learner
 * had no way to resolve.
 *
 * `CoursePosition` exists so the figure and the strip are rendered by the same
 * component from the same state. These tests assert the *invariant* — the
 * headline number, the rings drawn, and the caption can never disagree — rather
 * than snapshotting markup, so a future course change (a 17th unit, a new
 * `support` band) fails here if it reintroduces a second denominator.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

// ── Module mocks, hoisted before the component import ───────────────────────
// Paths are relative to THIS file (`src/components/dashboard/`), so they use the
// same `../../` depth the component itself does. Mocking `../hooks/useLang`
// would resolve to `src/components/hooks/...`, silently match nothing, and let
// the real `useLanguage` throw "must be used within LanguageProvider".
const phaseByUnit = new Map<number, string>();
// `getPushNode` returns null when the learner has finished everything, which is
// a real state the component has to render. It is modelled as a mutable box so
// a test can flip it without re-mocking the module.
const pushState: { node: { unitIndex: number; to: string } | null } = {
  node: { unitIndex: 0, to: '/lesson/0' },
};

vi.mock('../../hooks/useLang', () => ({
  useLang: () => ({ langMode: 'english' }),
}));

vi.mock('../../hooks/useA1Path', () => ({
  useA1Path: () => ({
    getPushNode: () => pushState.node,
    getUnitPhase: (index: number) => phaseByUnit.get(index) ?? 'locked',
    isNodeComplete: () => true,
    isCheckpointComplete: () => false,
  }),
}));

vi.mock('../../data/a1Path', () => {
  // Three units is enough to prove the invariant and keeps the test readable.
  //
  // `nodeMap` + `checkpoint` are required because the REAL `computeModuleProgress`
  // is not mocked (it is pure and cheap, and mocking it would defeat the point
  // of testing a real invariant). It walks `unit.nodeIds`, resolves each id
  // through `A1_CURRICULUM.nodeMap`, and adds one more step when the unit has a
  // gate. A fixture missing any of those throws rather than reporting 0.
  const units = [0, 1, 2].map((i) => ({
    id: `m0${i + 1}`,
    index: i,
    code: `M0${i + 1}`,
    title: { en: `Unit ${i + 1}`, de: `Einheit ${i + 1}` },
    nodeIds: [`m0${i + 1}-learn`, `m0${i + 1}-practice`],
    checkpoint: { id: `m0${i + 1}-gate` },
  }));
  const nodeMap = Object.fromEntries(
    units.flatMap((u) =>
      u.nodeIds.map((id) => [id, { id, kind: id.endsWith('practice') ? 'practice' : 'learn' }]),
    ),
  );
  return { A1_CURRICULUM: { units, nodeMap }, A1_UNIT_COUNT: units.length };
});

vi.mock('../path/ProgressRing', () => ({
  ProgressRing: ({ label, decorative }: { label: string; decorative?: boolean }) => (
    <span data-testid={`ring-${label}`} data-decorative={String(!!decorative)} />
  ),
}));

import { CoursePosition } from './CoursePosition';

afterEach(() => {
  cleanup();
  phaseByUnit.clear();
  // `pushState.node` is module-level and the "course done" test sets it to
  // null, so it must be restored or later tests inherit a finished learner.
  pushState.node = { unitIndex: 0, to: '/lesson/0' };
});

const renderIt = (children: ReactNode) => render(<MemoryRouter>{children}</MemoryRouter>);

/**
 * The headline renders as `<p>1<span>/3</span></p>` — the numerator and the
 * denominator are separate elements so the denominator can be de-emphasised.
 * `getByText('1/3')` therefore cannot match, and asserting on the numerator
 * alone would pass even if the denominator were wrong. Read the paragraph's
 * full text instead, which is the thing a learner actually sees.
 */
const headline = (container: HTMLElement) =>
  container.querySelector('section p.font-mono')?.textContent;

describe('CoursePosition — one figure, one denominator', () => {
  it('counts the units it draws rings for', () => {
    phaseByUnit.set(0, 'done');
    phaseByUnit.set(1, 'current');
    const { container } = renderIt(<CoursePosition gateAveragePct={null} />);

    // 1 done of 3 units, and 3 rings actually rendered.
    expect(headline(container)).toBe('1/3');
    expect(screen.getAllByTestId(/^ring-/)).toHaveLength(3);
  });

  it('reads 0/3 rather than omitting the denominator on a fresh learner', () => {
    const { container } = renderIt(<CoursePosition gateAveragePct={null} />);
    expect(headline(container)).toBe('0/3');
  });

  it('renders the gate average as a caption, never as a peer headline', () => {
    phaseByUnit.set(0, 'done');
    renderIt(<CoursePosition gateAveragePct={86} />);

    // Present, but in the caption line alongside the percentage of the course.
    expect(screen.getByText('Checkpoints averaging 86%')).toBeTruthy();
    expect(screen.getByText(/33% of the course/)).toBeTruthy();
  });

  it('says "no checkpoint attempted" instead of a fake 0% when nothing is attempted', () => {
    renderIt(<CoursePosition gateAveragePct={null} />);
    expect(screen.getByText('No checkpoint attempted')).toBeTruthy();
    expect(screen.queryByText(/averaging 0%/)).toBeNull();
  });
});

describe('CoursePosition — the ring strip', () => {
  it('keeps the list role on the scroll container', () => {
    // Chrome drops the implicit list role on a scroll container, which would
    // leave sixteen links announced as an unlabelled group.
    phaseByUnit.set(0, 'done');
    const { container } = renderIt(<CoursePosition gateAveragePct={null} />);
    const list = container.querySelector('ul');
    expect(list?.getAttribute('role')).toBe('list');
  });

  it('marks every ring decorative, because the link carries the full name', () => {
    renderIt(<CoursePosition gateAveragePct={null} />);
    for (const ring of screen.getAllByTestId(/^ring-/)) {
      expect(ring.getAttribute('data-decorative')).toBe('true');
    }
  });
});

describe('CoursePosition — the next link', () => {
  it('links to the push node route when one exists', () => {
    pushState.node = { unitIndex: 1, to: '/lesson/1' };
    const { container } = renderIt(<CoursePosition gateAveragePct={null} />);
    // Scoped to the NEXT row, not the whole section: every ring link also
    // carries a unit title in its accessible name, so a document-wide
    // getByRole('link', { name: /Unit 2/ }) matches both and throws.
    const next = container.querySelector('section a.group');
    expect(next?.getAttribute('href')).toBe('/lesson/1');
  });

  it('shows a terminal state, not a dead link, when the course is done', () => {
    // All units done + no push node: the exact pair of conditions under which
    // `getPushNode()` returns null. The component must render a sentence, not a
    // link to a unit that does not exist.
    phaseByUnit.set(0, 'done');
    phaseByUnit.set(1, 'done');
    phaseByUnit.set(2, 'done');
    pushState.node = null;

    const { container } = renderIt(<CoursePosition gateAveragePct={100} />);
    expect(screen.getByText('Course complete')).toBeTruthy();
    expect(container.querySelector('section a.group')).toBeNull();
  });
});
