/**
 * src/hooks/useLessonRun.ts
 *
 * Where a learner is in a step-flow run, and how they got there.
 *
 * ── WHY THIS IS NOT IN `useA1Path` ──────────────────────────────────────────
 * The end state for this work is a lesson run whose completion marks the unit's
 * `learn` node done, which is `useA1Path`'s territory. It is deliberately NOT
 * wired there yet.
 *
 * `useA1Path` is the single highest-blast-radius store in the app: it holds every
 * learner's saved path progress, it syncs to Supabase, and it has already needed
 * two versioned state migrations (`a1Path.v4migration`). Adding a field to it
 * means a state-version bump, a `normalizeState` rule, a Supabase payload change
 * and a new check script, and a mistake in any of those reaches every learner
 * who has ever opened a lesson.
 *
 * So during the pilot the run keeps its own storage, and the wiring is a separate
 * change made once the model is proven. The containment is worth the small
 * duplication: a broken run-progress key can cost someone their place in a
 * lesson, and that is a far smaller blast radius than a broken path migration.
 *
 * ── WHY LOCALSTORAGE, NOT DEXIE ─────────────────────────────────────────────
 * Two reasons, and the second is the real one. Dexie is async, so a resume would
 * flash the wrong step on every mount until the read resolved; and run progress is
 * cheap, small, and worth losing. Re-doing one step of a lesson is an
 * inconvenience; a learner resuming M12 into M01's third step is a bug report.
 *
 * The same try/catch discipline as the renderer switch applies: this is read
 * during render, and Safari private mode throws on `getItem`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { isCheckStep, type Run } from '../data/curriculum/steps';

const STORAGE_PREFIX = 'meroDeutschRun:';

export interface RunProgress {
  /** Index of the step the learner is on. */
  stepIndex: number;
  /** How many CHECK steps have been answered, for the progress bar. */
  answeredChecks: number;
  /** How many of those were right. */
  correct: number;
  /** Set once the last step has been reached. Never cleared. */
  completedAt?: string;
}

function emptyProgress(): RunProgress {
  return { stepIndex: 0, answeredChecks: 0, correct: 0 };
}

function storageKey(runId: string): string {
  return `${STORAGE_PREFIX}${runId}`;
}

function read(runId: string): RunProgress {
  try {
    if (typeof localStorage === 'undefined') return emptyProgress();
    const raw = localStorage.getItem(storageKey(runId));
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as Partial<RunProgress>;
    return {
      // Clamped on read: a run can shrink between visits (a content fix, a
      // re-authored lesson), and an index past the end would render nothing at
      // all. Clamping to the last step is always better than a blank page.
      stepIndex: typeof parsed.stepIndex === 'number' && parsed.stepIndex >= 0 ? Math.floor(parsed.stepIndex) : 0,
      answeredChecks: typeof parsed.answeredChecks === 'number' ? Math.max(0, Math.floor(parsed.answeredChecks)) : 0,
      correct: typeof parsed.correct === 'number' ? Math.max(0, Math.floor(parsed.correct)) : 0,
      ...(typeof parsed.completedAt === 'string' ? { completedAt: parsed.completedAt } : {}),
    };
  } catch {
    return emptyProgress();
  }
}

function write(runId: string, progress: RunProgress): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(storageKey(runId), JSON.stringify(progress));
  } catch {
    // Losing a resume point is survivable; failing a lesson render is not.
  }
}

export function clearRunProgress(runId: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(storageKey(runId));
  } catch {
    /* see write() */
  }
}

export interface UseLessonRun {
  progress: RunProgress;
  /**
   * False when this run has never been opened. The runner uses it to skip the
   * teaching screens on a FIRST visit without disturbing a resume.
   */
  started: boolean;
  /**
   * The stored step index, clamped to the run.
   *
   * Named `stepIndex` rather than `index` to make the unit explicit: it indexes
   * `run.steps`, NOT screens. Navigation by screen lives in the runner
   * (`components/run/screens.ts`), and this hook is deliberately ignorant of it —
   * the stored value is a STEP so that a save made before the screen layer
   * existed still resumes onto the right content instead of the wrong offset.
   */
  stepIndex: number;
  /** Total CHECK steps, for the progress bar. */
  totalChecks: number;
  /** CHECK steps answered so far. */
  answeredChecks: number;
  isLastStep: boolean;
  isComplete: boolean;
  /** Move to a step. Clamped. */
  goToStep: (index: number) => void;
  /**
   * Record the outcome of a CHECK step.
   *
   * The step index is passed in rather than read from the stored position. The
   * runner answers whatever is on the current screen, and the stored position is
   * only a resume hint — inferring the step from it would couple scoring to where
   * the save happens to point, which is wrong the moment a learner resumes
   * mid-batch.
   */
  answer: (stepIndex: number, correct: boolean) => void;
  /** Record that the learner reached the end. Idempotent, and never cleared. */
  complete: () => void;
  restart: () => void;
}

export function useLessonRun(run: Run): UseLessonRun {
  const [progress, setProgress] = useState<RunProgress>(() => read(run.id));

  /**
   * Which CHECK steps have already been counted.
   *
   * A ref rather than something derived from `answeredChecks`: re-answering a
   * step after a retry is the normal way to fix a slip, and a "have I counted
   * this" question has to be about the STEP, not about a running total that a
   * re-render might have reset.
   */
  const reportedStepsRef = useRef<Set<number>>(new Set());

  // A different run must not inherit the previous run's place, and must not
  // inherit its "already counted" set — step 4 of M01 and step 4 of M08 are
  // unrelated questions. Keyed on `run.id` rather than compared field-by-field.
  useEffect(() => {
    reportedStepsRef.current = new Set();
    setProgress(read(run.id));
  }, [run.id]);

  const totalChecks = run.steps.filter(isCheckStep).length;
  const lastIndex = Math.max(0, run.steps.length - 1);

  const goTo = useCallback(
    (index: number) => {
      setProgress((current) => {
        const clamped = Math.max(0, Math.min(index, lastIndex));
        const next = { ...current, stepIndex: clamped };
        write(run.id, next);
        return next;
      });
    },
    [lastIndex, run.id],
  );

  const answer = useCallback(
    (stepIndex: number, correct: boolean) => {
      setProgress((current) => {
        const step = run.steps[stepIndex];
        if (!step || !isCheckStep(step)) return current;
        if (reportedStepsRef.current.has(stepIndex)) return current;
        reportedStepsRef.current.add(stepIndex);
        const next: RunProgress = {
          ...current,
          answeredChecks: current.answeredChecks + 1,
          correct: current.correct + (correct ? 1 : 0),
        };
        write(run.id, next);
        return next;
      });
    },
    [run],
  );

  const restart = useCallback(() => {
    clearRunProgress(run.id);
    reportedStepsRef.current = new Set();
    setProgress(emptyProgress());
  }, [run.id]);

  /**
   * Stamp completion. Stamped rather than derived from `stepIndex`, because
   * `free` mode lets a reader JUMP to the last step and a linear learner can drag
   * the progress bar — neither of which means the run was done, and both of which
   * would otherwise mark a lesson complete on arrival.
   *
   * Never cleared, and never revoked, matching `markCheckpointResult`: progress
   * in this app only ever moves forward.
   */
  const complete = useCallback(() => {
    setProgress((current) => {
      if (current.completedAt) return current;
      const next = { ...current, completedAt: new Date().toISOString() };
      write(run.id, next);
      return next;
    });
  }, [run.id]);

  const stepIndex = Math.max(0, Math.min(progress.stepIndex, lastIndex));

  return {
    progress,
    started: progress.answeredChecks > 0 || progress.completedAt !== undefined || progress.stepIndex > 0,
    stepIndex,
    totalChecks,
    answeredChecks: progress.answeredChecks,
    isLastStep: stepIndex === lastIndex,
    isComplete: progress.completedAt !== undefined,
    goToStep: goTo,
    answer,
    complete,
    restart,
  };
}
