/**
 * scripts/curriculum/repin-routing-baseline.ts
 *
 *   npm run curriculum:repin-baseline            # dry run
 *   npm run curriculum:repin-baseline -- --write
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * `curriculum:verify` diffs the spine's observable snapshot against
 * `scripts/data/a1-curriculum/baseline.json`, which was derived from the frozen
 * pre-refactor source. Its whole job is to fail when routing changes by accident.
 *
 * On 2026-09-29 the routing was changed ON PURPOSE: every unit's `learn` node was
 * repointed from a shared tool page to that unit's own lesson, and the tool it
 * pointed at moved down to the `practice` node. See
 * `scripts/curriculum/repoint-learn-nodes.ts` for the change and its reasoning.
 *
 * So the baseline is stale by design, and the right response is a DELIBERATE,
 * NARROW re-pin — not a blanket "accept whatever the code says now", which would
 * turn the guard back into a tautology.
 *
 * ── WHY ONLY THREE THINGS ────────────────────────────────────────────────────
 * `learnNodes` and `functions.nodeByRoute` describe where the spine sends a
 * learner. `units[].vocabCategories` was separately corrected on the same day —
 * the tags were valid but pointed at the WRONG units (M04 "Family" resolved to
 * M02's and M05's tags), which silently fed the themed glossary and the unit-
 * filtered tool pools the wrong vocabulary. No validator caught it, because the
 * values were real tags rather than invalid ones.
 *
 * Everything else in the snapshot — clusters, checkpoint specs, pedagogy tables,
 * thresholds, id remaps, XP, node ids, lesson metadata — is untouched and MUST
 * keep failing if it ever drifts. This script refuses to write any other key, and
 * prints the full before/after for what it does touch.
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildSnapshot, stableStringify } from './snapshot';
import type { PathApi, SpineSnapshot } from './snapshot';
import * as current from '../../src/data/a1Path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const BASELINE_FILE = path.join(ROOT, 'scripts', 'data', 'a1-curriculum', 'baseline.json');

const write = process.argv.includes('--write');

const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) as SpineSnapshot & { note?: string };
const snapshot = buildSnapshot(current as unknown as PathApi);

if (baseline.learnNodes) delete (baseline.learnNodes as unknown as Record<string, unknown>).note;

// Vocab categories are re-pinned PER UNIT, keyed on the unit's own id — never as a
// wholesale array copy. Copying the array would let a changed unit id, title,
// cluster or checkpoint ride along silently, which is the whole class of drift
// this file exists to catch.
const baseUnits = (baseline.units ?? []) as unknown as Record<string, unknown>[];
const nextUnits = (snapshot.units ?? []) as unknown as Record<string, unknown>[];
const byId = new Map(baseUnits.map((u) => [u.id, u]));
let categoriesChanged = 0;
for (const unit of nextUnits) {
  const target = byId.get(unit.id);
  if (!target) continue;
  if (stableStringify(target.vocabCategories) === stableStringify(unit.vocabCategories)) continue;
  categoriesChanged += 1;
  target.vocabCategories = unit.vocabCategories;
}

const before = {
  learnNodes: stableStringify(baseline.learnNodes),
  nodeByRoute: stableStringify(baseline.functions?.nodeByRoute),
};
const after = {
  learnNodes: stableStringify(snapshot.learnNodes),
  nodeByRoute: stableStringify(snapshot.functions?.nodeByRoute),
};

// The `curriculum.nodeIds` list grew by the fifteen `mNN-tool` bonus nodes that
// re-homed the old learn tools. Re-pinned ONLY if the list is otherwise
// identical — if anything else moved, this refuses rather than overwriting, so a
// genuine drift can never be absorbed by "just re-pin it".
const isToolId = (id: string): boolean => /^m\d\d-tool$/.test(id);
const baseNodeIds = (baseline.curriculum?.nodeIds ?? []) as string[];
const nextNodeIds = (snapshot.curriculum?.nodeIds ?? []) as string[];
const strippedNext = nextNodeIds.filter((id) => !isToolId(id));
let nodeIdsChanged = 0;
if (JSON.stringify(strippedNext) === JSON.stringify(baseNodeIds) && nextNodeIds.length !== baseNodeIds.length) {
  nodeIdsChanged = nextNodeIds.length - baseNodeIds.length;
  baseline.curriculum.nodeIds = nextNodeIds;
} else if (JSON.stringify(strippedNext) !== JSON.stringify(baseNodeIds)) {
  console.log('  curriculum.nodeIds: UNEXPECTED drift beyond the tool nodes — NOT re-pinned.');
}

// The same guard, per unit. `computeModuleProgress` counts a unit's non-checkpoint
// nodes, so a missing `mNN-tool` here would change every unit's percentage.
let unitNodeIdsChanged = 0;
let unitNodeIdsRefused = 0;
for (let i = 0; i < (snapshot.units ?? []).length; i += 1) {
  const next = snapshot.units![i] as unknown as { id: string; nodeIds: string[] };
  const base = (baseline.units ?? [])[i] as unknown as { id: string; nodeIds: string[] } | undefined;
  if (!base || base.id !== next.id) {
    unitNodeIdsRefused += 1;
    continue;
  }
  const strippedBase = base.nodeIds.filter((id) => !isToolId(id));
  const strippedUnit = next.nodeIds.filter((id) => !isToolId(id));
  if (JSON.stringify(strippedBase) === JSON.stringify(strippedUnit) && base.nodeIds.length !== next.nodeIds.length) {
    unitNodeIdsChanged += 1;
    base.nodeIds = next.nodeIds;
  } else if (JSON.stringify(strippedBase) !== JSON.stringify(strippedUnit)) {
    unitNodeIdsRefused += 1;
  }
}
if (unitNodeIdsRefused > 0) {
  console.log(`  units[].nodeIds: ${unitNodeIdsRefused} unit(s) drifted unexpectedly — NOT re-pinned.`);
}

console.log(`\nRE-PINNING (routing + bonus node ids only)\n`);
for (const key of ['learnNodes', 'nodeByRoute'] as const) {
  const slot = key === 'learnNodes' ? before.learnNodes : before.nodeByRoute;
  const next = key === 'learnNodes' ? after.learnNodes : after.nodeByRoute;
  console.log(`  ${key}: ${slot === next ? 'unchanged' : 'CHANGED'}`);
  if (slot !== next) {
    console.log(`    before: ${truncate(slot)}`);
    console.log(`    after:  ${truncate(next)}`);
  }
}
console.log(`  units[].vocabCategories: ${categoriesChanged} unit(s) re-pinned`);
console.log(`  curriculum.nodeIds:      ${nodeIdsChanged} tool id(s) re-pinned`);
console.log(`  units[].nodeIds:         ${unitNodeIdsChanged} unit(s) re-pinned`);

const unchanged =
  before.learnNodes === after.learnNodes &&
  before.nodeByRoute === after.nodeByRoute &&
  categoriesChanged === 0 &&
  nodeIdsChanged === 0 &&
  unitNodeIdsChanged === 0;

if (unchanged) {
  console.log('\nNothing to re-pin — the baseline already matches.');
  process.exit(0);
}

console.log('\n  Reason 1: every `learn` node was repointed from a shared tool page to its own');
console.log('  lesson. The tool it pointed at became an `mNN-tool` BONUS node — NOT a');
console.log('  replacement for `practice`, which overwrote sixteen real drills.');
console.log('  Reason 2: unit `vocabCategories` was corrected against a closed vocabulary that');
console.log('  lives in src/data/vocab/, then reverted — HEAD held the only legal values.');
console.log('  Clusters, checkpoints, pedagogy, thresholds, XP and id remaps are NOT touched.');

if (!write) {
  console.log('\nDry run — nothing written. Re-run with --write to apply.');
  process.exit(0);
}

baseline.learnNodes = snapshot.learnNodes;
if (baseline.functions) baseline.functions.nodeByRoute = snapshot.functions?.nodeByRoute;
fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
console.log('\nRe-pinned. Run `npm run curriculum:verify` to confirm P0 VERIFIED.');

function truncate(s: string, n = 200): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
