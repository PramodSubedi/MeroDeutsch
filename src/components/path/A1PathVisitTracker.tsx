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
 *
 * ── WHY A `learn` NODE IS EXEMPT WHEN THE RUN RENDERER IS ACTIVE ─────────────
 * Arrival is completion for a TOOL: opening the sentence builder is doing the
 * practice, so completing a practice node on arrival is right and stays.
 *
 * It is wrong for a lesson. Every learn node was repointed at `/lesson/:n`, so
 * arrival now means "opened the page", and a learner who opens a lesson, reads
 * the first screen and closes the tab would be credited with the whole module.
 * With the run renderer active, `LessonRunPage` completes the node when the last
 * step is answered instead.
 *
 * Gated on the renderer so the LEGACY path is untouched: with `lesson_render` on
 * `legacy` the lesson page has no completion callback, and exempting the tracker
 * there would leave `learn` nodes that nothing can ever complete.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useA1Path } from '../../hooks/useA1Path';
import { getNodeByRoute } from '../../data/a1Path';
import { getLessonRender } from '../../data/lessonRender/resolveActive';

export function A1PathVisitTracker() {
  const { completeNode } = useA1Path();
  const { pathname, search } = useLocation();

  useEffect(() => {
    // Pass pathname + search, NOT pathname alone: 15 modules share a small set of
    // routes, so module identity lives partly in the query string
    // (/grammar?tab=modals, /vocab-trainer?category=family). getNodeByRoute
    // prefers an exact full-route match and only falls back to the bare path when
    // exactly one node claims it, so a plain /roleplay cannot mark five modules
    // complete at once.
    const node = getNodeByRoute(pathname + search);
    if (!node) return;

    if (node.kind === 'learn' && getLessonRender() === 'run') return;

    completeNode(node.id);
  }, [pathname, search, completeNode]);

  return null;
}
