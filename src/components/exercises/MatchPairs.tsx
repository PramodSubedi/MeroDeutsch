/**
 * src/components/exercises/MatchPairs.tsx
 *
 * Lesson Engine primitive — split-screen matching mechanic (new exercise type).
 * Two independently shuffled columns (German left, English right). Tap one item
 * from each side:
 *   - MATCH   -> both lock green tint + success chime (+ optional TTS reinforce)
 *   - MISMATCH-> both flash red + error buzz, selection resets after ~600 ms;
 *                each uniquely-missed pair is queued ONCE per round into the
 *                SRS review queue via the shared Lesson Engine reporter.
 *
 * Completing ALL pairs awards the drill-tier XP (+25) exactly once and fires
 * `onComplete`. "Play again" reshuffles both columns for a fresh round.
 *
 * Design tokens: theme.* classes, ≥44px targets, active:scale-95, light/dark,
 * haptic feedback on taps (existing utils/haptic).
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { theme } from '../../config/theme';
import { shuffleArray } from '../../utils/shuffleArray';
import { triggerHaptic } from '../../utils/haptic';
import { playCorrectFx, playWrongFx, speakGerman } from '../../utils/audioService';
import { XP_REWARDS } from '../../hooks/useXp';
import { useAnswerReporter } from '../../hooks/useExerciseSession';

/** One translatable pair. */
export interface MatchPair {
  /** Stable id shared by both halves (used as the SRS itemKey suffix). */
  id: string;
  de: string;
  en: string;
}

interface MatchPairsProps {
  pairs: MatchPair[];
  /** moduleType surfaced to XP + the review queue (e.g. 'greetings'). */
  module: string;
  /** Fired once when every pair has been matched. */
  onComplete?: (correct: number, missed: number) => void;
  /** Speak the German word when a pair matches. Default true. */
  speakOnMatch?: boolean;
  /**
   * Optional column headers (e.g. "Nomen" / "Pronomen" for the gender →
   * pronoun mode). When omitted NO header row renders — the Greetings
   * DE↔EN mode keeps its original layout unchanged.
   */
  columnLabels?: { left: string; right: string };
}

/** Tile visual state derived from match/flash/selection. */
type TileTone = 'idle' | 'selected' | 'matched' | 'wrong';

export function MatchPairs({ pairs, module, onComplete, speakOnMatch = true, columnLabels }: MatchPairsProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const reportResult = useAnswerReporter();

  /** Increments to reshuffle both columns for a fresh round. */
  const [roundId, setRoundId] = useState(0);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(() => new Set());
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [flashingIds, setFlashingIds] = useState<Set<string>>(() => new Set());

  // Unique misses this round (queued to SRS at most once per pair per round).
  const missedRef = useRef<Set<string>>(new Set());
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  // Both columns shuffled INDEPENDENTLY at mount/reshuffle (stable per round).
  const leftColumn = useMemo(() => shuffleArray([...pairs]), [pairs, roundId]); // eslint-disable-line react-hooks/exhaustive-deps
  const rightColumn = useMemo(() => shuffleArray([...pairs]), [pairs, roundId]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearFlash = useCallback(() => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashingIds(new Set()), 600);
  }, []);

  const toneFor = useCallback(
    (side: 'left' | 'right', id: string): TileTone => {
      if (flashingIds.has(id)) return 'wrong';
      if (matchedIds.has(id)) return 'matched';
      if ((side === 'left' ? selectedLeft : selectedRight) === id) return 'selected';
      return 'idle';
    },
    [flashingIds, matchedIds, selectedLeft, selectedRight]
  );

  const tileCls = (tone: TileTone): string => {
    switch (tone) {
      case 'matched':
        return 'border-success-300 bg-success-50 text-success-900 dark:border-success-800 dark:bg-success-950/40 dark:text-success-200';
      case 'selected':
        return 'border-accent-500 bg-accent-50 text-accent-900 shadow-sm dark:border-accent-400 dark:bg-accent-950/60 dark:text-accent-100';
      case 'wrong':
        return 'border-danger-400 bg-danger-100 text-danger-900 dark:border-danger-600 dark:bg-danger-950/50 dark:text-danger-200';
      default:
        return 'border-ink-200 bg-white text-ink-800 hover:border-accent-300 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100 dark:hover:border-accent-500';
    }
  };

  const handleLeftTap = (pair: MatchPair) => {
    triggerHaptic('light');
    if (matchedIds.has(pair.id)) return;
    setSelectedLeft(pair.id);
    // If the right side is already selected, resolve immediately.
    if (selectedRight !== null) resolve(pair.id, selectedRight);
  };

  const handleRightTap = (pair: MatchPair) => {
    triggerHaptic('light');
    if (matchedIds.has(pair.id)) return;
    setSelectedRight(pair.id);
    if (selectedLeft !== null) resolve(selectedLeft, pair.id);
  };

  const resolve = (leftId: string, rightId: string) => {
    const isMatch = leftId === rightId;

    if (isMatch) {
      const nextMatched = new Set(matchedIds).add(leftId);
      setMatchedIds(nextMatched);
      setSelectedLeft(null);
      setSelectedRight(null);
      playCorrectFx();
      const pair = pairs.find((p) => p.id === leftId);
      if (speakOnMatch && pair) speakGerman(pair.de);

      // Round complete -> award drill XP once + notify.
      if (nextMatched.size === pairs.length && !completedRef.current) {
        completedRef.current = true;
        reportResult({ correct: true, module, amount: XP_REWARDS.drill });
        onComplete?.(pairs.length, missedRef.current.size);
      }
      return;
    }

    // Mismatch: flash red + buzz + queue the missed pair once.
    const nextFlashing = new Set([leftId, rightId]);
    setFlashingIds(nextFlashing);
    clearFlash();
    playWrongFx();
    if (!missedRef.current.has(leftId)) {
      missedRef.current.add(leftId);
      const leftPair = pairs.find((p) => p.id === leftId);
      const rightPair = pairs.find((p) => p.id === rightId);
      if (leftPair && rightPair) {
        reportResult({
          correct: false,
          module,
          itemKey: `match:${leftPair.id}`,
          userAnswer: rightPair.en,
          correctAnswer: leftPair.en,
        });
      }
    }
    setSelectedLeft(null);
    setSelectedRight(null);
  };

  const playAgain = () => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    missedRef.current = new Set();
    completedRef.current = false;
    setMatchedIds(new Set());
    setFlashingIds(new Set());
    setSelectedLeft(null);
    setSelectedRight(null);
    setRoundId((r) => r + 1); // reshuffles both columns via useMemo deps
  };

  const done = matchedIds.size === pairs.length && pairs.length > 0;

  return (
    <div className={theme.panel.surface}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-ink-950 dark:text-white">
          {isDE ? 'Paare zuordnen' : 'Match the pairs'}
        </h3>
        <span className="text-body font-semibold text-ink-500 dark:text-ink-400">
          {matchedIds.size}/{pairs.length}
        </span>
      </div>

      {/* Optional column headers (gender → pronoun mode); greetings mode unchanged. */}
      {columnLabels && (
        <div className="grid grid-cols-2 gap-2 text-[11px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-500 sm:gap-3">
          <span>{columnLabels.left}</span>
          <span>{columnLabels.right}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {/* Left column — German */}
        <div className="space-y-2">
          {leftColumn.map((pair) => (
            <button
              key={`L-${pair.id}-${roundId}`}
              type="button"
              onClick={() => handleLeftTap(pair)}
              disabled={matchedIds.has(pair.id)}
              className={`min-h-[48px] w-full rounded-md border px-3 py-2.5 text-left text-body font-semibold transition active:scale-95 disabled:opacity-80 ${tileCls(
                toneFor('left', pair.id)
              )}`}
            >
              {pair.de}
            </button>
          ))}
        </div>

        {/* Right column — English */}
        <div className="space-y-2">
          {rightColumn.map((pair) => (
            <button
              key={`R-${pair.id}-${roundId}`}
              type="button"
              onClick={() => handleRightTap(pair)}
              disabled={matchedIds.has(pair.id)}
              className={`min-h-[48px] w-full rounded-md border px-3 py-2.5 text-left text-body font-semibold transition active:scale-95 disabled:opacity-80 ${tileCls(
                toneFor('right', pair.id)
              )}`}
            >
              {pair.en}
            </button>
          ))}
        </div>
      </div>

      {/* Round complete footer */}
      {done && (
        <div className="mt-4 flex flex-col items-center gap-3">
          <p className="text-center text-body font-semibold text-success-700 dark:text-success-300">
            🎉{' '}
            {isDE
              ? `Alle Paare gefunden! Fehler: ${missedRef.current.size}`
              : `All pairs matched! Misses: ${missedRef.current.size}`}
          </p>
          <button
            type="button"
            onClick={playAgain}
            className={`${theme.button.secondary} inline-flex min-h-[44px] items-center gap-1.5`}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {isDE ? 'Neue Runde' : 'Play again'}
          </button>
        </div>
      )}
    </div>
  );
}