/**
 * scripts/curriculum/export.ts — ONE-TIME P0 CONVERSION (run once, then retire)
 *
 * WHY
 * `src/data/a1Path.ts` held ~750 lines of inline content (unit metadata, node
 * lists, pedagogy tables) mixed into TypeScript, so editing a lesson meant
 * editing code. This script moves that content into hand-editable JSON:
 *
 *   src/data/curriculum/clusters.json          the 5 clusters
 *   src/data/curriculum/units/mNN.json         one file per unit (add/remove = file ops)
 *   src/data/curriculum/units.generated.ts     explicit imports (Vite + tsx safe)
 *   scripts/data/a1-curriculum/baseline.json   canonical snapshot BEFORE the change
 *
 * The baseline is the evidence: `scripts/curriculum/verify.ts` recomputes the
 * same structure from the rewritten `a1Path.ts` and diffs it, so P0 can be
 * proven to have changed nothing any consumer can observe.
 *
 * ⚠ AFTER P0 THIS SCRIPT IS SPENT. Do NOT re-run it once content has been edited
 * in the JSON: it regenerates the files from the runtime shape, which does not
 * surface authoring-only fields (`sections`, `teaches`, extra section types) —
 * re-running would silently drop them. It refuses to run when the generated
 * barrel already exists unless you pass --force.
 *
 * Usage:
 *   npx tsx scripts/curriculum/export.ts            # convert (refuses if converted)
 *   npx tsx scripts/curriculum/export.ts --force    # overwrite generated files
 *   npx tsx scripts/curriculum/export.ts --dry-run  # report only, write nothing
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  A1_UNITS,
  A1_LEARN_NODES,
  A1_BONUS_NODES,
  A1_CLUSTERS,
  HONORIFICS,
  WORD_ORDER_PANEL,
  WORD_ORDER_TABLE,
  MODAL_VERB_FINAL_PANEL,
  UM_AM_IM_RULES,
  ACCUSATIVE_RULES,
  DIRECTIONAL_RULES,
  PERFEKT_RULES,
  A1_UNIT_COUNT,
  FIRST_UNIT_INDEX,
  CHECKPOINT_PASS_THRESHOLD,
  MODULE_MASTERY_THRESHOLD,
  DEFAULT_CHECKPOINT_ITEM_COUNT,
  LEGACY_TO_BAND_INDEX,
  BAND_TO_MODULE_INDEX,
  BAND_MIGRATION_MARKER,
  M15_MIGRATION_MARKER,
  remapLegacyUnitIndex,
  remapBandToModuleIndex,
  getNextGatedBandIndex,
  getCheckpointNode,
  getNodeByRoute,
  isLegacyPathNodeId,
  isBandNodeId,
  isSixBandNodeId,
  isModuleNodeId,
  getClusterForModule,
} from '../../src/data/a1Path';
import type {
  CurriculumNodeFile,
  CurriculumUnitFile,
  PathNode,
  A1Unit,
} from '../../src/data/curriculum/schema';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const CURRICULUM_DIR = path.join(ROOT, 'src', 'data', 'curriculum');
const UNITS_DIR = path.join(CURRICULUM_DIR, 'units');
const BASELINE_DIR = path.join(ROOT, 'scripts', 'data', 'a1-curriculum');
const BARREL_FILE = path.join(CURRICULUM_DIR, 'units.generated.ts');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

/** Deep clone through JSON so only real, serialisable data is written. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Deterministic stringify: object keys sorted, `undefined` dropped (exactly as
 * JSON.stringify does). Used for the baseline so the verify diff can never
 * report a false change caused by key insertion order.
 *
 * Shared references are EXPANDED, never marked: an earlier version wrote the
 * literal `"[circular]"` for a repeated object, which corrupted the baseline
 * because the spine shares arrays between `pedagogy` and `units[n].pedagogy`
 * (and, under sorted keys, `pedagogy` is serialised first). The spine data is a
 * DAG, so expansion is correct and terminating.
 *
 * NOTE: the canonical baseline is written by `rebuild-baseline.ts`, not here —
 * see that file's header. This copy is kept so a forced re-run of this retired
 * script cannot write a corrupt baseline.
 */
function stableStringify(value: unknown): string {
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
  return JSON.stringify(walk(value), null, 2) + '\n';
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

/* ── content → JSON ───────────────────────────────────────────────────────── */

/**
 * A resolved spine node back to its authored form.
 * `unitIndex` is deliberately NOT stored: it is derived on read from the owning
 * unit's `order`, which is what makes inserting or reordering units safe.
 */
function toNodeFile(node: PathNode): CurriculumNodeFile {
  const file: CurriculumNodeFile = {
    id: node.id,
    kind: node.kind,
    label: clone(node.label),
    to: node.to,
  };
  if (node.bonus) file.bonus = true;
  if (node.sections && node.sections.length > 0) file.sections = clone(node.sections);
  if (node.teaches) file.teaches = true;
  return file;
}

/**
 * One unit. `index` becomes `order` (1-based) and `nodeIds` is dropped — both
 * are derived on read, which removes the drift class the old file had (a node
 * list and a `nodeIds` list that could disagree, failing only with a console
 * warning at runtime).
 */
function toUnitFile(unit: A1Unit, learn: PathNode[], bonus: PathNode[]): CurriculumUnitFile {
  const file: CurriculumUnitFile = {
    id: unit.id,
    order: unit.index + 1,
    code: unit.code,
    kind: unit.kind,
    cluster: unit.cluster,
    title: clone(unit.title),
    theme: clone(unit.theme),
    goal: clone(unit.goal),
    nodes: learn.map(toNodeFile),
  };
  if (bonus.length > 0) file.bonus = bonus.map(toNodeFile);
  if (unit.checkpoint) file.checkpoint = clone(unit.checkpoint);
  if (unit.pedagogy) file.pedagogy = clone(unit.pedagogy);
  if (unit.vocabCategories && unit.vocabCategories.length > 0) {
    file.vocabCategories = [...unit.vocabCategories];
  }
  if (unit.vocabPos) file.vocabPos = unit.vocabPos;
  if (unit.grammarCategories && unit.grammarCategories.length > 0) {
    file.grammarCategories = [...unit.grammarCategories];
  }
  return file;
}

function buildUnitFiles(): CurriculumUnitFile[] {
  return A1_UNITS.map((unit) =>
    toUnitFile(
      unit,
      A1_LEARN_NODES.filter((n) => n.unitIndex === unit.index),
      A1_BONUS_NODES.filter((n) => n.unitIndex === unit.index)
    )
  );
}

/* ── baseline snapshot (what verify.ts diffs against) ─────────────────────── */

/**
 * Every observable export of `a1Path.ts`, captured BEFORE the content moved.
 * `verify.ts` recomputes this exact structure from the rewritten file and diffs
 * the two, which is how P0 proves "nothing a consumer can see has changed".
 */
function buildBaseline(): Record<string, unknown> {
  return {
    note: 'Canonical pre-P0 snapshot of every observable export of src/data/a1Path.ts. Never regenerated; consumed only by scripts/curriculum/verify.ts.',
    constants: {
      A1_UNIT_COUNT,
      FIRST_UNIT_INDEX,
      CHECKPOINT_PASS_THRESHOLD,
      MODULE_MASTERY_THRESHOLD,
      DEFAULT_CHECKPOINT_ITEM_COUNT,
      LEGACY_TO_BAND_INDEX,
      BAND_TO_MODULE_INDEX,
      BAND_MIGRATION_MARKER,
      M15_MIGRATION_MARKER,
    },
    clusters: A1_CLUSTERS,
    units: A1_UNITS,
    learnNodes: A1_LEARN_NODES,
    bonusNodes: A1_BONUS_NODES,
    curriculum: {
      unitIds: A1_UNITS.map((u) => u.id),
      nodeIds: [...A1_LEARN_NODES, ...A1_BONUS_NODES].map((n) => n.id),
      checkpointIds: A1_UNITS.map((u) => getCheckpointNode(u.index)?.id ?? null),
    },
    pedagogy: {
      HONORIFICS,
      WORD_ORDER_PANEL,
      WORD_ORDER_TABLE,
      MODAL_VERB_FINAL_PANEL,
      UM_AM_IM_RULES,
      ACCUSATIVE_RULES,
      DIRECTIONAL_RULES,
      PERFEKT_RULES,
    },
    functions: {
      remapLegacyUnitIndex: [0, 1, 2, 3, 4, 5].map(remapLegacyUnitIndex),
      remapBandToModuleIndex: [0, 1, 2, 3, 4, 5, 6, 7].map(remapBandToModuleIndex),
      getNextGatedBandIndex: [...Array(A1_UNIT_COUNT).keys()].map(getNextGatedBandIndex),
      checkpointRoutes: [...Array(A1_UNIT_COUNT).keys()].map(
        (index) => getCheckpointNode(index)?.to ?? null
      ),
      clusterForModule: [...Array(A1_UNIT_COUNT).keys()].map((i) => getClusterForModule(i).code),
      nodeByRoute: [
        '/greetings',
        '/greetings?x=1',
        '/grammar?tab=modals',
        '/vocab-trainer?category=family',
        '/roleplay?scene=cafe',
        '/roleplay',
        '/rapid-fire?mode=mixed',
        '/articles',
        '/nope',
      ].map((route) => getNodeByRoute(route)?.id ?? null),
    },
    predicates: {
      sample: [
        'u1-greetings',
        'a-basics',
        BAND_MIGRATION_MARKER,
        'm01-greetings',
        M15_MIGRATION_MARKER,
        'zz-other',
      ].map((id) => ({
        id,
        legacy: isLegacyPathNodeId(id),
        band: isBandNodeId(id),
        sixBand: isSixBandNodeId(id),
        module: isModuleNodeId(id),
      })),
    },
  };
}

/* ── main ─────────────────────────────────────────────────────────────────── */

function main(): void {
  // `--barrel-only` is the ONE part of this script that stays useful forever:
  // after adding or deleting a `units/mNN.json`, it rewrites the import barrel
  // without touching any content.
  if (args.includes('--barrel-only')) {
    const ids = unitIdsOnDisk();
    fs.mkdirSync(CURRICULUM_DIR, { recursive: true });
    fs.writeFileSync(BARREL_FILE, barrelSource(ids), 'utf8');
    console.log(`✓ barrel rewritten for ${ids.length} unit(s): ${ids.join(', ')}`);
    return;
  }

  if (fs.existsSync(BARREL_FILE) && !force && !dryRun) {
    console.error(
      'Refusing to run: src/data/curriculum/units.generated.ts already exists.\n' +
        'This is a ONE-TIME conversion. Re-running it regenerates the JSON from the\n' +
        'runtime shape and would drop authoring-only fields (sections, teaches).\n' +
        'Pass --force only if you know the JSON carries no such fields.'
    );
    process.exit(1);
  }

  const unitFiles = buildUnitFiles();
  const baseline = buildBaseline();
  const nodeCount = unitFiles.reduce(
    (sum, unit) => sum + unit.nodes.length + (unit.bonus?.length ?? 0),
    0
  );

  console.log(`units:      ${unitFiles.length}`);
  console.log(`nodes:      ${nodeCount}`);
  console.log(`clusters:   ${A1_CLUSTERS.length}`);
  console.log(`pedagogy:   ${Object.keys(baseline.pedagogy as object).length} table(s)`);

  if (dryRun) {
    console.log('\nDRY RUN — nothing written.');
    return;
  }

  writeJson(path.join(CURRICULUM_DIR, 'clusters.json'), clone(A1_CLUSTERS));
  for (const unit of unitFiles) {
    writeJson(path.join(UNITS_DIR, `${unit.id}.json`), unit);
  }
  fs.writeFileSync(BARREL_FILE, barrelSource(unitFiles.map((u) => u.id)), 'utf8');
  fs.mkdirSync(BASELINE_DIR, { recursive: true });
  fs.writeFileSync(path.join(BASELINE_DIR, 'baseline.json'), stableStringify(baseline), 'utf8');

  console.log(`\n✓ ${unitFiles.length} unit file(s) → src/data/curriculum/units/`);
  console.log('✓ clusters.json + units.generated.ts');
  console.log('✓ scripts/data/a1-curriculum/baseline.json');
}

main();
function barrelSource(ids: string[]): string {
  if (ids.length === 0) return 'export const UNIT_FILES = [];\n';
  const imports = ids.map((id) => `import ${id} from './units/${id}.json';`).join('\n');
  return `/**
 * src/data/curriculum/units.generated.ts
 *
 * AUTO-GENERATED by the curriculum scripts — DO NOT EDIT BY HAND.
 * Add a unit: create \`units/mNN.json\`, then run \`npm run curriculum:barrel\`.
 */
${imports}

import type { CurriculumUnitFile } from './schema';

export const UNIT_FILES: readonly CurriculumUnitFile[] = [
  ${ids.join(', ')},
] as unknown as readonly CurriculumUnitFile[];
`;
}

/** Unit ids present on disk, ascending. The single source for the barrel. */
function unitIdsOnDisk(): string[] {
  if (!fs.existsSync(UNITS_DIR)) return [];
  return fs
    .readdirSync(UNITS_DIR)
    .filter((file) => /^m\d{2}\.json$/.test(file))
    .map((file) => file.replace(/\.json$/, ''))
    .sort();
}
