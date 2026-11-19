/** Records visits to unlocked practice tools in the A1 campaign. */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useA1Path } from '../../hooks/useA1Path';
import { getNodeByRoute } from '../../data/a1Path';

export function A1PathVisitTracker() {
  const { completeNode, isNodeUnlocked } = useA1Path();
  const { pathname, search } = useLocation();

  useEffect(() => {
    // Pass pathname + search, NOT pathname alone: 15 modules share a small set of
    // routes, so module identity lives partly in the query string
    // (/grammar?tab=modals, /vocab-trainer?category=family). getNodeByRoute
    // prefers an exact full-route match and only falls back to the bare path when
    // exactly one node claims it, so a plain /roleplay cannot mark five modules
    // complete at once.
    const node = getNodeByRoute(pathname + search);
    if (node?.kind !== 'practice' || !isNodeUnlocked(node)) return;

    completeNode(node.id);
  }, [pathname, search, completeNode, isNodeUnlocked]);

  return null;
}
