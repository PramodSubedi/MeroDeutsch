/**
 * src/components/path/A1PathVisitTracker.tsx
 *
 * Renders nothing. Mounted once inside <Layout> (under the Router) so it runs
 * on every navigation. Implements lesson-complete rule (A): visiting a
 * learn/practice node's EXISTING route marks that node complete in the A1 path
 * state. Checkpoint and bonus nodes are NOT auto-completed here (checkpoints
 * complete only on a passing score; bonus never gates).
 *
 * This keeps lesson pages untouched (C16: don't modify unless a one-line
 * integration is required) — visit tracking lives in one tiny component.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useA1Path } from '../../hooks/useA1Path';
import { getNodeByRoute } from '../../data/a1Path';

export function A1PathVisitTracker() {
  const { completeNode } = useA1Path();
  const { pathname } = useLocation();

  useEffect(() => {
    const node = getNodeByRoute(pathname);
    if (node) {
      completeNode(node.id);
    }
  }, [pathname, completeNode]);

  return null;
}
