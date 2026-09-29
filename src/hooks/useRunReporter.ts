/**
 * src/hooks/useRunReporter.ts
 *
 * Connects a step-flow run to the app's learning loop: XP, the SRS review queue,
 * and the assessment claim that stops the Mero panel covering the run's controls.
 *
 * ── WHY THE RUNNER CANNOT JUST SCORE ITSELF ─────────────────────────────────
 * A run that counted its own right answers and stopped there would be a
 * convincing demo and a broken product. Three things would be missing, and all
 * three are already solved elsewhere in this app:
 *
 *   1. XP. `reportAnswer` is the single shared award point, and it also records
 *      the engagement activity the heatmap reads. A local counter feeds neither.
 *   2. THE REVIEW QUEUE. `addWrongAnswer` is what puts a missed item into the
 *      SRS. Without it, a learner who fails the same step three times over three
 *      sessions never sees it again queued — the step-flow would be the only
 *      exercise in the app that forgets what it got wrong.
 *   3. THE ASSESSMENT CLAIM. This is the one that is a BUG, not a feature.
 *      `useExerciseSession` claims it for every deck-driven quiz because the Mero
 *      panel is `fixed inset-y-0 right-0 sm:w-[360px]` and auto-opens on a
 *      proactive nudge. A1CheckpointPage measured the cost at 1440px: the panel
 *      covered the Next button outright — `elementFromPoint` returned a chat
 *      paragraph — so the learner could not advance, retry or leave.
 *
 * A step-flow run is NOT deck-driven, so `useExerciseSession` cannot claim on its
 * behalf. Its header says so explicitly: "A page-level claim is what a page
 * WITHOUT a deck-driven engine needs." This is that call, and skipping it would
 * re-introduce a bug that was already found and fixed once.
 *
 * ── WHY `useExerciseSession` IS NOT USED FOR THE SCORING ────────────────────
 * Its model is "one of N options", with the deck owning index, lock and score.
 * The run's check steps are not that: a `typed` step is a free-text answer judged
 * by `matchesAnswer`, an `arrange` step is an ordered token list, a `match` step
 * is several pairs, and a `dictation` step is a sentence heard rather than read.
 * Those components must own their own lock state regardless — and several already
 * did before this hook existed. Forcing them through an options-only engine would
 * mean encoding every one of them as a fake option list.
 *
 * What IS shared is everything above, and that is what this hook centralises, so
 * there is exactly one place in the run where XP and SRS are awarded.
 */
import { useCallback, useRef } from 'react';
import { useXp } from './useXp';
import { useReviewQueue } from './useReviewQueue';
import { useAssessmentActive } from './useAssessmentActive';

/** The module id the lesson already reports under (`LessonModulePage`). */
const RUN_MODULE = 'a1-lesson';

export interface RunReport {
  /** Stable SRS key for the step: run id plus the step's position. */
  itemKey: string;
  /** True when the learner got it right. */
  correct: boolean;
  /** What the learner actually typed or picked, for the review card. */
  userAnswer?: string;
  /** The expected answer, for the review card. */
  correctAnswer?: string;
}

export interface UseRunReporter {
  /** Report one answered check step. Safe to call more than once per step. */
  report: (r: RunReport) => void;
}

export function useRunReporter(active: boolean): UseRunReporter {
  const { reportAnswer } = useXp();
  const { addWrongAnswer } = useReviewQueue();

  // Claimed for the WHOLE run, including the summary step. The claim exists to
  // keep the run's own controls clickable, and the Finish button is exactly the
  // control that was covered.
  useAssessmentActive(active);

  // Ref guard, mirroring `useExerciseSession`'s: a double-tapped option fires two
  // handlers before React re-renders, and both would award XP.
  const reported = useRef(new Set<string>());

  const report = useCallback(
    ({ itemKey, correct, userAnswer, correctAnswer }: RunReport) => {
      if (reported.current.has(itemKey)) return;
      reported.current.add(itemKey);

      reportAnswer({ correct, module: RUN_MODULE });

      if (!correct) {
        addWrongAnswer({
          moduleType: RUN_MODULE,
          itemKey,
          // A `match` step has no single wrong string. An empty user answer is
          // honest — the review card shows the expected answer and no spurious
          // "you said" that was never typed.
          userAnswer: userAnswer ?? '',
          correctAnswer: correctAnswer ?? '',
        });
      }
    },
    [addWrongAnswer, reportAnswer],
  );

  return { report };
}
