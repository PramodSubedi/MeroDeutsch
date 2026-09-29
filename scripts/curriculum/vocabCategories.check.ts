/**
 * scripts/curriculum/vocabCategories.check.ts
 *
 *   npm run check:vocabcats
 *
 * ── WHAT THIS IS FOR ─────────────────────────────────────────────────────────
 * Every unit in `src/data/curriculum/units/*.json` declares `vocabCategories`.
 * Those names are resolved at runtime by
 * `curriculumService.getVocabularyByCategories()`, which matches them against
 * the `tags` on each vocabulary card and then falls back to an unthemed
 * "first 60 A1 cards in primary-key order" fill when NOTHING matches.
 *
 * That fallback is why this rotted silently. Eight unit configs referenced
 * category names that have never existed in any vocab file — `personal`,
 * `numbers`, `alphabet`, `family`, `people`, `housing`, `travel`, `clothing`.
 * Units 2, 3 and 4 matched zero cards, so all three drew from the identical
 * generic prefix (Haus, Mutter, Vater, sein, haben, …) instead of their own
 * theme. No error, no empty deck, no failed build: the checkpoint just served
 * the same handful of words forever, which is exactly the "the questions feel
 * repeated" complaint.
 *
 * A typo'd category name is therefore not a crash — it is a silent content
 * regression. So the two properties that make a themed unit actually work are
 * asserted here instead of being trusted:
 *
 *   1. every declared category resolves to at least one vocab card, and
 *   2. the resulting pool is larger than the deck the unit draws, so the
 *      deck is not forced to be identical on every attempt.
 *
 * Run:  npm run check:vocabcats
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildVocabCategoryIndex } from './vocabCategoryIndex';

interface UnitFile {
  id: string;
  title?: { en?: string };
  vocabCategories?: string[];
  checkpoint?: { specs?: { type: string; count: number }[] };
}

// Resolved from the process cwd, matching scripts/genContentPools.ts — npm
// always invokes these from the repo root, and ESM gives us no `__dirname`.
// Only the units directory is needed here; the vocabulary sources are the shared
// module's business.
const ROOT = process.cwd();
const UNITS_DIR = path.join(ROOT, 'src/data/curriculum/units');

let checks = 0;
const failures: string[] = [];
const warnings: string[] = [];

function check(label: string, condition: boolean, detail = ''): void {
  checks += 1;
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    failures.push(label);
  }
}

function warn(label: string, detail = ''): void {
  console.log(`  WARN  ${label}${detail ? ` — ${detail}` : ''}`);
  warnings.push(label);
}

// ── 1. Build the set of categories that actually exist ────────────────────────
//
// The derivation — which files count, why `tags` and not `category`, why the
// CEFR level tags are dropped, and why an absent source is a hard failure rather
// than an empty set — lives in `vocabCategoryIndex.ts`, shared with
// `curriculum:validate`. That gate refuses a typo'd category at author time, this
// one additionally proves the pool can fill the deck. They must not hold two
// copies of the vocabulary, because two copies drift and a drifted list is the
// original defect in a different hat.
let categoryCounts: ReadonlyMap<string, number>;
let sources: readonly string[];
try {
  const index = buildVocabCategoryIndex();
  categoryCounts = index.counts;
  sources = index.sources;
} catch (err) {
  // NOT a skip. A typo'd category is a silent content regression, so exiting 0
  // here would re-create the exact failure this file was written to catch: a
  // green suite that has checked nothing. Fail loudly and say how to fix it.
  console.error(`\nFAILED: ${(err as Error).message}`);
  process.exit(1);
}

console.log(
  `\nVocabulary categories available: ${categoryCounts.size} ` +
    `(${[...categoryCounts.values()].reduce((a, b) => a + b, 0)} cards) ` +
    `from ${sources.join(' + ')}\n`,
);

// ── 2. Every unit category must resolve ───────────────────────────────────────
const units = fs
  .readdirSync(UNITS_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(UNITS_DIR, f), 'utf8')) as UnitFile)
  .sort((a, b) => a.id.localeCompare(b.id));

for (const unit of units) {
  const declared = unit.vocabCategories ?? [];
  if (declared.length === 0) continue;

  const unknown = declared.filter((c) => !categoryCounts.has(c));
  check(
    `${unit.id} declares only real vocabulary categories`,
    unknown.length === 0,
    unknown.length ? `no such category: ${unknown.join(', ')}` : ''
  );
}

// ── 3. The themed pool must be able to fill the deck without repeating ────────
// `pickNUnique` draws without replacement, but a pool of N cannot vary when the
// deck needs N. A pool strictly larger than the need is the minimum bar for a
// checkpoint to re-roll usefully.
for (const unit of units) {
  const specs = unit.checkpoint?.specs ?? [];
  const vocabSpecs = specs.filter(
    (s) => s.type.startsWith('vocab-') || s.type === 'listening-gap'
  );
  if (vocabSpecs.length === 0) continue;

  const need = vocabSpecs.reduce((sum, s) => sum + s.count, 0);
  const pool = (unit.vocabCategories ?? []).reduce(
    (sum, c) => sum + (categoryCounts.get(c) ?? 0),
    0
  );

  if (pool === 0) {
    check(
      `${unit.id} resolves a vocabulary pool for its checkpoint`,
      false,
      `needs ${need} cards but no declared category matches anything`
    );
  } else if (pool <= need) {
    warn(
      `${unit.id} vocabulary pool is not much larger than its deck`,
      `pool ${pool} vs deck ${need} — near-zero variation between attempts`
    );
  } else {
    check(
      `${unit.id} vocabulary pool exceeds its deck`,
      true,
      `pool ${pool} > deck ${need}`
    );
  }
}

console.log(
  `\n${checks - failures.length}/${checks} checks passed, ${warnings.length} warning(s).`
);
if (failures.length > 0) {
  console.error(`\nFAILED: ${failures.length} check(s) — ${failures.join('; ')}`);
  process.exit(1);
}
console.log('OK');
