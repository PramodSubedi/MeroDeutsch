/**
 * src/data/a1Path.ts
 *
 * A1 curriculum spine configuration for MeroDeutsch.
 *
 * This is a DATA-ONLY module (no React). It wraps the EXISTING lesson routes
 * (/greetings, /numbers, /articles, /calendar, /grammar, /roleplay,
 *  /pronunciation, /dictation, /sentence-builder, /alphabet, /stories,
 *  /rapid-fire) into a LINEAR campaign of BANDS A..F (index 0..5).
 * Band B ("Script & Sound") is a SUPPORT band: it carries no checkpoint, never
 *  gates, and never push-blocks (its nodes are bonus-kind). Gates A/C/D/E/F sit
 *  on the core bands; passing a gate unlocks the NEXT CORE band, skipping B.
 *
 * Design (locked .clinerules + band-reorg decisions):
 *  - Linear spine only. Support/bonus chips never gate the next band.
 *  - Lesson-complete rule = (A) visit counts as complete for learn/practice
 *    nodes. ONLY a checkpoint pass (>=80%) unlocks the next band.
 *  - Gate A has NO alphabet items; Gate E is vocab + listening only (real
 *    loaders, no new roleplay engine).
 *  - Checkpoint item sources are real curriculumService loaders (no mocks).
 *
 * The per-user progress state (`completedNodeIds`, `unlockedUnitIndex`,
 * `checkpointBestByUnit`) lives in `useA1Path`, keyed
 * `meroDeutschA1Path:<userId>` (guest -> `meroDeutschA1Path:guest`).
 */

/** Stable, human-readable identifiers for the four German articles. */
export type Article = 'der' | 'die' | 'das';

export type PathNodeKind = 'learn' | 'practice' | 'checkpoint' | 'bonus';

/**
 * A band is CORE when it carries a checkpoint (gate) that must be passed to
 * unlock the next core band. A SUPPORT band (Band B: alphabet/spelling) is
 * optional — it never gates and never blocks the path.
 */
export type BandKind = 'core' | 'support';

export type WordOrder = 'SVO' | 'SOV' | 'V2';

/** EN/DE label pair (UI copy). Nepali is NOT part of general UI copy. */
export interface LocalizedLabel {
  en: string;
  de: string;
}

/** EN/NE/DE pedagogical bridge content. */
export interface Trilingual {
  en: string;
  ne: string;
  de: string;
}

export interface PathNode {
  /** Stable node id, e.g. `u1-greetings`, `u1-checkpoint`, `u4-stories` */
  id: string;
  unitIndex: number; // 0..4
  kind: PathNodeKind;
  label: LocalizedLabel;
  /** Existing route this node navigates to. Checkpoints use `/checkpoint/:i`. */
  to: string;
  /** True for optional bonus chips that never gate the next unit. */
  bonus?: boolean;
}

/** Question shapes a unit checkpoint can draw from real loaders. */
export type CheckpointSource =
  | 'greeting-translation'
  | 'number-conversion'
  | 'alphabet-letter'
  | 'article-precision'
  | 'grammar-drill'
  | 'calendar-translation'
  | 'vocab-translation'
  | 'vocab-translation-ne'
  | 'listening-gap';

export interface CheckpointSpec {
  type: CheckpointSource;
  /** How many items to pull from this source (>=1). Sum of a unit's specs = item count. */
  count: number;
}

export interface CheckpointConfig {
  /** Stable moduleType surfaced to the review queue. */
  moduleType: 'a1-checkpoint';
  /** Ordered item specs; summed counts produce 10-15 checkpoint items. */
  specs: CheckpointSpec[];
}

/**
 * Pedagogical bridge blocks rendered on a unit's spine card.
 * All bridge text is trilingual (EN/NE/DE); the UI component hides EN/NE when
 * in Nur-DE mode (C1.5).
 */
export interface UnitPedagogy {
  honorifics?: { title: LocalizedLabel; rows: HonorificRow[] };
  grammarComparison?: { title: LocalizedLabel; rows: ComparisonRow[] };
  genderLegend?: LocalizedLabel; // short blurb above the GenderBadge legend
  umlautCallout?: LocalizedLabel; // special chars note (Alphabet)
  suffixNote?: LocalizedLabel; // e.g. -ung/-heit/-keit -> die
}

/** Honoring Du/Sie ↔ तिमी/तपाईं. */
export interface HonorificRow {
  pronoun: Trilingual; // du / तिमी / du , Sie / तपाईं / Sie
  usage: LocalizedLabel; // when to use (EN/DE)
}

export interface ComparisonRow {
  language: Trilingual; // language name
  order: Trilingual; // SVO / SOV / V2 description
  example: Trilingual; // example sentence
}

export interface A1Unit {
  id: string; // 'band-a'
  index: number; // 0..5
  code: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'; // band letter shown on the spine
  kind: BandKind; // 'core' (gates) | 'support' (optional, never gates)
  title: LocalizedLabel;
  theme: LocalizedLabel;
  goal: LocalizedLabel;
  /** Ordered node ids (learn -> practice -> checkpoint). */
  nodeIds: string[];
  pedagogy?: UnitPedagogy;
  /** Optional: only CORE bands carry a checkpoint (gate); SUPPORT bands omit it. */
  checkpoint?: CheckpointConfig;
  /**
   * v0.2.0 — optional unit-vocab theming for checkpoint `vocab-translation`
   * items. Categories are tried in order, then vocabPos as a POS-only pass,
   * and the loader ALWAYS tops up from the general A1 pool — sparse/unknown
   * values can never starve a checkpoint deck. U1–U3 intentionally omit this
   * (their dedicated pools already match the theme).
   */
  vocabCategories?: string[];
  vocabPos?: 'noun' | 'verb' | 'adjective' | 'phrase';
}

/** Index signature so node lookup by id is O(1) and type-safe. */
export interface A1Curriculum {
  units: A1Unit[];
  /** All nodes flattened, in spine order. */
  nodes: PathNode[];
  /** Map id -> node for quick lookup. */
  nodeMap: Record<string, PathNode>;
  /** Flat list of checkpoint nodes, in unit order. */
  checkpoints: PathNode[];
}

function lbl(en: string, de: string): LocalizedLabel {
  return { en, de };
}

function tri(en: string, ne: string, de: string): Trilingual {
  return { en, ne, de };
}

/** Pedagogical bridges — Nepali/English comparative (C2.10). ≤3 rows. */
export const HONORIFICS: HonorificRow[] = [
  {
    pronoun: tri('you (informal)', 'तिमी', 'du'),
    usage: lbl('friends, family, children', 'Freunde, Familie, Kinder'),
  },
  {
    pronoun: tri('you (formal / plural)', 'तपाईं', 'Sie'),
    usage: lbl('strangers, elders, professionals', 'Fremde, Ältere, Profis'),
  },
  {
    pronoun: tri('we', 'हामी', 'wir'),
    usage: lbl('we — informal register', 'wir — informelle Anrede'),
  },
];

/** EN (SVO) vs NE (SOV) vs DE (V2/verb-final) comparative bridge. */
export const WORD_ORDER_PANEL: ComparisonRow[] = [
  {
    language: tri('English', 'नेपाली', 'Deutsch'),
    order: tri('SVO (Subject–Verb–Object)', 'SOV (विषय–वस्तु–क्रिया)', 'SVO (Subjekt–Verb–Objekt)'),
    example: tri('I drink tea.', 'म चिया पिउँछु।', 'Ich trinke Tee.'),
  },
  {
    language: tri('Nepali', 'नेपाली', 'Deutsch'),
    order: tri('SOV', 'SOV (विषय–वस्तु–क्रिया)', 'V2 (Verb 2nd in main; verb-final in sub)'),
    example: tri('I drink tea.', 'म चिया पिउँछु।', 'Ich trinke Tee.'),
  },
  {
    language: tri('German', 'नेपाली', 'Deutsch'),
    order: tri('SVO', 'SOV', 'V2 (Hauptsatz) / verb-final (Nebensatz)'),
    example: tri('I drink tea.', 'म चिया पिउँछु।', 'Ich trinke Tee. (V2 im Hauptsatz)'),
  },
];

// A small helper: build a 3-row panel where each row teaches one language's
// order + example relative to the others. Keeps the table to exactly 3 rows.
export const WORD_ORDER_TABLE: ComparisonRow[] = [
  {
    language: tri('English', 'नेपाली', 'Deutsch'),
    order: tri('SVO', 'SOV', 'V2 (main)'),
    example: tri('I drink tea.', 'म चिया पिउँछु।', 'Ich trinke Tee.'),
  },
  {
    language: tri('Nepali', 'नेपाली', 'Deutsch'),
    order: tri('SVO', 'SOV', 'V2/verb-final'),
    example: tri('I drink tea.', 'म चिया पिउँछु।', 'Ich trinke Tee.'),
  },
  {
    language: tri('German', 'नेपाली', 'Deutsch'),
    order: tri('SVO', 'SOV', 'V2 (Haupt-) / verb-final (Nebensatz)'),
    example: tri('I drink tea.', 'म चिया पिउँछु।', 'Ich trinke Tee. (V2 im Hauptsatz)'),
  },
];

/** Modal / verb-final bridge for Unit 5 (only if content exists). */
export const MODAL_VERB_FINAL_PANEL: ComparisonRow[] = [
  {
    language: tri('English', 'नेपाली', 'Deutsch'),
    order: tri('Subject–Modal–Verb (V2)', 'SOV (विषय–वस्तु–क्रिया)', 'V2 (Haupt-) / Modal am Ende (Nebensatz)'),
    example: tri('I can swim.', 'म तराई गर्न सक्छु।', 'Ich kann schwimmen.'),
  },
  {
    language: tri('Nepali', 'नेपाली', 'Deutsch'),
    order: tri('Subject–Modal–Verb', 'SOV', 'V2 / verb-final'),
    example: tri('I can swim.', 'म तराई गर्न सक्छु।', 'Ich kann schwimmen.'),
  },
  {
    language: tri('German', 'नेपाली', 'Deutsch'),
    order: tri('SVO', 'SOV', 'Modal am Ende im Nebensatz'),
    example: tri('I can swim.', 'म तराई गर्न सक्छु।', 'Ich kann schwimmen. (V2 im Hauptsatz)'),
  },
];

/**
 * The 5-unit A1 campaign.
 *
 * unitIndex derived from this config only — never hardcoded to 0 by consumers.
 * Nodes reference EXISTING routes; checkpoints point at `/checkpoint/:index`.
 */
export const A1_UNITS: A1Unit[] = [
  {
    id: 'band-a',
    index: 0,
    code: 'A',
    kind: 'core',
    title: lbl('First Contact', 'Erster Kontakt'),
    theme: lbl('Greet · Introduce · Numbers', 'Begrüßen · Vorstellen · Zahlen'),
    goal: lbl('Greet people, introduce yourself, and handle signs, prices and numbers', 'Sich begrüßen und vorstellen; Preise, Schilder und Zahlen'),
    // Gate A: contact language ONLY. No alphabet-letter items (decision).
    nodeIds: ['a-greetings', 'a-numbers', 'a-gate'],
    checkpoint: {
      moduleType: 'a1-checkpoint',
      specs: [
        { type: 'greeting-translation', count: 7 },
        { type: 'number-conversion', count: 5 },
      ],
    },
    pedagogy: {
      honorifics: { title: lbl('Du / Sie', 'Du / Sie'), rows: HONORIFICS },
    },
  },
  {
    id: 'band-b',
    index: 1,
    code: 'B',
    kind: 'support',
    title: lbl('Script & Sound', 'Schrift & Klang'),
    theme: lbl('Optional', 'Optional'),
    goal: lbl('Alphabet + spelling of known words — optional side track, never blocks', 'Alphabet + bekannte Wörter buchstabieren — optional, blockiert nichts'),
    // Support band: no checkpoint, no gate. Its nodes are bonus-kind so
    // getPushNode never stops here and no later band is gated by it.
    nodeIds: [],
    pedagogy: {
      umlautCallout: lbl(
        'Umlauts (ä, ö, ü) and ß are separate letters — e.g. Fuß (foot), Über (over). Optional to learn early.',
        'Umlaute (ä, ö, ü) und ß sind eigenständige Buchstaben — z. B. Fuß, Über. Optional zu lernen.'
      ),
    },
  },
{
    id: 'band-c',
    index: 2,
    code: 'C',
    kind: 'core',
    title: lbl('Name the World', 'Die Welt benennen'),
    theme: lbl('Gender · Articles', 'Genus · Artikel'),
    goal: lbl('Name everyday things with der/die/das', 'Alltagsdinge mit der/die/das benennen'),
    nodeIds: ['c-articles', 'c-gate'],
    checkpoint: {
      moduleType: 'a1-checkpoint',
      specs: [
        { type: 'article-precision', count: 8 },
        { type: 'vocab-translation', count: 4 }, // adds meaning (EN/NE) alongside article
      ],
    },
    vocabCategories: ['core', 'food', 'home'],
    pedagogy: {
      genderLegend: lbl(
        'der = masculine, die = feminine, das = neuter, Plural = amber. Gender colors live in theme.ts tokens.',
        'der = maskulin, die = feminin, das = neutral, Plural = orange. Genus-Farben aus theme.ts.'
      ),
      suffixNote: lbl(
        'Tip: -ung, -heit, -keit, -schaft, -e → usually die (feminine).',
        'Tipp: -ung, -heit, -keit, -schaft, -e → meistens die (feminin).'
      ),
    },
  },
  {
    id: 'band-d',
    index: 3,
    code: 'D',
    kind: 'core',
    title: lbl('Time & Routine', 'Zeit & Alltag'),
    theme: lbl('Clock · Verbs · Word order', 'Uhrzeit · Verben · Wortstellung'),
    goal: lbl('Talk about your day: times, routines, and sein/haben', 'Über den Alltag sprechen: Uhrzeit, Routine, sein/haben'),
    nodeIds: ['d-calendar', 'd-grammar', 'd-gate'],
    checkpoint: {
      moduleType: 'a1-checkpoint',
      specs: [
        { type: 'grammar-drill', count: 8 },
        { type: 'calendar-translation', count: 4 },
      ],
    },
    pedagogy: {
      grammarComparison: { title: lbl('Word Order', 'Wortstellung'), rows: WORD_ORDER_TABLE },
    },
  },
  {
    id: 'band-e',
    index: 4,
    code: 'E',
    kind: 'core',
    title: lbl('Situations', 'Situationen'),
    theme: lbl('Food · Place · Directions', 'Essen · Ort · Orientieren'),
    goal: lbl('Apply vocabulary: ordering, directions, real-world chats', 'Wortschatz anwenden: Bestellen, Wege, Alltagssituationen'),
    // Gate E sources = EXISTING vocab + listening loaders only (decision: no new
    // roleplay/dialogue engine). Thin pool → fewer items, never fake content.
    nodeIds: ['e-roleplay', 'e-gate'],
    checkpoint: {
      moduleType: 'a1-checkpoint',
      specs: [
        { type: 'vocab-translation', count: 7 },
        { type: 'vocab-translation-ne', count: 3 },
        { type: 'listening-gap', count: 2 },
      ],
    },
    vocabCategories: ['food', 'travel', 'places', 'directions', 'restaurant', 'core'],
    pedagogy: {
      grammarComparison: {
        title: lbl('Real-world practice', 'Praxis im echten Leben'),
        rows: WORD_ORDER_TABLE,
      },
    },
  },
{
    id: 'band-f',
    index: 5,
    code: 'F',
    kind: 'core',
    title: lbl('Control & Accuracy', 'Präzision & Aussprache'),
    theme: lbl('Modals · Pronunciation · Dictation', 'Modalverben · Aussprache · Diktat'),
    goal: lbl('Say and write accurately; express ability and wants', 'Korrekt sprechen & schreiben; Wünsche und Fähigkeiten'),
    nodeIds: ['f-pron', 'f-dict', 'f-gate'],
    checkpoint: {
      moduleType: 'a1-checkpoint',
      specs: [
        { type: 'vocab-translation', count: 4 },
        { type: 'vocab-translation-ne', count: 2 },
        { type: 'listening-gap', count: 2 },
        { type: 'grammar-drill', count: 4 },
      ],
    },
    vocabCategories: ['verbs', 'phrases', 'routine', 'core'],
    vocabPos: 'verb',
    pedagogy: {
      grammarComparison: { title: lbl('Modals & Word', 'Modalverben & Wortstellung'), rows: MODAL_VERB_FINAL_PANEL },
    },
  },
];

/**
 * Core learning nodes (learn/practice/checkpoint) in spine order. Bonus/support
 * nodes are excluded here — so getPushNode never stops on optional content and
 * Band B (support) never blocks the campaign.
 */
export const A1_LEARN_NODES: PathNode[] = [
  // Band A — Gate A (contact language only; no alphabet items)
  { id: 'a-greetings', unitIndex: 0, kind: 'learn', label: lbl('Greetings', 'Grüße'), to: '/greetings' },
  { id: 'a-numbers', unitIndex: 0, kind: 'learn', label: lbl('Numbers', 'Zahlen'), to: '/numbers' },
  { id: 'a-gate', unitIndex: 0, kind: 'checkpoint', label: lbl('Gate A', 'Pforte A'), to: '/checkpoint/0' },
  // Band C — Gate C (name the world)
  { id: 'c-articles', unitIndex: 2, kind: 'learn', label: lbl('Articles', 'Artikel'), to: '/articles' },
  { id: 'c-gate', unitIndex: 2, kind: 'checkpoint', label: lbl('Gate C', 'Pforte C'), to: '/checkpoint/2' },
  // Band D — Gate D (time & routine)
  { id: 'd-calendar', unitIndex: 3, kind: 'learn', label: lbl('Calendar & Time', 'Kalender & Uhrzeit'), to: '/calendar' },
  { id: 'd-grammar', unitIndex: 3, kind: 'learn', label: lbl('Grammar', 'Grammatik'), to: '/grammar' },
  { id: 'd-gate', unitIndex: 3, kind: 'checkpoint', label: lbl('Gate D', 'Pforte D'), to: '/checkpoint/3' },
  // Band E — Gate E (situations / vocab + listening only)
  { id: 'e-roleplay', unitIndex: 4, kind: 'learn', label: lbl('Roleplay', 'Rollenspiel'), to: '/roleplay' },
  { id: 'e-gate', unitIndex: 4, kind: 'checkpoint', label: lbl('Gate E', 'Pforte E'), to: '/checkpoint/4' },
  // Band F — Gate F (control & accuracy)
  { id: 'f-pron', unitIndex: 5, kind: 'learn', label: lbl('Pronunciation', 'Aussprache'), to: '/pronunciation' },
  { id: 'f-dict', unitIndex: 5, kind: 'practice', label: lbl('Dictation', 'Diktat'), to: '/dictation' },
  { id: 'f-gate', unitIndex: 5, kind: 'checkpoint', label: lbl('Gate F', 'Pforte F'), to: '/checkpoint/5' },
];

/** Bonus + support nodes — optional, never gate, never push-lock. */
export const A1_BONUS_NODES: PathNode[] = [
  { id: 'a-numbers-practice', unitIndex: 0, kind: 'bonus', label: lbl('Number Minigame', 'Zahlen-Minispiel'), to: '/rapid-blitz?mode=number-conversion', bonus: true },
  // Band B (support row) — alphabet/spelling live here as a visible optional chip.
  { id: 'b-alphabet', unitIndex: 1, kind: 'bonus', label: lbl('Alphabet & Spelling', 'Alphabet & Buchstabieren'), to: '/alphabet', bonus: true },
  { id: 'c-sentence', unitIndex: 2, kind: 'bonus', label: lbl('Sentence Builder', 'Satzbau'), to: '/sentence-builder', bonus: true },
  { id: 'd-time-practice', unitIndex: 3, kind: 'bonus', label: lbl('Time Practice', 'Uhrzeit-Üben'), to: '/rapid-blitz?mode=calendar-translation', bonus: true },
  { id: 'd-numbers-full', unitIndex: 3, kind: 'bonus', label: lbl('All Numbers', 'Alle Zahlen'), to: '/rapid-blitz?mode=number-conversion', bonus: true },
  { id: 'e-stories', unitIndex: 4, kind: 'bonus', label: lbl('Stories', 'Geschichten'), to: '/stories', bonus: true },
  { id: 'e-vocab-drill', unitIndex: 4, kind: 'bonus', label: lbl('Vocab Drill', 'Wortschatz-Drill'), to: '/rapid-blitz?mode=vocabulary-translation', bonus: true },
  { id: 'f-modals', unitIndex: 5, kind: 'bonus', label: lbl('Modal Drills', 'Modalverben'), to: '/grammar?tab=modals', bonus: true },
  { id: 'f-blitz', unitIndex: 5, kind: 'bonus', label: lbl('Blitz Mixed', 'Mixed-Quiz'), to: '/rapid-fire', bonus: true },
  // NotebookLM workbook mechanics — bonus chips only (never gate, never push-lock).
  { id: 'a-cypher', unitIndex: 0, kind: 'bonus', label: lbl('Number Code Cracker', 'Zahlen-Code knacken'), to: '/games?game=cypher', bonus: true },
  { id: 'a-oddone', unitIndex: 0, kind: 'bonus', label: lbl('Phonetic Trap Game', 'Phonetik-Rätsel'), to: '/games?game=oddoneout', bonus: true },
  { id: 'd-separable', unitIndex: 3, kind: 'bonus', label: lbl('Separable Verbs', 'Trennbare Verben'), to: '/sentence-builder?focus=separable', bonus: true },
  { id: 'd-dice', unitIndex: 3, kind: 'bonus', label: lbl('Verb Dice', 'Verben-Würfelspiel'), to: '/games?game=dice', bonus: true },
  { id: 'f-tictactoe', unitIndex: 5, kind: 'bonus', label: lbl('Conjugation Tic-Tac-Toe', 'Konjugations-Spiel'), to: '/games?game=tictactoe', bonus: true },
  { id: 'f-email', unitIndex: 5, kind: 'bonus', label: lbl('Email Builder', 'E-Mail-Trainer'), to: '/email-builder', bonus: true },
];

function buildCurriculum(): A1Curriculum {
  const nodes: PathNode[] = [...A1_LEARN_NODES, ...A1_BONUS_NODES];
  const nodeMap: Record<string, PathNode> = {};
  for (const n of nodes) {
    nodeMap[n.id] = n;
  }
  const checkpoints = A1_LEARN_NODES.filter((n) => n.kind === 'checkpoint');
  // Ensure each unit's nodeIds resolve to a node.
  for (const unit of A1_UNITS) {
    for (const id of unit.nodeIds) {
      if (!nodeMap[id]) {
        // Missing node — omit silently rather than invent a route.
        // eslint-disable-next-line no-console
        console.warn(`[a1Path] unit ${unit.id} references unknown node ${id}`);
      }
    }
  }
  return { units: A1_UNITS, nodes, nodeMap, checkpoints };
}

export const A1_CURRICULUM: A1Curriculum = buildCurriculum();

export const A1_UNIT_COUNT = A1_UNITS.length;

/**
 * The first unit index the checkpoint service maps to (always 0).
 * Consumers must derive unitIndex from the config, never hardcode 0.
 */
export const FIRST_UNIT_INDEX = 0;

/**
 * Checkpoint pass threshold (locked: >=80%, not 100%, no cooldown).
 */
export const CHECKPOINT_PASS_THRESHOLD = 0.8;

/**
 * Default number of checkpoint items to draw (10-15). The actual count is the
 * sum of a unit's CheckpointSpec counts (each 3-8).
 */
export const DEFAULT_CHECKPOINT_ITEM_COUNT = 12;

/**
 * Resolve a checkpoint node for a given unitIndex. Used by the spine and Home
 * Push to navigate to the right /checkpoint/:i route.
 */
export function getCheckpointNode(unitIndex: number): PathNode | undefined {
  const safe = Math.max(0, Math.min(unitIndex, A1_UNIT_COUNT - 1));
  return A1_CURRICULUM.units[safe]?.nodeIds
    .map((id) => A1_CURRICULUM.nodeMap[id])
    .find((n) => n.kind === 'checkpoint');
}

/** Find the learn/practice node whose route matches a pathname (for visit-based completion). */
export function getNodeByRoute(pathname: string): PathNode | undefined {
  return A1_CURRICULUM.nodes.find((n) => n.kind !== 'checkpoint' && pathname === n.to);
}

/**
 * The band index that is unlocked next after passing the checkpoint at
 * `currentUnitIndex`. Only CORE bands advance the path — SUPPORT bands (B) are
 * skipped, so passing Gate A (0) unlocks Band C (2) directly (skip-b).
 * Returns the last band when nothing lies ahead.
 */
export function getNextGatedBandIndex(currentUnitIndex: number): number {
  for (let i = currentUnitIndex + 1; i < A1_UNIT_COUNT; i++) {
    const band = A1_UNITS[i];
    if (band && band.kind === 'core') return i;
  }
  return Math.max(0, A1_UNIT_COUNT - 1);
}

/**
 * One-time remap for users holding OLD 5-unit progress (index 0..4) -> new band
 * index. Band B is support and never produced, so old unit 1 (Core) lands on
 * Band C (2):
 *   old 0 (U1 First Steps)  -> A (0)
 *   old 1 (U2 Core)         -> C (2)
 *   old 2 (U3 Action)       -> D (3)
 *   old 3 (U4 Navigation)   -> E (4)
 *   old 4 (U5 Expression)   -> F (5)
 */
export const LEGACY_TO_BAND_INDEX: readonly number[] = [0, 2, 3, 4, 5];

export function remapLegacyUnitIndex(oldIndex: number): number {
  const i = Math.max(0, Math.min(oldIndex, LEGACY_TO_BAND_INDEX.length - 1));
  return LEGACY_TO_BAND_INDEX[i] ?? 0;
}

/**
 * Marker injected into `completedNodeIds` exactly once during migration so the
 * remap is idempotent (never re-runs on a later hydrate). It is not a real
 * node id; path lookups ignore unknown ids.
 */
export const BAND_MIGRATION_MARKER = 'a1-path-bands-v2';

/** True when an id belongs to the OLD `u1-..u5` node scheme. */
export function isLegacyPathNodeId(id: string): boolean {
  return /^u[1-5]-/.test(id);
}

/** True when an id belongs to the NEW `a-..f-` band scheme (or the migration marker). */
export function isBandNodeId(id: string): boolean {
  return /^[a-f]-/.test(id) || id === BAND_MIGRATION_MARKER;
}
