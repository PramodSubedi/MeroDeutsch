/**
 * src/hooks/useCurriculumSource.ts
 *
 * Records what `curriculum_source` resolved to. It does NOT reload.
 *
 * ── WHY NO RELOAD, AND WHY THAT IS THE HONEST ANSWER ───────────────────────
 * The obvious implementation — resolve, then `location.reload()` — does not
 * work, and shipping it would be worse than shipping nothing.
 *
 * `a1Path.ts` snapshots the spine into ~50 module-scope constants at IMPORT
 * TIME:
 *
 *     import { RESOLVED_PATH } from './curriculum';
 *     export const A1_UNITS = RESOLVED_PATH.units;
 *
 * Those bindings are frozen when the module graph is evaluated. A reload
 * re-evaluates that graph BEFORE any network resolution runs, and
 * `RESOLVED_PATH` is computed synchronously from the bundle. So a reload serves
 * the bundle again — every time, forever.
 *
 * For `db` content to actually reach a learner, the curriculum modules must be
 * evaluated AFTER resolution: resolve in `main.tsx`, then `await import('./App')`.
 * That is a boot-gate change to the learner's critical path, and it is the real
 * remaining piece of Phase 3b. It needs its own focused pass with boot timing and
 * offline behaviour measured, not a drive-by at the end of a long session.
 *
 * Until then this hook is OBSERVABILITY, not behaviour: it resolves the flag and
 * records the decision, so the decision is inspectable rather than invisible. No
 * reload, no loop risk, no false impression that content has switched.
 */
import { useEffect } from 'react';
import { startCurriculumResolution, getSourceDecision } from '../data/curriculum/resolveActive';
import type { SourceDecision } from '../data/curriculum/source';

let latest: SourceDecision | null = null;

export function getLearnerSourceDecision(): SourceDecision | null {
  return latest;
}

export function useCurriculumSource(): void {
  useEffect(() => {
    // Idempotent: a second mount cannot race a second fetch.
    startCurriculumResolution();

    // `startCurriculumResolution` is fire-and-forget, so the decision is read on
    // the next tick. It runs after mount, which is what keeps the ~50
    // synchronous importers working.
    void Promise.resolve().then(() => {
      latest = getSourceDecision();
      if (import.meta.env.DEV) {
        // Surfaces the decision while developing. Never logged in production:
        // a learner's console should not become an ops channel.
        console.info('[curriculum] source:', latest.source, latest.reason);
      }
    });
  }, []);
}
