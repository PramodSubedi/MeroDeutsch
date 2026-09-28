/**
 * src/lib/checkpointDeck.test.ts
 *
 * The regression lock for the defect that made 14 of the 16 A1 modules
 * unpassable.
 *
 * THE BUG, IN ONE SENTENCE
 * The checkpoint builder re-mapped `getVocabularyByCategories()` rows as if
 * they were `VocabCard`s, reading `c.lemma` and `c.translation` off objects
 * that only ever had `c.de` / `c.en` — so every vocabulary question rendered
 * an empty prompt above a single blank option button.
 *
 * WHY A TEST WAS THE ONLY WAY TO CATCH IT
 *   · `npm run curriculum:validate` reads the unit JSON and counts declared
 *     items. It reported "✓ curriculum valid — 0 issues" on the exact build
 *     that shipped the broken decks, because the files were fine and the
 *     RUNTIME was not.
 *   · The one pre-existing test file covers `useA1Path` (progress bookkeeping).
 *   · TypeScript could not help either: the mapping was `((vocabulary) as any)`,
 *     which is precisely the cast that erases the very mismatch it created.
 *
 * So the suite went green on a product where two thirds of the paid
 * curriculum could not be taken. These tests assert on the built question, not
 * on the config, because that is the layer that was actually broken.
 */

import { describe, it, expect } from 'vitest';
import {
  buildOptions,
  isUsableQuestion,
  toVocabEntry,
  type DeckQuestion,
  type FlatVocab,
  type CardVocab,
} from './checkpointDeck';

// ── Fixtures shaped like the REAL loader output ─────────────────────────────
// Taken from live `get_content_items('greeting-item')` and
// `getVocabularyByCategories([...])` reads, not invented.

const REAL_VOCAB_ENTRY: FlatVocab = {
  id: 'Mir geht es gut.',
  de: 'Mir geht es gut.',
  en: 'I am fine.',
  ne: 'मलाई ठिक छ।',
  tags: ['phrase', 'A1', 'smalltalk-phrases'],
};

const REAL_VOCAB_CARD: CardVocab = {
  id: 'Haus',
  lemma: 'Haus',
  translation: { en: 'house', np: 'घर' },
  tags: ['noun', 'A1'],
};

/** A question exactly as the broken build emitted it. */
const BROKEN_QUESTION: DeckQuestion = {
  key: 'vocab-ne:vocab-1',
  prompt: '',
  correctAnswer: undefined as unknown as string,
  options: [undefined as unknown as string],
  source: 'vocab-translation-ne',
};

// ── toVocabEntry ────────────────────────────────────────────────────────────

describe('toVocabEntry', () => {
  it('preserves an already-flat VocabEntry (the shape that was being destroyed)', () => {
    // THE core regression. The old code read `c.lemma` off this object, got
    // `undefined`, and produced an unanswerable question.
    const got = toVocabEntry(REAL_VOCAB_ENTRY);

    expect(got).not.toBeNull();
    expect(got!.de).toBe('Mir geht es gut.');
    expect(got!.en).toBe('I am fine.');
    expect(got!.ne).toBe('मलाई ठिक छ।');
    expect(got!.tags).toContain('smalltalk-phrases');
  });

  it('converts a VocabCard from the getVocabularyFiltered fallback', () => {
    const got = toVocabEntry(REAL_VOCAB_CARD);

    expect(got).toEqual({
      id: 'Haus',
      de: 'Haus',
      en: 'house',
      ne: 'घर',
      tags: ['noun', 'A1'],
      audioUrl: undefined,
    });
  });

  it('drops a row with no German text', () => {
    expect(toVocabEntry({ id: 'x', en: 'hello', ne: '' })).toBeNull();
    expect(toVocabEntry({ id: 'x', lemma: '', translation: { en: 'hi' } })).toBeNull();
  });

  it('drops a row with no English text', () => {
    expect(toVocabEntry({ id: 'x', de: 'Hallo', ne: 'नमस्ते' })).toBeNull();
    expect(toVocabEntry({ id: 'x', lemma: 'Hallo' })).toBeNull();
  });

  it('drops an entirely empty row instead of emitting a blank one', () => {
    expect(toVocabEntry({ id: 'broken' })).toBeNull();
    expect(toVocabEntry({} as FlatVocab)).toBeNull();
  });

  it('builds a genuinely answerable question from real loader output', () => {
    // End-to-end over the two shapes: normalise, then build options. This is
    // the exact path that produced one blank button.
    const pool = [REAL_VOCAB_ENTRY, REAL_VOCAB_CARD]
      .map(toVocabEntry)
      .filter((v): v is NonNullable<typeof v> => v !== null);

    expect(pool).toHaveLength(2);
    const options = buildOptions(pool[0]!.de, pool.map((p) => p.de), 4);

    expect(options.length).toBeGreaterThanOrEqual(2);
    expect(options).toContain(pool[0]!.de);
    expect(options.every((o) => o.trim().length > 0)).toBe(true);
  });
});

// ── buildOptions ────────────────────────────────────────────────────────────

describe('buildOptions', () => {
  const pool = ['Hallo', 'Guten Morgen', 'Guten Tag', 'Guten Abend', 'Tschüss', 'Danke'];

  it('always includes the correct answer', () => {
    for (const correct of pool) {
      expect(buildOptions(correct, pool, 4)).toContain(correct);
    }
  });

  it('produces four distinct options from a healthy pool', () => {
    const opts = buildOptions('Hallo', pool, 4);
    expect(opts).toHaveLength(4);
    expect(new Set(opts).size).toBe(4);
  });

  it('never repeats the correct answer as its own distractor', () => {
    const opts = buildOptions('Hallo', pool, 4);
    expect(opts.filter((o) => o === 'Hallo')).toHaveLength(1);
  });

  it('varies the distractors rather than taking a positional slice', () => {
    // The old positional take gave every question the same first three
    // distractors, so a deck read as the same question over and over.
    const firsts = new Set(
      Array.from({ length: 12 }, () => buildOptions('Hallo', pool, 4).join('|')),
    );
    expect(firsts.size).toBeGreaterThan(1);
  });

  it('degrades to fewer options — never to a blank one — on a thin pool', () => {
    const opts = buildOptions('Hallo', ['Hallo'], 4);
    expect(opts).toEqual(['Hallo']);
    expect(opts.every((o) => typeof o === 'string' && o.length > 0)).toBe(true);
  });
});

// ── isUsableQuestion ────────────────────────────────────────────────────────

describe('isUsableQuestion', () => {
  const good: DeckQuestion = {
    key: 'greeting:Hallo',
    prompt: 'Hello',
    correctAnswer: 'Hallo',
    options: ['Hallo', 'Danke', 'Tschüss'],
    source: 'greeting-translation',
  };

  it('accepts a well-formed question', () => {
    expect(isUsableQuestion(good)).toBe(true);
  });

  it('rejects the exact question the bug produced', () => {
    expect(isUsableQuestion(BROKEN_QUESTION)).toBe(false);
  });

  it('rejects an empty prompt', () => {
    expect(isUsableQuestion({ ...good, prompt: '' })).toBe(false);
    expect(isUsableQuestion({ ...good, prompt: '   ' })).toBe(false);
  });

  it('rejects a missing or blank correctAnswer', () => {
    expect(isUsableQuestion({ ...good, correctAnswer: '' })).toBe(false);
    expect(
      isUsableQuestion({ ...good, correctAnswer: undefined as unknown as string }),
    ).toBe(false);
  });

  it('rejects a single-option question — the visible symptom', () => {
    expect(isUsableQuestion({ ...good, options: ['Hallo'] })).toBe(false);
    expect(isUsableQuestion({ ...good, options: [] })).toBe(false);
    expect(isUsableQuestion({ ...good, options: undefined })).toBe(false);
  });

  it('rejects a question whose correctAnswer is not among its options', () => {
    // Unanswerable by construction, and a plausible outcome of a bad draw.
    expect(isUsableQuestion({ ...good, options: ['Danke', 'Tschüss'] })).toBe(false);
  });

  it('rejects options containing a blank entry', () => {
    expect(isUsableQuestion({ ...good, options: ['Hallo', '', 'Tschüss'] })).toBe(false);
    expect(
      isUsableQuestion({ ...good, options: ['Hallo', undefined as unknown as string, 'x'] }),
    ).toBe(false);
  });

  it('reports the dropped question so content rot stays visible', () => {
    const dropped: DeckQuestion[] = [];
    isUsableQuestion(BROKEN_QUESTION, (q) => dropped.push(q));
    expect(dropped).toHaveLength(1);
    expect(dropped[0]!.key).toBe('vocab-ne:vocab-1');
  });

  it('does not report a question it accepted', () => {
    const dropped: DeckQuestion[] = [];
    isUsableQuestion(good, (q) => dropped.push(q));
    expect(dropped).toHaveLength(0);
  });

  // ── Degenerate prompts (C2.6) ──────────────────────────────────────────────
  //
  // A prompt that IS the answer is not a question. It became an ANSWER LEAK
  // once `speakText` began preferring bundled clips: `vocab-translation` sets
  // `speakPrompt: v.en` and `correctAnswer: v.de`, so for a true cognate the
  // pre-lock speaker played a recording of the answer before the learner could
  // choose. These assertions lock the invariant that prevents it.

  it('rejects a self-answering prompt', () => {
    // The real card: German "bitter", English "bitter" — tags
    // ['adjective','A1','taste-texture-adjectives'], which is what m10/m13 pull.
    const cognate: DeckQuestion = {
      key: 'vocab:bitter',
      prompt: 'bitter',
      correctAnswer: 'bitter',
      options: ['bitter', 'süß', 'salzig'],
      source: 'vocab-translation',
    };
    expect(isUsableQuestion(cognate)).toBe(false);
  });

  it('catches the collision through case and spacing, not just identity', () => {
    // A naive `===` would pass these through and still leak.
    expect(isUsableQuestion({ ...good, prompt: 'Hallo', correctAnswer: 'hallo' })).toBe(false);
    expect(isUsableQuestion({ ...good, prompt: '  Hallo  ', correctAnswer: 'Hallo' })).toBe(false);
  });

  it('still accepts a cognate-shaped question whose answer is a DIFFERENT word', () => {
    // "Hallo" -> "Guten Tag" is a translation question like any other. The
    // invariant must not start dropping legitimate vocabulary questions.
    expect(
      isUsableQuestion({ ...good, prompt: 'Hello', correctAnswer: 'Guten Tag', options: ['Guten Tag', 'Hallo'] }),
    ).toBe(true);
  });
});
