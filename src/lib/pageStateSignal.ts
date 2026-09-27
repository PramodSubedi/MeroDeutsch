/**
 * src/lib/pageStateSignal.ts — "what is on screen right now?"
 *
 * WHY A MODULE SIGNAL AND NOT A PROP
 * ---------------------------------
 * The chat lives in the app shell; the page knows what it is showing. Wiring
 * that together with props would mean editing every module page and threading
 * state through `Layout`. This is the same dependency-free module-signal shape
 * as the existing `lib/dailySessionSignal.ts`, so there is no precedent to
 * invent and no provider to wrap.
 *
 * A page publishes; the chat reads. Pages that publish nothing simply produce
 * no focus line, and the chat still grounds on the route + curriculum.
 */

export interface PageFocus {
  /** What the learner is looking at, e.g. "der Hund". */
  subject: string;
  /** Optional extra fact: the answer, a translation, the module title. */
  detail?: string;
  /** A ready-made question Mero can be asked about this exact thing. */
  suggestedQuestion?: string;
}

let current: PageFocus | null = null;
const listeners = new Set<(v: PageFocus | null) => void>();

/** Publish what this page is currently showing. Call on every change. */
export function setPageFocus(focus: PageFocus | null): void {
  current = focus;
  listeners.forEach((l) => l(focus));
}

export function getPageFocus(): PageFocus | null {
  return current;
}

export function subscribePageFocus(listener: (v: PageFocus | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
