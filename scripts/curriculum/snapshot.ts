/**
 * scripts/curriculum/snapshot.ts
 *
 * ONE definition of "everything observable about the A1 spine", shared by:
 *
 *   · scripts/curriculum/rebuild-baseline.ts  → derives it from the FROZEN pre-P0
 *     source (`scripts/data/a1-curriculum/_legacy.ts`, a copy of the original
 *     inline-content `a1Path.ts`) and writes `baseline.json`.
 *   · scripts/curriculum/verify.ts            → derives it from the CURRENT,
 *     data-driven `src/data/a1Path.ts` and diffs the two.
 *
 * Sharing the SHAPE is deliberate and does not weaken the check: the two sides
 * are produced by different code from different sources, and that difference is
 * the independent variable that matters. Duplicating the shape in both scripts
 * would only create somewhere else for them to disagree by accident.
 *
 * `stableStringify` sorts object keys and drops `undefined` (exactly what
 * JSON.stringify does) so a diff can never be caused by key insertion order —
 * which is precisely the noise this comparison must not produce.
 */
import type {
  A1Unit,
  Cluster,
  ComparisonRow,
  HonorificRow,
  PathNode,
  RuleRow,
} from '../../src/data/curriculum/schema';

/**
 * The slice of the `a1Path` module this snapshot observes. Both the legacy
 * module and the current façade satisfy it.
 */
export interface PathApi {
  A1_UNITS: A1Unit[];
  A1_LEARN_NODES: PathNode[];
  A1_BONUS_NODES: PathNode[];
  A1_CLUSTERS: Cluster[];
  HONORIFICS: HonorificRow[];
  WORD_ORDER_PANEL: ComparisonRow[];
  WORD_ORDER_TABLE: ComparisonRow[];
  MODAL_VERB_FINAL_PANEL: ComparisonRow[];
  UM_AM_IM_RULES: RuleRow[];
  ACCUSATIVE_RULES: RuleRow[];
  DIRECTIONAL_RULES: RuleRow[];
  PERFEKT_RULES: RuleRow[];
  A1_UNIT_COUNT: number;
  FIRST_UNIT_INDEX: number;
  CHECKPOINT_PASS_THRESHOLD: number;
  MODULE_MASTERY_THRESHOLD: number;
  DEFAULT_CHECKPOINT_ITEM_COUNT: number;
  LEGACY_TO_BAND_INDEX: readonly number[];
  BAND_TO_MODULE_INDEX: readonly number[];
  BAND_MIGRATION_MARKER: string;
  M15_MIGRATION_MARKER: string;
  remapLegacyUnitIndex: (oldIndex: number) => number;
  remapBandToModuleIndex: (oldIndex: number) => number;
  getNextGatedBandIndex: (unitIndex: number) => number;
  getCheckpointNode: (unitIndex: number) => PathNode | undefined;
  getNodeByRoute: (route: string) => PathNode | undefined;
  isLegacyPathNodeId: (id: string) => boolean;
  isBandNodeId: (id: string) => boolean;
  isSixBandNodeId: (id: string) => boolean;
  isModuleNodeId: (id: string) => boolean;
  getClusterForModule: (unitIndex: number) => Cluster;
}

export interface SpineSnapshot {
  constants: Record<string, unknown>;
  clusters: unknown[];
  units: unknown[];
  learnNodes: unknown[];
  bonusNodes: unknown[];
  curriculum: {
    unitIds: string[];
    nodeIds: string[];
    checkpointIds: (string | null)[];
  };
  pedagogy: Record<string, unknown>;
  functions: Record<string, unknown>;
  predicates: { sample: unknown[] };
}

/**
 * Deterministic stringify: keys sorted, `undefined` dropped.
 *
 * NOTE: shared references are expanded, not marked. An earlier version replaced
 * a second reference to the same array with the literal `"[circular]"`, which
 * silently corrupted the baseline: under sorted keys `pedagogy` is serialised
 * before `units`, so every `units[n].pedagogy.*.rows` that aliased one of the
 * shared tables was written as `"[circular]"` instead of its content. The spine
 * data is a DAG, not a cycle, so expanding is both correct and terminating.
 */
export function stableStringify(value: unknown): string {
  const walk = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') return input;
    if (Array.isArray(input)) return input.map(walk);
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(input as Record<string, unknown>).sort()) {
      const walked = walk((input as Record<string, unknown>)[key]);
      if (walked !== undefined) out[key] = walked;
    }
    return out;
  };
  return JSON.stringify(walk(value));
}

/** Routes used to exercise `getNodeByRoute` in a fixed, meaningful order. */
const ROUTE_PROBES = [
  '/greetings',
  '/greetings?x=1',
  '/grammar?tab=modals',
  '/vocab-trainer?category=family',
  '/roleplay?scene=cafe',
  '/roleplay',
  '/rapid-fire?mode=mixed',
  '/articles',
  '/nope',
];

/** Build the observable snapshot from any module that satisfies `PathApi`. */
export function buildSnapshot(api: PathApi): SpineSnapshot {
  const indices = [...Array(api.A1_UNIT_COUNT).keys()];
  return {
    constants: {
      A1_UNIT_COUNT: api.A1_UNIT_COUNT,
      FIRST_UNIT_INDEX: api.FIRST_UNIT_INDEX,
      CHECKPOINT_PASS_THRESHOLD: api.CHECKPOINT_PASS_THRESHOLD,
      MODULE_MASTERY_THRESHOLD: api.MODULE_MASTERY_THRESHOLD,
      DEFAULT_CHECKPOINT_ITEM_COUNT: api.DEFAULT_CHECKPOINT_ITEM_COUNT,
      LEGACY_TO_BAND_INDEX: api.LEGACY_TO_BAND_INDEX,
      BAND_TO_MODULE_INDEX: api.BAND_TO_MODULE_INDEX,
      BAND_MIGRATION_MARKER: api.BAND_MIGRATION_MARKER,
      M15_MIGRATION_MARKER: api.M15_MIGRATION_MARKER,
    },
    clusters: api.A1_CLUSTERS,
    units: api.A1_UNITS,
    learnNodes: api.A1_LEARN_NODES,
    bonusNodes: api.A1_BONUS_NODES,
    curriculum: {
      unitIds: api.A1_UNITS.map((unit) => unit.id),
      nodeIds: [...api.A1_LEARN_NODES, ...api.A1_BONUS_NODES].map((node) => node.id),
      checkpointIds: api.A1_UNITS.map((unit) => api.getCheckpointNode(unit.index)?.id ?? null),
    },
    pedagogy: {
      HONORIFICS: api.HONORIFICS,
      WORD_ORDER_PANEL: api.WORD_ORDER_PANEL,
      WORD_ORDER_TABLE: api.WORD_ORDER_TABLE,
      MODAL_VERB_FINAL_PANEL: api.MODAL_VERB_FINAL_PANEL,
      UM_AM_IM_RULES: api.UM_AM_IM_RULES,
      ACCUSATIVE_RULES: api.ACCUSATIVE_RULES,
      DIRECTIONAL_RULES: api.DIRECTIONAL_RULES,
      PERFEKT_RULES: api.PERFEKT_RULES,
    },
    functions: {
      remapLegacyUnitIndex: [0, 1, 2, 3, 4, 5].map(api.remapLegacyUnitIndex),
      remapBandToModuleIndex: [0, 1, 2, 3, 4, 5, 6, 7].map(api.remapBandToModuleIndex),
      getNextGatedBandIndex: indices.map(api.getNextGatedBandIndex),
      checkpointRoutes: indices.map((index) => api.getCheckpointNode(index)?.to ?? null),
      clusterForModule: indices.map((index) => api.getClusterForModule(index).code),
      nodeByRoute: ROUTE_PROBES.map((route) => api.getNodeByRoute(route)?.id ?? null),
    },
    predicates: {
      sample: [
        'u1-greetings',
        'a-basics',
        api.BAND_MIGRATION_MARKER,
        'm01-greetings',
        api.M15_MIGRATION_MARKER,
        'zz-other',
      ].map((id) => ({
        id,
        legacy: api.isLegacyPathNodeId(id),
        band: api.isBandNodeId(id),
        sixBand: api.isSixBandNodeId(id),
        module: api.isModuleNodeId(id),
      })),
    },
  };
}
