/**
 * src/components/run/StepRunner.tsx
 *
 * The one component that plays a `Run`, in either of its two modes.
 *
 * ── WHY IT NAVIGATES SCREENS, NOT STEPS ──────────────────────────────────────
 * The first version walked `run.steps` one at a time, which made M07
 * forty-nine clicks long. A step is a unit of CONTENT; a screen is a unit of
 * ATTENTION, and they are not the same size. `buildScreens` derives the mapping
 * (see `screens.ts`); this file just obeys it.
 *
 * ── WHY EXERCISES ADVANCE THEMSELVES ─────────────────────────────────────────
 * After an answer, the feedback needs a moment to be read and then the run moves
 * on. Two properties matter:
 *
 *   · It fires only after an EXPLICIT answer — a chosen option, a submitted
 *     field — never on a timer. There is no need for a pause control, because
 *     nothing moves without the learner having just acted, and nothing is moving
 *     while they read.
 *   · The Continue button appears IMMEDIATELY, not after the delay. The delay is
 *     a convenience for someone in flow, and forcing it on someone who wants to
 *     move on would be the same irritation this change exists to remove.
 *
 * The one case where auto-advance is suppressed is a match step: it reports
 * `onResult` once per MISPAIR as well as at the end, and advancing mid-puzzle
 * would throw the board away.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../../hooks/useLang';
import { useLessonRun } from '../../hooks/useLessonRun';
import { useRunReporter } from '../../hooks/useRunReporter';
import { isCheckStep, type CheckStep, type Run, type Step } from '../../data/curriculum/steps';
import { buildScreens, resumeIndexOf, type RunScreen } from './screens';
import { StepScreen } from './StepScreen';

/** Long enough to register right/wrong, short enough not to feel like a stall. */
const AUTO_ADVANCE_MS = 1200;

export interface StepRunnerProps {
  run: Run;
  /** Called once, when the learner completes the run. The path wiring lands in phase 2. */
  onComplete?: (run: Run) => void;
}

export function StepRunner({ run, onComplete }: StepRunnerProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  const screens = useMemo(() => buildScreens(run.steps), [run.steps]);
  const { stepIndex, started, totalChecks, answeredChecks, goToStep, answer, complete } = useLessonRun(run);

  // The screen containing the stored step. Keyed off the stored index so a
  // mid-batch resume (an older save, or a learner who stopped on word 9 of 14)
  // lands on that batch rather than at its start.
  const screenIndex = useMemo(() => {
    const found = screens.findIndex((s) => s.indices.includes(stepIndex));
    return found === -1 ? 0 : found;
  }, [screens, stepIndex]);

  const [screenPos, setScreenPos] = useState(screenIndex);
  const [answered, setAnswered] = useState(false);

  // Follow the stored index when it changes from outside (a resume, a restart).
  useEffect(() => setScreenPos(screenIndex), [screenIndex]);

  // ── START AT THE FIRST EXERCISE ──
  //
  // This page is the exercise runner. The reading — objectives, vocabulary,
  // grammar, traps, culture, dialogue — is the lesson notes at
  // `/lesson/:n/notes`, which has always been that surface and is linked from the
  // end of this run.
  //
  // So a run that has never been opened skips straight to its first exercise. The
  // teaching steps stay in the data (the notes page reads its own document fields,
  // and the check that a run ends in a summary still holds) but they are not the
  // entry point, because a learner opening a lesson to PRACTISE should not have to
  // click through six screens of prose first.
  //
  // Only on a FIRST visit. `started` is false for a run that has never been
  // opened, so a learner resuming at exercise 7 is not yanked back to exercise 1.
  useEffect(() => {
    if (started) return;
    const firstCheck = screens.findIndex((s) => s.group === 'check');
    if (firstCheck <= 0) return;
    setScreenPos(firstCheck);
    goToStep(resumeIndexOf(screens[firstCheck]));
  }, [goToStep, screens, started]);

  const screen: RunScreen | undefined = screens[screenPos];
  const totalScreens = screens.length;
  const isLastScreen = screenPos === totalScreens - 1;
  const pct = totalScreens > 0 ? Math.round((screenPos / (totalScreens - 1 || 1)) * 100) : 100;

  // Claimed for the whole run: the claim exists to keep the run's own controls
  // clickable, and those are exactly what the Mero panel was measured covering.
  const { report } = useRunReporter(run.steps.length > 0);

  // The pending auto-advance. Held in a ref and cleared on unmount and on every
  // screen change, because a timer that outlives its component fires
  // `goToScreen` after the run is gone — which navigates a screen the learner
  // already left, or warns about setting state on an unmounted tree.
  const autoAdvanceRef = useRef<number | null>(null);

  const cancelAutoAdvance = useCallback(() => {
    if (autoAdvanceRef.current === null) return;
    window.clearTimeout(autoAdvanceRef.current);
    autoAdvanceRef.current = null;
  }, []);

  useEffect(() => cancelAutoAdvance, [cancelAutoAdvance]);
  // Any navigation a learner makes cancels a pending advance, so an impatient
  // click is never overtaken by the timer they were trying to beat.
  useEffect(() => {
    cancelAutoAdvance();
  }, [screenPos, cancelAutoAdvance]);

  const goToScreen = useCallback(
    (pos: number) => {
      const clamped = Math.max(0, Math.min(pos, totalScreens - 1));
      setScreenPos(clamped);
      setAnswered(false);
      const target = screens[clamped];      if (target) goToStep(resumeIndexOf(target));
    },
    [goToStep, screens, totalScreens],
  );

  const next = useCallback(() => goToScreen(screenPos + 1), [goToScreen, screenPos]);
  const back = useCallback(() => goToScreen(screenPos - 1), [goToScreen, screenPos]);

  const handleResult = useCallback(
    (correct: boolean, userAnswer?: string) => {
      // Pulled out up front because the guard below has to establish that THIS
      // screen holds a scored step, and TypeScript cannot carry that narrowing
      // through to the report.
      const checkIndex = screen?.checkIndex;
      if (checkIndex === undefined) return;
      const current = run.steps[checkIndex];
      if (!current || !isCheckStep(current)) return;

      answer(checkIndex, correct);
      setAnswered(true);
      const expected = expectedAnswer(current);
      report({
        itemKey: `${run.id}#${checkIndex}`,
        correct,
        ...(expected ? { correctAnswer: expected } : {}),
        ...(userAnswer ? { userAnswer } : {}),
      });

      // A match step reports on every mispair as well as on completion, so it is
      // the one case that must never advance itself.
      if (current.type !== 'match' && !isLastScreen) {
        cancelAutoAdvance();
        autoAdvanceRef.current = window.setTimeout(() => {
          autoAdvanceRef.current = null;
          goToScreen(screenPos + 1);
        }, AUTO_ADVANCE_MS);
      }
    },
    [answer, cancelAutoAdvance, goToScreen, isLastScreen, report, run.id, run.steps, screen, screenPos],
  );

  if (run.steps.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <p className="text-sm text-ink-600 dark:text-ink-300">
          {isDE ? 'Für diese Lektion sind noch keine Inhalte hinterlegt.' : 'This lesson has no content yet.'}
        </p>
      </div>
    );
  }

  const showAutoHint = answered && screen?.checkIndex !== undefined && !isLastScreen && screen !== undefined;

  // ── NO READING PHASE HERE, DELIBERATELY ──
  //
  // There was a notebook reading layer in front of these exercises: objectives,
  // core phrases, the explanation, tips, then a button that started practising.
  // It worked, and it is not what this page is for.
  //
  // The lesson NOTES are the reading surface, and they are the long-standing
  // document renderer at /lesson/:n/notes — which a learner reaches from the link
  // at the end of this run. Splitting the teaching across two surfaces in two
  // different visual languages made the lesson feel assembled rather than written,
  // which is worse than either one alone.
  //
  // So: exercises here, notes there, one link between them. Restoring the notebook
  // means porting its best parts (the gender colours, the vocabulary
  // cross-references, the print stylesheet) onto LessonSections rather than
  // re-adding a second reading surface.
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-micro font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
            {isDE ? 'Schritt' : 'Screen'} {screenPos + 1} / {totalScreens}
          </p>
          <p className="text-micro text-ink-500 dark:text-ink-400">
            {totalChecks > 0 ? `${answeredChecks} / ${totalChecks} ${isDE ? 'Übungen' : 'exercises'}` : ''}
          </p>
        </div>
        <div
          className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-200 dark:bg-ink-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={isDE ? 'Fortschritt' : 'Progress'}
        >
          <div className="h-full rounded-full bg-accent-600 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {screen ? <StepScreen screen={screen} steps={run.steps} onResult={handleResult} /> : null}

      <nav className="mt-5 flex items-center justify-between gap-3" aria-label={isDE ? 'Navigation' : 'Navigation'}>
        <RunnerButton onClick={back} disabled={screenPos === 0} tone="quiet">
          {isDE ? 'Zurück' : 'Back'}
        </RunnerButton>

        {isLastScreen ? (
          <RunnerButton
            onClick={() => {
              // Recorded, not derived: a learner can drag the progress bar or jump
              // to the last screen, and neither means the run was done.
              complete();
              onComplete?.(run);
            }}
            tone="primary"
          >
            {isDE ? 'Fertigstellen' : 'Finish'}
          </RunnerButton>
        ) : (
          <RunnerButton onClick={next} tone="primary">
            {isDE ? 'Weiter' : 'Continue'}
            {showAutoHint ? (
              <span className="sr-only" aria-live="polite">
                {isDE ? 'Weiter geht es automatisch.' : 'Continuing automatically.'}
              </span>
            ) : null}
          </RunnerButton>
        )}
      </nav>

      {showAutoHint ? (
        <p className="mt-2 text-center text-micro text-ink-500 dark:text-ink-400" aria-hidden="true">
          {isDE ? 'Weiter geht es von selbst.' : 'Moving on by itself.'}
        </p>
      ) : null}
    </div>
  );
}

function RunnerButton({
  onClick,
  children,
  disabled,
  tone,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  tone: 'primary' | 'quiet';
}) {
  const base =
    'min-h-[44px] rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 disabled:opacity-40';
  const style =
    tone === 'primary' ? 'bg-accent-600 text-white hover:bg-accent-700' : 'border border-ink-300 text-ink-800 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800';
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${style}`}>
      {children}
    </button>
  );
}

/**
 * The answer to show on a review card, per step type.
 *
 * `undefined` for a `match` step: a missed pair is not a single string, and
 * inventing one would put a sentence on the card that nobody typed.
 */
function expectedAnswer(step: CheckStep): string | undefined {
  switch (step.type) {
    case 'mcq':
    case 'typed':
      return step.answer;
    case 'dictation':
      return step.text;
    case 'arrange':
      return step.tokens.join(' ');
    case 'match':
      return undefined;
    default:
      return undefined;
  }
}

/** Re-exported so a caller can narrow a step without importing two modules. */
export type { Step, Run };
