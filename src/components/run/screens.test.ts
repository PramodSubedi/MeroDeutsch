/**
 * src/components/run/screens.test.ts
 *
 * The grouping that decides what the learner has to click through.
 *
 * The M07 shape is pinned as a worked example, because it is the one a reviewer
 * will click: forty-nine steps must become thirty-two screens, and the
 * twenty-five exercises must each be alone so their feedback can auto-advance.
 */
import { describe, expect, it } from 'vitest';
import { buildScreens, groupOf, resumeIndexOf, type ScreenGroup } from './screens';
import { isCheckStep, type Step } from '../../data/curriculum/steps';

const step = (s: Step): Step => s;
const word = (w: string): Step => step({ type: 'word', entry: { word: w, en: w, ne: w } });
const check = (): Step => step({ type: 'mcq', prompt: 'q', options: ['a', 'b'], answer: 'a' });

const m07: Step[] = [
  { type: 'intro', objectives: { en: ['one'] } },
  ...['a', 'b', 'c', 'd'].map(word),
  { type: 'explain', title: { en: 'e1', de: 'e1' }, notes: [{ en: 'x', ne: '', de: 'x' }] },
  { type: 'explain', title: { en: 'e2', de: 'e2' }, notes: [{ en: 'y', ne: '', de: 'y' }] },
  { type: 'trap', note: { en: 't', ne: '', de: 't' } },
  { type: 'culture', title: { en: 'c', de: 'c' }, body: ['b'] },
  check(),
  check(),
  { type: 'summary' },
];

describe('groupOf', () => {
  it('gives check steps their own group', () => {
    expect(groupOf(check())).toBe('check');
  });

  it('groups every reference kind it knows', () => {
    expect(groupOf(word('x'))).toBe('words');
    expect(groupOf({ type: 'trap', note: { en: '', ne: '', de: '' } })).toBe('trap');
    expect(groupOf({ type: 'culture', title: { en: '', de: '' }, body: [] })).toBe('culture');
  });

  it('falls back to single for an unmapped reference type', () => {
    expect(groupOf({ type: 'summary' })).toBe('summary');
    expect(groupOf({ type: 'intro', objectives: { en: [] } })).toBe('intro');
  });
});

describe('buildScreens', () => {
  it('merges ADJACENT reference steps of the same kind', () => {
    const screens = buildScreens(m07);
    const words = screens.find((s) => s.group === 'words');
    expect(words?.indices).toEqual([1, 2, 3, 4]);
    const explains = screens.find((s) => s.group === 'explain');
    expect(explains?.indices).toEqual([5, 6]);
  });

  it('never merges across a check step', () => {
    // A trap, then a check, then a trap: two separate trap screens, not one.
    const screens = buildScreens([
      { type: 'trap', note: { en: 'a', ne: '', de: 'a' } },
      check(),
      { type: 'trap', note: { en: 'b', ne: '', de: 'b' } },
    ]);
    expect(screens.map((s) => s.group)).toEqual(['trap', 'check', 'trap']);
  });

  it('gives every check step its own screen, with checkIndex set', () => {
    const screens = buildScreens(m07);
    const checks = screens.filter((s) => s.group === 'check');
    expect(checks).toHaveLength(2);
    for (const c of checks) {
      expect(c.indices).toHaveLength(1);
      expect(c.checkIndex).toBe(c.indices[0]);
    }
  });

  it('covers every step exactly once, in order', () => {
    const screens = buildScreens(m07);
    const flat = screens.flatMap((s) => s.indices);
    expect(flat).toEqual(m07.map((_, i) => i));
  });

  it('produces no screen for an empty run', () => {
    expect(buildScreens([])).toEqual([]);
  });

  it('keeps a `single` group unmerged even when adjacent', () => {
    // Nothing maps to `single` today, but if a new type ever did, two of them in
    // a row would be two screens rather than one accidental mega-screen.
    const screens = buildScreens([word('a'), check(), word('b')]);
    expect(screens.map((s) => s.group)).toEqual(['words', 'check', 'words']);
  });

  it('resumes at the first step of a screen', () => {
    const screens = buildScreens(m07);
    const words = screens.find((s) => s.group === 'words');
    expect(resumeIndexOf(words!)).toBe(1);
  });
});

describe('the M07 shape a reviewer will actually click', () => {
  it('collapses 49 steps into 32 screens, 7 of which need a Continue', () => {
    // The authored M07 order is: intro, 14 words, 3 explanations, 3 traps,
    // culture, dialogue, 25 exercises, summary.
    const real: Step[] = [
      { type: 'intro', objectives: { en: ['x'] } },
      ...Array.from({ length: 14 }, (_, i) => word(`w${i}`)),
      ...Array.from({ length: 3 }, () => ({ type: 'explain', title: { en: 'e', de: 'e' }, notes: [{ en: 'n', ne: '', de: 'n' }] })),
      ...Array.from({ length: 3 }, () => ({ type: 'trap', note: { en: 't', ne: '', de: 't' } })),
      { type: 'culture', title: { en: 'c', de: 'c' }, body: ['b'] },
      { type: 'dialogue', title: { en: 'd', de: 'd' }, turns: [] },
      ...Array.from({ length: 25 }, check),
      { type: 'summary' },
    ];

    const screens = buildScreens(real);
    expect(real).toHaveLength(49);
    expect(screens).toHaveLength(32);

    // Six reference screens plus the closing summary need a Continue; the 25
    // exercises are answered, not skipped past.
    const needsContinue = screens.filter((s) => s.group !== 'check');
    expect(needsContinue).toHaveLength(7);

    // Every screen holds only check steps or only reference steps.
    for (const s of screens) {
      const kinds = new Set<ScreenGroup>(s.indices.map((i) => groupOf(real[i])));
      expect(kinds.size).toBe(1);
      if (s.group === 'check') expect(isCheckStep(real[s.indices[0]])).toBe(true);
    }
  });
});
