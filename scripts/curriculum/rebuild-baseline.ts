/**
 * scripts/curriculum/rebuild-baseline.ts
 *
 * Writes the P0 evidence baseline: `scripts/data/a1-curriculum/baseline.json`,
 * the canonical snapshot of EVERY observable export of `a1Path.ts` as it was
 * BEFORE the content moved into JSON.
 *
 * It derives that snapshot from `scripts/data/a1-curriculum/_legacy.ts` — a byte
 * copy of the original inline-content file, which had no imports of its own.
 * Using a copy rather than `git show` is deliberate: the working tree carried
 * uncommitted changes when P0 started, so HEAD does NOT reproduce the spine that
 * was actually converted. `_legacy.ts` does.
 *
 * `verify.ts` then recomputes the same shape from the current data-driven module
 * and diffs the two.
 *
 * Usage: npx tsx scripts/curriculum/rebuild-baseline.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as legacy from '../data/a1-curriculum/_legacy';
import { buildSnapshot, stableStringify } from './snapshot';
import type { PathApi } from './snapshot';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const BASELINE_FILE = path.join(ROOT, 'scripts', 'data', 'a1-curriculum', 'baseline.json');

/** The legacy module is structurally compatible; its types are its own copies. */
const snapshot = buildSnapshot(legacy as unknown as PathApi);

const payload = {
  note: 'Canonical pre-P0 snapshot of every observable export of src/data/a1Path.ts, derived from scripts/data/a1-curriculum/_legacy.ts by rebuild-baseline.ts. Consumed only by verify.ts.',
  ...snapshot,
};

// Canonical (key-sorted) content, pretty-printed for reviewability: the file is
// diffed against a summary by verify.ts, and read by humans when a check fails.
fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
fs.writeFileSync(BASELINE_FILE, JSON.stringify(JSON.parse(stableStringify(payload)), null, 2) + '\n', 'utf8');

console.log('✓ baseline.json rebuilt from the frozen pre-P0 source');
console.log(`  units:      ${snapshot.units.length}`);
console.log(`  learnNodes: ${snapshot.learnNodes.length}`);
console.log(`  bonusNodes: ${snapshot.bonusNodes.length}`);
console.log(`  clusters:   ${snapshot.clusters.length}`);