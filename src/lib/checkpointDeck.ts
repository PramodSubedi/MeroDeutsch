/**
 * src/lib/checkpointDeck.ts
 *
 * The PURE half of building an A1 checkpoint deck. No React, no Supabase, no
 * Dexie — which is the entire point of this file existing.
 *
 * WHY IT WAS EXTRACTED
 * --------------------
 * 14 of the 16 A1 modules shipped with an UNANSWERABLE checkpoint. The deck
 * builder read `c.lemma` / `c.translation` off rows that are actually
 * `VocabEntry` (`{id, de, en, ne}`), so every vocabulary question came out
 * with `prompt: ''`, `correctAnswer: undefined` and a single unlabelled
 * option. The learner saw a blank screen and one blank button, no error.
 *
 * It shipped because nothing tested this code. `curriculum:validate` only
 * checks that the unit FILES declare 12 items — it never builds a deck — and
 * the one test file in the project covers `useA1Path`. A bug that can only be
 * seen by running the app is a bug that survives a green CI. These three
 * helpers decide whether a question is ANSWERABLE, so they are the ones that
 * earn a test, and the test needs them importable without mounting a page.
 */

import { shuffleArray } from '../utils/shuffleArray';
import { normalizeAnswer } from '../utils/answerNormalize';

/** The minimum a checkpoint question must carry to be playable. */
export interface DeckQuestion {
  key: string;
  prompt: string;
  correctAnswer: string;
  options?: string[];
  source: string;
}

/**
 * Build the option set for one question: the correct answer plus `count - 1`
 * distractors drawn at RANDOM from the pool.
 *
 * The decoys MUST be shuffled BEFORE they are sliced.
 *
 * This used to be `uniqueDecoys.slice(0, count - 1)` — a POSITIONAL take. The
 * pool returned by `curriculumService` is deterministically ordered (Dexie
 * primary-key order for vocab; `sort` order for content pools), so every
 * single question in a deck was handed the SAME first three distractors. Only
 * their display position changed, because `useExerciseSession` shuffles options
 * once at mount. The result read as "the same question over and over" even
 * though the prompts were different.
 *
 * Concrete example this fixes — the 8-item greeting pool, old behaviour:
 *   'Hallo'           -> Hallo | Guten Morgen | Guten Tag | Guten Abend
 *   'Auf Wiedersehen' -> Auf Wiedersehen | Hallo | Guten Morgen | Guten Tag
 *   'Entschuldigung'  -> Entschuldigung | Hallo | Guten Morgen | Guten Tag
 *
 * Matches the convention already used in `templateResolver.ts` and
 * `ClockDrill.tsx` (`shuffleArray(distractors).slice(0, n)`).
 */
export function buildOptions(correct: string, decoyPool: string[], count: number): string[] {
  const uniqueDecoys = Array.from(new Set(decoyPool.filter((d) => d !== correct)));
  const chosen = shuffleArray(uniqueDecoys).slice(0, count - 1);
  return [correct, ...chosen]; // final shuffle happens once at session mount
}

/** The two vocabulary shapes the checkpoint draws from, structurally typed. */
export type FlatVocab = {
  id: string;
  de?: string;
  en?: string;
  ne?: string;
  tags?: string[];
  audioUrl?: string;
};
export type CardVocab = {
  id: string;
  lemma?: string;
  translation?: { en?: string; np?: string };
  tags?: string[];
  audioUrl?: string;
};

/**
 * Normalise EITHER vocabulary shape onto `{id, de, en, ne, …}`, or return null
 * when the row cannot make a usable question.
 *
 * WHY THIS EXISTS (the bug that emptied 14 of 16 checkpoints)
 * The deck builder draws from two loaders that return DIFFERENT shapes:
 *
 *   getVocabularyByCategories() → VocabEntry[]  { id, de, en, ne, tags, level }
 *   getVocabularyFiltered()     → VocabCard[]   { id, lemma, translation{en,np} }
 *
 * The page previously cast both to `any` and read `c.lemma` / `c.translation`,
 * which only exist on a `VocabCard`. Against the (far more common) themed
 * loader every field read back `undefined`, so `buildOptions` produced
 * `[correct]` — a single OPTION WITH NO LABEL — and the prompt rendered empty.
 * The `as any` also silenced the type checker that would have caught it.
 *
 * `null` is returned for a row with no German text or no English text. Such a
 * row can only ever produce a blank prompt or an unanswerable question, so it
 * is dropped here rather than being allowed to poison the deck.
 */
export function toVocabEntry(raw: FlatVocab | CardVocab): {
  id: string;
  de: string;
  en: string;
  ne: string;
  tags: string[];
  audioUrl?: string;
} | null {
  const flat = raw as FlatVocab;
  const card = raw as CardVocab;

  const de = typeof flat.de === 'string' ? flat.de : card.lemma;
  const en = typeof flat.en === 'string' ? flat.en : card.translation?.en;
  const ne = typeof flat.ne === 'string' ? flat.ne : (card.translation?.np ?? '');

  if (!de || !en) return null;

  return { id: raw.id, de, en, ne, tags: raw.tags ?? [], audioUrl: raw.audioUrl };
}

/**
 * A question is only playable if it can actually be answered.
 *
 * This is the LAST line of defence, deliberately placed at the very end of the
 * builder so it covers EVERY source — not just the vocabulary ones. The defect
 * that shipped emptied 14 of 16 checkpoints: those questions carried an empty
 * prompt, an `undefined` correctAnswer and a single unlabelled option. Because
 * a deck that merely shrinks is a far better outcome than a deck of unplayable
 * questions, a malformed question is dropped here and the learner gets a
 * shorter (but real) checkpoint instead of a blank screen with no error.
 *
 * The caller passes `onDrop` to route the warning somewhere (console in the
 * page, an assertion in the test). A silent drop would reintroduce the original
 * failure mode, where content quietly rots with nothing to notice.
 *
 * DEGENERATE PROMPTS (the `prompt === answer` clause) — C2.6
 * ----------------------------------------------------
 * A question whose prompt IS its own answer is not a question. The learner is
 * handed the answer on screen, and — because `speakPrompt` reuses that same
 * string — the pre-lock speaker plays the bundled RECORDING of the answer too.
 * That second half is an answer leak, not just a weak question, and it is
 * reachable purely from seed data: a true cognate (German "bitter", English
 * "bitter") produces `prompt: v.en === correctAnswer: v.de` for the
 * `vocab-translation` source. It only became audible once `speakText` started
 * preferring bundled clips, because the manifest is keyed by the same German
 * string — before that it was an unreadable babble in a de-DE voice.
 *
 * Fixing it at the source (correcting `translation.en`) is a seed-data job, and
 * a cognate is not even wrong — the words genuinely coincide. So the invariant
 * is enforced here instead: the degenerate card is dropped from the deck and
 * the remaining pool absorbs the slot. Both affected units have pools several
 * times larger than their declared count, so no checkpoint is starved.
 */
export function isUsableQuestion(q: DeckQuestion, onDrop?: (q: DeckQuestion) => void): boolean {
  const prompt = typeof q.prompt === 'string' ? q.prompt.trim() : '';
  const answer = typeof q.correctAnswer === 'string' ? q.correctAnswer.trim() : '';
  const options = Array.isArray(q.options) ? q.options : [];

  const usable =
    prompt.length > 0 &&
    answer.length > 0 &&
    // The prompt must not already BE the answer. Compared through the shared
    // normalizer so case and spacing cannot smuggle a collision past this.
    normalizeAnswer(prompt) !== normalizeAnswer(answer) &&
    options.length >= 2 &&
    options.every((o) => typeof o === 'string' && o.trim().length > 0) &&
    options.includes(answer);

  if (!usable) onDrop?.(q);
  return usable;
}

