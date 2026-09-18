/**
 * src/utils/wordOfDay.ts
 *
 * Shared, DETERMINISTIC "Word of the Day" picker used by HomeExtras and
 * DailyChallenge (and reusable by AlphabetPage if it ever pulls a real vocab
 * word instead of the picked letter's example).
 *
 * Why this exists:
 *   curriculumService.getVocabularyFiltered({}) routes to the quiz-side
 *   `get_random_vocabulary` RPC, which returns a RANDOM 25-row sample in random
 *   order on every call. Indexing that with `dayIndex % length` therefore
 *   yields a different "Word of the Day" on every refresh, and the two
 *   components disagree with each other.
 *
 *   Callers must instead use the deterministic FULL-pool fetch —
 *   `getVocabularyFiltered({ limit: 2000 })` — which routes to
 *   `get_vocabulary_glossary` (migration 017: word-ordered, active-only, no
 *   randomization). That result is stable across calls/refresh/device, so the
 *   day-based index stays meaningful.
 *
 *   This helper additionally sorts a copy by `keyOf` so the pick is stable
 *   even if the RPC's order were to change on a re-migration (defensive).
 */

/** Days since the Unix epoch, counted in LOCAL time so the word rolls over at
 * the user's local midnight — consistent with the existing `new Date().toDateString()`
 * usage in AlphabetPage and the cached `KEY` in DailyChallenge. */
export function localDayIndex(now: Date = new Date()): number {
  const utcMidnight = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor(utcMidnight / 86_400_000);
}

/**
 * Deterministic pick: return the element at `(localDayIndex % length)` of an
 * id-sorted copy. Returns `null` for an empty pool so callers can render
 * nothing (rather than a random word) until vocab is loaded.
 */
export function pickWordOfDay<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  now: Date = new Date()
): T | null {
  if (!items || items.length === 0) return null;
  const sorted = [...items].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
  return sorted[localDayIndex(now) % sorted.length];
}
