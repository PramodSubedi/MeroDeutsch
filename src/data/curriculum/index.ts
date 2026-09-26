/**
 * src/data/curriculum/index.ts
 *
 * Loads the authored campaign (clusters.json + units/*.json via the generated
 * barrel), validates it, and DERIVES the runtime shapes the app consumes:
 * `A1Unit[]`, learn nodes and bonus nodes.
 *
 * This module is the only place that knows how authored JSON becomes a spine.
 * `../a1Path.ts` re-exposes the result through its long-standing 50 exports, so
 * every existing importer keeps working while the content itself moved to data.
 *
 * Derivation (and why):
 *   · `index`   = position in the ascending-`order` list (never authored)
 *   · `nodeIds` = the ids of `nodes[]` in order (never authored)
 *   · a checkpoint node's route = `/checkpoint/{index}` unless authored, and the
 *     validator requires an authored value to agree — so inserting a unit never
 *     means renumbering the gate routes after it.
 */
import clustersJson from './clusters.json';
import { UNIT_FILES } from './units.generated';
import {
  CURRICULUM_SCHEMA_VERSION,
  checkpointRouteFor,
  hasCurriculumErrors,
  validateCurriculum,
} from './schema';
import type {
  A1Unit,
  Cluster,
  CurriculumFile,
  CurriculumIssue,
  CurriculumNodeFile,
  PathNode,
} from './schema';

/** JSON modules are structurally typed as plain objects, hence the cast. */
const RAW_CLUSTERS = clustersJson as unknown as Cluster[];

/** The authored campaign as one object. */
export const CURRICULUM_FILE: CurriculumFile = {
  schemaVersion: CURRICULUM_SCHEMA_VERSION,
  clusters: RAW_CLUSTERS,
  units: [...UNIT_FILES],
};

export interface ResolvedPath {
  units: A1Unit[];
  /** learn / practice / checkpoint nodes, in spine order. */
  learnNodes: PathNode[];
  /** optional practice chips — never gate, never push-lock. */
  bonusNodes: PathNode[];
}

/** Resolve one authored node into a spine node for a given unit index. */
function resolveNode(node: CurriculumNodeFile, unitIndex: number, isBonus: boolean): PathNode {
  const bonus = isBonus || node.kind === 'bonus';
  const resolved: PathNode = {
    id: node.id,
    unitIndex,
    kind: node.kind,
    label: node.label,
    // A checkpoint route may be omitted and is then derived, so reordering or
    // inserting units cannot leave a stale `/checkpoint/N` behind.
    to: node.kind === 'checkpoint' ? (node.to ?? checkpointRouteFor(unitIndex)) : (node.to ?? ''),
  };
  if (bonus) resolved.bonus = true;
  if (node.sections) resolved.sections = node.sections;
  if (node.teaches) resolved.teaches = true;
  return resolved;
}

/**
 * Turn the authored file into runtime shapes.
 *
 * `units` are sorted by `order` (the validator guarantees the orders are
 * contiguous from 1, so a sort is enough and a mis-ordered file is caught before
 * it can shift a learner's progress onto the wrong unit).
 */
export function resolvePath(file: CurriculumFile): ResolvedPath {
  const ordered = [...file.units].sort((a, b) => a.order - b.order);
  const units: A1Unit[] = [];
  const learnNodes: PathNode[] = [];
  const bonusNodes: PathNode[] = [];

  ordered.forEach((authored, index) => {
    const learn = authored.nodes.map((node) => resolveNode(node, index, false));
    const bonus = (authored.bonus ?? []).map((node) => resolveNode(node, index, true));
    learnNodes.push(...learn);
    bonusNodes.push(...bonus);

    const unit: A1Unit = {
      id: authored.id,
      index,
      code: authored.code,
      kind: authored.kind,
      cluster: authored.cluster,
      title: authored.title,
      theme: authored.theme,
      goal: authored.goal,
      // Only the gating spine — bonus chips are deliberately excluded, which is
      // what keeps `getPushNode` from ever stopping on optional content.
      nodeIds: learn.map((node) => node.id),
    };
    if (authored.pedagogy) unit.pedagogy = authored.pedagogy;
    if (authored.checkpoint) unit.checkpoint = authored.checkpoint;
    if (authored.vocabCategories) unit.vocabCategories = [...authored.vocabCategories];
    if (authored.vocabPos) unit.vocabPos = authored.vocabPos;
    if (authored.grammarCategories) unit.grammarCategories = [...authored.grammarCategories];
    if (authored.hasLesson) unit.hasLesson = true;
    units.push(unit);
  });

  return { units, learnNodes, bonusNodes };
}

/* ── validation + the resolved instance ───────────────────────────────────── */

/** Every content finding, computed once at module load. */
export const CURRICULUM_ISSUES: readonly CurriculumIssue[] = validateCurriculum(CURRICULUM_FILE);

/**
 * Loud on errors, silent on warnings.
 *
 * A `console.error` rather than a throw is deliberate: broken content must be
 * obvious in dev and in the CLI, but it must not white-screen the app for a
 * learner who had nothing to do with it. The spine renders with whatever it can
 * resolve. `npm run curriculum:validate` turns the same list into a non-zero
 * exit code for CI.
 */
if (hasCurriculumErrors(CURRICULUM_ISSUES)) {
  const lines = CURRICULUM_ISSUES.filter((issue) => issue.level === 'error').map(
    (issue) => `  ✗ ${issue.where}: ${issue.message}`
  );
  // eslint-disable-next-line no-console
  console.error(
    `[curriculum] invalid content — fix src/data/curriculum/units/*.json:\n${lines.join('\n')}`
  );
}

/** The resolved spine. `../a1Path.ts` derives its exports from this. */
export const RESOLVED_PATH: ResolvedPath = resolvePath(CURRICULUM_FILE);
