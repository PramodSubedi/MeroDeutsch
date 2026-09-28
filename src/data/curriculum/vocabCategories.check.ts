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
  word?: string;
  part_of_speech?: string;
  /** Authored scalar category in the local staging batches. */
  category?: string;
}

interface EnrichedCard {
  lemma?: string;
  partOfSpeech?: string;
  /** The field the runtime actually matches on — see the loader note below. */
  tags?: string[];
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
const UNITS_DIR = path.join(ROOT, 'src/data/curriculum/units');
const ENRICHED_FILE = path.join(ROOT, 'public/data/enriched-vocab.json');
const VOCAB_DIR = path.join(ROOT, 'src/data/vocab');

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
// WHY THIS READS TWO FILES, AND WHY THE OBVIOUS ONE IS THE WRONG ONE
//
// `getVocabularyByCategories` selects on a card's `tags` array, not a `category`
// column — see localCurriculumService pass 1 (`c.tags.some(t => cats.includes(t))`)
// and `supabaseCurriculumService` (`p_category = ANY(tags)`). Migration
// 20260928040000 dropped `category` outright. So `tags` is the field a unit's
// `vocabCategories` is actually resolved against, and `enriched-vocab.json` —
// which is TRACKED and carries `tags` — is the faithful source for this check.
//
// `src/data/vocab/*.json` is the opposite on both counts: it is gitignored
// (.gitignore: "Seeding-pipeline staging data, kept local, not app code") and it
// stores a single scalar `category`. A check that read only that directory was
// asserting against a file a fresh CI clone does not have — it could not run in
// CI at all, which is where a content gate has to run.
//
// It is still read, when present, because `seedVocab` unions both sources into
// the one `vocabulary` table (scripts/seedVocab.ts). Including it makes a local
// run a superset of CI rather than a divergent one, and it is folded into a
// one-element tags[] here the same way `toDbRow` folds it there.
//
// A previous version of this file asserted the opposite — that the staging dir
// was "the in-repo source of truth … always present" — and that false premise is
// exactly what made it crash with ENOENT on every clean CI run.
const categoryCounts = new Map<string, number>();
const sources: string[] = [];
// Cards are keyed like seedVocab's `onConflict: 'word,part_of_speech'` so the
// same word is not counted twice. The VALUE is the union of that card's topical
// tags across every source, because a single card legitimately appears several
// times: the enriched export holds both a bare `["noun","A1"]` row and a later
// enriched row for the same lemma, and the local staging batches repeat it again.
// Merging (rather than first-wins) is what keeps the topical tag from being
// silently dropped by whichever duplicate happened to be read first — which is
// precisely the kind of silent loss this check exists to catch.
const cardTags = new Map<string, Set<string>>();

// Deliberately NOT `isTopicalTag`. That helper answers "is this a category a
// learner can browse in the Glossary", where the `unit1`…`unit5` markers are
// treated as structural. This check answers a different question — "does a unit's
// `vocabCategories` entry match a card" — and the runtime answers it with a
// literal `c.tags.includes(cat)` / `p_category = ANY(tags)`, with no filtering.
// So the same tag can be structural for the Glossary and still be exactly what a
// unit must declare: `unit2-nouns`, `unit5-expressions` and friends are real
// declared categories in `units/*.json`. Filtering them here would have failed
// six units for a tag the loader matches on happily.
//
// Only the two shapes no loader can ever match are dropped: non-strings, and the
// CEFR level tags that are added to every single card by `toDbRow`.
const LEVEL_RE = /^[ab][12]$/i;

function addCard(key: string, tags: readonly string[]): void {
  let merged = cardTags.get(key);
  if (!merged) cardTags.set(key, (merged = new Set()));
  for (const raw of tags) {
    if (typeof raw !== 'string') continue;
    const tag = raw.trim();
    if (!tag || LEVEL_RE.test(tag)) continue;
    merged.add(tag);
  }
}

if (fs.existsSync(ENRICHED_FILE)) {
  const cards = JSON.parse(fs.readFileSync(ENRICHED_FILE, 'utf8')) as EnrichedCard[];
  for (const card of cards) {
    if (!card.lemma) continue;
    addCard(`${card.lemma}|${card.partOfSpeech ?? 'noun'}`, card.tags ?? []);
  }
  sources.push('public/data/enriched-vocab.json');
}

if (fs.existsSync(VOCAB_DIR)) {
  for (const file of fs.readdirSync(VOCAB_DIR).filter((f) => f.endsWith('.json'))) {
    const rows = JSON.parse(fs.readFileSync(path.join(VOCAB_DIR, file), 'utf8')) as VocabRow[];
    for (const row of rows) {
      if (!row.word) continue;
      // Scalar `category` becomes a one-element tags[], mirroring toDbRow().
      addCard(`${row.word}|${row.part_of_speech ?? 'noun'}`, row.category ? [row.category] : []);
    }
  }
  sources.push('src/data/vocab/*.json');
}

// Distinct cards per category, computed from the merged tag sets.
for (const tags of cardTags.values()) {
  for (const tag of tags) {
    categoryCounts.set(tag, (categoryCounts.get(tag) ?? 0) + 1);
  }
}

if (categoryCounts.size === 0) {
  // NOT a skip. A typo'd category is a silent content regression, so exiting 0
  // here would re-create the exact failure this file was written to catch: a
  // green suite that has checked nothing. Fail loudly and say how to fix it.
  console.error(
    '\nFAILED: no vocabulary source found — cannot verify unit vocabCategories.\n' +
      `  Looked for: ${ENRICHED_FILE}\n` +
      `              ${VOCAB_DIR}\n` +
      '  `public/data/enriched-vocab.json` is tracked and must be present; if it is\n' +
      '  missing, restore it with `git checkout -- public/data/enriched-vocab.json`.\n',
  );
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
