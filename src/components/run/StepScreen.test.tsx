/**
 * src/components/run/StepScreen.test.tsx
 *
 * Every screen group renders SOMETHING.
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
 * The first version of `StepScreen` filtered every screen to its reference steps,
 * "so an exercise could never be stacked under prose". A check screen's only
 * member IS an exercise, so the filter emptied it and the component returned
 * `null` — every one of M07's 25 exercises rendered blank, and `screens.test.ts`
 * stayed green throughout because it only ever inspected the grouping and never
 * the output.
 *
 * A test that asserts the SHAPE of a thing will happily pass while the thing is
 * invisible. This one renders every group and asserts there is something in the
 * DOM, which is the only question that was actually being asked.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { StepScreen } from './StepScreen';
import { buildScreens } from './screens';
import type { Step } from '../../data/curriculum/steps';
import { NOMINATIVE_ACCUSATIVE_FLOW } from '../exercises/GrammarFlowchart';

// Every step component reads `langMode` through this hook, and the real one throws
// outside a `LanguageProvider`. Mocking the hook rather than mounting the provider
// chain is the convention the other component tests in this repo already use —
// and it is what lets a step render at all here, which is the whole point of the
// file. The path is relative to THIS file, so `../../` reaches `src/hooks/`.
vi.mock('../../hooks/useLang', () => ({ useLang: () => ({ langMode: 'normal', toggleLanguage: () => {} }) }));
// `AudioButton` is rendered by the word and dialogue screens. It is not under
// test here — the question is whether a screen has content, not whether audio
// works — and it reaches speech state this file has no reason to configure.
vi.mock('../AudioButton', () => ({ AudioButton: () => <span data-testid="audio" /> }));

const noop = () => {};

const word = (w: string): Step => ({ type: 'word', entry: { word: w, en: `${w}-en`, ne: `${w}-ne` } });
const trap = (t: string): Step => ({ type: 'trap', right: 'richtig', note: { en: t, ne: t, de: t } });
const explain = (e: string): Step => ({ type: 'explain', title: { en: e, de: e }, notes: [{ en: `${e}-body`, ne: '', de: `${e}-body` }] });

/** Every group the runner can produce, with a representative member. */
const ALL: Record<string, Step[]> = {
  intro: [{ type: 'intro', objectives: { en: ['learn the order'] } }],
  words: [word('heute'), word('gestern')],
  explain: [explain('inversion')],
  trap: [trap('watch the position')],
  table: [
    {
      type: 'rule-table',
      title: { en: 'articles', de: 'artikel' },
      rows: [{ label: { en: 'der', de: 'der' }, usage: { en: 'masculine', de: 'männlich' }, example: { en: 'der Mann', de: 'der Mann' } }],
    },
  ],
  // The real shipped flowchart, not a hand-built stand-in: if that shape ever
  // changes, this test is the thing that notices a decision-tree screen no longer
  // renders.
  tree: [{ type: 'decision-tree', title: { en: 'flow', de: 'fluss' }, flow: NOMINATIVE_ACCUSATIVE_FLOW }],
  culture: [{ type: 'culture', title: { en: 'customs', de: 'brauchtum' }, body: ['point one'] }],
  dialogue: [
    { type: 'dialogue', title: { en: 'scene', de: 'szene' }, turns: [{ speaker: 'A', de: 'Guten Morgen', en: 'Good morning' }] },
  ],
  summary: [{ type: 'summary' }],
  check: [{ type: 'mcq', prompt: 'Which sentence is correct?', options: ['Heute lerne ich Deutsch.', 'Heute ich lerne Deutsch.'], answer: 'Heute lerne ich Deutsch.' }],
};

describe('StepScreen renders every group', () => {
  for (const [group, steps] of Object.entries(ALL)) {
    it(`renders a "${group}" screen with content`, () => {
      const screens = buildScreens(steps);
      expect(screens).toHaveLength(1);
      expect(screens[0].group).toBe(group);

      const { container, unmount } = render(<StepScreen screen={screens[0]} steps={steps} onResult={noop} />);

      // Not merely non-null: the thing must have visible substance. A `null`
      // render, an empty fragment and a div with no text all pass a bare
      // `toBeTruthy` on the component, which is how this slipped through.
      expect(container.innerHTML).not.toBe('');
      expect(container.textContent?.trim().length ?? 0).toBeGreaterThan(0);
      unmount();
    });
  }

  it('renders each check type, not just mcq', () => {
    // The regression was specific to screens whose only member is a check step,
    // so every check type has to be covered — they all sit on their own screen.
    const checks: Step[] = [
      { type: 'mcq', prompt: 'pick', options: ['a', 'b'], answer: 'a' },
      { type: 'typed', ask: 'fill-blank', prompt: 'Das ist ___ Bruder.', answer: 'mein' },
      { type: 'arrange', prompt: 'Build it', tokens: ['heute', 'ist', 'Montag'] },
      { type: 'dictation', text: 'Heute ist Montag.' },
      { type: 'match', pairs: [{ id: '0', de: 'heute', en: 'today' }, { id: '1', de: 'morgen', en: 'tomorrow' }] },
    ];
    for (const step of checks) {
      const screens = buildScreens([step]);
      const { container, unmount } = render(<StepScreen screen={screens[0]} steps={[step]} onResult={noop} />);
      expect(container.innerHTML).not.toBe('');
      expect(container.textContent?.trim().length ?? 0).toBeGreaterThan(0);
      unmount();
    }
  });

  it('shows every word in a batch, not just the first', () => {
    const steps = [word('heute'), word('gestern'), word('morgen')];
    const screens = buildScreens(steps);
    const { container, unmount } = render(<StepScreen screen={screens[0]} steps={steps} onResult={noop} />);
    for (const w of ['heute', 'gestern', 'morgen']) {
      expect(container.textContent).toContain(w);
    }
    unmount();
  });

  it('stacks every member of a reference batch', () => {
    const steps = [explain('first'), explain('second'), trap('third')];
    const screens = buildScreens(steps);
    const { container, unmount } = render(<StepScreen screen={screens[0]} steps={steps} onResult={noop} />);
    // `buildScreens` keeps the two explains together and gives the trap its own
    // screen, so this asserts the two explains share one.
    expect(screens[0].indices).toEqual([0, 1]);
    expect(container.textContent).toContain('first-body');
    expect(container.textContent).toContain('second-body');
    unmount();
  });

  it('shows a message rather than nothing for an empty screen', () => {
    const { container, unmount } = render(
      <StepScreen screen={{ indices: [], group: 'single' }} steps={[]} onResult={noop} />,
    );
    expect(container.textContent).toContain('No step to show');
    unmount();
  });
});

/**
 * THE CRASH REGRESSION.
 *
 * Every shape below is one a generator has actually produced, taken from the first
 * real NotebookLM export. The contract now accepts all of them, but acceptance is
 * not enough on its own: a lesson is authored by something outside the
 * repository, so a field it omits will eventually be omitted. The renderer has to
 * survive that, because a missing heading is a cosmetic defect and a thrown
 * TypeError is a blank page for the whole lesson.
 *
 * The first one is a REAL bug this project shipped: a `culture` step with no
 * `title` reached `CultureStepView`, which called `label(step.title)`, which
 * dereferenced `.de` on `undefined`.
 */
describe('imperfect content does not crash the run', () => {
  // Typed as `unknown`, deliberately. Several of these do NOT satisfy the
  // TypeScript types — a `LocalizedLabel` with no `de`, a `DialogueTurn` with no
  // German — and that is the premise rather than a mistake in the fixture:
  // authored content arrives as JSON from outside the repository and is never
  // typechecked, so the renderer's tolerance is the only thing standing between a
  // missing field and a blank page.
  const HOSTILE: { name: string; steps: unknown[] }[] = [
    { name: 'a culture step with no title — this crashed', steps: [{ type: 'culture', body: 'People shake hands.' }] },
    { name: 'a dialogue with no title', steps: [{ type: 'dialogue', turns: [{ speaker: 'A', de: 'Hallo', en: 'Hi' }] }] },
    { name: 'an explanation with a title and no body', steps: [{ type: 'explain', title: { en: 'Only a title', de: '' } }] },
    { name: 'a culture body written as one string', steps: [{ type: 'culture', body: 'A single sentence.' }] },
    {
      name: 'an explanation using prose `body` with markdown',
      steps: [
        {
          type: 'explain',
          title: { en: 'Introducing yourself' },
          body: "Use **Ich heiße...** to say your name.\n\n- **Anna** is a name.\n- **Thomas** is too.",
        },
      ],
    },
    { name: 'a dialogue turn missing its German', steps: [{ type: 'dialogue', title: { en: 'x', de: 'x' }, turns: [{ speaker: 'A', en: 'Hi' }] }] },
    { name: 'a word step with no examples', steps: [word('allein')] },
  ];

  for (const { name, steps } of HOSTILE) {
    it(`renders ${name} without throwing`, () => {
      for (const step of steps) {
        const typed = step as Step;
        const screens = buildScreens([typed]);
        const { unmount } = render(<StepScreen screen={screens[0]} steps={[typed]} onResult={noop} />);
        unmount();
      }
    });
  }

  it('renders the prose body as readable text, not literal markdown', () => {
    const step = {
      type: 'explain',
      title: { en: 'Introducing yourself' },
      body: 'Use **Ich heiße** to say your name.',
    } as unknown as Step;
    const screens = buildScreens([step]);
    const { container, unmount } = render(<StepScreen screen={screens[0]} steps={[step]} onResult={noop} />);
    // The emphasis is rendered as emphasis, so the asterisks are gone…
    expect(container.textContent).toContain('Ich heiße');
    expect(container.textContent).not.toContain('**');
    // …and the surrounding sentence survives intact.
    expect(container.textContent).toContain('to say your name');
    unmount();
  });

  it('splits a prose body into paragraphs and bullets', () => {
    const step = {
      type: 'explain',
      title: { en: 'Forms' },
      body: 'Two ways to say it:\n\n- du with friends\n- Sie with strangers',
    } as unknown as Step;
    const screens = buildScreens([step]);
    const { container, unmount } = render(<StepScreen screen={screens[0]} steps={[step]} onResult={noop} />);
    expect(container.querySelectorAll('li')).toHaveLength(2);
    unmount();
  });
});
