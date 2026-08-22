/**
 * src/data/a1Path.ts
 *
 * A1 curriculum spine configuration for MeroDeutsch.
 *
 * This is a DATA-ONLY module (no React). It wraps the EXISTING lesson routes
 * (/greetings, /alphabet, /numbers, /articles, /calendar, /grammar,
 *  /roleplay, /stories, /rapid-fire, /pronunciation) into a LINEAR campaign of
 * 5 units (index 0..4). No new lesson pages are invented; if a route is missing
 * a node is simply omitted (see U4/U5 docs).
 *
 * Design (locked decisions from .clinerules):
 *  - Linear spine only. Bonus chips never gate the next unit.
 *  - Lesson-complete rule = (A) visit counts as complete for learn/practice
 *    nodes. ONLY a checkpoint pass (>=80%) unlocks the next unit.
 *  - Checkpoint item sources are real curriculumService loaders (no mocks).
 *
 * The per-user progress state (`completedNodeIds`, `unlockedUnitIndex`,
 * `checkpointBestByUnit`) lives in `useA1Path`, keyed
 * `meroDeutschA1Path:<userId>` (guest -> `meroDeutschA1Path:guest`).
 */

/** Stable, human-readable identifiers for the four German articles. */
export type Article = 'der' | 'die' | 'das';

export type PathNodeKind = 'learn' | 'practice' | 'checkpoint' | 'bonus';

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
  | 'vocab-translation';

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
  id: string; // 'unit-1'
  index: number; // 0..4
  title: LocalizedLabel;
  theme: LocalizedLabel;
  goal: LocalizedLabel;
  /** Ordered node ids (learn -> practice -> checkpoint). */
  nodeIds: string[];
  pedagogy?: UnitPedagogy;
  checkpoint: CheckpointConfig;
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
    id: 'unit-1',
    index: 0,
    title: lbl('Unit 1 — First Steps', 'Einheit 1 — Erste Schritte'),
    theme: lbl('Ice & sound', 'Eis & Klang'),
    goal: lbl('Introduce self; signs & prices', 'Sich vorstellen; Preise & Schilder'),
    nodeIds: ['u1-greetings', 'u1-alphabet', 'u1-numbers', 'u1-checkpoint'],
    checkpoint: {
      moduleType: 'a1-checkpoint',
      specs: [
        { type: 'greeting-translation', count: 6 },
        { type: 'number-conversion', count: 4 },
        { type: 'alphabet-letter', count: 3 },
      ],
    },
    pedagogy: {
      honorifics: { title: lbl('Du / Sie', 'Du / Sie'), rows: HONORIFICS },
      umlautCallout: lbl(
        'Umlauts (ä, ö, ü) and ß are separate letters — e.g. Fuß (foot), Über (over).',
        'Umlaute (ä, ö, ü) und ß sind eigenständige Buchstaben — z. B. Fuß, Über.'
      ),
    },
  },
  {
    id: 'unit-2',
    index: 1,
    title: lbl('Unit 2 — The Core', 'Einheit 2 — Der Kern'),
    theme: lbl('Gender', 'Genus'),
    goal: lbl('Objects + correct article', 'Objekte + richtiger Artikel'),
    nodeIds: ['u2-articles', 'u2-checkpoint'],
    checkpoint: {
      moduleType: 'a1-checkpoint',
      specs: [{ type: 'article-precision', count: 12 }],
    },
    pedagogy: {
      genderLegend: lbl(
        'der = masculine, die = feminine, das = neuter, Plural = amber. Color tokens live in theme.ts.',
        'der = maskulin, die = feminin, das = neutral, Plural = orange. Farben aus theme.ts.'
      ),
      suffixNote: lbl(
        'Tip: -ung, -heit, -keit, -schaft, -e → usually die (feminine).',
        'Tipp: -ung, -heit, -keit, -schaft, -e → meistens die (feminin).'
      ),
    },
  },
  {
    id: 'unit-3',
    index: 2,
    title: lbl('Unit 3 — Action', 'Einheit 3 — Aktion'),
    theme: lbl('Routine & time', 'Routine & Zeit'),
    goal: lbl('Simple routine + telling time', 'Einfache Routine + Uhrzeit'),
    nodeIds: ['u3-calendar', 'u3-grammar', 'u3-checkpoint'],
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
    id: 'unit-4',
    index: 3,
    title: lbl('Unit 4 — Navigation', 'Einheit 4 — Orientierung'),
    theme: lbl('Place & food', 'Ort & Essen'),
    goal: lbl('Directions, ordering café food', 'Wegbeschreibungen, Café-bestellung'),
    // `/roleplay` exists; `/stories` exists (bonus — never gates the next unit).
    nodeIds: ['u4-roleplay', 'u4-stories', 'u4-checkpoint'],
    checkpoint: {
      moduleType: 'a1-checkpoint',
      specs: [{ type: 'vocab-translation', count: 12 }],
    },
    pedagogy: {
      grammarComparison: {
        title: lbl('Real-world practice', 'Praxis im echten Leben'),
        rows: WORD_ORDER_TABLE,
      },
    },
  },
  {
    id: 'unit-5',
    index: 4,
    title: lbl('Unit 5 — Expression', 'Einheit 5 — Ausdruck'),
    theme: lbl('Want & can', 'Können & Mögen'),
    goal: lbl('Express ability & wants', 'Fähigkeit & Wünsche ausdrücken'),
    // Blitz-as-practice (existing) + bonus pronunciation. Both never gate.
    nodeIds: ['u5-blitz', 'u5-pronunciation', 'u5-checkpoint'],
    checkpoint: {
      moduleType: 'a1-checkpoint',
      specs: [
        { type: 'grammar-drill', count: 6 },
        { type: 'vocab-translation', count: 6 },
      ],
    },
    pedagogy: {
      grammarComparison: { title: lbl('Modals & verb-final', 'Modalverben & Verb Position'), rows: MODAL_VERB_FINAL_PANEL },
    },
  },
];

/** All learning nodes (learn/practice/checkpoint) in spine order — bonus excluded from "incomplete" tracking. */
export const A1_LEARN_NODES: PathNode[] = [
  // U1
  { id: 'u1-greetings', unitIndex: 0, kind: 'learn', label: lbl('Greetings', 'Grüße'), to: '/greetings' },
  { id: 'u1-alphabet', unitIndex: 0, kind: 'learn', label: lbl('Alphabet', 'Alphabet'), to: '/alphabet' },
  { id: 'u1-numbers', unitIndex: 0, kind: 'learn', label: lbl('Numbers', 'Zahlen'), to: '/numbers' },
  { id: 'u1-checkpoint', unitIndex: 0, kind: 'checkpoint', label: lbl('Checkpoint 1', 'Puffer 1'), to: '/checkpoint/0' },
  // U2
  { id: 'u2-articles', unitIndex: 1, kind: 'learn', label: lbl('Articles', 'Artikel'), to: '/articles' },
  { id: 'u2-checkpoint', unitIndex: 1, kind: 'checkpoint', label: lbl('Checkpoint 2', 'Puffer 2'), to: '/checkpoint/1' },
  // U3
  { id: 'u3-calendar', unitIndex: 2, kind: 'learn', label: lbl('Calendar', 'Kalender'), to: '/calendar' },
  { id: 'u3-grammar', unitIndex: 2, kind: 'learn', label: lbl('Grammar', 'Grammatik'), to: '/grammar' },
  { id: 'u3-checkpoint', unitIndex: 2, kind: 'checkpoint', label: lbl('Checkpoint 3', 'Puffer 3'), to: '/checkpoint/2' },
  // U4
  { id: 'u4-roleplay', unitIndex: 3, kind: 'learn', label: lbl('Roleplay', 'Rollenspiel'), to: '/roleplay' },
  { id: 'u4-checkpoint', unitIndex: 3, kind: 'checkpoint', label: lbl('Checkpoint 4', 'Puffer 4'), to: '/checkpoint/3' },
  // U5
  { id: 'u5-blitz', unitIndex: 4, kind: 'practice', label: lbl('Blitz practice', 'Blitz-Übung'), to: '/rapid-fire' },
  { id: 'u5-checkpoint', unitIndex: 4, kind: 'checkpoint', label: lbl('Checkpoint 5', 'Puffer 5'), to: '/checkpoint/4' },
];

/** Bonus chips — optional, never gates the next unit. */
export const A1_BONUS_NODES: PathNode[] = [
  { id: 'u2-sentence', unitIndex: 1, kind: 'bonus', label: lbl('Sentence Builder', 'Satzbau'), to: '/sentence-builder', bonus: true },
  { id: 'u4-stories', unitIndex: 3, kind: 'bonus', label: lbl('Stories', 'Geschichten'), to: '/stories', bonus: true },
  { id: 'u5-pronunciation', unitIndex: 4, kind: 'bonus', label: lbl('Pronunciation', 'Aussprache'), to: '/pronunciation', bonus: true },
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
