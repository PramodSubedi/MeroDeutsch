import { useProgress } from './useProgress';

/** Alphabet module totals — the single source for letters/spelling progress. */
export const ALPHABET_LETTER_TOTAL = 26;
export const SPELLING_TOTAL = 10;

export interface ProgressMetrics {
  /** Distinct letters marked as practiced. */
  lettersCount: number;
  /** lettersCount / ALPHABET_LETTER_TOTAL, clamped 0-100. */
  lettersPct: number;
  /** Alphabet quiz accuracy, clamped 0-100 (0 when no quiz answered yet). */
  quizPct: number;
  /** Spelling completions / SPELLING_TOTAL, clamped 0-100. */
  spellingPct: number;
  /** True once the learner has done anything in the alphabet module. */
  hasActivity: boolean;
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((part / total) * 100)));
}

/**
 * One source for the alphabet-module progress percentages.
 *
 * Home, Dashboard, Analytics and the Alphabet page each recomputed these from
 * `useProgress()` with subtly different rounding, guards and denominators
 * (e.g. Analytics produced >100% if more than 26 ids were practiced).
 */
export function useProgressMetrics(): ProgressMetrics {
  const { progress } = useProgress();
  const lettersCount = progress.practiced.length;
  return {
    lettersCount,
    lettersPct: pct(lettersCount, ALPHABET_LETTER_TOTAL),
    quizPct: pct(progress.quizCorrect, progress.quizTotal),
    spellingPct: pct(progress.spellCompleted, SPELLING_TOTAL),
    hasActivity: lettersCount > 0 || progress.quizTotal > 0 || progress.spellCompleted > 0,
  };
}
