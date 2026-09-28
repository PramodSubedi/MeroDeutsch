/**
 * scripts/checkAudio.check.ts — `npm run check:audio`
 *
 * THE REGRESSION LOCK FOR THE BUNDLED TTS CATALOGUE.
 *
 * 813 MP3s live in `public/audio/anki/` (~12.9 MB) and are reached through three
 * independent records: the generated `AUDIO_BY_LEMMA` map, `VocabCard.audioUrl`
 * in `public/data/enriched-vocab.json`, and `VocabCard.examples[].audioUrl`.
 * Nothing at runtime can notice a stale record — a bad URL just silently falls
 * back to `speechSynthesis`, which sounds close enough to pass unnoticed. That
 * is exactly how 197 of the 813 clips were unreachable for so long.
 *
 * FAILS (exit 1) on:
 *   1. A manifest / audioUrl pointing at a file that does not exist.
 *   2. An audioUrl outside `/audio/anki/` (wrong prefix, or an absolute URL —
 *      these would hit the network instead of the shipped asset).
 *   3. `AUDIO_BY_LEMMA` disagreeing with the cards that generated it (stale
 *      generated file, or a hand edit — the file says do-not-edit).
 *
 * REPORTS (exit 0) on: orphan clips, self-answering cards, lemma-level audio
 * coverage, and per-tag audio coverage — the last one is the gate for whether a
 * unit may declare the `listening-gap` checkpoint source.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const AUDIO_DIR = path.join(ROOT, 'public', 'audio', 'anki');
const VOCAB_PATH = path.join(ROOT, 'public', 'data', 'enriched-vocab.json');
const MANIFEST_PATH = path.join(ROOT, 'src', 'data', 'audioManifest.ts');

const AUDIO_PREFIX = '/audio/anki/';

const failures: string[] = [];

/** Latin letters plus German umlauts/ß — what a German lemma or prompt can be. */
const GERMANISH = /^[a-zäöüß0-9'’\- ]+$/;

function fail(msg: string) {
  failures.push(msg);
}

// ── 0. Preconditions ────────────────────────────────────────────────────────

if (!fs.existsSync(AUDIO_DIR)) {
  console.error(`FATAL: ${AUDIO_DIR} does not exist. The audio catalogue is missing.`);
  process.exit(1);
}
if (!fs.existsSync(VOCAB_PATH)) {
  console.error(`FATAL: ${VOCAB_PATH} does not exist. Run scripts/bundle-offline-seed.cjs first.`);
  process.exit(1);
}
if (!fs.existsSync(MANIFEST_PATH)) {
  console.error(`FATAL: ${MANIFEST_PATH} does not exist. Run scripts/bundle-offline-seed.cjs first.`);
  process.exit(1);
}

const filesOnDisk = new Set(
  fs
    .readdirSync(AUDIO_DIR)
    .filter((f) => f.toLowerCase().endsWith('.mp3'))
    .map((f) => f),
);
const referencedClips = new Set<string>();

// ── 1. Validate one audio URL, recording the outcome ────────────────────────

function checkUrl(url: unknown, where: string): void {
  if (url === null || url === undefined) return;
  if (typeof url !== 'string' || url.length === 0) {
    fail(`${where}: audioUrl is not a non-empty string (got ${JSON.stringify(url)})`);
    return;
  }
  if (!url.startsWith(AUDIO_PREFIX)) {
    fail(`${where}: "${url}" is not under ${AUDIO_PREFIX} — it would hit the network instead of the shipped asset`);
    return;
  }
  const file = url.slice(AUDIO_PREFIX.length);
  referencedClips.add(file);
  if (!filesOnDisk.has(file)) {
    fail(`${where}: "${url}" does not exist in public/audio/anki/`);
  }
}

// ── 2. The generated manifest ───────────────────────────────────────────────

console.log('=== 1. AUDIO_BY_LEMMA (src/data/audioManifest.ts) ===');

const manifestSrc = fs.readFileSync(MANIFEST_PATH, 'utf8');
const manifestBody = manifestSrc.slice(
  manifestSrc.indexOf('AUDIO_BY_LEMMA'),
);
const manifest = new Map<string, string>();
const entryRe = /"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
let m: RegExpExecArray | null;
while ((m = entryRe.exec(manifestBody)) !== null) {
  const key = JSON.parse(`"${m[1]}"`) as string;
  const url = JSON.parse(`"${m[2]}"`) as string;
  manifest.set(key, url);
}

if (manifest.size === 0) {
  fail('AUDIO_BY_LEMMA parsed to 0 entries — the generated file is empty or malformed');
}

for (const [key, url] of manifest) {
  checkUrl(url, `AUDIO_BY_LEMMA["${key}"]`);
}

console.log(`  ${manifest.size} keys, all URLs validated`);

// ── 3. The offline boot seed ────────────────────────────────────────────────

console.log('\n=== 2. public/data/enriched-vocab.json ===');

interface SeedExample {
  de?: string;
  en?: string;
  np?: string;
  audioUrl?: string | null;
}
interface SeedCard {
  lemma?: string;
  tags?: string[] | null;
  audioUrl?: string | null;
  examples?: SeedExample[] | null;
}

const cards = JSON.parse(fs.readFileSync(VOCAB_PATH, 'utf8')) as SeedCard[];

const cardsWithAudio: SeedCard[] = [];
/**
 * Key -> clip, LAST WRITE WINS — the same rule `buildManifest` applies. Several
 * Anki cards share a lemma (each with its own example sentence and clip), so
 * comparing card-by-card against the manifest would report a false mismatch on
 * every duplicate except the winner. Build the same map, then diff the maps.
 */
const expectedFromSeed = new Map<string, string>();
/** Every lowercase English translation, for the self-answering report (rule 4). */
const englishTranslations = new Set<string>();
let examplesWithAudio = 0;
const perTag = new Map<string, { total: number; withAudio: number }>();

for (const card of cards) {
  const lemma = (card.lemma ?? '').trim();
  if (!lemma) continue;

  checkUrl(card.audioUrl, `enriched-vocab.json card "${lemma}".audioUrl`);

  let hasExampleAudio = false;
  for (const ex of card.examples ?? []) {
    checkUrl(ex?.audioUrl, `enriched-vocab.json card "${lemma}" example "${ex?.de ?? ''}".audioUrl`);
    if (ex?.audioUrl) {
      hasExampleAudio = true;
      examplesWithAudio++;
    }
  }

  const en = (card as { translation?: { en?: string } }).translation?.en?.trim();
  if (en) englishTranslations.add(en.toLowerCase());

  const audible = Boolean(card.audioUrl) || hasExampleAudio;
  if (audible) {
    cardsWithAudio.push(card);
    if (card.audioUrl) expectedFromSeed.set(lemma.toLowerCase(), card.audioUrl);
  }

  for (const tag of card.tags ?? []) {
    if (!tag) continue;
    const bucket = perTag.get(tag) ?? { total: 0, withAudio: 0 };
    bucket.total++;
    if (audible) bucket.withAudio++;
    perTag.set(tag, bucket);
  }
}

// Rule 3: the manifest must agree with the seed it was generated from, for
// every exact lemma key.
for (const [key, url] of expectedFromSeed) {
  const inManifest = manifest.get(key);
  if (inManifest !== url) {
    fail(
      `stale AUDIO_BY_LEMMA["${key}"]: manifest has ${inManifest ?? '<absent>'}, ` +
        `enriched-vocab.json has ${url}. Re-run scripts/bundle-offline-seed.cjs.`,
    );
  }
}

// Rule 4, REPORTED not failed: cards whose `translation.en` equals the German
// lemma are self-answering — the prompt text IS the answer. That is a seed
// data-quality issue (the Anki deck stores the German base form in the `en`
// field for cognate entries like antworten/finden/schön), not an audio bug,
// but it has an audio consequence worth surfacing: a pre-lock
// `speakPrompt: v.en` for such a card will now resolve to a bundled recording
// of the answer, because AUDIO_BY_LEMMA is keyed by that same German string.
//
// An earlier version of this check FAILED on the key/translation collision and
// produced 144 false positives, because "is this English?" is not decidable
// from the data (a German cognate and an English gloss are the same string).
// The self-answering set is the part that is decidable, and the part that
// matters.
const selfAnswering: string[] = [];
for (const card of cards) {
  const lemma = (card.lemma ?? '').trim().toLowerCase();
  const en = (card as { translation?: { en?: string } }).translation?.en?.trim().toLowerCase();
  if (!lemma || !en) continue;
  if (lemma === en) selfAnswering.push(card.lemma as string);
}

// Wordlist apparatus in keys is expected (the source deck's printed headwords
// are preserved verbatim and normalized aliases sit alongside them). Report it
// so an unexpected rise is visible, but do not fail on it.
const apparatusKeys = [...manifest.keys()].filter((k) => !GERMANISH.test(k));

console.log(`  ${cards.length} cards, ${cardsWithAudio.length} with audio (${examplesWithAudio} sentence clips)`);
if (apparatusKeys.length > 0) {
  console.log(`  ${apparatusKeys.length} keys carry wordlist apparatus (expected, e.g. "eltern (pl.)")`);
  console.log(`    e.g. ${apparatusKeys.slice(0, 3).map((k) => `"${k}"`).join(', ')}`);
}

// ── 4. Orphan report ────────────────────────────────────────────────────────

console.log('\n=== 3. Orphan clips (on disk, referenced by nothing) ===');

const orphans = [...filesOnDisk].filter((f) => !referencedClips.has(f)).sort();
if (orphans.length === 0) {
  console.log('  none — every clip on disk is reachable from data');
} else {
  console.log(`  ${orphans.length} of ${filesOnDisk.size} clips (${((orphans.length / filesOnDisk.size) * 100).toFixed(1)}%)`);
  console.log('  First 15:');
  for (const f of orphans.slice(0, 15)) console.log(`    ${f}`);
  if (orphans.length > 15) console.log(`    … and ${orphans.length - 15} more`);
  console.log('  Non-fatal: the Anki deck has one clip per CARD, and several cards share a lemma.');
  console.log('  A clip with no lemma and no sentence is dead weight, but harmless.');
}

// ── 5. Self-answering cards (rule 4, reported) ──────────────────────────────

console.log('\n=== 4. Cards whose English gloss IS the German lemma ===');
if (selfAnswering.length === 0) {
  console.log('  none');
} else {
  const withClip = selfAnswering.filter((l) => manifest.has(l.toLowerCase()));
  console.log(`  ${selfAnswering.length} cards have translation.en === lemma (the Anki deck stores the`);
  console.log('  German base form in the `en` field for cognate entries). These are');
  console.log('  self-answering in a vocab-translation question: the prompt text is the answer.');
  console.log(`  ${withClip.length} of them also have a bundled clip, so a pre-lock "speakPrompt: v.en"`);
  console.log('  will play the answer as a recording. A seed-data issue, not an audio bug —');
  console.log('  reported so it stays visible, deliberately NOT failed (see rule 4 above).');
  console.log(`  e.g. ${selfAnswering.slice(0, 8).join(', ')}${selfAnswering.length > 8 ? ', …' : ''}`);
}

// ── 6. Coverage report — the gate for the `listening-gap` checkpoint source ──

console.log('\n=== 5. Audio coverage by tag ===');
console.log('  `listening-gap` draws from vocabulary.filter(v => v.audioUrl), so a unit may');
console.log('  only declare it if its declared categories resolve to cards that HAVE audio.');

const topical = [...perTag.entries()]
  .filter(([tag]) => !['A1', 'A2', 'B1', 'B2', 'noun', 'verb', 'adjective', 'adverb', 'preposition', 'phrase'].includes(tag))
  .sort((a, b) => b[1].total - a[1].total);

if (topical.length === 0) {
  console.log('  (no topical tags found)');
} else {
  console.log(`  ${'tag'.padEnd(28)} ${'withAudio'.padStart(10)} / ${'total'.padStart(6)}`);
  for (const [tag, b] of topical) {
    const pct = b.total === 0 ? 0 : Math.round((b.withAudio / b.total) * 100);
    console.log(`  ${tag.padEnd(28)} ${String(b.withAudio).padStart(10)} / ${String(b.total).padStart(6)}  ${pct}%`);
  }
  const fullyCovered = topical.filter(([, b]) => b.total > 0 && b.withAudio === b.total).map(([t]) => t);
  console.log(`\n  Categories with 100% lemma or sentence coverage: ${fullyCovered.length ? fullyCovered.join(', ') : 'NONE'}`);
  if (fullyCovered.length === 0) {
    console.log('  -> No category is fully covered. `listening-gap` will silently shorten any deck');
    console.log('     that declares it, which is the defect schema.ts documents. Keep it on');
    console.log('     UNUSABLE_CHECKPOINT_SOURCES until the Supabase vocabulary.audio_url');
    console.log('     backfill (scripts/backfillVocabularyAudio.ts) has run.');
  }
}

// ── 6. Verdict ──────────────────────────────────────────────────────────────

console.log('');
if (failures.length > 0) {
  console.error(`=== FAILED: ${failures.length} problem(s) ===`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}

console.log('=== OK: every referenced clip exists, every URL is a bundled asset, manifest matches seed ===');
console.log(`    ${filesOnDisk.size} clips on disk · ${referencedClips.size} referenced · ${orphans.length} orphaned`);
