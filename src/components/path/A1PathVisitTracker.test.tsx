import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { A1PathVisitTracker } from './A1PathVisitTracker';

vi.unmock('react-router-dom');

const completeNode = vi.fn();
const getNodeByRoute = vi.fn();
const isNodeUnlocked = vi.fn();

vi.mock('../../hooks/useA1Path', () => ({
  useA1Path: () => ({ completeNode, isNodeUnlocked }),
}));
vi.mock('../../data/a1Path', () => ({
  getNodeByRoute: (route: string) => getNodeByRoute(route),
}));

function mountAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <A1PathVisitTracker />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  completeNode.mockClear();
  getNodeByRoute.mockReset();
  isNodeUnlocked.mockReset().mockReturnValue(true);
});

describe('A1 practice visit tracking', () => {
  it('records an unlocked practice visit with its module-specific route', () => {
    getNodeByRoute.mockReturnValue({ id: 'm07-practice', kind: 'practice' });
    mountAt('/grammar?tab=word-order');
    expect(getNodeByRoute).toHaveBeenCalledWith('/grammar?tab=word-order');
    expect(completeNode).toHaveBeenCalledWith('m07-practice');
  });

  it('leaves locked practice unfinished', () => {
    getNodeByRoute.mockReturnValue({ id: 'm07-practice', kind: 'practice' });
    isNodeUnlocked.mockReturnValue(false);
    mountAt('/grammar?tab=word-order');
    expect(completeNode).not.toHaveBeenCalled();
  });

  it.each(['learn', 'checkpoint', 'bonus'])('leaves %s completion to its activity', (kind) => {
    getNodeByRoute.mockReturnValue({ id: 'm07-node', kind });
    mountAt('/lesson/6');
    expect(completeNode).not.toHaveBeenCalled();
  });

  it('ignores routes outside the campaign', () => {
    mountAt('/dashboard');
    expect(completeNode).not.toHaveBeenCalled();
  });
});
