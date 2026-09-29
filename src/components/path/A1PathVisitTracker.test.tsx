/**
 * src/components/path/A1PathVisitTracker.test.tsx
 *
 * Which node kinds completion-on-arrival still applies to.
 *
 * ── WHY THIS IS PINNED ───────────────────────────────────────────────────────
 * Every `learn` node was repointed at `/lesson/:n`, which made "arrived at this
 * URL" and "completed this module" the same event. A learner who opened a lesson,
 * read the first screen and closed the tab was credited with the whole module —
 * and the progress ring, which is built from node completion, showed a unit as
 * done for work nobody did.
 *
 * The fix has to be narrow in BOTH directions, and both halves are silent when
 * wrong:
 *
 *   · completing a `learn` node on arrival, under the run renderer, is the bug;
 *   · exempting it when the LEGACY renderer is active is a WORSE bug, because the
 *     legacy lesson page has no completion callback — nothing could ever complete
 *     a learn node again, and no error would ever appear.
 *
 * So this asserts both halves, rather than the happy path.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { A1PathVisitTracker } from './A1PathVisitTracker';

const completeNode = vi.fn();
const getNodeByRoute = vi.fn();

vi.mock('../../hooks/useA1Path', () => ({ useA1Path: () => ({ completeNode }) }));
vi.mock('../../data/a1Path', () => ({ getNodeByRoute: (r: string) => getNodeByRoute(r) }));
vi.mock('../../data/lessonRender/resolveActive', () => ({ getLessonRender: () => getLessonRender() }));

let getLessonRender = () => 'legacy' as string;

function mountAt(path: string) {
  const Probe = () => {
    const location = useLocation();
    return <span data-testid="path">{`${location.pathname}${location.search}`}</span>;
  };
  render(
    <MemoryRouter initialEntries={[path]}>
      <A1PathVisitTracker />
      <Probe />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  completeNode.mockClear();
  getNodeByRoute.mockReset();
  getLessonRender = () => 'legacy';
});

describe('arrival still completes a practice node', () => {
  it('does, under either renderer', () => {
    getNodeByRoute.mockReturnValue({ id: 'm07-practice', kind: 'practice' });
    mountAt('/sentence-builder');
    expect(completeNode).toHaveBeenCalledWith('m07-practice');
  });
});

describe('a learn node under the LEGACY renderer', () => {
  it('still completes on arrival — nothing else could', () => {
    // The legacy lesson page has no completion callback. If the tracker stopped
    // completing learn nodes here, no learn node could ever complete and nothing
    // would report an error.
    getLessonRender = () => 'legacy';
    getNodeByRoute.mockReturnValue({ id: 'm07-learn', kind: 'learn' });
    mountAt('/lesson/6');
    expect(completeNode).toHaveBeenCalledWith('m07-learn');
  });
});

describe('a learn node under the RUN renderer', () => {
  it('does NOT complete on arrival — opening is not finishing', () => {
    getLessonRender = () => 'run';
    getNodeByRoute.mockReturnValue({ id: 'm07-learn', kind: 'learn' });
    mountAt('/lesson/6');
    expect(completeNode).not.toHaveBeenCalled();
  });

  it('looks the node up before deciding to skip it', () => {
    getLessonRender = () => 'run';
    getNodeByRoute.mockReturnValue(undefined);
    mountAt('/lesson/6?render=run');
    // The lookup happens first, with the query string included, so the 15 shared
    // tool routes still resolve to a single module rather than a base-path guess.
    expect(getNodeByRoute).toHaveBeenCalled();
  });
});

describe('an unmatched route', () => {
  it('completes nothing', () => {
    getLessonRender = () => 'run';
    getNodeByRoute.mockReturnValue(null);
    mountAt('/dashboard');
    expect(completeNode).not.toHaveBeenCalled();
  });
});
