/**
 * src/data/curriculum/lessonSpec.test.ts
 *
 * The content contract, and the examples in `docs/notebooklm-lesson-prompt.md`.
 *
 * ── WHY THE DOC EXAMPLES ARE IN HERE ─────────────────────────────────────────
 * `notebooklm-lesson-prompt.md` is the instruction an LLM is given instead of a
 * human. If the validator changes and the prompt does not, the generator starts
 * producing content the app refuses — and the refusal looks like a validator bug
 * rather than a stale document. So every example the guide tells a generator to
 * write is asserted HERE, against the real validator.
 *
 * A spec that drifts from the implementation is worse than no spec: it costs a
 * content author a round trip to find out which one is lying.
 */
import { describe, expect, it } from 'vitest';
import { validateLessonSteps, isValidLesson, warnLessonSteps, ASK_VALUES, ASK_INSTRUCTION } from './lessonSpec';
import type { Step } from './steps';

/** Everything `notebooklm-lesson-prompt.md` shows as a GOOD example. */
const GUIDE_EXAMPLES: Record<string, Step> = {
  'fill-in': { type: 'typed', ask: 'fill-blank', prompt: 'In der Nacht ________ ich.', answer: 'schlafe' },
  conjugation: { type: 'typed', ask: 'conjugate', prompt: 'ich (wohnen) in Berlin.', answer: 'wohne' },
  article: { type: 'typed', ask: 'choose-article', prompt: 'Bett', answer: 'das' },
  'translation en-de': { type: 'typed', ask: 'translate-en-de', prompt: 'This morning I was tired.', answer: 'Heute Morgen war ich müde' },
  correction: { type: 'typed', ask: 'correct', prompt: 'Heute ich trinke Tee.', answer: 'Heute trinke ich Tee' },
  'with a note': { type: 'typed', ask: 'fill-blank', prompt: 'In der Nacht ________ ich.', answer: 'schlafe', note: 'The conjugated verb comes second.' },
  'with accepted': { type: 'typed', ask: 'fill-blank', prompt: 'Ich trinke _______ (einen/ein) Tee.', answer: 'einen', accepted: ['ein'] },
  mcq: {
    type: 'mcq',
    prompt: 'Which sentence has the verb in the right position?',
    options: ['Heute lerne ich Deutsch.', 'Heute ich lerne Deutsch.', 'Ich lerne heute Deutsch.'],
    answer: 'Heute lerne ich Deutsch.',
    hintReason: 'The conjugated verb is the second element of a main clause.',
  },
  arrange: { type: 'arrange', prompt: 'Build the sentence:', tokens: ['heute', 'ist', 'Montag'] },
  match: {
    type: 'match',
    pairs: [
      { id: '0', de: 'heute', en: 'today' },
      { id: '1', de: 'gestern', en: 'yesterday' },
    ],
    columnLabels: { left: 'Deutsch', right: 'English' },
  },
  dictation: { type: 'dictation', text: 'Heute ist Montag.', instruction: 'Listen and type what you hear.' },
  intro: { type: 'intro', objectives: { en: ['Put the conjugated verb in second position in a main clause'] } },
  'explain using prose body': {
    type: 'explain',
    title: { en: "Introducing Yourself with 'Ich heiße'" },
    body: "To say your name in German, use **Ich heiße...** (literally 'I am called...').\n\n- **Ich heiße Anna.** = My name is Anna.\n- **Ich heiße Thomas.** = My name is Thomas.",
  },
  'culture with a string body': { type: 'culture', body: "People maintain formal 'Sie' until invited to use 'du'." },
  'culture with a list body': { type: 'culture', title: { en: 'Register', de: 'Anrede' }, body: ['One line.', 'Another line.'] },
  'culture with no title': { type: 'culture', body: 'Shaking hands with eye contact is the standard formal greeting.' },
  word: {
    type: 'word',
    entry: { word: 'heute', en: 'today', ne: 'आज', examples: [{ de: 'Heute ist Montag.', en: 'Today is Monday.' }] },
    active: true,
  },
  trap: { type: 'trap', wrong: 'Heute ich lerne Deutsch.', right: 'Heute lerne ich Deutsch.', note: { en: 'The conjugated verb comes second.' } },
  dialogue: {
    type: 'dialogue',
    title: { en: 'At the café', de: 'Im Café' },
    turns: [
      { speaker: 'A', de: 'Guten Morgen!', en: 'Good morning!' },
      { speaker: 'B', de: 'Guten Morgen. Was möchten Sie?', en: 'Good morning. What would you like?' },
    ],
  },
  summary: { type: 'summary' },
};

/**
 * Every failure the guide warns about, and that this project actually shipped.
 * Each is keyed by the field the validator must complain about.
 */
const MUST_BE_REFUSED: Record<string, { step: unknown; field: string }> = {
  'a typed step with no ask': { step: { type: 'typed', prompt: 'In der Nacht ________ ich.', answer: 'schlafe' }, field: 'ask' },
  'fill-blank with no blank': { step: { type: 'typed', ask: 'fill-blank', prompt: 'ich (wohnen) in Berlin.', answer: 'wohne' }, field: 'prompt' },
  'conjugate with no infinitive': { step: { type: 'typed', ask: 'conjugate', prompt: 'In der Nacht ________ ich.', answer: 'schlafe' }, field: 'prompt' },
  'an explanation inside answer': { step: { type: 'typed', ask: 'conjugate', prompt: 'ich (sein) Student.', answer: 'bin (sein)' }, field: 'answer' },
  'an article question with a blank': { step: { type: 'typed', ask: 'choose-article', prompt: '___ Bett', answer: 'das' }, field: 'prompt' },
  'choose-article answered with a non-article': { step: { type: 'typed', ask: 'choose-article', prompt: 'Bett', answer: 'bett' }, field: 'answer' },
  'short-answer with a bare label': { step: { type: 'typed', ask: 'short-answer', prompt: 'Bedeutung', answer: 'meaning' }, field: 'prompt' },
  'an mcq answer outside its options': { step: { type: 'mcq', prompt: 'Which article?', options: ['der', 'die'], answer: 'das' }, field: 'answer' },
  'an mcq prompt that is a bare label': { step: { type: 'mcq', prompt: 'Position', options: ['1', '2'], answer: '2' }, field: 'prompt' },
  'a choice with no accepted list': { step: { type: 'typed', ask: 'fill-blank', prompt: 'Ich trinke _______ (einen/ein) Tee.', answer: 'einen' }, field: 'accepted' },
  'arrange with a duplicate token': { step: { type: 'arrange', prompt: 'Build it:', tokens: ['ist', 'ist'] }, field: 'tokens' },
  'match with a repeated left side': {
    step: { type: 'match', pairs: [{ id: '0', de: 'heute', en: 'today' }, { id: '1', de: 'heute', en: 'now' }] },
    field: 'pairs[1].de',
  },
  'a dialogue turn with no German — a crash, not a wrong answer': {
    step: { type: 'dialogue', title: { en: 'x', de: 'x' }, turns: [{ speaker: 'A', en: 'Hi' }] },
    field: 'turns[0].de',
  },
  'dictation with no text to speak': { step: { type: 'dictation' }, field: 'text' },
  'an unknown step type': { step: { type: 'flashcard', prompt: 'x' }, field: 'type' },
  'a word with no English gloss': { step: { type: 'word', entry: { word: 'heute', en: '', ne: 'x' } }, field: 'entry.en' },
  'a typed step with no answer': { step: { type: 'typed', ask: 'fill-blank', prompt: 'In der Nacht ________ ich.', answer: '' }, field: 'answer' },
  'a culture step with no body at all': { step: { type: 'culture' }, field: 'body' },
  'an explain with a title and no body': { step: { type: 'explain', title: { en: 'Only a title', de: '' } }, field: 'body' },
};

describe('the content contract accepts what the guide tells NotebookLM to write', () => {
  for (const [name, step] of Object.entries(GUIDE_EXAMPLES)) {
    it(`accepts ${name}`, () => {
      expect(validateLessonSteps([step], { id: name })).toEqual([]);
    });
  }
});

describe('the content contract refuses the failures the guide warns about', () => {
  for (const [name, { step, field }] of Object.entries(MUST_BE_REFUSED)) {
    it(`refuses ${name}`, () => {
      const problems = validateLessonSteps([step], { id: name });
      expect(problems.length).toBeGreaterThan(0);
      expect(problems.map((p) => p.field)).toContain(field);
    });
  }
});

describe('the contract and the renderer agree about every ask', () => {
  it('has an instruction for every declared ask', () => {
    for (const ask of ASK_VALUES) {
      expect(ASK_INSTRUCTION[ask]).toBeDefined();
      expect(ASK_INSTRUCTION[ask].en).toBeTruthy();
      expect(ASK_INSTRUCTION[ask].de).toBeTruthy();
    }
  });

  it('never says "fill in the blank" for anything but a fill-blank', () => {
    // The defect this file's existence is about: one over-loaded field rendered
    // "Fill in the blank:" for conjugations, articles and definitions alike.
    for (const ask of ASK_VALUES) {
      const isFillBlank = /blank/i.test(ASK_INSTRUCTION[ask].en);
      expect(isFillBlank).toBe(ask === 'fill-blank');
    }
  });
});

describe('warnings report smells without refusing a lesson', () => {
  it('flags `accepted` that repeats the answer, whatever the punctuation', () => {
    // The first NotebookLM export did this in 75 exercises, because the guide
    // said "list every option in accepted" and the generator read that as
    // including the answer. Harmless at runtime — `matchesAnswer` compares
    // against `[answer, ...accepted]` — so it is a warning, not a failure.
    const cases = [
      { type: 'typed', ask: 'fill-blank', prompt: 'Ich ___ Anna.', answer: 'heiße', accepted: ['heiße'] },
      { type: 'typed', ask: 'translate-en-de', prompt: 'My name is Maria.', answer: 'Ich heiße Maria', accepted: ['Ich heiße Maria.'] },
      { type: 'typed', ask: 'short-answer', prompt: 'What is the German for goodbye?', answer: 'Tschüss', accepted: ['tschüss'] },
    ] as unknown as Step[];

    for (const step of cases) {
      // Not a refusal.
      expect(validateLessonSteps([step])).toEqual([]);
      const warnings = warnLessonSteps([step]);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].field).toBe('accepted');
    }
  });

  it('does not warn when `accepted` holds a genuine alternative', () => {
    const step: Step = { type: 'typed', ask: 'fill-blank', prompt: 'Ich trinke _______ (einen/ein) Tee.', answer: 'einen', accepted: ['ein'] };
    expect(warnLessonSteps([step])).toEqual([]);
  });

  it('flags a two-option multiple choice as a coin flip', () => {
    const step: Step = { type: 'mcq', prompt: 'Formal or informal?', options: ['Sie', 'du'], answer: 'Sie' };
    expect(validateLessonSteps([step])).toEqual([]);
    const warnings = warnLessonSteps([step]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].field).toBe('options');
  });

  it('stays silent on a clean lesson', () => {
    const steps: Step[] = [
      { type: 'intro', objectives: { en: ['Greet someone'] } },
      { type: 'word', entry: { word: 'Hallo', en: 'hello', ne: 'नमस्ते' } },
      { type: 'mcq', prompt: 'Which greeting is used in the morning?', options: ['Guten Morgen', 'Guten Abend', 'Gute Nacht'], answer: 'Guten Morgen' },
      { type: 'summary' },
    ];
    expect(validateLessonSteps(steps)).toEqual([]);
    expect(warnLessonSteps(steps)).toEqual([]);
  });
});

describe('whole lessons', () => {
  it('refuses an empty step list', () => {
    expect(isValidLesson([])).toBe(false);
    expect(isValidLesson(undefined)).toBe(false);
  });

  it('accepts a minimal well-formed lesson', () => {
    expect(
      isValidLesson([
        { type: 'intro', objectives: { en: ['Learn one thing'] } },
        { type: 'mcq', prompt: 'Which is right?', options: ['a', 'b'], answer: 'a' },
        { type: 'summary' },
      ]),
    ).toBe(true);
  });
});
