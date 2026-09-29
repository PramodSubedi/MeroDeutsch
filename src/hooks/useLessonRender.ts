/**
 * src/hooks/useLessonRender.ts
 *
 * Which lesson renderer `/lesson/:n` uses right now.
 *
 * ── WHY THIS IS A HOOK AND NOT JUST A FUNCTION CALL ─────────────────────────
 * `getLessonRender()` alone would render correctly on first paint (it reads the
 * localStorage mirror synchronously) and then never update when the flag
 * resolves — which is the exact moment a learner who has never visited a lesson
 * needs it to. Subscribing is what closes that gap: the first visit may paint
 * `legacy` once, and every visit after that is correct from the first frame.
 *
 * That residual first-visit flash is a deliberate trade, and the cheap half of
 * it is avoidable. This hook does NOT kick off resolution on mount — `App.tsx`
 * does that once at the root, next to `useCurriculumSource`. If every component
 * that consulted the switch also started a resolution, mounting a page that
 * renders both a lesson and something else would open redundant reads.
 *
 * ── WHY THE DEFAULT IS LEGACY HERE TOO ──────────────────────────────────────
 * `getLessonRender()` is seeded from the cache and falls back to `legacy`, so
 * this hook cannot hand back a renderer that does not exist. There is no
 * "loading" state to render and nothing to guard: an absent flag is a normal
 * state, not a failure.
 */
import { useEffect, useSyncExternalStore } from 'react';
import {
  getLessonRender,
  getLessonRenderRead,
  startLessonRenderResolution,
  subscribeLessonRender,
} from '../data/lessonRender/resolveActive';
import type { LessonRender } from '../data/lessonRender/source';

/**
 * Kick the switch read off once. Mounted at the ROOT, next to
 * `useCurriculumSource`, rather than inside the lesson page.
 *
 * That placement is the point. If the lesson page started the read, a learner
 * would pay the latency on the very lesson that is about to render — and every
 * visit thereafter would re-read, because there is no root to hold the result.
 * Starting it at the root means it overlaps with the rest of boot instead.
 */
export function useLessonRenderResolution(): void {
  useEffect(() => {
    // Idempotent: a second mount cannot race a second fetch.
    startLessonRenderResolution();

    // Fire-and-forget, so the outcome is read on the next tick. Dev only — a
    // learner's console should not become an ops channel.
    void Promise.resolve().then(() => {
      if (import.meta.env.DEV) {
        console.info('[lesson] renderer:', getLessonRenderRead()?.reason ?? 'unresolved');
      }
    });
  }, []);
}

/**
 * The renderer in force, re-rendering when the flag resolves.
 *
 * `getSnapshot` must be cheap and must return a stable value for an unchanged
 * store, which is why it delegates to the module's plain variable rather than
 * computing anything here.
 *
 * There is deliberately no companion `useLessonRenderRead()` for the last read
 * attempt. It would have to be a hook to be useful, and a hook that does not
 * subscribe returns a stale value after the first render — so `App.tsx` and the
 * admin System page read `getLessonRenderRead()` directly instead, where a
 * one-shot read is what they actually want.
 */
export function useLessonRender(): LessonRender {
  return useSyncExternalStore(subscribeLessonRender, getLessonRender, getLessonRender);
}
