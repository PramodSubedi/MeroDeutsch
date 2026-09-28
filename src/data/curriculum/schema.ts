/**
 * src/data/curriculum/schema.ts
 *
 * THE CONTENT CONTRACT for the A1 campaign.
 *
 * WHY THIS EXISTS
 * `src/data/a1Path.ts` used to hold ~750 lines of inline content (unit metadata,
 * node lists, pedagogy tables) mixed into TypeScript. Editing a lesson line
 * meant editing code, and adding a lesson meant editing three places that could
 * silently drift apart (the node array, the unit's `nodeIds`, the bonus chips).
 * Content now lives in `./units/*.json`, is checked by this file's validator,
 * and `../a1Path.ts` has become a thin DERIVATION LAYER over it — so every one
 * of its exports keeps working unchanged for the 25 modules that import it.
 *
 * ADD / EDIT / REMOVE CONTENT
 *   · edit a lesson text, route, table row  -> edit the unit JSON, re-export
 *   · add a lesson                          -> add a node object to `nodes[]`
 *   · remove a lesson                       -> delete the node object
 *   · add / remove / reorder a unit         -> add or delete a units/*.json file
 *                                              and set `order`
 * Nothing in this file needs to change for any of those.
 *
 * IDs ARE PERMANENT
 * `completedNodeIds` in learner progress references node ids, and unit ids key
 * the path state. Renaming an `mNN` unit id or a node id is a DATA MIGRATION
 * (the same pattern as `LEGACY_TO_BAND_INDEX` / `BAND_TO_MODULE_INDEX` in
 * `../a1Path.ts`). Labels, routes, sections, specs and pedagogy are free to
 * edit at any time.
 *
 * P0 SCOPE: types + validation only. `PathNode.sections` and `PathNode.teaches`
 * are new OPTIONAL fields reserved for the lesson-section renderer (P2); they
 * are absent from the current data and cost nothing until used.
 */

/** Stable, human-readable identifiers for the four German articles. */
export type Article = 'der' | 'die' | 'das';

/**
 * How the learner wants to move through the 15 modules.
 *   `guided` — the spine gates: a module unlocks when the previous checkpoint is
 *              passed (>=80%). DEFAULT.
 *   `self`   — every module is open; the spine still suggests an order and still
 *              scores checkpoints, but nothing is enforced.
 * Progress is never revoked by either mode.
 */
export type PathMode = 'guided' | 'self';

export type PathNodeKind = 'learn' | 'practice' | 'checkpoint' | 'bonus';

/**
 * A band is CORE when it carries a checkpoint (gate) that must be passed to
 * unlock the next core band. A SUPPORT band is optional — it never gates.
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

/**
 * Question shapes a unit checkpoint can draw from real loaders.
 * A source is only usable when `A1CheckpointPage.buildQuestions()` has a case
 * for it; adding a source is therefore a two-part change (this union + the
 * builder case), while changing how MANY items a unit draws is data-only.
 */
export type CheckpointSource =
  | 'greeting-translation'
  | 'number-conversion'
  | 'alphabet-letter'
  | 'article-precision'
  | 'grammar-drill'
  | 'calendar-translation'
  | 'vocab-translation'
  | 'vocab-translation-ne'
  /**
   * ⚠️ STILL CURRENTLY UNUSABLE — no unit may declare it (enforced in `validateCurriculum`).
   *
   * The builder draws these from `vocabulary.filter(v => v.audioUrl)`. The
   * plumbing that used to drop that field is now FIXED:
   *   - migration 20260930170000 adds `audio_url` to the `vocabulary` table;
   *   - `rowToVocabCard` / `cardToLegacyEntry` and
   *     `localCurriculumService.getVocabularyByCategories` all forward it.
   *
   * The source is still gated because the COLUMN is empty: `npm run backfill-audio`
   * has to run against the live project before any pool exists. `npm run check:audio`
   * prints the per-tag coverage table that decides it.
   *
   * TO REVIVE:
   *   1. Apply 20260930170000_vocabulary_audio_url.sql.
   *   2. `npm run backfill-audio` (idempotent; --dry-run first).
   *   3. `npm run check:audio` and confirm a REAL category the unit declares
   *      shows non-zero coverage. As of the last run NO topical category did —
   *      the audio-bearing cards are the Anki-sourced ones, whose tags are
   *      structural ('A1', 'noun'), while the topical categories
   *      ('unit3-adjectives', 'dative-prepositions', …) sit on curriculum rows
   *      that are mostly outside the Goethe A1 list.
   *   4. Only then remove the member from UNUSABLE_CHECKPOINT_SOURCES below and
   *      add it to a unit's `checkpoint.specs`.
   *
   * Declaring it before step 3 re-creates the original defect: the pool is
   * empty, the source contributes ZERO items, and the unit's deck is silently
   * SHORTER than its declared count. That is what shipped M03 and M14 as 6- and
   * 8-item decks when every other unit rendered 12.
   */
  | 'listening-gap'
  /**
   * Whole-sentence WORD ORDER. Reads the `wordOrder` drill pool, whose options
   * are complete sentences in different orders, so the learner picks the
   * grammatical arrangement rather than a single missing word.
   *
   * Deliberately MCQ rather than a drag-and-drop builder: the checkpoint
   * session engine renders `options` + `correctAnswer`, and a second exercise
   * mode inside a timed, gated, SRS-scored round is a much larger change than
   * the gap it closes. It tests ordering, which the single-blank `v2` drills
   * cannot.
   */
  | 'word-order';

/** Runtime list of the sources above, so the validator never drifts from the type. */
export const CHECKPOINT_SOURCES: readonly CheckpointSource[] = [
  'greeting-translation',
  'number-conversion',
  'alphabet-letter',
  'article-precision',
  'grammar-drill',
  'calendar-translation',
  'vocab-translation',
  'vocab-translation-ne',
  'listening-gap',
  'word-order',
];

/**
 * Sources that are wired up in the builder but CANNOT currently produce items,
 * so declaring one silently shortens a unit's deck instead of failing.
 *
 * Kept as an explicit deny-list rather than deleting the source: the builder
 * case and the `CheckpointSource` member stay, so reviving the source is a data
 * + loader change rather than a re-plumbing of the curriculum schema.
 *
 * See the `listening-gap` doc comment for the full root cause.
 */
export const UNUSABLE_CHECKPOINT_SOURCES: ReadonlySet<CheckpointSource> = new Set<CheckpointSource>([
  'listening-gap',
]);

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

/** One row of a module's grammar rule table (um/am/im, der→den, …). */
export interface RuleRow {
  label: LocalizedLabel; // the form itself, e.g. "um" / "den"
  usage: LocalizedLabel; // when to use it
  example: LocalizedLabel; // worked example
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

/**
 * Pedagogical bridge blocks rendered on a unit's spine card.
 * All bridge text is trilingual (EN/NE/DE); the UI hides EN/NE in Nur-DE mode.
 */
export interface UnitPedagogy {
  honorifics?: { title: LocalizedLabel; rows: HonorificRow[] };
  grammarComparison?: { title: LocalizedLabel; rows: ComparisonRow[] };
  genderLegend?: LocalizedLabel; // short blurb above the GenderBadge legend
  umlautCallout?: LocalizedLabel; // special chars note (Alphabet)
  suffixNote?: LocalizedLabel; // e.g. -ung/-heit/-keit -> die
  /** One short teaching line for the module's grammar mechanics. EN/DE only. */
  grammarNote?: LocalizedLabel;
  /** A compact rule table (e.g. um/am/im, der→den). */
  ruleTable?: { title: LocalizedLabel; rows: RuleRow[] };
}

/**
 * One of the 5 GCSE Topic Area groupings that visually group the 15 units.
 * `index` is the value units reference via their `cluster` field.
 */
export interface Cluster {
  index: number;
  code: string; // 'C1'..'C5'
  title: LocalizedLabel;
  topicArea: LocalizedLabel;
}

/** A resolved spine node: what the UI and the progress hooks consume. */
export interface PathNode {
  /** Stable node id, e.g. `m01-greetings`, `m04-gate`. NEVER rename. */
  id: string;
  /** 0-based unit index — DERIVED from the owning unit's `order`. */
  unitIndex: number;
  kind: PathNodeKind;
  label: LocalizedLabel;
  /** Existing route this node navigates to. Checkpoints use `/checkpoint/:index`. */
  to: string;
  /** True for optional bonus chips that never gate the next unit. */
  bonus?: boolean;
  /** P2: inline lesson blocks rendered by the section registry. */
  sections?: LessonSection[];
  /** P2: marks a content lesson (as opposed to a practice drill). */
  teaches?: boolean;
}

export interface A1Unit {
  id: string; // 'm01'
  /** 0-based position — DERIVED from `order`. */
  index: number;
  code: string; // 'M01'..'M15' shown on the spine
  kind: BandKind;
  /** Cluster index (0..4) — the 5 GCSE Topic Area groupings. */
  cluster: number;
  title: LocalizedLabel;
  theme: LocalizedLabel;
  goal: LocalizedLabel;
  /** Ordered node ids (learn -> practice -> checkpoint) — DERIVED from `nodes`. */
  nodeIds: string[];
  pedagogy?: UnitPedagogy;
  /** Every core module carries a checkpoint (gate) that unlocks the next module. */
  checkpoint?: CheckpointConfig;
  /** Unit-vocab theming for checkpoint `vocab-translation` items. */
  vocabCategories?: string[];
  vocabPos?: 'noun' | 'verb' | 'adjective' | 'phrase';
  /** Grammar drill categories for this module's checkpoint `grammar-drill` items. */
  grammarCategories?: string[];
  /**
   * True when a lesson file exists for this unit (`curriculum/lessons/mNN.json`).
   *
   * The spine deliberately does NOT carry the lesson content itself: the spine is
   * needed on every page, the lesson is only read on /lesson/:index, so keeping
   * them apart code-splits ~300 KB of document material out of the main bundle.
   * Load it with `loadLesson(unit.id)` from `./curriculum/lessons`.
   */
  hasLesson?: boolean;
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

/* ─────────────────────────────────────────────────────────────────────────
 * CONTENT FILE SHAPES — what a `units/mNN.json` file contains.
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * One "common trap" (Fettnäpfchen) entry.
 *
 * `wrong` / `right` are optional: several documented traps are pure warnings
 * (e.g. "Das ist mein Freund" implies boyfriend) with no corrected sentence.
 */
export interface TrapItem {
  /** The wrong sentence as learners actually write it. */
  wrong?: string;
  /** The corrected sentence. */
  right?: string;
  note: Trilingual;
}

/* ─────────────────────────────────────────────────────────────────────────
 * LESSON CONTENT — the document material rendered by the lesson page.
 *
 * This is the shape the NotebookLM curriculum documents map onto. It is
 * authoring data only: the spine ignores it, so a unit can carry a full lesson
 * without any node, route or checkpoint changing.
 * ───────────────────────────────────────────────────────────────────────── */

/** One vocabulary row from a unit's trilingual lexicon. */
export interface LexiconEntry {
  /** Lemma as taught (e.g. "Familie"). Corrections for typos live in the importer. */
  word: string;
  /** German article. `plural` for plural-only nouns; absent for non-nouns. */
  article?: 'der' | 'die' | 'das' | 'plural';
  plural?: string;
  ipa?: string;
  en: string;
  ne: string;
  /** Documents mark words learners produce (active) vs only recognise (passive). */
  frequency?: 'active' | 'passive';
  partOfSpeech?: string;
  examples?: { de: string; en: string; ne: string }[];
}

/** A grammar teaching block: prose, a rule table, or a decision flowchart. */
export interface GrammarBlock {
  title: LocalizedLabel;
  /** One or more teaching paragraphs, already stripped of markdown. */
  notes?: Trilingual[];
  /** An optional data table (e.g. the possessive matrix, kein vs. nicht). */
  table?: { columns: string[]; rows: string[][] };
  /** A monospaced decision chart / formula (e.g. the kein-nicht flowchart). */
  callout?: string;
  /** Bullet rules that are not a table. */
  bullets?: string[];
}

/** One line of a scripted dialogue. */
export interface DialogueTurn {
  speaker: string;
  de: string;
  en?: string;
  ne?: string;
}

export interface DialogueScript {
  id: string;
  title: LocalizedLabel;
  scenario?: LocalizedLabel;
  turns: DialogueTurn[];
}

/** One question from a unit's practice bank / self-assessment drills. */
export interface PracticeItem {
  /** e.g. 'MCQ', 'Fill-in', 'Translation', 'Culture', 'Error correction'. */
  kind: string;
  prompt: string;
  answer?: string;
  options?: string[];
}

/** The document-specified interactive component, kept as data. */
export interface MiniGameSpec {
  type: string;
  id: string;
  /**
   * Human-readable name for the exercise. This is the ONLY prose
   * `MiniGameCard` can show — the payload is never rendered — so without it the
   * card on every lesson read as a bare technical slug. Accepts a plain string
   * or a localised label; `MiniGameCard` falls back across EN/DE either way.
   */
  title?: string | LocalizedLabel;
  /** The document's own JSON payload, verbatim. */
  payload: unknown;
}

export interface UnitLessonContent {
  /** Learning objectives, one line per language where the document gave one. */
  objectives?: { en: string[]; ne?: string[]; de?: string[] };
  cefr?: string;
  /** The document's stated route, e.g. '/vocab'. */
  docRoute?: string;
  /** The trilingual lexicon. Documents use 40 rows; unit files use fewer. */
  lexicon?: LexiconEntry[];
  grammar?: GrammarBlock[];
  traps?: TrapItem[];
  culture?: { title: LocalizedLabel; body: string[] };
  dialogue?: DialogueScript;
  practiceBank?: PracticeItem[];
  miniGame?: MiniGameSpec;
}


/**
 * A lesson block. P2 renders these through a section registry; a new BLOCK TYPE
 * is the only content change that needs code (1 component + 1 registry entry).
 */
export type LessonSection =
  | { type: 'objectives'; title?: LocalizedLabel; items: { en?: string[]; ne?: string[]; de?: string[] } }
  | { type: 'lexicon'; title?: LocalizedLabel; limit?: number; nounsOnly?: boolean }
  | { type: 'grammar-note'; title?: LocalizedLabel; text: Trilingual }
  | { type: 'rule-table'; title: LocalizedLabel; rows: RuleRow[] }
  | { type: 'comparison-table'; title: LocalizedLabel; rows: ComparisonRow[] }
  | { type: 'honorifics'; title: LocalizedLabel; rows: HonorificRow[] }
  | { type: 'traps'; title?: LocalizedLabel; items: TrapItem[] }
  | { type: 'culture'; title: LocalizedLabel; body: Trilingual }
  | { type: 'dialogue'; dialogueId: string }
  | { type: 'checkpoint-cta' }
  | { type: 'markdown'; title?: LocalizedLabel; text: Trilingual };

/** A node as authored in JSON (before index/nodeIds derivation). */
export interface CurriculumNodeFile {
  id: string;
  kind: PathNodeKind;
  label: LocalizedLabel;
  /**
   * Route to open. Required for learn / practice / bonus nodes.
   *
   * OPTIONAL for checkpoints: the builder derives `/checkpoint/{unit index}`, so
   * inserting a unit never forces renumbering every `/checkpoint/N` after it.
   * If you do author it, it must equal the derived value (the validator enforces
   * that, so the file stays readable without being able to drift).
   */
  to?: string;
  bonus?: boolean;
  /** P2 lesson blocks for this node. */
  sections?: LessonSection[];
  /** P2: marks a content lesson rather than a practice drill. */
  teaches?: boolean;
}

/** One unit as authored in JSON. */
export interface CurriculumUnitFile {
  /** Stable unit id, e.g. 'm04'. NEVER rename — learner progress keys on it. */
  id: string;
  /** 1-based position. Units render in ascending `order`; `index` = order - 1. */
  order: number;
  code: string;
  kind: BandKind;
  cluster: number;
  title: LocalizedLabel;
  theme: LocalizedLabel;
  goal: LocalizedLabel;
  /** Lesson / practice / gate nodes, in spine order. */
  nodes: CurriculumNodeFile[];
  /** Optional practice chips that never gate and never push-lock. */
  bonus?: CurriculumNodeFile[];
  checkpoint?: CheckpointConfig;
  pedagogy?: UnitPedagogy;
  vocabCategories?: string[];
  vocabPos?: 'noun' | 'verb' | 'adjective' | 'phrase';
  grammarCategories?: string[];
  /**
   * Whether `curriculum/lessons/mNN.json` exists. Authoring metadata only — the
   * lesson CONTENT lives in that separate, lazily-loaded file.
   */
  hasLesson?: boolean;
}

/** The whole campaign (clusters + units) as authored. */
export interface CurriculumFile {
  schemaVersion: number;
  clusters: Cluster[];
  units: CurriculumUnitFile[];
}

/** Bump when the JSON shape changes in a way readers must know about. */
export const CURRICULUM_SCHEMA_VERSION = 1;

/** One validation finding. `error` blocks a release; `warn` is advisory. */
export interface CurriculumIssue {
  level: 'error' | 'warn';
  where: string;
  message: string;
}

/** The canonical checkpoint route for a unit index. Single source of truth. */
export function checkpointRouteFor(unitIndex: number): string {
  return `/checkpoint/${unitIndex}`;
}

/** True when an EN/DE label is missing on either side. */
function labelIncomplete(label: LocalizedLabel | undefined): boolean {
  return !label || label.en.trim() === '' || label.de.trim() === '';
}

/**
 * True when any finding is an error (i.e. the content must not ship).
 * Takes a readonly array because callers hand it the module-level
 * `CURRICULUM_ISSUES`, and nothing here mutates the input.
 */
export function hasCurriculumErrors(issues: readonly CurriculumIssue[]): boolean {
  return issues.some((issue) => issue.level === 'error');
}

/**
 * Validate a whole authored campaign.
 *
 * Returns EVERY finding rather than throwing on the first one, so an editor sees
 * the complete list instead of fixing one error per run. Two categories: an
 * `error` means the spine is inconsistent (a missing gate, an unknown
 * checkpoint source, a duplicate or renamed id) and must not be published; a
 * `warn` means the shape is usable but something is probably unintended.
 */
export function validateCurriculum(file: CurriculumFile): CurriculumIssue[] {
  const issues: CurriculumIssue[] = [];
  const err = (where: string, message: string) => {
    issues.push({ level: 'error', where, message });
  };
  const warn = (where: string, message: string) => {
    issues.push({ level: 'warn', where, message });
  };

  if (file.schemaVersion !== CURRICULUM_SCHEMA_VERSION) {
    err('curriculum', `schemaVersion ${file.schemaVersion} ≠ expected ${CURRICULUM_SCHEMA_VERSION}`);
  }
  if (file.units.length === 0) err('curriculum', 'no units defined');

  const clusterIndexes = new Set<number>();
  for (const cluster of file.clusters) {
    if (clusterIndexes.has(cluster.index)) {
      err(`cluster ${cluster.code}`, `duplicate cluster index ${cluster.index}`);
    }
    clusterIndexes.add(cluster.index);
    if (labelIncomplete(cluster.title)) warn(`cluster ${cluster.code}`, 'title is missing EN or DE');
    if (labelIncomplete(cluster.topicArea)) warn(`cluster ${cluster.code}`, 'topicArea is missing EN or DE');
  }

  const units = [...file.units].sort((a, b) => a.order - b.order);
  const unitIds = new Set<string>();
  const orders = new Set<number>();
  const nodeIds = new Set<string>();

  units.forEach((unit, position) => {
    const at = `unit ${unit.id}`;
    // A unit with no `id` must be REPORTED, not dereferenced. The checks below
    // read `unit.id` and `unit.order`, so an early exit is the only way to keep
    // a malformed document from throwing instead of returning issues.
    //
    // This matters beyond the build: Phase 3b runs untrusted database content
    // through this same validator at runtime, where a throw would surface as a
    // broken lesson rather than a validation error.
    if (typeof unit.id !== 'string' || unit.id.length === 0) {
      err(`unit ${position}`, "id must be a non-empty string looking like 'm04'");
      return;
    }
    if (!/^m\d{2}$/.test(unit.id)) err(at, "id must look like 'm04'");
    if (unitIds.has(unit.id)) err(at, 'duplicate unit id');
    unitIds.add(unit.id);

    if (typeof unit.order !== 'number' || !Number.isInteger(unit.order) || unit.order < 1) {
      err(at, 'order must be an integer >= 1');
      return;
    }
    if (orders.has(unit.order)) err(at, `duplicate order ${unit.order}`);
    orders.add(unit.order);
    if (position !== unit.order - 1) {
      err(at, `orders must be contiguous from 1 (this unit sits at position ${position + 1} but declares order ${unit.order})`);
    }
    if (unit.code !== unit.id.toUpperCase()) err(at, `code should be '${unit.id.toUpperCase()}'`);
    if (!clusterIndexes.has(unit.cluster)) err(at, `cluster ${unit.cluster} is not defined in clusters.json`);
    if (labelIncomplete(unit.title)) warn(at, 'title is missing EN or DE');
    if (labelIncomplete(unit.theme)) warn(at, 'theme is missing EN or DE');
    if (labelIncomplete(unit.goal)) warn(at, 'goal is missing EN or DE');

    const index = unit.order - 1;
    const bonusNodes = unit.bonus ?? [];
    if (unit.nodes.length === 0) err(at, 'nodes[] is empty');

    for (const node of [...unit.nodes, ...bonusNodes]) {
      const nodeAt = `${at} / ${node.id}`;
      if (!node.id.startsWith(`${unit.id}-`)) err(nodeAt, `node id must start with '${unit.id}-'`);
      if (!/^m\d{2}-[a-z0-9-]+$/.test(node.id)) err(nodeAt, "node id must look like 'm04-family'");
      if (nodeIds.has(node.id)) err(nodeAt, 'duplicate node id (node ids are global)');
      nodeIds.add(node.id);
      if (labelIncomplete(node.label)) warn(nodeAt, 'label is missing EN or DE');

      if (node.kind === 'checkpoint') {
        const expected = checkpointRouteFor(index);
        // Omit `to` to have it derived; if authored it must agree, so the file
        // cannot drift from the route the builder actually uses.
        if (node.to !== undefined && node.to !== expected) {
          err(nodeAt, `checkpoint route must be '${expected}' (or omitted so it is derived)`);
        }
      } else if (!node.to || !node.to.startsWith('/')) {
        err(nodeAt, `kind '${node.kind}' needs a 'to' route starting with '/'`);
      }
      if (bonusNodes.includes(node) && node.kind !== 'bonus') {
        warn(nodeAt, `listed in bonus[] but kind is '${node.kind}'`);
      }
    }

    const checkpoints = unit.nodes.filter((node) => node.kind === 'checkpoint');
    if (unit.kind === 'core' && checkpoints.length !== 1) {
      err(at, `core units need exactly 1 checkpoint node (found ${checkpoints.length})`);
    }
    if (unit.kind === 'support' && checkpoints.length > 0) {
      err(at, 'support units never gate, so they must not define a checkpoint node');
    }

    if (unit.checkpoint) {
      if (unit.checkpoint.moduleType !== 'a1-checkpoint') {
        err(at, "checkpoint.moduleType must be 'a1-checkpoint'");
      }
      if (unit.checkpoint.specs.length === 0) err(at, 'checkpoint.specs is empty');
      let total = 0;
      for (const spec of unit.checkpoint.specs) {
        if (!CHECKPOINT_SOURCES.includes(spec.type)) {
          err(at, `unknown checkpoint source '${spec.type}' — no builder case exists in A1CheckpointPage`);
        }
        if (UNUSABLE_CHECKPOINT_SOURCES.has(spec.type)) {
          // The static item-count check below CANNOT catch this: the spec sums
          // to 12 and the file is well-formed, but the source resolves to zero
          // items at runtime, so the learner gets a silently shortened deck.
          err(
            at,
            `spec '${spec.type}' cannot produce items today (no audioUrl reaches the builder) — ` +
              `use a source that resolves, or revive the source first`,
          );
        }
        if (!Number.isInteger(spec.count) || spec.count < 1) {
          err(at, `spec '${spec.type}' count must be an integer >= 1`);
        }
        total += Number.isFinite(spec.count) ? spec.count : 0;
      }
      if (total < 10 || total > 15) {
        warn(at, `checkpoint draws ${total} items; the spec is 10-15`);
      }
    } else if (unit.kind === 'core') {
      err(at, 'core units must define a checkpoint');
    }
  });

  return issues;
}

/**
 * Human-readable report for the CLI (`npm run curriculum:validate`) and for the
 * curriculum scripts: errors first, then warnings, each with its location.
 */
export function formatCurriculumIssues(issues: readonly CurriculumIssue[]): string {
  if (issues.length === 0) return '✓ curriculum valid — 0 issues';
  const errors = issues.filter((issue) => issue.level === 'error');
  const warnings = issues.filter((issue) => issue.level === 'warn');
  const lines: string[] = [];
  for (const issue of errors) lines.push(`  ✗ ${issue.where}: ${issue.message}`);
  for (const issue of warnings) lines.push(`  ⚠ ${issue.where}: ${issue.message}`);
  return `${errors.length} error(s), ${warnings.length} warning(s)\n${lines.join('\n')}`;
}
