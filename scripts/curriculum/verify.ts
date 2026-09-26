/**
 * scripts/curriculum/verify.ts — P0 EVIDENCE
 *
 * Recomputes the observable snapshot of `src/data/a1Path.ts` from the CURRENT
 * (now data-driven) module and diffs it against `baseline.json`, which was
 * derived from the frozen pre-P0 source by `rebuild-baseline.ts`.
 *
 * Two independent checks:
 *   1. EXPORT SURFACE — every `export` name in the pre-P0 backup still exists.
 *   2. VALUE PARITY   — units, nodes, clusters, pedagogy tables, thresholds,
 *                       legacy remaps, route lookups and id predicates.
 *
 * Two deliberate, documented relaxations (both about ORDER, never about set
 * membership):
 *   · bonus chips are compared as a SET. Their authored order changed in P0
 *     because a chip now lives inside its own unit's JSON, so they come out
 *     grouped by unit instead of in the old hand-maintained sequence. Nothing
 *     consumes that order: `A1_BONUS_NODES` has no importer outside a1Path,
 *     `buildCurriculum` only folds it into an id-keyed map, and `getNodeByRoute`
 *     always sees all learn nodes before any bonus node.
 *   · `A1_CURRICULUM.nodes` is `[...learn, ...bonus]`; its learn half is compared
 *     exactly and its bonus half as a set, for the same reason.
 *
 * Usage: npx tsx scripts/curriculum/verify.ts     (exit 1 on any difference)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as current from '../../src/data/a1Path';
import { buildSnapshot, stableStringify } from './snapshot';
import type { PathApi, SpineSnapshot } from './snapshot';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const BASELINE_FILE = path.join(ROOT, 'scripts', 'data', 'a1-curriculum', 'baseline.json');
const BACKUP_FILE = path.join(ROOT, 'scripts', 'data', 'a1-curriculum', '_pre-p0-a1Path.ts.bak');
const CURRENT_FILE = path.join(ROOT, 'src', 'data', 'a1Path.ts');

interface Difference {
  path: string;
  before: string;
  after: string;
}

function preview(value: unknown): string {
  const text = typeof value === 'string' ? value : stableStringify(value);
  return text.length > 140 ? `${text.slice(0, 137)}…` : text;
}

/** Collect leaf differences between two structurally similar values. */
function diff(before: unknown, after: unknown, at: string, out: Difference[], limit = 40): void {
  if (out.length >= limit) return;
  if (stableStringify(before) === stableStringify(after)) return;

  const bothObjects =
    before !== null && after !== null && typeof before === 'object' && typeof after === 'object';
  if (!bothObjects) {
    out.push({ path: at, before: preview(before), after: preview(after) });
    return;
  }

  const keys = new Set([
    ...Object.keys(before as Record<string, unknown>),
    ...Object.keys(after as Record<string, unknown>),
  ]);
  for (const key of [...keys].sort()) {
    diff(
      (before as Record<string, unknown>)[key],
      (after as Record<string, unknown>)[key],
      `${at}.${key}`,
      out,
      limit
    );
    if (out.length >= limit) return;
  }
}

/**
 * Names a file exports, including `export { … }` / `export type { … }` blocks.
 * Comments are stripped first so a commented-out export cannot count.
 */
function exportNames(source: string): string[] {
  const names = new Set<string>();
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

  for (const match of code.matchAll(
    /^export\s+(?:const|function|interface|type)\s+([A-Za-z0-9_$]+)/gm
  )) {
    names.add(match[1]);
  }
  for (const block of code.matchAll(/^export\s+(?:type\s+)?\{([\s\S]*?)\}/gm)) {
    for (const entry of block[1].split(',')) {
      const name = entry.trim().split(/\s+as\s+/)[0]?.trim();
      if (name) names.add(name);
    }
  }
  return [...names].sort();
}

/** Sort a node array by id so set membership can be compared order-insensitively. */
function byId(nodes: unknown[]): unknown[] {
  return [...nodes].sort((a, b) =>
    String((a as { id: string }).id).localeCompare(String((b as { id: string }).id))
  );
}

function main(): void {
  if (!fs.existsSync(BASELINE_FILE)) {
    console.error(
      'baseline.json is missing — run `npx tsx scripts/curriculum/rebuild-baseline.ts` first.'
    );
    process.exit(1);
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) as SpineSnapshot & {
    note?: string;
  };
  delete baseline.note;
  const snapshot: SpineSnapshot = buildSnapshot(current as unknown as PathApi);

  // LESSON METADATA IS AUTHORING-ONLY.
  //
  // `unit.hasLesson` just records that `curriculum/lessons/mNN.json` exists; the
  // content itself lives outside the spine entirely and is lazily imported. The
  // pre-P0 module had no such field, so comparing it against the baseline would
  // report a difference for every unit that has received content — a feature,
  // not a regression. Excluded from the parity diff and reported separately.
  const unitsWithLesson = snapshot.units.filter(
    (unit) => unit && typeof unit === 'object' && 'hasLesson' in (unit as object)
  ).length;
  for (const unit of snapshot.units as unknown as Record<string, unknown>[]) {
    delete unit.hasLesson;
    delete unit.lesson;
  }
  for (const unit of (baseline.units ?? []) as unknown as Record<string, unknown>[]) {
    delete unit.hasLesson;
    delete unit.lesson;
  }

  // ── order-insensitive halves (see the header for why) ────────────────────
  const bonusSequenceChanged =
    stableStringify(baseline.bonusNodes) !== stableStringify(snapshot.bonusNodes);
  baseline.bonusNodes = byId(baseline.bonusNodes);
  snapshot.bonusNodes = byId(snapshot.bonusNodes);

  const learnCount = snapshot.learnNodes.length;
  const normalizeNodeIds = (ids: string[]): string[] => [
    ...ids.slice(0, learnCount),
    ...ids.slice(learnCount).sort(),
  ];
  baseline.curriculum.nodeIds = normalizeNodeIds(baseline.curriculum.nodeIds);
  snapshot.curriculum.nodeIds = normalizeNodeIds(snapshot.curriculum.nodeIds);

  // ── export surface ──────────────────────────────────────────────────────
  // The frozen pre-P0 source is deliberately NOT committed (100 KB of dead code
  // — see .gitignore), so on a fresh clone this check is skipped and only the
  // committed baseline is used. Restore the backup to re-enable it; see
  // scripts/data/a1-curriculum/README.md.
  const hasBackup = fs.existsSync(BACKUP_FILE);
  const beforeNames = hasBackup ? exportNames(fs.readFileSync(BACKUP_FILE, 'utf8')) : [];
  const afterNames = exportNames(fs.readFileSync(CURRENT_FILE, 'utf8'));
  const missing = beforeNames.filter((name) => !afterNames.includes(name));
  const added = beforeNames.length > 0
    ? afterNames.filter((name) => !beforeNames.includes(name))
    : afterNames;

  // ── value parity ────────────────────────────────────────────────────────
  const differences: Difference[] = [];
  diff(baseline, snapshot, 'a1Path', differences);

  if (!hasBackup) {
    console.log('export surface: skipped — no local pre-P0 backup (see the README)');
    console.log(`  current file exports ${afterNames.length} names`);
  } else {
    console.log(`export surface: ${beforeNames.length} before / ${afterNames.length} after`);
    if (missing.length === 0) {
      console.log('  ✓ every pre-P0 export is still present');
    } else {
      console.log(`  ✗ MISSING: ${missing.join(', ')}`);
    }
    if (added.length > 0) {
      console.log(`  + added (additive, harmless): ${added.join(', ')}`);
    }
  }

  if (differences.length === 0) {
    console.log('\nvalue parity: ✓ structurally identical to the pre-P0 baseline');
  } else {
    console.log(`\nvalue parity: ✗ ${differences.length} difference(s)`);
    for (const difference of differences) {
      console.log(`  ${difference.path}`);
      console.log(`      before: ${difference.before}`);
      console.log(`      after:  ${difference.after}`);
    }
  }

  if (bonusSequenceChanged) {
    console.log('\nbonus chip sequence: changed intentionally — set parity verified above');
    console.log('  each chip now lives in its own unit file, so they group by unit.');
  }
  console.log(
    `lesson content: ${unitsWithLesson}/${snapshot.units.length} unit(s) carry imported document material (authoring data, excluded from parity)`
  );

  if (missing.length > 0 || differences.length > 0) {
    console.error('\nP0 NOT VERIFIED');
    process.exit(1);
  }
  console.log('\nP0 VERIFIED — the spine renders from data and every observable export is unchanged.');
}

main();
