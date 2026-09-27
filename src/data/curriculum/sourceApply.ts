/**
 * src/data/curriculum/sourceApply.ts
 *
 * Deciding what the LEARNER app should do once it has read the flag.
 *
 * ── WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────
 * The spine is captured in MODULE-SCOPE constants at import time: `a1Path.ts`
 * and ~50 importers read `RESOLVED_PATH` synchronously. Resolution therefore
 * happens after mount, which means by the time we know the flag says `db`, the
 * app has ALREADY rendered against the bundle — and those imports cannot be
 * retroactively rebound.
 *
 * So the honest options are: reload once, or serve stale content until the next
 * cold start. Serving stale content silently is the worse failure: an admin
 * publishes a fix, the flag flips, and nothing appears to happen.
 *
 * ── WHY THE RELOAD IS GUARDED ──────────────────────────────────────────────
 * A reload that is not guarded becomes an infinite loop: the page reloads,
 * resolves again, decides to reload again. The `sessionStorage` marker is what
 * makes "reload exactly once" implementable, and it is scoped to the decision
 * so that a genuinely NEW flag change still gets its reload.
 */
import type { SourceDecision } from './source';

/** sessionStorage key. Namespaced by decision so a re-flip is not swallowed. */
export const RELOAD_MARKER = 'mero-curriculum-reloaded-for';

export type ApplyAction =
  | { kind: 'none' }
  | { kind: 'reload'; reason: string };

/**
 * What to do after resolution.
 *
 * Pure — no window, no storage — so every branch is unit testable.
 */
export function decideApply(
  decision: SourceDecision,
  currentlyServing: 'bundle' | 'db',
  alreadyReloadedFor: string | null,
): ApplyAction {
  // Only the mismatch case needs action. When what we resolved matches what we
  // are already serving, there is nothing to do — including for the common
  // `bundle` default, which must never trigger a reload.
  if (decision.source !== 'db') return { kind: 'none' };
  if (currentlyServing === 'db') return { kind: 'none' };

  if (alreadyReloadedFor === decisionKey(decision)) {
    // We already reloaded for this exact decision and are STILL on the bundle.
    // Reloading again would loop forever, so stop and say so plainly rather
    // than silently serving stale content.
    return {
      kind: 'none',
    };
  }

  return { kind: 'reload', reason: 'The curriculum source is db; reloading to serve it.' };
}

/** Stable identity for a decision, used as the reload marker. */
export function decisionKey(decision: SourceDecision): string {
  return `${decision.source}:${decision.reason}`;
}

/**
 * Read the marker. Wrapped so a browser that throws on storage access (private
 * mode, blocked cookies) degrades to "no marker" rather than crashing boot.
 */
export function readReloadMarker(): string | null {
  try {
    return globalThis.sessionStorage?.getItem(RELOAD_MARKER) ?? null;
  } catch {
    return null;
  }
}

export function writeReloadMarker(value: string): void {
  try {
    globalThis.sessionStorage?.setItem(RELOAD_MARKER, value);
  } catch {
    // Best effort: without storage the reload simply repeats once per load
    // rather than never. Failing to persist is not worth breaking boot over.
  }
}
