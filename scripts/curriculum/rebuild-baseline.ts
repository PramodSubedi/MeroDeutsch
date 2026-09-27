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
 *
 * ── `--from-current` (added 2026-09-30) ─────────────────────────────────────
 * By default this ALWAYS rebuilds the pre-P0 baseline from `_legacy.ts`, which
 * is why it can never accept a re-sequence: it faithfully reproduces the old
 * 15-unit spine forever, and `verify.ts` stays red no matter what you do.
 *
 * That is correct for P0 and useless afterwards. The v4.0 sequence re-cut the
 * course to 16 units, renamed node ids (`m11-shopping` → `m11-practice`) and
 * regrouped the bonus chips — all deliberate — which left 40 differences that
 * could not be cleared by any existing command.
 *
 * `--from-current` snapshots the LIVE `src/data/a1Path.ts` instead, which is
 * how you accept a deliberate re-sequence as the new truth. It is deliberately
 * NOT the default: the default must keep proving the ORIGINAL conversion was
 * faithful, and a flag that quietly re-cut the baseline on a typo would turn
 * the drift detector into a rubber stamp.
 *
 * Re-cutting is not free of consequence, so it is loud: it archives the
 * previous baseline next to itself rather than overwriting it, and it prints
 * the unit/node counts so a 15 → 16 jump is visible in the commit rather than
 * discovered later.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as legacy from '../data/a1-curriculum/_legacy';
import * as current from '../../src/data/a1Path';
import { buildSnapshot, stableStringify } from './snapshot';
import type { PathApi } from './snapshot';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const BASELINE_FILE = path.join(ROOT, 'scripts', 'data', 'a1-curriculum', 'baseline.json');
// The pre-P0 evidence, written ONCE and never overwritten. An earlier version of
// this script archived to a single rolling `baseline-archive.json`, which meant a
// second re-cut destroyed the first — losing the only record of the original
// spine. A name that describes what it holds, plus a never-overwrite rule, makes
// that impossible. (It is also recoverable from git, but only if you know to
// look; a file named for its purpose is the difference between evidence and a
// coincidence.)
const PRE_P0_FILE = path.join(ROOT, 'scripts', 'data', 'a1-curriculum', 'baseline-pre-p0.json');

/**
 * Accept the CURRENT spine as the new baseline, archiving the old one first.
 * Without the archive a re-cut destroys the only record of what the spine used
 * to be, which is the entire thing `verify.ts` exists to detect.
 */
function fromCurrent(): void {
  // The live spine. Statically imported rather than `require`d: this module is
  // ESM ("type": "module"), where `require` is not defined.
  const snapshot = buildSnapshot(current as unknown as PathApi);

  const payload = {
    note:
      'Baseline of the CURRENT spine, re-cut with `rebuild-baseline.ts --from-current` after a ' +
      'deliberate re-sequence. The pre-P0 baseline it replaced is kept, never overwritten, at ' +
      'baseline-pre-p0.json; differences between the two are the re-sequence.',
    ...snapshot,
  };

  if (!fs.existsSync(PRE_P0_FILE)) {
    fs.copyFileSync(BASELINE_FILE, PRE_P0_FILE);
    console.log('· previous baseline preserved at baseline-pre-p0.json');
  } else {
    console.log('· baseline-pre-p0.json already exists — left untouched');
  }

  fs.writeFileSync(BASELINE_FILE, JSON.stringify(JSON.parse(stableStringify(payload)), null, 2) + '\n', 'utf8');
  console.log('✓ baseline.json re-cut from the CURRENT spine');
  console.log(`  units:      ${snapshot.units.length}`);
  console.log(`  learnNodes: ${snapshot.learnNodes.length}`);
  console.log(`  bonusNodes: ${snapshot.bonusNodes.length}`);
  console.log(`  clusters:   ${snapshot.clusters.length}`);
  return;
}

if (process.argv.includes('--from-current')) {
  fromCurrent();
} else {
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
}