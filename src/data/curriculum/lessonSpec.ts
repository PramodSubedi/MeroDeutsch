/**
 * src/data/curriculum/lessonSpec.ts
 *
 * THE CONTENT CONTRACT. What a lesson must look like to be renderable.
 *
 * ── WHY THIS FILE IS THE POINT ───────────────────────────────────────────────
 * The step model in `steps.ts` says what the renderer can DRAW. It says nothing
 * about whether the content is ANSWERABLE, and that gap is where the first
 * version of this work went wrong: a migration inferred each exercise's question
 * type from a free-text `kind` label, lumped six unrelated types together, and
 * rendered ninety-two of the 334 exercises with an instruction that did not match
 * the question — twenty of them telling a learner to "fill in the blank" about a
 * prompt with no blank in it.
 *
 * Nothing in the pipeline could have caught that, because nothing declared what
 * the question WAS. So the contract is declared here, and enforced here, and
 * content is refused at the door rather than rendered wrongly to a learner.
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────────
 * An authoring tool (a human, or NotebookLM following `docs/lesson-content-spec.md`)
 * produces a lesson. This validator is the only thing that decides whether it is
 * usable. Two rules:
 *
 *   1. A REFUSAL is a build failure, never a render-time surprise. Every message
 *      names the field, the offending value, and the rule it broke, so the author
 *      can fix it without reading this file.
 *   2. An unclassifiable exercise is REFUSED, not guessed. The whole defect class
 *      this exists to prevent began with a confident inference.
 */
import { STEP_TYPES, isCheckStep, type Ask } from './steps';
import { normaliseAnswer } from '../../components/run/steps/matchesAnswer';

export interface SpecProblem {
  /** Where to look: a step index, or `run` for the lesson as a whole. */
  where: string;
  /** The field at fault, so an author can jump straight to it. */
  field: string;
  /** What is wrong, phrased as the rule rather than the symptom. */
  problem: string;
  /** The offending value, truncated. */
  found?: string;
}

const ARTICLES = new Set(['der', 'die', 'das']);

/** Every `ask` value, for the validator and for the authoring guide. */
export const ASK_VALUES: readonly Ask[] = [
  'fill-blank',
  'conjugate',
  'choose-article',
  'plural-of',
  'translate-de-en',
  'translate-en-de',
  'translate-ne-de',
  'correct',
  'short-answer',
];

/**
 * The learner-facing instruction for each `ask`.
 *
 * Kept beside the validator on purpose: the two must agree about what each `ask`
 * MEANS, and the previous failure was precisely that they did not — the renderer
 * said "Fill in the blank" for a question that was not a fill-in, because the
 * instruction lived in a component and the meaning lived in a data field that
 * nobody checked.
 */
export const ASK_INSTRUCTION: Record<Ask, { en: string; de: string }> = {
  'fill-blank': { en: 'Fill in the blank:', de: 'Ergänze die Lücke:' },
  conjugate: { en: 'Write the conjugated form:', de: 'Schreibe die konjugierte Form:' },
  'choose-article': { en: 'Which article does this noun take?', de: 'Welchen Artikel nimmt dieses Nomen?' },
  'plural-of': { en: 'What is the plural of this noun?', de: 'Wie lautet der Plural dieses Nomens?' },
  'translate-de-en': { en: 'Write this in English:', de: 'Schreibe das auf Englisch:' },
  'translate-en-de': { en: 'Write this in German:', de: 'Schreibe das auf Deutsch:' },
  'translate-ne-de': { en: 'Write this in German:', de: 'Schreibe das auf Deutsch:' },
  correct: { en: 'This sentence has a mistake. Write it correctly:', de: 'Dieser Satz hat einen Fehler. Schreibe ihn richtig:' },
  'short-answer': { en: 'Answer:', de: 'Antworte:' },
};

const short = (s: string, n = 60): string => (s.length > n ? `${s.slice(0, n)}…` : s);

/**
 * Does this text actually ask something?
 *
 * Trailing quotes and brackets are skipped, because a prompt that embeds its
 * question — `What does the waiter mean by "Zusammen oder getrennt?"` — ends in a
 * quotation mark, and a rule that only accepted a bare `?` flagged four correct
 * prompts as broken.
 */
const ASKS_SOMETHING = /[?:][\s"'”’)\]]*$/;

/** A trailing `(…)` that is not an `(or …)` alternative. */
const TRAILING_EXPLANATION = /\s*\((?![^()]*\bor\b)[^()]{2,}\)\s*$/;

export interface ValidateOptions {
  /** The lesson's own identifier, used in messages. */
  id?: string;
}

/**
 * Validate a lesson's steps against the content contract.
 *
 * Returns every problem rather than the first: an author pasting a fresh
 * NotebookLM export should see the whole list, not fix one defect per round trip.
 */
export function validateLessonSteps(steps: unknown, opts: ValidateOptions = {}): SpecProblem[] {
  const problems: SpecProblem[] = [];
  const at = (i: number, field: string, problem: string, found?: string) =>
    problems.push({ where: `${opts.id ? `${opts.id} ` : ''}step ${i}`, field, problem, ...(found ? { found } : {}) });

  if (!Array.isArray(steps) || steps.length === 0) {
    problems.push({ where: opts.id ?? 'lesson', field: 'steps', problem: 'A lesson needs at least one step.' });
    return problems;
  }

  steps.forEach((raw, i) => {
    const step = raw as Record<string, unknown>;
    const type = typeof step.type === 'string' ? step.type : '(missing)';

    if (!STEP_TYPES.includes(type as (typeof STEP_TYPES)[number])) {
      at(i, 'type', `Unknown step type. Expected one of: ${STEP_TYPES.join(', ')}.`, type);
      return;
    }

    if (type === 'intro') {
      const objectives = step.objectives as { en?: unknown } | undefined;
      if (!objectives || !Array.isArray(objectives.en) || objectives.en.length === 0) {
        at(i, 'objectives.en', 'An intro needs at least one English objective. `de` and `ne` are optional.');
      }
      return;
    }

    if (type === 'word') {
      const entry = step.entry as { word?: unknown; en?: unknown; ne?: unknown } | undefined;
      if (!entry || typeof entry.word !== 'string' || entry.word === '') {
        at(i, 'entry.word', 'A word step needs a headword.');
      }
      if (!entry || typeof entry.en !== 'string' || entry.en === '') {
        at(i, 'entry.en', 'A word step needs an English gloss. `LexiconEntry` has no German gloss — the headword IS the German.');
      }
      return;
    }

    if (type === 'explain') {
      if (typeof (step.title as { en?: unknown } | undefined)?.en !== 'string') at(i, 'title.en', 'An explanation needs a title.');
      const hasBody =
        typeof step.body === 'string' ||
        (Array.isArray(step.notes) && step.notes.length > 0) ||
        (Array.isArray(step.bullets) && step.bullets.length > 0) ||
        step.table !== undefined ||
        typeof step.callout === 'string';
      if (!hasBody) at(i, 'body', 'An explanation with a title and no body renders as an empty card. Put prose in `body`, or use `notes` / `bullets` / `table` / `callout`.');
      return;
    }

    if (type === 'rule-table') {
      if (!Array.isArray(step.rows) || step.rows.length === 0) at(i, 'rows', 'A rule table needs at least one row.');
      return;
    }

    if (type === 'decision-tree') {
      const flow = step.flow as { startId?: unknown; nodes?: unknown } | undefined;
      if (!flow || typeof flow.startId !== 'string' || !flow.nodes) {
        at(i, 'flow', 'A decision tree needs `startId` and `nodes`.');
        return;
      }
      // A dangling `nextId` is a CRASH, not a wrong answer: the flowchart walks
      // to it and finds nothing.
      for (const [id, node] of Object.entries(flow.nodes as Record<string, { nextId?: string; options?: { nextId: string }[] }>)) {
        if (node.options) {
          for (const o of node.options) {
            if (!(flow.nodes as Record<string, unknown>)[o.nextId]) {
              at(i, `flow.nodes.${id}`, `An option points at node "${o.nextId}", which does not exist.`);
            }
          }
        }
      }
      if (!(flow.nodes as Record<string, unknown>)[flow.startId]) {
        at(i, 'flow.startId', `startId "${flow.startId}" is not one of the nodes.`);
      }
      return;
    }

    if (type === 'trap') {
      if (typeof (step.note as { en?: unknown } | undefined)?.en !== 'string') at(i, 'note.en', 'A trap needs an English note explaining why.');
      return;
    }

    if (type === 'tip') {
      if (typeof step.body !== 'string' || step.body.trim() === '') {
        at(i, 'body', 'A tip needs something to remember. A tip that needs a paragraph is an `explain` step.');
      } else if (step.body.length > 320) {
        at(i, 'body', 'A tip should be one or two sentences. Over ~320 characters it stops being memorable and becomes an explanation.');
      }
      if (step.example !== undefined && typeof step.example !== 'string') at(i, 'example', 'A tip example must be a string.');
      return;
    }

    if (type === 'culture') {
      // `title` is OPTIONAL here. A culture note is a note, and a generator that
      // omits the heading should not have its lesson refused — but the renderer
      // must still not assume the field exists, because that is a crash rather than
      // a missing heading.
      //
      // `body` is a string OR a list. One is what an author actually writes for a
      // one-sentence note, and insisting on a list of one is a rule about types
      // rather than about teaching.
      const body = step.body;
      const hasBody = typeof body === 'string' ? body.trim() !== '' : Array.isArray(body) && body.length > 0;
      if (!hasBody) at(i, 'body', 'A culture step needs at least one line, as a string or a list of strings.');
      return;
    }

    if (type === 'dialogue') {
      if (!Array.isArray(step.turns) || step.turns.length === 0) {
        at(i, 'turns', 'A dialogue needs at least one turn.');
        return;
      }
      // The audio button speaks `turn.de` directly. An empty one is a crash in the
      // speech layer, not a silent no-op.
      (step.turns as { de?: unknown; speaker?: unknown }[]).forEach((turn, j) => {
        if (typeof turn.de !== 'string' || turn.de === '') at(i, `turns[${j}].de`, 'Every turn needs German text — it is what the audio button speaks.');
        if (typeof turn.speaker !== 'string' || turn.speaker === '') at(i, `turns[${j}].speaker`, 'Every turn needs a speaker.');
      });
      return;
    }

    if (type === 'summary') return;

    /* ── check steps ── */

    if (type === 'mcq') {
      const options = step.options as unknown[];
      if (!Array.isArray(options) || options.length < 2) at(i, 'options', 'Multiple choice needs at least two options.');
      if (typeof step.answer !== 'string' || !Array.isArray(options) || !options.includes(step.answer)) {
        at(i, 'answer', 'The answer must be one of the options. An answer outside the option list means the question has no correct choice and every learner is marked wrong.', short(String(step.answer)));
      }
      // A prompt may ask with a question mark, a colon, or a blank to fill.
      // `Fill demonstrative: ________ (this - der) Pullover ist warm.` ends in a full
      // stop and is still an unambiguous instruction, and requiring a `?` flagged
      // it as broken while waving through nothing real.
      if (typeof step.prompt !== 'string' || (!/_{3,}/.test(step.prompt) && !ASKS_SOMETHING.test(step.prompt.trim()))) {
        at(i, 'prompt', 'A multiple-choice prompt must either contain `___` or end in a question mark or colon. A bare label like "Position" does not ask the learner anything.');
      }
      return;
    }

    if (type === 'arrange') {
      const tokens = step.tokens as unknown[];
      if (!Array.isArray(tokens) || tokens.length < 2) at(i, 'tokens', 'A reordering exercise needs at least two tokens.');
      // Two identical tiles cannot be placed in the right order: the learner can
      // build a string that looks wrong while being untellable from identical parts.
      if (Array.isArray(tokens) && new Set(tokens).size !== tokens.length) {
        at(i, 'tokens', 'Every token must be distinct, or the correct order is ambiguous.');
      }
      return;
    }

    if (type === 'match') {
      const pairs = step.pairs as { id?: unknown; de?: unknown; en?: unknown }[] | undefined;
      if (!Array.isArray(pairs) || pairs.length < 2) {
        at(i, 'pairs', 'A matching exercise needs at least two pairs — one pair is not a matching exercise.');
        return;
      }
      const lefts = new Set<string>();
      pairs.forEach((p, j) => {
        if (typeof p.de !== 'string' || p.de === '' || typeof p.en !== 'string' || p.en === '') {
          at(i, `pairs[${j}]`, 'Every pair needs both a German and an English side.');
        }
        if (typeof p.de === 'string') {
          if (lefts.has(p.de)) at(i, `pairs[${j}].de`, `"${p.de}" appears twice on the left — the pairing would be ambiguous.`);
          lefts.add(p.de);
        }
      });
      return;
    }

    if (type === 'dictation') {
      if (typeof step.text !== 'string' || step.text.trim() === '') {
        at(i, 'text', 'Dictation needs the text to speak. With no text there is nothing to hear and no answer to check.');
      }
      return;
    }

    if (type === 'typed') {
      validateTyped(i, step, at);
    }
  });

  return problems;
}

function validateTyped(i: number, step: Record<string, unknown>, at: (i: number, f: string, p: string, found?: string) => void): void {
  const ask = step.ask;
  const prompt = typeof step.prompt === 'string' ? step.prompt : '';
  const answer = typeof step.answer === 'string' ? step.answer.trim() : '';
  const accepted = Array.isArray(step.accepted) ? (step.accepted as unknown[]).filter((a): a is string => typeof a === 'string') : [];

  if (!ASK_VALUES.includes(ask as Ask)) {
    at(i, 'ask', `Unknown question type "${String(ask)}". Expected one of: ${ASK_VALUES.join(', ')}. Do not guess — a wrong \`ask\` renders a wrong instruction.`);
    return;
  }

  if (prompt === '') at(i, 'prompt', 'A typed step needs a prompt.');
  if (answer === '') at(i, 'answer', 'A typed step needs an answer. An exercise with no answer cannot be marked right or wrong.');
  if (!Array.isArray(step.accepted) && step.accepted !== undefined) at(i, 'accepted', '`accepted` must be a list of strings.');

  // ── the rule that would have caught the M15 bug ──
  // `"Ich ___ (haben/sein) gegangen." → "bin (sein)"`: the learner is asked for
  // the auxiliary and the comparison string carries an explanation, so typing the
  // correct `bin` is marked wrong. Silently stripping it at render time is exactly
  // the kind of guess this contract exists to prevent.
  for (const candidate of [answer, ...accepted]) {
    if (TRAILING_EXPLANATION.test(candidate)) {
      at(i, 'answer', 'The answer must not end in a parenthetical — that is an explanation, and a learner who types the correct word alone is then marked wrong. Put it in `note`.', candidate);
    }
  }

  const hasBlank = /_{3,}/.test(prompt);
  const hasInfinitive = /\([^()]{2,}\)/.test(prompt);

  switch (ask) {
    case 'fill-blank':
      if (!hasBlank) {
        at(i, 'prompt', '`ask: "fill-blank"` means the prompt contains `___`. This one has no blank, so the learner is told to fill a gap that is not there.', short(prompt));
      }
      if (hasInfinitive) {
        // Only a REAL alternation needs listing: `(einen/ein)` offers two forms,
        // while `(der Brief)` is a hint naming the noun and `(haben/sein)` names the
        // verb. Flagging every paren here produced twelve false refusals across
        // M16's worksheets, which are mostly `(der Brief) → Ich schreibe ___ Brief.`
        const alternation = /\(([^()]*\/[^()]*|or[^()]*)\)/.exec(prompt)?.[1];
        if (alternation && accepted.length === 0) {
          at(i, 'accepted', `The prompt offers a choice like \`(${alternation})\`. List every option in \`accepted\`, or a correct alternative is marked wrong.`);
        }
      }
      break;

    case 'conjugate':
      if (!hasInfinitive) {
        at(i, 'prompt', '`ask: "conjugate"` means the prompt shows the infinitive in brackets, e.g. "ich (wohnen) in Berlin." Without it the learner is not told which verb to conjugate.', short(prompt));
      }
      break;

    case 'choose-article':
      if (!ARTICLES.has(answer.toLowerCase())) {
        at(i, 'answer', '`ask: "choose-article"` needs `der`, `die` or `das`. Anything else means the question is not an article question.', short(answer));
      }
      if (hasBlank) {
        at(i, 'prompt', 'An article question names the noun; it does not contain a blank. The blank makes the learner look for something that is not the answer.', short(prompt));
      }
      break;

    case 'plural-of':
      if (hasBlank) {
        at(i, 'prompt', 'A plural question names the noun; it does not contain a blank.', short(prompt));
      }
      break;

    case 'translate-de-en':
    case 'translate-en-de':
    case 'translate-ne-de':
      if (hasBlank) {
        at(i, 'prompt', 'A translation prompt is a complete sentence, not a gap.', short(prompt));
      }
      if (answer === prompt) at(i, 'answer', 'A translation whose answer equals its prompt asks for nothing.');
      break;

    case 'correct':
      if (answer === prompt) at(i, 'answer', 'The corrected sentence is identical to the prompt — there is no mistake to find.');
      if (hasBlank) at(i, 'prompt', 'A correction prompt is a whole sentence containing the mistake, not a blank.', short(prompt));
      break;

    case 'short-answer':
      // The catch-all still has to ASK something. A bare label is the defect the
      // whole `ask` field was introduced to prevent.
      if (!ASKS_SOMETHING.test(prompt.trim())) {
        at(i, 'prompt', '`ask: "short-answer"` still needs a prompt that asks something — end it with a question mark or a colon. A bare noun or label tells the learner nothing about what to produce.', short(prompt));
      }
      break;
  }
}

/** Convenience: does this lesson pass the contract? */
export function isValidLesson(steps: unknown, opts: ValidateOptions = {}): boolean {
  return validateLessonSteps(steps, opts).length === 0;
}

/**
 * Advisory findings: real smells that do not break anything.
 *
 * Separated from `validateLessonSteps` because a lesson that renders correctly
 * and merely reads badly should not be REFUSED. Refusing is for defects that
 * reach a learner as a wrong answer, a blank screen, or a crash; these are
 * reported, not enforced.
 *
 * The one that matters in practice is `accepted` repeating the answer, which
 * happened in 75 of the first NotebookLM export's exercises: the guide says
 * "list every option in accepted" and a generator reads that as including the
 * answer. It costs nothing at runtime — `matchesAnswer` compares against
 * `[answer, ...accepted]`, so a duplicate is a redundant comparison — but it is
 * the visible symptom of a rule that was read more literally than it was meant,
 * and it is worth surfacing.
 */
export interface SpecWarning {
  where: string;
  field: string;
  warning: string;
  found?: string;
}

export function warnLessonSteps(steps: unknown, opts: ValidateOptions = {}): SpecWarning[] {
  const warnings: SpecWarning[] = [];
  if (!Array.isArray(steps)) return warnings;

  steps.forEach((raw, i) => {
    const step = raw as Record<string, unknown>;
    const at = (field: string, warning: string, found?: string) =>
      warnings.push({ where: `${opts.id ? `${opts.id} ` : ''}step ${i}`, field, warning, ...(found ? { found } : {}) });

    if (step.type === 'typed' && Array.isArray(step.accepted)) {
      const answer = typeof step.answer === 'string' ? step.answer.trim() : '';
      // Compared with the SAME function the app uses to decide, not a stricter
      // one. An `accepted` of `["Wie heißt du?"]` against an answer of
      // `"Wie heißt du"` is unreachable — the first check caught those, this one
      // did not, and the gap is exactly the set of entries that are pure noise.
      const dupes = (step.accepted as unknown[]).filter(
        (a): a is string => typeof a === 'string' && normaliseAnswer(a) === normaliseAnswer(answer) && normaliseAnswer(answer) !== '',
      );
      if (dupes.length > 0) {
        at('accepted', '`accepted` repeats the answer. List ALTERNATIVES only — the answer is already what is compared against.', answer);
      }
    }

    if (step.type === 'mcq' && Array.isArray(step.options) && step.options.length === 2) {
      at('options', 'A two-option question is a coin flip. Prefer three or four options, or use a `typed` step with an `ask`.');
    }
  });

  return warnings;
}

export { isCheckStep };
