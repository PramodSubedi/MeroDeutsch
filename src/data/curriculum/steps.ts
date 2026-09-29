/**
 * src/data/curriculum/steps.ts
 *
 * THE CONTENT CONTRACT for the step-flow lesson.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * A lesson used to be a document. The content lived in `lessons/mNN.json` as
 * `lexicon` / `grammar` / `practiceBank` blocks, and the page rendered them as
 * headings, tables and `<details>` rows. Every kind of exercise the curriculum
 * authored — fill-in, unscramble, matching, dictation, error correction — was
 * prose, because no renderer took anything but an option list.
 *
 * A step-flow needs the opposite: a sequence of small, individually renderable,
 * individually scorable things. This file is that sequence's vocabulary.
 *
 * ── WHY ONE UNION AND A REGISTRY ─────────────────────────────────────────────
 * Adding a new kind of step is one interface member plus one line in
 * `STEP_TYPES` plus one renderer. Nothing here, on the page, or in the migration
 * needs to change. The alternative — a long if/else in a page — is the pattern
 * `LessonSections.tsx` already replaced with a `SECTION_RENDERERS` registry, and
 * the reason that one worked is worth keeping.
 *
 * `STEP_TYPES` exists so the validator cannot drift from the type, the same
 * reason `CHECKPOINT_SOURCES` exists in `schema.ts`. A union member with no
 * registry entry would be a step the validator silently accepts and no renderer
 * can draw.
 *
 * ── REFERENCE STEPS vs CHECK STEPS ───────────────────────────────────────────
 * The split is load-bearing and it is about scoring, not about difficulty.
 *
 *   · a REFERENCE step teaches and is never scored: objectives, a word, an
 *     explanation, a rule table, a trap, a dialogue.
 *   · a CHECK step asks the learner to PRODUCE something and reports a result:
 *     multiple choice, typed, arrange, match, dictation.
 *
 * `isCheckStep` is the single predicate both the renderer and the completion
 * logic use, so a new step type cannot be added without stating which side of
 * the line it is on.
 *
 * ── WHY `typed` CARRIES SO MANY OF THE AUTHORED KINDS ───────────────────────
 * The authored practice banks span ~15 `kind` strings — Fill-in, V2 Slot,
 * Accusative Shift, Translation DE->EN / EN->DE / NE->DE, Error Correction,
 * Subordinate Contrast — and they are all the same interaction with different
 * framing: "here is something in German, produce the German form". A step type
 * per authored kind would be seven components that differ only in their label.
 * `direction` is the part that actually changes behaviour (which way the
 * translation runs, and whether the input is a repair or a recall), so that is
 * what is a field.
 */
import type {
  DialogueTurn,
  LexiconEntry,
  LocalizedLabel,
  RuleRow,
  Trilingual,
} from './schema';
import type { GrammarFlow } from '../../components/exercises/GrammarFlowchart';

/* ─────────────────────────────────────────────────────────────────────────
 * REFERENCE STEPS — teach, never score.
 * ───────────────────────────────────────────────────────────────────────── */

/** What the learner is about to be able to do. Always the first step. */
export interface IntroStep {
  type: 'intro';
  title?: LocalizedLabel;
  /** Learning objectives. `en` is required; the others are optional mirrorings. */
  objectives: { en: string[]; ne?: string[]; de?: string[] };
  /** How long the run should take, when the document stated it. */
  meta?: string;
}

/**
 * One vocabulary item.
 *
 * A step carries a single `word`, not a batch, because the whole point of the
 * run is that each word is its own moment: hear it, see the example, move on.
 * Grouping them is a `free`-mode layout concern, not a data one.
 */
export interface WordStep {
  type: 'word';
  entry: LexiconEntry;
  /** Set when the learner is expected to PRODUCE this word, not just spot it. */
  active?: boolean;
}

/**
 * Prose teaching, optionally with a data table, an ASCII chart, or rules.
 *
 * `body` is the authoring shape a generator reaches for first — paragraphs of
 * prose, blank-line separated, with `**bold**` and `- ` bullets. It is supported
 * rather than refused because refusing it means the generator keeps writing it
 * and every lesson fails the contract for a field the author did not know about.
 * `notes`/`bullets` remain available for anything that wants the split form.
 */
export interface ExplainStep {
  type: 'explain';
  title: LocalizedLabel;
  /** Prose. `\n\n` separates paragraphs, `- ` marks a bullet, `**x**` is bold. */
  body?: string;
  notes?: Trilingual[];
  table?: { columns: string[]; rows: string[][] };
  /**
   * A monospaced decision chart. Rendered in a scrollable `<pre>` because these
   * are 70+ characters with no break opportunity and would push a phone sideways.
   */
  callout?: string;
  bullets?: string[];
}

/** A compact rule table. Renders through the existing `GrammarRuleTable`. */
export interface RuleTableStep {
  type: 'rule-table';
  title: LocalizedLabel;
  rows: RuleRow[];
}

/** An interactive decision tree. Renders through the existing `GrammarFlowchart`. */
export interface DecisionTreeStep {
  type: 'decision-tree';
  title?: LocalizedLabel;
  flow: GrammarFlow;
}

/** A common mistake: what is wrong, what is right, and why. */
export interface TrapStep {
  type: 'trap';
  wrong?: string;
  right?: string;
  note: Trilingual;
}

/**
 * Cultural context. A note, not an exercise. `title` is optional.
 *
 * `body` accepts a bare string as well as a list. A culture note is usually one
 * or two sentences, and refusing a whole lesson because an author wrote a string
 * where a list of one would do is a rule about types, not about teaching.
 */
export interface CultureStep {
  type: 'culture';
  title?: LocalizedLabel;
  body: string | string[];
}

/**
 * The thing to remember. A callout, not a paragraph.
 *
 * ── WHY THIS IS SEPARATE FROM `trap` ─────────────────────────────────────────
 * A `trap` says "this is wrong, and here is why". A `tip` says "here is the thing
 * to carry away" — a pattern, a contrast pair, a memory hook, a rule of thumb.
 * They read differently and they serve different moments: the trap is a warning
 * you hit, the tip is an anchor you keep. Styling a tip as a trap would present
 * good advice as a mistake.
 *
 * It existed in the authoring guidance as a concept before it existed here, and
 * the corpus shows the cost of that gap: across fifteen lessons there were SIX
 * trap steps and no tips at all, because nothing in the contract asked for one.
 * A contract that only asks for exercises produces lessons that only test.
 */
export interface TipStep {
  type: 'tip';
  title?: LocalizedLabel;
  /** The memory hook. One or two sentences — a tip needing a paragraph is an explanation. */
  body: string;
  /** Optional worked example, rendered under the body. */
  example?: string;
}

/** A scripted dialogue the learner can read aloud, line by line. */
export interface DialogueStep {
  type: 'dialogue';
  title: LocalizedLabel;
  scenario?: LocalizedLabel;
  turns: DialogueTurn[];
  /** Set false to hide per-line EN/NE even outside Nur-DE mode. */
  showTranslations?: boolean;
}

/** The last step: what was covered, and what to do next. */
export interface SummaryStep {
  type: 'summary';
  title?: LocalizedLabel;
  /** Trap indices (into the run's trap steps) to re-show here. */
  recapTraps?: number[];
  /** A tool that reinforces this run, resolved through the module registry. */
  nextToolId?: string;
}

export type ReferenceStep =
  | IntroStep
  | WordStep
  | ExplainStep
  | RuleTableStep
  | DecisionTreeStep
  | TrapStep
  | TipStep
  | CultureStep
  | DialogueStep
  | SummaryStep;

/* ─────────────────────────────────────────────────────────────────────────
 * CHECK STEPS — ask, score, feed the SRS queue.
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * What a `typed` step is actually asking. This is an AUTHORING field, not a
 * presentation one: it decides the instruction the learner reads, and the
 * validator in `lessonSpec.ts` refuses combinations that could not be answered.
 *
 * ── WHY THIS REPLACED A SINGLE `direction` ───────────────────────────────────
 * The first version had `direction: 'recall' | 'repair' | 'de-en' | …` and the
 * migration inferred it from the authored `kind` label. That inference lumped six
 * unrelated question types under `recall`, so all of them rendered the same
 * instruction — "Fill in the blank:" — including:
 *
 *   · `ich (wohnen) in Berlin. → wohne`   — conjugate, and there IS no blank;
 *   · `Bett → das`                         — name the article, and no blank;
 *   · `Bedeutung → Bedeutung`              — define the word, and no blank.
 *
 * Ninety-two of the 334 migrated exercises were unanswerable or misleading as a
 * result, and twenty of those said "fill in the blank" about a prompt with no
 * blank in it. The instruction was wrong because nothing declared what the
 * question was; the renderer had no way to know.
 */
export type Ask =
  /** The prompt contains `___` and the answer is what goes there. */
  | 'fill-blank'
  /** The prompt contains `(infinitive)` and the answer is the conjugated form. */
  | 'conjugate'
  /** The prompt names a noun and the answer is its article. */
  | 'choose-article'
  /** The prompt names a noun and the answer is its plural. */
  | 'plural-of'
  /** German → English. */
  | 'translate-de-en'
  /** English → German. */
  | 'translate-en-de'
  /** Nepali → German. */
  | 'translate-ne-de'
  /** The prompt contains a mistake and the answer is the corrected sentence. */
  | 'correct'
  /** Anything else. The prompt must be a real question. */
  | 'short-answer';

/**
 * A typed answer.
 *
 * `accepted` carries the alternatives a learner may legitimately type. The
 * authored banks write `(einen/ein)` in the prompt, which is a choice, not an
 * answer — comparing against `answer` alone would mark a correct alternative
 * wrong, which is the one thing a language exercise must never do.
 *
 * A trailing parenthetical in `answer` is REJECTED by the validator, not stripped
 * at render time. M15 authors `"Ich ___ (haben/sein) gegangen." → "bin (sein)"`,
 * and stripping it silently is how a correct `bin` ends up marked wrong by a
 * comparison against a string the learner was never asked to produce. The
 * explanation belongs in the field that is shown, not in the field that is
 * compared.
 */
export interface TypedStep {
  type: 'typed';
  ask: Ask;
  prompt: string;
  answer: string;
  /** Other spellings/forms that are also correct. Compared case- and accent-insensitively. */
  accepted?: string[];
  /** Safe to speak BEFORE the answer locks. Never the answer itself. */
  speakPrompt?: string;
  /** Speak only AFTER the answer locks. */
  speakAfter?: string;
  /** Why this is the right answer. Shown after answering; never compared. */
  note?: string;
}

/** Multiple choice. The authored banks' `MCQ` and `Culture MCQ`, plus TeKaMoLo. */
export interface McqStep {
  type: 'mcq';
  prompt: string;
  options: string[];
  answer: string;
  speakPrompt?: string;
  speakAfter?: string;
  /** What the item is testing, for the post-answer hint line. */
  hintReason?: string;
}

/** Reorder tokens into a correct sentence. Renders through `SentenceBuilder`. */
export interface ArrangeStep {
  type: 'arrange';
  prompt: string;
  /** The correct token sequence, in order. */
  tokens: string[];
  /** Decoy tiles that must be left in the tray. */
  distractors?: string[];
  hint?: string;
}

/** Pair German with English/romanisation. Renders through `MatchPairs`. */
export interface MatchStep {
  type: 'match';
  pairs: { id: string; de: string; en: string }[];
  /** Column headings; defaults to Word / Translation. */
  columnLabels?: { left: string; right: string };
}

/** Hear it, type it. Renders through `DictationInput`. */
export interface DictationStep {
  type: 'dictation';
  /** The text the learner must produce. Spoken, and shown after the answer. */
  text: string;
  /** What the learner is being asked to type — shown above the field. */
  instruction?: string;
  itemNoun?: { singular: string; plural: string };
}

export type CheckStep = TypedStep | McqStep | ArrangeStep | MatchStep | DictationStep;

/* ─────────────────────────────────────────────────────────────────────────
 * THE UNIONS
 * ───────────────────────────────────────────────────────────────────────── */

export type Step = ReferenceStep | CheckStep;

/**
 * Every step type, as a runtime list.
 *
 * The validator checks authored steps against THIS, not against a hardcoded
 * list, for the same reason `CHECKPOINT_SOURCES` exists: a union member with no
 * entry here is a step nothing can render, and the failure would otherwise be
 * a blank area on a lesson page rather than a build error.
 */
export const STEP_TYPES = [
  'intro',
  'word',
  'explain',
  'rule-table',
  'decision-tree',
  'trap',
  'tip',
  'culture',
  'dialogue',
  'summary',
  'mcq',
  'typed',
  'arrange',
  'match',
  'dictation',
] as const;

export type StepType = (typeof STEP_TYPES)[number];

/** The single predicate that decides whether a step is scored. */
export function isCheckStep(step: Step): step is CheckStep {
  return (
    step.type === 'mcq' ||
    step.type === 'typed' ||
    step.type === 'arrange' ||
    step.type === 'match' ||
    step.type === 'dictation'
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * THE RUN
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * How a run is navigated.
 *
 *   `linear` — one step at a time with a progress bar and auto-advance. This is
 *              the guided lesson: the whole point is that the learner does not
 *              have to decide what to do next.
 *   `free`   — every step reachable, in order, without a gate. This is what a
 *              grammar reference tab and the premium notes page need: someone
 *              opening *sein* wants to look up a conjugation, not sit a
 *              fifteen-step quiz about it.
 */
export type RunMode = 'linear' | 'free';

export interface Run {
  /** Stable id, e.g. `m07-lesson`. Used for run progress records. */
  id: string;
  title: LocalizedLabel;
  mode: RunMode;
  steps: Step[];
}

/** An empty run, used as the `useSyncExternalStore` snapshot floor. */
export function emptyRun(): Run {
  return { id: 'empty', title: { en: '', de: '' }, mode: 'linear', steps: [] };
}
