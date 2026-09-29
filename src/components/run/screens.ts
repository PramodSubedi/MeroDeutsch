/**
 * src/components/run/screens.ts
 *
 * Turns a `Run`'s steps into SCREENS — what the learner actually looks at.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * The step and the screen are different things, and the first version of the
 * runner treated them as the same. That made M07 forty-nine clicks long: the
 * twenty-five exercises each need their own screen, but the twenty-four
 * reference steps do not, and asking a learner to press "Continue" past a word
 * they have not finished looking at is friction with nothing behind it.
 *
 * The data stays as one step per word because that is what the CONTENT needs —
 * audio, the active/passive distinction and the example all hang off the
 * individual entry. Batching is a layout decision, so it belongs here and not in
 * the authored data.
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────────
 * Consecutive reference steps of the same KIND share a screen. A check step is
 * always alone, because it has to give feedback about one question and
 * auto-advance past it.
 *
 * Only ADJACENT steps merge. The authored order is all reference steps, then all
 * check steps, then a summary, so in practice this yields roughly one screen per
 * reference kind plus one per exercise: M07 goes from forty-nine screens to
 * thirty-two, of which only seven need a "Continue".
 */
import { isCheckStep, type Step } from '../../data/curriculum/steps';

/**
 * Why a batch is a batch. Keyed on the step type, so a new reference step type
 * gets its own screen by construction — it simply has no group entry and falls
 * through to `single`.
 */
export type ScreenGroup =
  | 'intro'
  | 'words'
  | 'explain'
  | 'trap'
  | 'tip'
  | 'table'
  | 'tree'
  | 'culture'
  | 'dialogue'
  | 'summary'
  | 'check'
  | 'single';

const GROUP_OF: Partial<Record<Step['type'], ScreenGroup>> = {
  intro: 'intro',
  word: 'words',
  explain: 'explain',
  trap: 'trap',
  tip: 'tip',
  'rule-table': 'table',
  'decision-tree': 'tree',
  culture: 'culture',
  dialogue: 'dialogue',
  summary: 'summary',
};

export interface RunScreen {
  /** Indices into `run.steps`, in order. Always at least one. */
  indices: number[];
  /** Why these steps share a screen. */
  group: ScreenGroup;
  /** The step index of the scored question, when this screen has one. */
  checkIndex?: number;
}

export function groupOf(step: Step): ScreenGroup {
  if (isCheckStep(step)) return 'check';
  return GROUP_OF[step.type] ?? 'single';
}

export function buildScreens(steps: Step[]): RunScreen[] {
  const screens: RunScreen[] = [];

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const group = groupOf(step);
    const previous = screens[screens.length - 1];

    // A check step never joins a batch, and never lets the next one join it.
    if (group === 'check') {
      screens.push({ indices: [i], group, checkIndex: i });
      continue;
    }

    if (previous && previous.group === group && group !== 'single') {
      previous.indices.push(i);
      continue;
    }

    screens.push({ indices: [i], group });
  }

  return screens;
}

/** The step index a screen resumes at: its first step. */
export function resumeIndexOf(screen: RunScreen): number {
  return screen.indices[0];
}
