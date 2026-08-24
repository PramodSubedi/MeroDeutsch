/**
 * src/hooks/useExerciseSession.ts
 *
 * Core Lesson Engine — single source of truth for the quiz state machine that
 * was previously duplicated inline across ~10 lesson pages.
 *
 * Owns:
 *  - idle / correct / wrong phases with option locking
 *  - live score + accuracy computation
 *  - option shuffling AT MOUNT (stable after lock — .clinerules C2.9)
 *  - ONE integration point with XpContext.reportAnswer() and
 *    useReviewQueue.addWrongAnswer() (.clinerules C2.6/C2.7 friendly)
 *
 * TTS safety contract (C2.6): questions may carry `speakPrompt` (safe to
 * speak BEFORE the answer locks) and `speakAfter` (only safe AFTER lock).
 * Primitives must never speak `speakAfter` pre-lock; this hook exposes both
 * fields explicitly so the UI cannot mix them up.
 *
 * Pages keep ownership of DATA (deck building from curriculumService) and
 * pass it in; this hook owns BEHAVIOR.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { shuffleArray } from '../utils/shuffleArray';
import { useXp } from './useXp';
import type { ReportAnswerOptions } from '../context/XpContext';
import { useReviewQueue } from './useReviewQueue';

/** Minimal shape a question must satisfy to be driven by the engine. */
export interface ExerciseQuestion {
  /** Stable unique id — used as the SRS review-queue itemKey. */
  key: string;
  correctAnswer: string;
  /** Multiple-choice options (raw order; the engine shuffles at mount). */
  options?: string[];
  /** Safe-to-speak text BEFORE the answer locks (prompt only). */
  speakPrompt?: string;
  /** Only speak AFTER the answer is locked (contains the answer). */
  speakAfter?: string;
}

export interface UseExerciseSessionConfig<Q extends ExerciseQuestion> {
  /** The deck — built by the page from real curriculum data. */
  questions: Q[];
  /** moduleType surfaced to XP + the review queue (e.g. 'grammar'). */
  module: string;
  /** XP awarded per correct answer. Defaults to XpContext default (quiz tier). */
  xpAmount?: number;
  /**
   * Custom option extractor when options are computed per question
   * (defaults to `q.options`). The returned array is shuffled once at mount.
   */
  getOptions?: (q: Q) => string[] | undefined;
  /**
   * Custom correctness comparator for TYPED answers (ListenAndType /
   * DictationInput) where trim/case/punctuation must be normalized.
   * Defaults to strict equality against `correctAnswer`.
   */
  matches?: (selected: string, question: Q) => boolean;
  /** Optional page-level side effect per answered item (e.g. advance stepper). */
  onItemResult?: (question: Q, correct: boolean) => void;
}

export type ExercisePhase = 'idle' | 'correct' | 'wrong';

export interface ExerciseSession<Q extends ExerciseQuestion> {
  /** Index into the deck of the active question. */
  index: number;
  /** Active question (undefined past the end of the deck). */
  current: Q | undefined;
  total: number;
  /** 'idle' until an option is chosen; then 'correct' | 'wrong' (locked). */
  phase: ExercisePhase;
  /** The option the learner picked (null while unlocked). */
  selected: string | null;
  /** True between picking an option and pressing Next. */
  locked: boolean;
  /** Whether the CURRENT locked selection was right (false while unlocked). */
  isCorrect: boolean;
  /** Number of correct answers so far. */
  score: number;
  /** Answered count so far. */
  answered: number;
  /** Accuracy over answered items (0-100). */
  accuracy: number;
  /** Per-question correctness by question key (for review rendering). */
  results: Record<string, boolean>;
  /** Shuffled-at-mount options for a question (stable across renders). */
  optionsFor: (question: Q) => string[];
  /** Lock in an answer. No-op while locked or past the deck end. */
  select: (option: string) => void;
  /** Advance to the next question (unlocks). */
  next: () => void;
  /** Restart the session from question 0 with a clean slate. */
  reset: () => void;
}

/**
 * The shared exercise state machine. See module docs for the contract.
 */
export function useExerciseSession<Q extends ExerciseQuestion>(
  config: UseExerciseSessionConfig<Q>
): ExerciseSession<Q> {
  const { questions, module, xpAmount, getOptions, matches, onItemResult } = config;

  const { reportAnswer } = useXp();
  const { addWrongAnswer } = useReviewQueue();

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<ExercisePhase>('idle');
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [results, setResults] = useState<Record<string, boolean>>({});
  /** Correctness of the CURRENT locked answer (respects custom `matches`). */
  const [lastCorrect, setLastCorrect] = useState(false);

  // Ref guard so rapid double-taps cannot double-report before re-render.
  const lockedRef = useRef(false);

  // Options are shuffled ONCE per question at mount/deck-build and stay
  // stable afterwards — even after locking (.clinerules C2.9).
  const shuffledOptionsRef = useRef<Map<string, string[]>>(new Map());
  const deckKey = useMemo(
    () => questions.map((q) => q.key).join('|'),
    [questions]
  );
  useMemo(() => {
    // Rebuild the shuffle cache whenever the deck changes.
    const map = new Map<string, string[]>();
    for (const q of questions) {
      const raw = getOptions ? getOptions(q) : q.options;
      map.set(q.key, raw ? shuffleArray([...raw]) : []);
    }
    shuffledOptionsRef.current = map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckKey]);

  const current = questions[index];
  const total = questions.length;
  const locked = phase !== 'idle';
  const isCorrect = locked && lastCorrect;
  const accuracy = answered > 0 ? Math.round((score / answered) * 100) : 0;

  const optionsFor = useCallback(
    (question: Q): string[] => shuffledOptionsRef.current.get(question.key) ?? [],
    []
  );

  const select = useCallback(
    (option: string) => {
      if (lockedRef.current || !current) return;
      lockedRef.current = true;

      const correct = matches ? matches(option, current) : option === current.correctAnswer;
      setSelected(option);
      setPhase(correct ? 'correct' : 'wrong');
            setLastCorrect(correct);
      setScore((n) => n + (correct ? 1 : 0));
      setAnswered((n) => n + 1);
      setResults((prev) => ({ ...prev, [current.key]: correct }));

      // Single-point gamification/SRS integration for ALL lesson surfaces.
      const payload: ReportAnswerOptions = {
        correct,
        module,
        amount: xpAmount,
      };
      reportAnswer(payload);
      if (!correct) {
        addWrongAnswer({
          moduleType: module,
          itemKey: current.key,
          userAnswer: option,
          correctAnswer: current.correctAnswer,
        });
      }

      onItemResult?.(current, correct);
    },
    [current, module, xpAmount, matches, reportAnswer, addWrongAnswer, onItemResult]
  );

  const next = useCallback(() => {
    lockedRef.current = false;
    setSelected(null);
    setPhase('idle');
    setLastCorrect(false);
    setIndex((i) => i + 1);
  }, []);

  const reset = useCallback(() => {
    lockedRef.current = false;
    setIndex(0);
    setPhase('idle');
    setSelected(null);
    setScore(0);
    setAnswered(0);
    setResults({});
    setLastCorrect(false);
  }, []);

  return {
    index,
    current,
    total,
    phase,
    selected,
    locked,
    isCorrect,
    score,
    answered,
    accuracy,
    results,
    optionsFor,
    select,
    next,
    reset,
  };
}

/**
 * Standalone reporter for surfaces that do NOT fit the linear session model
 * (Rapid Blitz timed rotation, pronunciation scoring, roleplay steps).
 * Routes through the SAME reportAnswer/addWrongAnswer pipeline so gamification
 * stays consistent app-wide without forcing those pages onto the deck machine.
 */
export function useAnswerReporter() {
  const { reportAnswer } = useXp();
  const { addWrongAnswer } = useReviewQueue();

  return useCallback(
    (input: {
      correct: boolean;
      module: string;
      amount?: number;
      itemKey?: string;
      userAnswer?: string;
      correctAnswer?: string;
    }) => {
      reportAnswer({
        correct: input.correct,
        module: input.module,
        amount: input.amount,
      });
      if (
        !input.correct &&
        input.itemKey &&
        input.correctAnswer !== undefined
      ) {
        addWrongAnswer({
          moduleType: input.module,
          itemKey: input.itemKey,
          userAnswer: input.userAnswer ?? '',
          correctAnswer: input.correctAnswer,
        });
      }
    },
    [reportAnswer, addWrongAnswer]
  );
}