/**
 * src/lib/dailySessionSignal.ts
 *
 * U6 — Session closure polish.
 *
 * A tiny module-level signal so the global Layout can know a daily review
 * session is ACTIVE on Home (/ ) or Learn (/learn) — routes that are NOT
 * normally "quiz routes". While active, level-up events must render as
 * non-blocking toasts, never the full-screen LevelUpModal, so the review batch
 * is never interrupted mid-session.
 *
 * Kept dependency-free on purpose: no new context system, no gamification.
 */

let active = false;

const listeners = new Set<(v: boolean) => void>();

/** Mark the daily review session active/inactive. */
export function setDailySessionActive(value: boolean): void {
  active = value;
  listeners.forEach((listener) => listener(value));
}

/** Current daily-session-active state. */
export function isDailySessionActive(): boolean {
  return active;
}

/** Subscribe to session-active changes. Returns an unsubscribe fn. */
export function subscribeDailySessionActive(
  listener: (value: boolean) => void
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}