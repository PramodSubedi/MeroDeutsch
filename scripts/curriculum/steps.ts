/**
 * scripts/curriculum/steps.ts
 *
 *   npm run curriculum:steps            # migrate every lesson
 *   npm run curriculum:steps -- m07     # migrate one lesson
 *   npm run curriculum:steps -- --check # report only, write nothing
 *   npm run curriculum:steps -- --dry   # print the resolved steps, write nothing
 *
 * ── WHAT IT DOES ────────────────────────────────────────────────────────────
 * Reads each `src/data/curriculum/lessons/mNN.json`, converts the document
 * blocks into the canonical `steps[]` sequence from `src/data/curriculum/steps.ts`,
 * and writes the result back. The block fields are left in place: the premium
 * notes page still renders them, so a lesson is fully readable by every renderer
 * that predates this file.
 *
 * ── WHY IT CLASSIFIES BY SHAPE, NOT BY `kind` ───────────────────────────────
 * The authored banks carry 56 DISTINCT `kind` labels across 334 items — and the
 * label does not predict the interaction. `Matching`, `Error Correction`,
 * `Translation DE->EN` and `Accusative Shift` are four labels for the same
 * structural shape (a prompt joined to its answer by an arrow); they differ only
 * in how the result should be presented. Conversely `MCQ`, `Culture MCQ` and
 * `Ending Rule` are three labels for "options plus an answer".
 *
 * So the classifier looks at the SHAPE and uses the kind only to choose between
 * a handful of framings. A kind map with 56 entries would be 56 chances to
 * guess, and every miss would be a silently wrong exercise.
 *
 * ── WHY IT NEVER GUESSES ────────────────────────────────────────────────────
 * The failure this script exists to avoid is the one `schema.ts` already
 * documents for `listening-gap`: a source that resolves to nothing ships as a
 * silently short deck. So:
 *
 *   · an item it cannot classify is REPORTED, not dropped and not fudged;
 *   · the output ends with a per-file count, and a mismatch is an error exit.
 *
 * ── WHY THE WORKSHEET ALIGNMENT CANNOT MIS-MARK ─────────────────────────────
 * M16's bank is not a set of single questions. It is five multi-part worksheets
 * plus five PARALLEL ANSWER-KEY items, each a run of numbered sub-items in prose:
 *
 *     Exercise 1: "... 1) ___ Tisch ist groß. 2) ___ Frau geht zur Arbeit. …"
 *     KEY 1:      "1) Der Tisch ist groß. 2) Die Frau geht zur Arbeit. …"
 *
 * Pairing them means aligning two independently numbered lists. The tempting
 * implementation is `zip` with re-alignment, and it is wrong: if the key drops an
 * item, every later pair shifts by one, and each shifted pair is a confidently
 * wrong answer attached to a question the learner can answer perfectly.
 *
 * So alignment here is STRICTLY BY NUMBER, never by position, and:
 *   · a sub-item with no matching key entry becomes an UNGRADED reference step,
 *     which under-scores and is visible; it does not invent an answer;
 *   · a key entry with no matching question is reported, never re-homed;
 *   · numbering must be contiguous from 1 on both sides or the whole worksheet is
 *     refused rather than partially aligned.
 *
 * The asymmetry is the whole safety property: a mis-alignment can cost a learner
 * a point, and can never cost them a point they earned.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { PracticeItem, UnitLessonContent } from '../../src/data/curriculum/schema';
import type { Step, Ask } from '../../src/data/curriculum/steps';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const LESSONS_DIR = path.join(ROOT, 'src', 'data', 'curriculum', 'lessons');

const argv = process.argv.slice(2);
const checkOnly = argv.includes('--check');
const dryRun = argv.includes('--dry');
// `m07`, not `7` — the lessons are named `mNN.json` and the filter is a substring
// test against the filename, so an unanchored `^\d` would match nothing and
// silently migrate every lesson instead of the one that was asked for.
const only = argv.find((a) => /^m\d+$/i.test(a));

/* ── reporting ─────────────────────────────────────────────────────────────── */

interface Report {
  file: string;
  steps: number;
  checks: number;
  /** Items that became a step. */
  migrated: number;
  /**
   * Items that became a step but NOT a scored one — prose, worked examples, a
   * key that states a whole sentence. The teaching still reaches the learner, so
   * these are reported for review and do not fail the build.
   */
  ungraded: { kind: string; reason: string; sample: string }[];
  /**
   * Items that produced no step at all: a blank with no key, an option set with
   * no matching answer. Content is LOST, so this is the only category that fails.
   */
  dropped: { kind: string; reason: string; sample: string }[];
  /** Deterministic repairs worth an audit trail (e.g. an answer's casing). */
  notes: { kind: string; reason: string; sample: string }[];
  /** Set when the lesson was skipped because its steps are imported. */
  skippedImported?: boolean;
  /** Counts of every structural shape seen, so a change in the corpus is visible. */
  shapes: Record<string, number>;
}

/* ── arrow handling ────────────────────────────────────────────────────────── */

/**
 * Split a prompt on its FIRST arrow.
 *
 * The arrow forms the corpus uses are `\(\rightarrow\)`, `\(\leftrightarrow\)`,
 * and bare `→` / `↔`. The LaTeX spelling is a backslash, an opening paren,
 * ANOTHER backslash, the word, a third backslash, then the closing paren — JSON
 * decodes it to exactly that, and stripping only the parens is what left a
 * literal `\rightarrow` visible on screen in `LessonSections.cleanPrompt`. Each
 * backslash is therefore optional here, so the escaped and plain spellings both
 * match — and `\leftrightarrow` must be included, because the antonym items use
 * it and a `\rightarrow`-only pattern reported all 12 of them as unanswerable
 * prose.
 *
 * The FIRST arrow, not the last. The separator is always the first one: `"heute"
 * or "in die Stadt"? → heute` puts the question before it, and an answer may
 * carry its own arrows after it. m14 writes
 * `in + das (accusative) = → ins (no contraction of in, but das → ns)`, whose
 * trailing `das → ns` would otherwise be taken as the separator and yield the
 * answer `ns)`.
 */
function lastArrowSplit(prompt: string): { left: string; right: string; arrow: string } | null {
  const m = /\\?\(\s*\\?(?:rightarrow|leftrightarrow)\s*\\?\)|→|↔/.exec(prompt);
  if (!m || m.index === undefined) return null;
  return {
    left: prompt.slice(0, m.index).trim(),
    right: prompt.slice(m.index + m[0].length).trim(),
    arrow: m[0].trim(),
  };
}

/**
 * Drop a trailing `(…)` label from a fragment.
 *
 * The corpus uses parens for three things — a blank's hint, a case label
 * (`(Nom)`, `(Acc)`), and a key answer's own aside (`ins (no contraction…)`) —
 * and none of those belong in text the learner reads as the answer. Applied only
 * to the arrow path, where the blank hints are already handled separately, so a
 * legitimate mid-sentence aside is untouched.
 */
function stripTrailingParen(text: string): string {
  return text.replace(/\s*\([^()]*\)\s*$/, '').trim();
}

/* ── small text helpers ────────────────────────────────────────────────────── */

/** A paren hint at the end of a prompt, e.g. "Tee. (einen/ein)". */
function extractHint(text: string): { body: string; hint?: string } {
  const m = /\s*\(([^()]*)\)\s*$/.exec(text);
  if (!m) return { body: text };
  return { body: text.slice(0, m.index).trim(), hint: m[1] };
}

/**
 * A paren hint in the MIDDLE of a prompt, e.g. "In der Nacht ________ (schlafen) ich."
 *
 * Separate from `extractHint` because a trailing-only rule misses the commonest
 * fill-in shape there is: the hint sits between the blank and the rest of the
 * sentence. Missing it is not a cosmetic gap — the leftover `(schlafen)` reads as
 * a bracket to the arrange classifier, so a fill-in gets rejected as a one-token
 * reorder instead of becoming the typed step it is.
 */
function extractInlineHint(text: string): { body: string; hint?: string } {
  const m = /\(([^()]*)\)/.exec(text);
  if (!m) return { body: text };
  return { body: `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`.replace(/\s+/g, ' ').trim(), hint: m[1] };
}

/** `["a", "b"]` / `(a / b)` as alternatives for the blank. */
function hintToAccepted(hint: string): string[] {
  return hint
    .split(/\s*\/\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== 'or');
}

/** The full sentence when the learner types the whole corrected line. */
function stripOrAlternative(answer: string): { answer: string; accepted: string[] } {
  const m = /\s*\(or\s+([^()]+)\)\s*$/i.exec(answer);
  if (!m) return { answer: answer.trim(), accepted: [] };
  return { answer: answer.slice(0, m.index).trim(), accepted: [m[1].trim()] };
}

/**
 * Split a trailing parenthetical explanation off an answer.
 *
 * M15 authors `"Ich ___ (haben/sein) gegangen." → "bin (sein)"`. The learner is
 * asked for the auxiliary, so `bin` is the answer and `(sein)` names the verb — but
 * the comparison string carried both, and a learner who typed the correct `bin`
 * was marked wrong. `lessonSpec` REFUSES this shape, so the migration has to
 * produce the compliant form: the explanation moves to `note`, which is shown and
 * never compared.
 */
function splitExplanation(answer: string): { answer: string; note?: string } {
  const m = TRAILING_NOTE.exec(answer);
  if (!m) return { answer: answer.trim() };
  return { answer: answer.slice(0, m.index).trim(), note: m[1].trim() };
}

/** A trailing `(…)` that is not an `(or …)` alternative. */
const TRAILING_NOTE = /\s*\((?![^()]*\bor\b)([^()]{2,})\)\s*$/;

/* ── direction, from the kind label ────────────────────────────────────────── */

/**
 * The question a typed step is asking.
 *
 * ── WHY THIS IS A DETECTOR AND NOT A KIND LOOKUP ─────────────────────────────
 * The first version mapped the authored `kind` label straight to a `direction`,
 * which conflated six unrelated question types under `recall` and rendered ninety-
 * two exercises with an instruction that did not match them. The `ask` field and
 * `src/data/curriculum/lessonSpec.ts` exist to make that impossible: a wrong
 * `ask` is now a build failure rather than a confusing screen.
 *
 * So this decides only from what it can PROVE about the prompt and the answer,
 * and returns `undefined` for anything else. An undefined `ask` is not a fallback
 * — the step is written without one, and the validator refuses it, so the item
 * shows up in the "needs authoring" list instead of reaching a learner as a
 * question that does not make sense.
 */
function askFor(kind: string, prompt: string, answer: string): { ask: Ask; note?: string } | { unclassified: true } {
  const k = kind.toLowerCase();

  // A gap is the one unambiguous signal, and it beats the label: a `Fill-in` whose
  // prompt has no blank is a different question wearing the wrong name.
  if (/_{3,}/.test(prompt)) return { ask: 'fill-blank' };

  if (k.includes('translation de->en')) return { ask: 'translate-de-en' };
  if (k.includes('translation en->de')) return { ask: 'translate-en-de' };
  if (k.includes('translation ne->de')) return { ask: 'translate-ne-de' };
  if (k.includes('error correction') || k.includes('infinitive placement')) return { ask: 'correct' };

  // An article is a closed set of three, so an answer that is one of them proves
  // the question — whatever the label says.
  if (['der', 'die', 'das'].includes(answer.toLowerCase())) return { ask: 'choose-article' };

  // An infinitive in brackets plus an answer that is not the infinitive is a
  // conjugation. M06's `ich (wohnen) in Berlin. → wohne` is the worked case: no
  // blank anywhere, so only this rule can rescue it from "fill in the blank".
  const infinitive = /\(([^()]{2,})\)/.exec(prompt)?.[1];
  if (infinitive && answer.toLowerCase() !== infinitive.toLowerCase() && !answer.includes(' ')) {
    return { ask: 'conjugate' };
  }

  if (/plural/i.test(k) && /\bplural\b/i.test(prompt)) return { ask: 'plural-of' };

  return { unclassified: true };
}

/* ── the numbered-list parser, for the M16 worksheets ──────────────────────── */

interface NumberedList {
  instruction: string;
  /** Keyed by the number printed in the text, so pairing is by label, not position. */
  items: Map<number, string>;
}

/**
 * Split `"Do X: 1) a. 2) b. 3) c."` into its instruction and its numbered parts.
 *
 * Returns `null` unless the numbering is contiguous from 1 with no duplicates —
 * a partial parse is the exact shape that would shift an answer onto the wrong
 * question, so it is refused rather than used.
 */
function parseNumbered(text: string): NumberedList | null {
  const marker = /(?:\s|^)(\d+)\)\s*/g;
  const parts: { n: number; start: number; end: number }[] = [];
  for (const m of text.matchAll(marker)) {
    parts.push({ n: Number(m[1]), start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  if (parts.length === 0) return null;

  const items = new Map<number, string>();
  const instruction = text.slice(0, parts[0].start).trim();
  parts.forEach((p, i) => {
    const stop = parts[i + 1]?.start ?? text.length;
    if (items.has(p.n)) return; // duplicate number: refuse via the check below
    items.set(p.n, text.slice(p.start, stop).replace(/^\s*\d+\)\s*/, '').trim());
  });

  for (let n = 1; n <= parts.length; n += 1) {
    if (!items.has(n)) return null; // gap, or a duplicate we swallowed
  }
  return { instruction, items };
}

/** The `DE:` segment of a trilingual answer key entry. */
function deSegmentOf(answer: string): string {
  const m = /\bDE:\s*([^|]+)/.exec(answer);
  return (m ? m[1] : answer).trim();
}

/* ── worksheet conversion (M16) ────────────────────────────────────────────── */

interface Worksheet {
  /** By exercise number, the parsed question list. */
  exercises: Map<number, { kind: string; list: NumberedList }>;
  /** By exercise number, the parsed answer-key list. */
  keys: Map<number, NumberedList>;
  /** `Scoring Guidance` and similar prose, kept verbatim. */
  prose: { kind: string; prompt: string }[];
}

/** Group the M16-shaped bank into exercises, keys, and prose. */
function collectWorksheet(items: PracticeItem[]): Worksheet | null {
  const exercises = new Map<number, { kind: string; list: NumberedList }>();
  const keys = new Map<number, NumberedList>();
  const prose: { kind: string; prompt: string }[] = [];

  for (const item of items) {
    const ex = /^Exercise (\d+)/i.exec(item.kind);
    if (ex) {
      const list = parseNumbered(item.prompt);
      if (!list) return null;
      exercises.set(Number(ex[1]), { kind: item.kind, list });
      continue;
    }
    const key = /^ANSWER KEY\s*[—-]\s*Exercise (\d+)/i.exec(item.kind);
    if (key) {
      const list = parseNumbered(item.prompt);
      if (!list) return null;
      keys.set(Number(key[1]), list);
      continue;
    }
    prose.push({ kind: item.kind, prompt: item.prompt });
  }

  return exercises.size > 0 ? { exercises, keys, prose } : null;
}

/** Exercise 4 is a reordering task; the rest are typed. */
function isReorderKind(kind: string): boolean {
  return /reorder/i.test(kind);
}

/* ── the classifier ────────────────────────────────────────────────────────── */

type Resolved =
  | { kind: 'step'; step: Step; shape: string }
  | { kind: 'reference'; step: Step; shape: string; reason: string }
  | { kind: 'ungraded'; step: Step; shape: string; reason: string }
  | { kind: 'skip'; reason: string };

/**
 * An item the migration cannot classify, preserved as a reference card.
 *
 * Content PRESERVED and REPORTED — neither dropped nor guessed. Scoring it as a
 * fill-in is what produced ninety-two broken exercises; dropping it loses
 * material; and an `ask` invented from the authored label is the same confident
 * inference that caused the problem in the first place.
 *
 * The learner still sees the question and the answer, the run is never shorter
 * than the document it replaces, and the item appears in the "needs an `ask`"
 * list where the fix is one label or a re-authored exercise per
 * `docs/lesson-content-spec.md`.
 */
function needsAsk(kind: string, prompt: string, answer: string): Resolved {
  return {
    kind: 'reference',
    shape: 'needs-ask',
    reason: 'no decidable question type',
    step: { type: 'explain', title: { en: kind, de: kind }, notes: [{ en: prompt, ne: '', de: answer }] },
  };
}

/**
 * One authored practice item → zero or one steps.
 *
 * `Matching` and its three siblings are returned as `skip` with a reason, because
 * they are only renderable as a PAIRED step: a single `heute → today` is a match
 * step with one pair, which is a worse exercise than three pairs. The caller
 * groups them.
 */
function classify(item: PracticeItem, notes: { kind: string; reason: string; sample: string }[] = []): Resolved {
  const prompt = (item.prompt ?? '').trim();
  const kind = item.kind ?? '';

  // ── options + answer → mcq ──
  const options = Array.isArray(item.options) ? item.options : undefined;
  if (options && options.length >= 2) {
    if (typeof item.answer === 'string' && item.answer.trim() !== '') {
      const answer = item.answer.trim();
      const exact = options.find((o) => o === answer);
      // Adopt the OPTION's own casing when the key differs only by case. m13
      // authors `"answer": "diese"` against options `["Dieser", "Diese", …]`,
      // which is the same answer; comparing exactly would emit a question with
      // no correct choice, and a learner could only ever be marked wrong.
      const ci = options.find((o) => o.toLowerCase() === answer.toLowerCase());
      if (exact) return { kind: 'step', shape: 'mcq', step: { type: 'mcq', prompt, options: [...options], answer: exact } };
      if (ci) {
        notes.push({ kind: 'casing-normalised', reason: `answer "${answer}" is option "${ci}"`, sample: prompt });
        return { kind: 'step', shape: 'mcq', step: { type: 'mcq', prompt, options: [...options], answer: ci } };
      }
      return { kind: 'ungraded', shape: 'mcq', reason: 'answer is not among the options', step: { type: 'explain', title: { en: kind, de: kind }, notes: [{ en: prompt, ne: '', de: answer }] } };
    }
    return { kind: 'ungraded', shape: 'mcq', reason: 'options but no answer', step: { type: 'explain', title: { en: kind, de: kind }, notes: [{ en: prompt, ne: '', de: '' }] } };
  }

  // ── `Listen & Type: "…"` → dictation ──
  if (/^listen\s*&\s*type/i.test(prompt)) {
    const quoted = /"([^"]+)"/.exec(prompt);
    if (!quoted) {
      return { kind: 'ungraded', shape: 'dictation', reason: 'no quoted sentence to speak', step: { type: 'explain', title: { en: 'Dictation', de: 'Diktat' }, notes: [{ en: prompt, ne: '', de: '' }] } };
    }
    return { kind: 'step', shape: 'dictation', step: { type: 'dictation', text: quoted[1], instruction: 'Listen & type what you hear.' } };
  }

  const split = lastArrowSplit(prompt);

  // ── no arrow ──
  if (!split) {
    if (typeof item.answer === 'string' && item.answer.trim() !== '') {
      const ask = askFor(kind, prompt, item.answer.trim());
      if ('unclassified' in ask) return needsAsk(kind, prompt, item.answer.trim());
      return { kind: 'step', shape: 'typed-answer-field', step: { type: 'typed', ask: ask.ask, prompt, answer: item.answer.trim() } };
    }
    // A blank with no key is a question whose answer is missing from the data —
    // broken content, and the one case here that must fail the build.
    if (/_{3,}/.test(prompt)) return { kind: 'skip', reason: 'a blank with no answer anywhere in the item' };
    // No blank and no answer means the prompt is a STATEMENT, not a question:
    // a worked example ("Conjugate einkaufen for du: du kaufst ... ein"), a
    // demonstration ("Walking on foot uses: gehen"), or a sign-off. Scored
    // exercises cannot be made from these, but the teaching stays reachable.
    return {
      kind: 'ungraded',
      shape: 'no-answer-prose',
      reason: 'no answer and no blank — kept as reference',
      step: { type: 'explain', title: { en: kind, de: kind }, notes: [{ en: prompt, ne: '', de: '' }] },
    };
  }

  const { left, right } = split;
  const answer = right.replace(/\.$/, '').trim();
  if (answer === '') return { kind: 'skip', reason: 'arrow with an empty right-hand side' };

  const { body: rawBody, hint } = extractHint(left);

  // The blank decides which hint rule applies: a trailing paren is a choice list
  // after the sentence, but a blank puts its hint inline before the sentence ends.
  const body = /_{3,}/.test(rawBody) ? extractInlineHint(rawBody).body : rawBody;
  const hintText = /_{3,}/.test(rawBody) ? extractInlineHint(rawBody).hint : hint;

  // ── two quoted alternatives plus an arrow that names one of them (TeKaMoLo) ──
  // "Which comes first after the verb: \"heute\" or \"in die Stadt\"? → heute"
  // is a two-way choice, and it is DETERMINATE: the arrow's right side is one of
  // the two quoted options, so this is a real multiple choice rather than a
  // guess about intent. If it ever stops matching, it falls through to a typed
  // step, which is the correct fallback — never to an invented option list.
  const alternatives = [...left.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (alternatives.length === 2 && alternatives.includes(answer)) {
    return { kind: 'step', shape: 'mcq', step: { type: 'mcq', prompt: left.replace(/\s*\\?\(\s*\\?(?:rightarrow|leftrightarrow)\s*\\?\)|→|↔\s*$/, '').trim(), options: alternatives, answer } };
  }

  // ── `[ a / b / c ]` → arrange ──
  //
  // A SLASH is required, and that is what separates a token list from every other
  // paren in the corpus. `Sentence Unscramble` writes `[ Montag / ist / heute ]`;
  // the other parens are single labels — `(Nom)`, `(Acc)`, `(accusative)`, the
  // rest — and treating those as a one-token list rejected real exercises
  // ("Dieser Schuh (Nom) → Accusative") instead of turning them into the typed
  // transformation they are.
  const bracket = /([[(])([^[\])]*\/[^[\])]*)([\])])/.exec(body);
  if (bracket) {
    const tokens = bracket[2]
      .split(/\s*\/\s*/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tokens.length < 2) return { kind: 'skip', reason: 'bracket holds fewer than two tokens' };
    return { kind: 'step', shape: 'arrange', step: { type: 'arrange', prompt: body.replace(bracket[0], '__________').trim(), tokens: tokens.reverse() } };
  }

  // ── a blank to fill ──
  if (/_{3,}/.test(body)) {
    const [rawPrefix, rawSuffix] = body.split(/_{3,}/);
    const prefix = (rawPrefix ?? '').trim();
    const suffix = (rawSuffix ?? '').trim();
    const deAnswer = deSegmentOf(answer);
    const accepted = hintText ? hintToAccepted(hintText) : [];

    // When the key states the WHOLE completed sentence, the missing word can be
    // sliced out of it by matching the prompt's own visible parts. That is a
    // deterministic string operation, not an inference, and it lets the learner
    // type one word instead of a sentence.
    if (
      (prefix === '' || deAnswer.startsWith(prefix)) &&
      (suffix === '' || deAnswer.endsWith(suffix)) &&
      deAnswer.length >= prefix.length + suffix.length
    ) {
      const token = deAnswer.slice(prefix.length, deAnswer.length - suffix.length).trim();
      if (token !== '') return { kind: 'step', shape: 'arrow-blank', step: { type: 'typed', ask: 'fill-blank', prompt: body, answer: token, ...(accepted.length ? { accepted } : {}) } };
    }

    // Otherwise the key states the missing piece directly — `… (schlafen) ich. →
    // schlafe` is the commonest fill-in in the corpus, and the answer really is
    // `schlafe`, not a sentence. Use it verbatim.
    //
    // This is deliberately NOT an attempt to "recover" a word from a sentence
    // that does not line up. Whatever the key author wrote IS the accepted
    // answer: guessing a narrower one is the one thing that can mark a correct
    // response wrong, and there is no upside to it worth that risk.
    const { answer: whole, accepted: wholeAccepted } = stripOrAlternative(splitExplanation(deAnswer).answer);
    const explanation = splitExplanation(deAnswer).note;
    return {
      kind: 'step',
      shape: 'arrow-blank-key',
      step: {
        type: 'typed',
        ask: 'fill-blank',
        prompt: body,
        answer: whole,
        ...(wholeAccepted.length || accepted.length ? { accepted: [...new Set([...accepted, ...wholeAccepted])] } : {}),
        ...(explanation ? { note: explanation } : {}),
      },
    };
  }

  // ── an arrow with two quoted sentences is a translation ──
  const quoted = /"([^"]+)"\s*$/.exec(stripTrailingParen(body));
  if (quoted) {
    const ask = askFor(kind, quoted[1], answer);
    if ('unclassified' in ask) return needsAsk(kind, quoted[1], stripTrailingParen(answer));
    return { kind: 'step', shape: 'arrow-translation', step: { type: 'typed', ask: ask.ask, prompt: quoted[1], answer: stripTrailingParen(answer) } };
  }

  // ── anything else: a transformation, classified or refused ──
  //
  // This is the 148-item bucket that the first version funnelled into
  // `direction: 'recall'`, which is why so many exercises told a learner to fill a
  // blank that was not there. `askFor` decides only what it can prove; anything
  // it cannot is REFUSED here and reported, so the item never reaches a learner
  // with an instruction that does not match the question.
  const cleanAnswer = stripTrailingParen(answer);
  const ask = askFor(kind, stripTrailingParen(body), cleanAnswer);
  if ('unclassified' in ask) return needsAsk(kind, stripTrailingParen(body), cleanAnswer);
  const { answer: finalAnswer, note } = splitExplanation(cleanAnswer);
  return {
    kind: 'step',
    shape: 'arrow-transform',
    step: { type: 'typed', ask: ask.ask, prompt: stripTrailingParen(body), answer: finalAnswer, ...(note ? { note } : {}) },
  };
}

/* ── reference steps ───────────────────────────────────────────────────────── */

function referenceSteps(lesson: UnitLessonContent): Step[] {
  const steps: Step[] = [];

  if (lesson.objectives?.en?.length) {
    steps.push({ type: 'intro', objectives: { en: lesson.objectives.en, ...(lesson.objectives.ne ? { ne: lesson.objectives.ne } : {}), ...(lesson.objectives.de ? { de: lesson.objectives.de } : {}) }, ...(lesson.cefr ? { meta: lesson.cefr } : {}) });
  }

  for (const entry of lesson.lexicon ?? []) {
    steps.push({ type: 'word', entry, ...(entry.frequency === 'active' ? { active: true } : {}) });
  }

  for (const block of lesson.grammar ?? []) {
    steps.push({ type: 'explain', title: block.title, ...(block.notes ? { notes: block.notes } : {}), ...(block.table ? { table: block.table } : {}), ...(block.callout ? { callout: block.callout } : {}), ...(block.bullets ? { bullets: block.bullets } : {}) });
  }

  for (const trap of lesson.traps ?? []) {
    steps.push({ type: 'trap', ...(trap.wrong ? { wrong: trap.wrong } : {}), ...(trap.right ? { right: trap.right } : {}), note: trap.note });
  }

  if (lesson.culture) {
    steps.push({ type: 'culture', title: lesson.culture.title, body: lesson.culture.body });
  }

  if (lesson.dialogue) {
    steps.push({ type: 'dialogue', title: lesson.dialogue.title, ...(lesson.dialogue.scenario ? { scenario: lesson.dialogue.scenario } : {}), turns: lesson.dialogue.turns });
  }

  return steps;
}

/* ── per-lesson conversion ─────────────────────────────────────────────────── */

const MATCHING_KINDS = /matching|^antonym match$|direction matching/i;

function convert(lesson: UnitLessonContent, file: string): Report {
  const report: Report = { file, steps: 0, checks: 0, migrated: 0, ungraded: [], dropped: [], notes: [], shapes: {} };
  const bank = lesson.practiceBank ?? [];
  const bump = (shape: string) => void (report.shapes[shape] = (report.shapes[shape] ?? 0) + 1);

  // The review unit's bank is worksheets, not questions. Handled whole, because
  // splitting one and leaving the other would half-align the pair.
  const worksheet = collectWorksheet(bank);
  const checkSteps: Step[] = [];

  if (worksheet) {
    for (const p of worksheet.prose) {
      checkSteps.push({ type: 'explain', title: { en: p.kind, de: p.kind }, notes: [{ en: p.prompt, ne: '', de: '' }] });
      report.migrated += 1;
      bump('worksheet-prose');
    }

    for (const [n, ex] of [...worksheet.exercises].sort((a, z) => a[0] - z[0])) {
      const key = worksheet.keys.get(n);
      const keyCount = key?.items.size ?? 0;
      // Strictly by number. A key shorter than the question list leaves the tail
      // ungraded rather than shifting every later answer up by one.
      const max = Math.max(ex.list.items.size, keyCount);
      for (let i = 1; i <= max; i += 1) {
        const question = ex.list.items.get(i);
        const rawAnswer = key?.items.get(i);
        if (question === undefined) {
          report.notes.push({ kind: `${ex.kind} #${i}`, reason: 'answer key entry has no question', sample: rawAnswer ?? '' });
          continue;
        }
        if (rawAnswer === undefined) {
          checkSteps.push({ type: 'explain', title: { en: ex.list.instruction, de: ex.list.instruction }, notes: [{ en: `${i}) ${question}`, ne: '', de: '' }] });
          report.ungraded.push({ kind: `${ex.kind} #${i}`, reason: 'no answer in the key — kept ungraded', sample: question });
          continue;
        }
        const answer = deSegmentOf(rawAnswer);
        if (isReorderKind(ex.kind)) {
          const bracket = /[[(]([^\])]*)[\])]/.exec(question);
        if (!bracket) {
          report.dropped.push({ kind: `${ex.kind} #${i}`, reason: 'reorder item with no token bracket', sample: question });
          continue;
        }
          const tokens = bracket[1].split(/\s*\/\s*/).map((t) => t.trim()).filter(Boolean);
          checkSteps.push({ type: 'arrange', prompt: ex.list.instruction, tokens: tokens.reverse(), hint: answer });
        } else {
          const { answer: whole, accepted } = stripOrAlternative(splitExplanation(answer).answer);
          // A worksheet sub-item is a gap to fill, a translation, or a whole
          // sentence to produce — and the exercise's own instruction says which.
          // Anything the instruction does not settle is refused by the contract
          // rather than guessed at here.
          const instruction = ex.list.instruction;
          const ask: Ask = /_{3,}/.test(question)
            ? 'fill-blank'
            : /translate into german/i.test(instruction)
              ? 'translate-en-de'
              : 'short-answer';
          checkSteps.push({ type: 'typed', ask, prompt: question, answer: whole, ...(accepted.length ? { accepted } : {}), ...(instruction ? { note: instruction } : {}) });
        }
        report.migrated += 1;
        bump('worksheet-scored');
      }
    }
  } else {
    // Every other lesson: a flat bank. Matching items are collected first so each
    // becomes one paired step rather than N single-pair steps.
    const matchBuckets = new Map<string, { id: string; de: string; en: string }[]>();
    let matchOrder = 0;

    for (const item of bank) {
      if (MATCHING_KINDS.test(item.kind ?? '')) {
        const split = lastArrowSplit(item.prompt ?? '');
        if (!split || split.right === '') {
          report.dropped.push({ kind: item.kind, reason: 'matching item with no usable arrow', sample: item.prompt });
          continue;
        }
        // `teuer ↔ billig / günstig` offers TWO acceptable right-hand sides for one
        // left-hand word. That is a choice, not a pair, and emitting it as two
        // pairs produced a match step with the same German word twice on the left —
        // an ambiguous board the learner cannot complete, since either `billig` or
        // `günstig` would clear both tiles. `lessonSpec` now refuses duplicate lefts;
        // here it becomes a typed step with both forms in `accepted`.
        const rights = split.right.split(/\s*\/\s*/).map((s) => stripTrailingParen(s.trim())).filter(Boolean);
        if (rights.length > 1) {
          const { answer: primary, note } = splitExplanation(rights[0]);
          checkSteps.push({ type: 'typed', ask: 'translate-de-en', prompt: split.left, answer: primary, accepted: rights.slice(1), ...(note ? { note } : {}) });
          report.migrated += 1;
          bump('match-multi-right');
          continue;
        }
        const bucket = matchBuckets.get(item.kind) ?? [];
        bucket.push({ id: `${matchOrder++}`, de: split.left, en: rights[0] ?? '' });
        matchBuckets.set(item.kind, bucket);
        continue;
      }

      const r = classify(item, report.notes);
      if (r.kind === 'step') {
        checkSteps.push(r.step);
        report.migrated += 1;
        bump(r.shape);
      } else if (r.kind === 'ungraded') {
        checkSteps.push(r.step);
        report.migrated += 1;
        report.ungraded.push({ kind: item.kind, reason: r.reason, sample: item.prompt });
        bump('ungraded');
      } else if (r.kind === 'reference') {
        // Preserved, not scored. The learner still sees it; the report says why.
        checkSteps.push(r.step);
        report.migrated += 1;
        report.ungraded.push({ kind: item.kind, reason: r.reason, sample: item.prompt });
        bump('needs-ask');
      } else {
        report.dropped.push({ kind: item.kind, reason: r.reason, sample: item.prompt });
      }
    }

    for (const bucket of matchBuckets.values()) {
      if (bucket.length < 2) {
        // One pair is not a matching exercise. Keep the content, as a typed step.
        for (const p of bucket) {
          checkSteps.push({ type: 'typed', prompt: p.de, answer: p.en, direction: 'de-en' });
          report.migrated += 1;
          bump('match-single');
        }
        continue;
      }
      checkSteps.push({ type: 'match', pairs: bucket.map((p) => ({ id: p.id, de: p.de, en: p.en })), columnLabels: { left: 'Deutsch', right: 'English' } });
      report.migrated += 1;
      bump('match');
    }
  }

  const steps: Step[] = [...referenceSteps(lesson), ...checkSteps, { type: 'summary' }];
  report.steps = steps.length;
  report.checks = checkSteps.filter((s) => ['mcq', 'typed', 'arrange', 'match', 'dictation'].includes(s.type)).length;
  lesson.steps = steps;
  return report;
}

/* ── main ──────────────────────────────────────────────────────────────────── */

const files = fs
  .readdirSync(LESSONS_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .filter((f) => (only ? f.includes(only) : true));

const reports: Report[] = [];
for (const file of files) {
  const full = path.join(LESSONS_DIR, file);
  const original = fs.readFileSync(full, 'utf8');
  const lesson = JSON.parse(original) as UnitLessonContent;

  // An `imported` lesson is authored work, validated against
  // `docs/lesson-content-spec.md`, and NOT regenerable. Reconstructing it from
  // the document blocks would replace someone's writing with a machine
  // approximation of it — silently, and with a green build. Refusing is the
  // only safe answer.
  if (lesson.stepsSource === 'imported') {
    console.log(`  skipped ${file} — steps are imported, not migrated (authored content is never overwritten)`);
    continue;
  }

  const report = convert(lesson, file);
  report.skippedImported = false;
  lesson.stepsSource = 'migrated';
  reports.push(report);
  const next = `${JSON.stringify(lesson, null, 2)}\n`;
  if (dryRun || checkOnly) {
    console.log(`\n=== ${file} ===`);
    console.log(`  steps: ${report.steps} (${report.checks} check)  migrated: ${report.migrated}`);
    console.log(`  shapes: ${Object.entries(report.shapes).map(([k, v]) => `${k}=${v}`).join(' ')}`);
    const show = (label: string, rows: typeof report.dropped) => {
      if (rows.length === 0) return;
      console.log(`  ${label} (${rows.length}):`);
      for (const u of rows.slice(0, 8)) console.log(`    - [${u.kind}] ${u.reason} :: ${u.sample.slice(0, 88)}`);
      if (rows.length > 8) console.log(`    … and ${rows.length - 8} more`);
    };
    show('DROPPED (content lost — build fails)', report.dropped);
    show('UNGRADED (content kept, not scored)', report.ungraded);
    show('NOTES (deterministic repairs)', report.notes);
  } else if (next !== original) {
    fs.writeFileSync(full, next, 'utf8');
    console.log(`  wrote ${file} — ${report.steps} steps (${report.checks} check)`);
  }
}

const totals = reports.reduce(
  (acc, r) => ({
    steps: acc.steps + r.steps,
    checks: acc.checks + r.checks,
    migrated: acc.migrated + r.migrated,
    dropped: acc.dropped + r.dropped.length,
    ungraded: acc.ungraded + r.ungraded.length,
    notes: acc.notes + r.notes.length,
  }),
  { steps: 0, checks: 0, migrated: 0, dropped: 0, ungraded: 0, notes: 0 },
);

console.log(
  `\n[summary] ${reports.length} lesson(s) — ${totals.steps} steps (${totals.checks} check), ` +
    `${totals.migrated} items migrated, ${totals.ungraded} ungraded, ${totals.dropped} dropped, ${totals.notes} repaired.`,
);

// Only DROPPED items fail the build. An ungraded item still reaches the learner as
// a reference step, so treating it as an error would block the rollout on content
// that is demonstrably not lost. A dropped item is a question the run will never
// ask — the exact `listening-gap` failure `schema.ts` documents.
if (totals.dropped > 0 && !dryRun && !checkOnly) {
  console.error(
    `\nFAILED — ${totals.dropped} practiceBank item(s) produced no step. Run with --dry to list them.\n` +
      'These are content defects, not conversion limits: fix the source data, then re-run.',
  );
  process.exit(1);
}
