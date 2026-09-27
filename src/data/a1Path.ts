/**
 * src/data/a1Path.ts — the A1 campaign's public API (a façade over editable data)
 *
 * WHAT THIS FILE IS NOW
 * The campaign content used to live here as ~750 lines of inline TypeScript:
 * unit metadata, node lists and pedagogy tables, all mixed together. Editing a
 * lesson text meant editing code, and adding a lesson meant editing three places
 * that could silently drift apart.
 *
 * Content now lives in hand-editable JSON:
 *
 *   src/data/curriculum/clusters.json    the 5 clusters
 *   src/data/curriculum/units/mNN.json   one file per unit — add / remove /
 *                                        reorder units and lessons by editing
 *                                        (or adding / deleting) these files
 *   src/data/curriculum/schema.ts        the content contract + validator
 *   src/data/curriculum/index.ts         loads the JSON and DERIVES the spine
 *
 * This file keeps the module's long-standing public API intact — every export
 * below is unchanged in name and shape — so the ~25 modules that import it did
 * not have to change. It no longer contains content: only derivation, thresholds
 * and the legacy progress-remap helpers, which are behaviour, not content.
 *
 * HOW TO EDIT THE COURSE
 *   · change a lesson title / route / rule table  → edit units/mNN.json
 *   · add a lesson                                → add a node object to nodes[]
 *   · remove a lesson                             → delete the node object
 *   · add / remove / reorder a unit               → add / delete units/mNN.json
 *                                                   and set `order`
 * Then run `npm run curriculum:barrel` (only when files were added or removed)
 * and `npm run curriculum:validate`. Nothing in this file needs to change.
 *
 * IDs ARE PERMANENT
 * `completedNodeIds` keys on node ids and the path state keys on unit ids, so
 * renaming one is a migration — the same pattern as `LEGACY_TO_BAND_INDEX` and
 * `BAND_TO_MODULE_INDEX` below. Labels, routes, sections, checkpoint specs and
 * pedagogy are free to edit at any time.
 */

import { CURRICULUM_FILE, CURRICULUM_ISSUES, RESOLVED_PATH } from './curriculum';
import type {
  A1Curriculum,
  A1Unit,
  Cluster,
  ComparisonRow,
  HonorificRow,
  PathNode,
  RuleRow,
} from './curriculum/schema';

/**
 * Re-exported for source compatibility: these types used to be declared in this
 * file and consumers import them from `../data/a1Path`. They now live with the
 * content contract in `./curriculum/schema.ts` — the single place that defines
 * what a unit file may contain.
 */
export type {
  A1Curriculum,
  A1Unit,
  Article,
  BandKind,
  CheckpointConfig,
  CheckpointSource,
  CheckpointSpec,
  Cluster,
  ComparisonRow,
  CurriculumFile,
  CurriculumIssue,
  CurriculumNodeFile,
  CurriculumUnitFile,
  HonorificRow,
  LessonSection,
  LocalizedLabel,
  PathMode,
  PathNode,
  PathNodeKind,
  RuleRow,
  TrapItem,
  Trilingual,
  UnitPedagogy,
  WordOrder,
} from './curriculum/schema';

/**
 * ADDITIVE (new in this version): the content validator and its findings.
 * `npm run curriculum:validate` and the P2 lesson renderer use these; their
 * presence changes nothing for existing consumers.
 */
export {
  CHECKPOINT_SOURCES,
  CURRICULUM_SCHEMA_VERSION,
  checkpointRouteFor,
  formatCurriculumIssues,
  hasCurriculumErrors,
  validateCurriculum,
} from './curriculum/schema';
export { CURRICULUM_ISSUES };

/* ── the campaign, derived from the unit files ────────────────────────────── */

/** The 15 core modules, in `order`. Content of record: `curriculum/units/*.json`. */
export const A1_UNITS: A1Unit[] = RESOLVED_PATH.units;

/**
 * Core learning nodes (learn/practice/checkpoint) in spine order. Bonus nodes
 * are excluded here — so getPushNode never stops on optional content.
 *
 * Several modules share a route (e.g. /roleplay serves M07, M10, M11, M12 and
 * M14). Where a module needs a specific variant we use the query-string deep
 * links the app already supports: /grammar?tab=modals,
 * /sentence-builder?focus=separable, /vocab-trainer?category=…,
 * /rapid-fire?mode=… . Node ids stay distinct even when two modules point at the
 * same base path, so visit tracking can still tell them apart.
 */
export const A1_LEARN_NODES: PathNode[] = RESOLVED_PATH.learnNodes;

/** Bonus + support nodes — optional, never gate, never push-lock. */
export const A1_BONUS_NODES: PathNode[] = RESOLVED_PATH.bonusNodes;

/**
 * The 5 GCSE Topic Area groupings that give the 15 modules their stages.
 * Content of record: `src/data/curriculum/clusters.json`.
 */
export const A1_CLUSTERS: Cluster[] = CURRICULUM_FILE.clusters;

/* ── legacy pedagogy aliases ──────────────────────────────────────────────── */

function unitById(id: string): A1Unit | undefined {
  return A1_UNITS.find((unit) => unit.id === id);
}

/**
 * These arrays were standalone constants in this file before the move. They are
 * now OWNED by the unit that renders them, so `curriculum/units/mNN.json` is the
 * one place to edit them; an alias simply follows its owner. If an owner stops
 * defining that block the alias becomes empty, which
 * `scripts/curriculum/verify.ts` reports as a finding rather than failing
 * silently.
 *
 * No module outside this file consumes them and no UI reads them directly (the
 * spine renders `unit.pedagogy`), so they exist to keep this module's export
 * surface stable.
 *
 * OWNERSHIP WAS REMAPPED FOR v4.0. These aliases were written against the old
 * 15-unit order, where M07 was the calendar, M10 the accusative, M12 the city
 * and M13 the modals. The corrected pedagogical sequence moved all four, so an
 * alias that was not remapped would have resolved to a unit about something else
 * entirely — the kind of error that is invisible because the fallback is `[]`.
 * The owner is now the unit that actually teaches the structure.
 *
 * Most of these still resolve to `[]` in practice: the tables those units
 * authored are multi-column (`columns` + raw cell strings) and do not fit the
 * 3-field `RuleRow` shape, so they live in `pedagogy.ruleTables` and are
 * invisible to this alias. `scripts/curriculum/validate.ts` reports that
 * mismatch rather than letting it pass silently.
 */
export const HONORIFICS: HonorificRow[] = unitById('m01')?.pedagogy?.honorifics?.rows ?? [];
/** Trilingual word-order bridge — owned by M07 (V2 word order). */
export const WORD_ORDER_TABLE: ComparisonRow[] =
  unitById('m07')?.pedagogy?.grammarComparison?.rows ?? [];
/** Modal sentence-bracket bridge — owned by M12 (professions & modal verbs). */
export const MODAL_VERB_FINAL_PANEL: ComparisonRow[] =
  unitById('m12')?.pedagogy?.grammarComparison?.rows ?? [];
/** um / am / im — owned by M11 (time, calendar & clock inversion). */
export const UM_AM_IM_RULES: RuleRow[] = unitById('m11')?.pedagogy?.ruleTable?.rows ?? [];
/** der → den — owned by M08 (accusative case & direct objects). */
export const ACCUSATIVE_RULES: RuleRow[] = unitById('m08')?.pedagogy?.ruleTable?.rows ?? [];
/** nach / zu / in / mit — owned by M14 (city navigation & dative prepositions). */
export const DIRECTIONAL_RULES: RuleRow[] = unitById('m14')?.pedagogy?.ruleTable?.rows ?? [];
/** haben/sein + Partizip II — owned by M15 (health, hobbies, weather & Perfekt). */
export const PERFEKT_RULES: RuleRow[] = unitById('m15')?.pedagogy?.ruleTable?.rows ?? [];
/**
 * The A1 mastery checklist behind the /grammar `review` tab — owned by M16
 * (comprehensive practice). Unlike the aliases above this one IS populated:
 * M16 authors it directly in the `ruleTable` shape.
 */
export const A1_REVIEW_RULES: RuleRow[] = unitById('m16')?.pedagogy?.ruleTable?.rows ?? [];

/**
 * Unused legacy constant, kept because it is part of this module's export
 * surface. `WORD_ORDER_TABLE` above is the table the spine actually renders; this
 * panel predates it and no unit references it. Remove the export deliberately if
 * you ever want to drop it.
 */
export const WORD_ORDER_PANEL: ComparisonRow[] = [
  {
    language: { en: 'English', ne: 'नेपाली', de: 'Deutsch' },
    order: {
      en: 'SVO (Subject–Verb–Object)',
      ne: 'SOV (विषय–वस्तु–क्रिया)',
      de: 'SVO (Subjekt–Verb–Objekt)',
    },
    example: { en: 'I drink tea.', ne: 'म चिया पिउँछु।', de: 'Ich trinke Tee.' },
  },
  {
    language: { en: 'Nepali', ne: 'नेपाली', de: 'Deutsch' },
    order: {
      en: 'SOV',
      ne: 'SOV (विषय–वस्तु–क्रिया)',
      de: 'V2 (Verb 2nd in main; verb-final in sub)',
    },
    example: { en: 'I drink tea.', ne: 'म चिया पिउँछु।', de: 'Ich trinke Tee.' },
  },
  {
    language: { en: 'German', ne: 'नेपाली', de: 'Deutsch' },
    order: { en: 'SVO', ne: 'SOV', de: 'V2 (Hauptsatz) / verb-final (Nebensatz)' },
    example: { en: 'I drink tea.', ne: 'म चिया पिउँछु।', de: 'Ich trinke Tee. (V2 im Hauptsatz)' },
  },
];

/* ── the campaign object the UI and the progress hooks consume ─────────────── */

function buildCurriculum(): A1Curriculum {
  const nodes: PathNode[] = [...A1_LEARN_NODES, ...A1_BONUS_NODES];
  const nodeMap: Record<string, PathNode> = {};
  for (const node of nodes) {
    nodeMap[node.id] = node;
  }
  const checkpoints = A1_LEARN_NODES.filter((node) => node.kind === 'checkpoint');
  // Each unit's `nodeIds` is DERIVED from its own `nodes[]` in
  // `curriculum/index.ts`, so this can no longer fail the way it used to (the
  // old file kept the two lists separate and only warned at runtime). The check
  // stays as a cheap invariant guard for a future hand-written node list.
  for (const unit of A1_UNITS) {
    for (const id of unit.nodeIds) {
      if (!nodeMap[id]) {
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

/** Checkpoint pass threshold (locked: >=80%, not 100%, no cooldown). */
export const CHECKPOINT_PASS_THRESHOLD = 0.8;

/**
 * "Mastered" threshold (spec §3: a module is Mastered at >=85%).
 *
 * DELIBERATELY SEPARATE from CHECKPOINT_PASS_THRESHOLD. 80% unlocks the next
 * module (locked decision); 85% only awards a cosmetic badge and never gates.
 * Raising the GATE to 85% would contradict the locked >=80% rule, so it is kept
 * strictly informational.
 */
export const MODULE_MASTERY_THRESHOLD = 0.85;

/**
 * Default number of checkpoint items to draw (10-15). The actual count is the
 * sum of a unit's CheckpointSpec counts (each 3-8), authored in units/mNN.json.
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
    .find((node) => node.kind === 'checkpoint');
}

/** Strip a query string so `/grammar?tab=modals` and `/grammar` share a base. */
function basePath(route: string): string {
  const query = route.indexOf('?');
  return query === -1 ? route : route.slice(0, query);
}

/**
 * Find the learn/practice node a visit landed on, for visit-based completion.
 *
 * Accepts the FULL location (pathname + search) so query-string deep-links —
 * `/grammar?tab=modals`, `/vocab-trainer?category=family` — resolve to their own
 * node instead of the bare-route one. `A1PathVisitTracker` passes
 * `pathname + search` for exactly this reason.
 *
 * When several nodes share a base path (e.g. /roleplay backs M07, M10, M11, M12
 * and M14), an exact full-route match always wins. Only if NO node claims the
 * exact route do we fall back to the base path — and then only when the
 * candidates are UNAMBIGUOUS, so a bare `/roleplay` can never silently mark
 * five modules complete.
 */
export function getNodeByRoute(fullPath: string): PathNode | undefined {
  const candidates = A1_CURRICULUM.nodes.filter((node) => node.kind !== 'checkpoint');

  const exact = candidates.find((node) => node.to === fullPath);
  if (exact) return exact;

  const base = basePath(fullPath);
  const byBase = candidates.filter((node) => basePath(node.to) === base);
  return byBase.length === 1 ? byBase[0] : undefined;
}

/**
 * The module index that is unlocked next after passing the checkpoint at
 * `currentUnitIndex`. All 15 modules are CORE, so this is simply the next
 * index; it stays a function so a future optional module can be skipped
 * without touching callers.
 */
export function getNextGatedBandIndex(currentUnitIndex: number): number {
  for (let i = currentUnitIndex + 1; i < A1_UNIT_COUNT; i++) {
    const band = A1_UNITS[i];
    if (band && band.kind === 'core') return i;
  }
  return Math.max(0, A1_UNIT_COUNT - 1);
}

/* ── legacy progress remaps (kept because learner state on disk is old) ────── */

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

/**
 * SECOND migration: 6-band (A–F) progress -> 15-module (M01–M15) progress.
 *
 * Each old band maps to the last module whose content it actually covered, so a
 * learner's position never regresses and never over-rewards:
 *
 *   band A (0) greetings + numbers    -> M02 (1)  both covered by Gate A
 *   band B (1) alphabet (SUPPORT)     -> M03 (2)  alphabet becomes a real module
 *   band C (2) articles / gender      -> M05 (4)  articles are M05's backbone
 *   band D (3) calendar + grammar     -> M08 (7)  Gate D drilled 8 grammar items
 *   band E (4) food/place/directions  -> M11 (10) themed food/travel/places vocab
 *   band F (5) modals + accuracy      -> M13 (12) Gate F included modals drills
 *
 * Deliberately NOT mapping band F to M15: Perfekt (M15) is brand-new grammar
 * with no counterpart in the old curriculum, so it must be earned. M14 (health)
 * and M15 (perfekt) are always re-earned — correct, since nobody has seen them.
 */
export const BAND_TO_MODULE_INDEX: readonly number[] = [1, 2, 4, 7, 10, 12];

export function remapBandToModuleIndex(oldIndex: number): number {
  const i = Math.max(0, Math.min(oldIndex, BAND_TO_MODULE_INDEX.length - 1));
  return BAND_TO_MODULE_INDEX[i] ?? 0;
}

/**
 * Marker injected into `completedNodeIds` exactly once so the 6→15 remap is
 * idempotent — exactly the mechanism the 5→6 migration already uses.
 */
export const M15_MIGRATION_MARKER = 'a1-path-modules-v3';

/** True when an id belongs to the 6-band `a-..f-` scheme (or its marker). */
export function isSixBandNodeId(id: string): boolean {
  return /^[a-f]-/.test(id) || id === BAND_MIGRATION_MARKER;
}

/** True when an id belongs to the current 15-module `mNN-` scheme (or its marker). */
export function isModuleNodeId(id: string): boolean {
  return /^m\d{2}-/.test(id) || id === M15_MIGRATION_MARKER;
}

/* ── v4.0 pedagogical reorder ────────────────────────────────────────────── */

/**
 * THIRD migration: v3 module ORDER -> v4.0 order. Same shape as the two above.
 *
 * What changed and why (the v4.0 "zero-dependency" correction):
 *   · Conjugation + V2 moved to slot 6, BEFORE the accusative at slot 9. In the
 *     v3 order the learner met `Ich trinke einen Kaffee` style sentences only
 *     at the very end, so the case was the first thing they were asked to
 *     apply to a verb form they had not met.
 *   · Time (am / im / um) moved from slot 7 to slot 10, i.e. AFTER the
 *     accusative. Those are dative contractions; they were being drilled three
 *     units before the case system existed.
 *
 * `completedNodeIds` is deliberately NOT remapped. Node ids are `mNN-…` and
 * stay bound to their unit — only `order` moved — so a learner keeps every
 * lesson they finished. What DOES move is everything keyed by unit INDEX:
 * `checkpointBestByUnit`, `attemptsByUnit` and `unlockedUnitIndex`.
 *
 * Read the table as: OLD index -> NEW index.
 *   0-4 unchanged · 5(m06)->6 · 6(m07)->9 · 7(m08)->5 · 8(m09)->7
 *   9(m10)->8 · 10(m11)->11 · 11(m12)->12 · 12(m13)->10 · 13-14 unchanged
 * The same eight units that move are exactly the eight whose scores move with
 * them, so a pass earned on m08 (Verbs) is a pass on new slot 6.
 */
export const V3_TO_V4_UNIT_INDEX: readonly number[] = [0, 1, 2, 3, 4, 6, 9, 5, 7, 8, 11, 12, 10, 13, 14];

export function remapV3UnitIndex(oldIndex: number): number {
  const i = Math.max(0, Math.min(oldIndex, V3_TO_V4_UNIT_INDEX.length - 1));
  return V3_TO_V4_UNIT_INDEX[i] ?? 0;
}

/**
 * v3 node id → v4 node id.
 *
 * ── WHY THIS EXISTS, AND WHY IT IS NOT THE SAME THING AS THE INDEX MAP ───────
 * `V3_TO_V4_UNIT_INDEX` above assumes "every unit still exists with the same id
 * and the same content", so node ids need no remapping. That assumption is
 * FALSE. The v4.0 pass renamed 20 NODE ids from semantic to positional:
 *
 *     m06-professions → m06-learn          m09-separable → m09-learn
 *     m06-grammar     → m06-practice       m09-prefix    → m09-practice
 *     m07-calendar    → m07-learn          m10-roleplay  → m10-learn
 *     m07-roleplay    → m07-practice       m10-accusative→ m10-practice
 *     m08-grammar     → m08-learn          m11-clothing  → m11-learn
 *     m08-sentence    → m08-practice       m11-shopping  → m11-practice
 *     m12-roleplay    → m12-learn          m13-modals    → m13-learn
 *     m12-travel      → m12-practice       m13-games     → m13-practice
 *     m14-health      → m14-learn          m15-stories   → m15-learn
 *     m14-doctor      → m14-practice       m15-blitz     → m15-practice
 *     mNN-gate        → mNN-checkpoint     (m06 … m15, every unit)
 *
 * That is 30 ids in total, and the count is the point: the first pass at this
 * map covered 22 and silently orphaned 8. `check:v4migration` asserts coverage
 * against the LIVE spine, which is what caught the shortfall.
 *
 * `completedNodeIds` is keyed on NODE ids (`isNodeComplete` is
 * `completedNodeIds.includes(node.id)`), so a learner who finished
 * `m06-professions` sees that node as INCOMPLETE after the rename. They are not
 * locked out — `unlockedUnitIndex` is remapped by the table above, so checkpoint
 * gating still holds — but roughly twenty finished nodes per learner silently
 * revert to "not done".
 *
 * Keyed by node id, NOT by array position: the unit ORDER changed too, so the
 * old learn node of m08 is not at the new m08's index. Matching on id is the
 * only stable key available.
 *
 * m01–m05 were already positional and are deliberately absent.
 */
export const V3_TO_V4_NODE_ID: Readonly<Record<string, string>> = {
  'm06-professions': 'm06-learn',
  'm06-grammar': 'm06-practice',
  'm07-calendar': 'm07-learn',
  'm07-roleplay': 'm07-practice',
  'm08-grammar': 'm08-learn',
  'm08-sentence': 'm08-practice',
  'm09-separable': 'm09-learn',
  'm09-prefix': 'm09-practice',
  'm10-roleplay': 'm10-learn',
  'm10-accusative': 'm10-practice',
  'm11-clothing': 'm11-learn',
  'm11-shopping': 'm11-practice',
  'm12-roleplay': 'm12-learn',
  'm12-travel': 'm12-practice',
  'm13-modals': 'm13-learn',
  'm13-games': 'm13-practice',
  'm14-health': 'm14-learn',
  'm14-doctor': 'm14-practice',
  'm15-stories': 'm15-learn',
  'm15-blitz': 'm15-practice',
  'm06-gate': 'm06-checkpoint',
  'm07-gate': 'm07-checkpoint',
  'm08-gate': 'm08-checkpoint',
  'm09-gate': 'm09-checkpoint',
  'm10-gate': 'm10-checkpoint',
  'm11-gate': 'm11-checkpoint',
  'm12-gate': 'm12-checkpoint',
  'm13-gate': 'm13-checkpoint',
  'm14-gate': 'm14-checkpoint',
  'm15-gate': 'm15-checkpoint',
};

/**
 * Remap a learner's completed node ids onto the v4 naming scheme.
 *
 * Idempotent by construction: a v4 id is never a KEY in the map, so passing an
 * already-migrated list through again is a no-op. That matters because the
 * caller may run this on any hydrate, not only the first.
 *
 * Unmapped ids are PRESERVED, not dropped. Migration markers ride along in this
 * array, and a stale id from some future schema is a harmless no-op at lookup
 * time — whereas dropping it would silently discard real completion.
 */
export function remapV3NodeIds(ids: readonly string[]): string[] {
  return ids.map((id) => V3_TO_V4_NODE_ID[id] ?? id);
}

/**
 * Marker injected into `completedNodeIds` exactly once so the v3→v4 reorder is
 * idempotent, on the same terms as `BAND_MIGRATION_MARKER` and
 * `M15_MIGRATION_MARKER`. Not a real node id; path lookups ignore it.
 */
export const V4_ORDER_MARKER = 'a1-path-v4-order';

/**
 * The cluster a module belongs to (0..4). Returns 0 for an unknown index rather
 * than throwing, so a stale saved index can never crash the spine.
 */
export function getClusterForModule(unitIndex: number): Cluster {
  const safe = Math.max(0, Math.min(unitIndex, A1_UNIT_COUNT - 1));
  return (
    A1_CLUSTERS.find((cluster) => cluster.index === A1_UNITS[safe]?.cluster) ??
    A1_CLUSTERS[0]!
  );
}
