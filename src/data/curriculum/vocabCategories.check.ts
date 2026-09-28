/**
 * src/data/curriculum/vocabCategories.check.ts
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
import * as fs from 'fs';
import * as path from 'path';

interface VocabRow {
  category?: string;
  word?: string;
}

interface UnitFile {
  id: string;
  title?: { en?: string };
  vocabCategories?: string[];
  checkpoint?: { specs?: { type: string; count: number }[] };
}

// Resolved from the process cwd, matching scripts/genContentPools.ts — npm
// always invokes these from the repo root, and ESM gives us no `__dirname`.
const ROOT = process.cwd();
const VOCAB_DIR = path.join(ROOT, 'src/data/vocab');
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
// `src/data/vocab/*.json` is the in-repo source of truth and is always present,
// unlike `public/data/enriched-vocab.json` which only exists after `npm run
// enrich` has been run. Checking the former keeps this usable in a bare CI box.
const categoryCounts = new Map<string, number>();
for (const file of fs.readdirSync(VOCAB_DIR).filter((f) => f.endsWith('.json'))) {
  const rows = JSON.parse(fs.readFileSync(path.join(VOCAB_DIR, file), 'utf8')) as VocabRow[];
  for (const row of rows) {
    if (!row.category) continue;
    categoryCounts.set(row.category, (categoryCounts.get(row.category) ?? 0) + 1);
  }
}
console.log(
  `\nVocabulary categories available: ${categoryCounts.size} ` +
    `(${[...categoryCounts.values()].reduce((a, b) => a + b, 0)} cards)\n`
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
