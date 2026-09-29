/**
 * src/components/run/StepRenderer.tsx
 *
 * The `Step` union → component registry.
 *
 * ── WHY A REGISTRY AND NOT A SWITCH ─────────────────────────────────────────
 * The same decision `LessonSections.tsx` made with `SECTION_RENDERERS`, for the
 * same reason: an `if`/`else` chain over 14 variants is a place to forget one, and
 * the miss is a blank area on a lesson page rather than an error. A registry's
 * miss is a build error the moment a step type is added without an entry, which
 * is what `STEP_TYPES` in the data layer exists to make possible.
 *
 * ── WHY THE MISSING CASE IS LOUD ────────────────────────────────────────────
 * The default branch says so in the UI instead of rendering nothing. `check:steps`
 * refuses a step whose type is not in `STEP_TYPES`, so this branch is reachable
 * only by a hand-authored step that skipped the validator — which is exactly the
 * case a silent blank would have hidden.
 */
import type { ReactNode } from 'react';
import { isCheckStep, type Step } from '../../data/curriculum/steps';
import {
  ArrangeStepView,
  DictationStepView,
  MatchStepView,
  McqStepView,
  TypedStepView,
  type StepResult,
} from './steps/CheckSteps';
import {
  CultureStepView,
  DialogueStepView,
  ExplainStepView,
  IntroStepView,
  SummaryStepView,
  TipStepView,
  TrapStepView,
  WordStepView,
} from './steps/ReferenceSteps';

/**
 * Keyed by step type.
 *
 * `Partial` on purpose: the point of the default branch below is to handle a
 * missing entry gracefully, and making this `Record<StepType, …>` would let the
 * compiler enforce completeness while removing the runtime guard that keeps a
 * hand-authored step from rendering as nothing.
 */
const STEP_RENDERERS: Partial<Record<Step['type'], (props: { step: never; onResult: StepResult }) => ReactNode>> = {
  intro: IntroStepView,
  word: WordStepView,
  explain: ExplainStepView,
  trap: TrapStepView,
  tip: TipStepView,
  culture: CultureStepView,
  dialogue: DialogueStepView,
  summary: SummaryStepView,
  mcq: McqStepView,
  typed: TypedStepView,
  arrange: ArrangeStepView,
  match: MatchStepView,
  dictation: DictationStepView,
};

export interface StepRendererProps {
  step: Step | undefined;
  onResult: StepResult;
}

export function StepRenderer({ step, onResult }: StepRendererProps) {
  if (!step) {
    return (
      <div className="rounded-lg border border-dashed border-ink-300 p-6 text-center text-sm text-ink-500 dark:border-ink-700 dark:text-ink-400">
        No step to show.
      </div>
    );
  }

  const render = STEP_RENDERERS[step.type];

  if (!render) {
    return (
      <div className="rounded-lg border border-danger-300 bg-danger-50 p-6 text-center text-sm text-danger-900 dark:border-danger-800 dark:bg-danger-950/40 dark:text-danger-100">
        No renderer for step type <code className="font-mono">{step.type}</code>. This is a content error — run{' '}
        <code className="font-mono">npm run check:steps</code>.
      </div>
    );
  }

  // The cast is the registry's own boundary: the map is keyed by the discriminant,
  // so `render` can only ever be the component that matches this `step.type`.
  // Reference steps ignore `onResult` — they are not scored, which is exactly
  // what `isCheckStep` is for.
  return <>{render({ step: step as never, onResult: isCheckStep(step) ? onResult : () => {} })}</>;
}
