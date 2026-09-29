/**
 * src/components/run/StepScreen.tsx
 *
 * Renders one SCREEN — which may hold several steps — by dispatching on the
 * screen's group.
 *
 * The batch cases are the ones that need a different component (`words` gets the
 * list); everything else is its existing step component rendered into a stack.
 * That keeps `StepRenderer` as the single place a step type becomes UI, and puts
 * the only real layout decision — a screen's worth of spacing — here.
 */
import { Fragment } from 'react';
import type { Step } from '../../data/curriculum/steps';
import { StepRenderer } from './StepRenderer';
import { WordScreen } from './steps/WordScreen';
import type { RunScreen } from './screens';
import type { StepResult } from './steps/CheckSteps';

export interface StepScreenProps {
  screen: RunScreen;
  steps: Step[];
  onResult: StepResult;
}

export function StepScreen({ screen, steps, onResult }: StepScreenProps) {
  const members = screen.indices.map((i) => steps[i]).filter((s): s is Step => s !== undefined);

  if (members.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-ink-300 p-6 text-center text-sm text-ink-500 dark:border-ink-700 dark:text-ink-400">
        No step to show.
      </div>
    );
  }

  // The one batch with its own component: a list of words, not a stack of cards.
  if (screen.group === 'words') {
    return <WordScreen steps={members as Extract<Step, { type: 'word' }>[]} />;
  }

  // A check screen holds exactly one exercise, and that IS the content. The first
  // version of this file filtered every screen to its reference steps "so an
  // exercise could never be stacked under prose" — which meant a check screen
  // filtered down to nothing and rendered `null`. Every exercise in the run was
  // blank, and `screens.test.ts` passed throughout because it only ever inspected
  // the grouping, never the output.
  if (screen.group === 'check') {
    return <StepRenderer step={members[0]} onResult={onResult} />;
  }

  // A reference screen: stack its members. `buildScreens` guarantees these are
  // all reference steps, so there is no need to filter — and filtering is what
  // hid the bug above.
  return (
    <div className="space-y-3">
      {members.map((step, i) => (
        <Fragment key={i}>
          <StepRenderer step={step} onResult={onResult} />
        </Fragment>
      ))}
    </div>
  );
}
