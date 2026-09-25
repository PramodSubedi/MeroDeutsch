/**
 * src/lib/anchors.ts
 *
 * Single registry for the in-page DOM anchor ids used by cross-page deep links
 * (`/dashboard#review-queue-section`, `/home#learning-path`, …) and by
 * scroll-to helpers.
 *
 * The same string literals were duplicated across four files, so renaming a
 * section silently broke links with no compile-time signal.
 */

export const ANCHORS = {
  /** A1 module grid on Home (`LearningPath`). */
  learningPath: 'learning-path',
  /** Dashboard SRS review queue section. */
  reviewQueue: 'review-queue-section',
  /** Linear A1 campaign spine on /learn (`UnitSpine`). */
  a1Spine: 'a1-spine',
  /** Home daily-session card (`DailySession`). */
  dailySession: 'daily-session',
} as const;

export type AnchorId = (typeof ANCHORS)[keyof typeof ANCHORS];

/** Build a cross-route deep link: `anchorHref('/dashboard', ANCHORS.reviewQueue)`. */
export function anchorHref(path: string, anchor: AnchorId): string {
  return `${path}#${anchor}`;
}

/**
 * Smooth-scroll to an anchor on the CURRENT page. No-op when the section is
 * not mounted (e.g. a collapsed/empty state) — callers never need to guard.
 */
export function scrollToAnchor(anchor: AnchorId, block: ScrollLogicalPosition = 'start'): void {
  if (typeof document === 'undefined') return;
  document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block });
}
