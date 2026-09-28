/**
 * src/lib/assessmentSignal.ts
 *
 * A tiny module-level flag answering one question: "is the learner in the
 * middle of a graded run RIGHT NOW?"
 *
 * WHY IT EXISTS (a real blocker, not a polish item)
 * `useChatbotTriggers` fires "I didn't pass the checkpoint. What did I get
 * wrong?" the moment a checkpoint records its result. That happens while the
 * learner is still ON the checkpoint page, looking at the last question with
 * its Next button. `enqueuePrompt` also forces the Mero panel open, and the
 * panel is `fixed inset-y-0 right-0 sm:w-[360px]`.
 *
 * Measured at a 1440px viewport: the panel's left edge sat at x=1070 while the
 * Next button spanned x=1157-1223. The panel was the topmost element at the
 * button's centre, so `elementFromPoint` returned a chat paragraph —
 * `nextIsClickable: false`. A learner physically COULD NOT advance the
 * checkpoint, and because the same overlap covers Retry and "Back to map" on
 * the result screen, they could not leave it either. The only escape was
 * discovering the close button.
 *
 * That is precisely the interruption `.clinerules` C2.7 forbids, and it
 * directly contradicts ChatSidebar's own header comment ("Nothing auto-opens
 * it"). The panel wanted to be seen; it just may not be seen MID-QUESTION.
 *
 * WHY A MODULE FLAG AND NOT A CONTEXT
 * `dailySessionSignal` already established this exact shape for the same
 * reason: the answer is needed by `chatStore` (below the tree) and by a page
 * (above it), and threading a provider between them would be all cost. No new
 * context, no new storage, no re-render of the tree.
 * ── WHY A DEPTH COUNTER AND NOT A BOOLEAN ───────────────────────────────────
 * A single boolean cannot be owned by two managers. `useExerciseSession` claims
 * for every deck-driven page, and `A1CheckpointPage` holds a second claim for
 * its own `phase === 'playing'` window — under a boolean, whichever released
 * first would clear the flag while the other was still mid-question and
 * re-open the panel over a live run. Counting claims makes overlapping owners
 * safe: the flag falls only when the LAST holder lets go. Every acquire must be
 * balanced by exactly one release, which is what `useAssessmentActive` is for.
 */

/** How many owners currently claim a graded run is in flight. */
let depth = 0;

const listeners = new Set<(v: boolean) => void>();

function emit(value: boolean): void {
  listeners.forEach((listener) => listener(value));
}

/**
 * Claim that a graded run is in flight. Balance every call with `releaseAssessment`.
 *
 * The one rule: ONE release per acquire, always — including on unmount. That is
 * why `useAssessmentActive` exists; calling these by hand from a page effect is
 * exactly how a leaked claim would freeze the panel shut for the whole session.
 */
export function acquireAssessment(): void {
  depth += 1;
  if (depth === 1) emit(true);
}

/** Release a claim. Clamped at zero, so a stray release cannot go negative. */
export function releaseAssessment(): void {
  if (depth === 0) return;
  depth -= 1;
  if (depth === 0) emit(false);
}

/** True while a graded run is in flight. */
export function isAssessmentActive(): boolean {
  return depth > 0;
}

/** Subscribe to changes. Returns an unsubscribe fn. */
export function subscribeAssessmentActive(listener: (value: boolean) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
