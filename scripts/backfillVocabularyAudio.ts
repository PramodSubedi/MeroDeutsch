/**
 * scripts/backfillVocabularyAudio.ts  —  `npm run backfill-audio`
 *
 * Copies the bundled-recording path from `public/data/enriched-vocab.json` into
 * the Supabase `vocabulary.audio_url` column (migration 20260930170000).
 *
 * WHY
 * ---
 * 813 MP3s ship under `public/audio/anki/` and are reachable from the learner
 * app through `AUDIO_BY_LEMMA` and `VocabCard.audioUrl`. Neither reaches the
 * curriculum: `A1CheckpointPage`'s `listening-gap` case draws from
 * `vocabulary.filter(v => v.audioUrl)` fed by `getVocabularyByCategories`, and
 * that path reads the `vocabulary` table — which until this column existed had
 * nowhere to put a clip. The source has therefore contributed exactly zero items
 * for its entire life, and two units (M03, M14) shipped 6- and 8-item decks
 * instead of 12 as a result. See the post-mortem in
 * `src/data/curriculum/schema.ts`.
 *
 * MATCHING
 * --------
 * `lower(vocabulary.word) = lower(lemma)`, last-wins on the seed side — the same
 * rule `scripts/bundle-offline-seed.cjs` uses to build `AUDIO_BY_LEMMA`, so the
 * DB and the client manifest never disagree about which clip a word plays.
 *
 * Only the BARE LEMMA clip is written. Sentence-level clips
 * (`examples[].audioUrl`) stay client-side: they are keyed by sentence text, not
 * by word, and the `vocabulary` table has nowhere to put 618 rows of them.
 *
 * APPEND-ONLY: an existing non-null `audio_url` is never overwritten, and a
 * mismatch is reported rather than silently reconciled.
 *
 * Env (same convention as the sibling backfills):
 *   VITE_SUPABASE_URL            (required)
 *   SUPABASE_SERVICE_ROLE_KEY    (recommended — writes are RLS-restricted)
 *   VITE_SUPABASE_ANON_KEY       (fallback read-only key; writes will fail)
 *
 * Usage:
 *   npm run backfill-audio                  (apply)
 *   npm run backfill-audio -- --dry-run     (report only, no DB access)
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env', override: false });
dotenv.config({ path: '.env.local', override: true });
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const VOCAB_PATH = path.join('public', 'data', 'enriched-vocab.json');
const AUDIO_DIR = path.join('public', 'audio', 'anki');
const AUDIO_PREFIX = '/audio/anki/';
const BATCH = 200;

const dryRun = process.argv.includes('--dry-run');

/* ── 1. Read the seed and build lemma -> clip ─────────────────────────────── */

interface SeedCard {
  lemma?: string;
  audioUrl?: string | null;
}

if (!fs.existsSync(VOCAB_PATH)) {
  console.error(`FATAL: ${VOCAB_PATH} not found. Run \`npm run bundle-offline-seed\` first.`);
  process.exit(1);
}
if (!fs.existsSync(AUDIO_DIR)) {
  console.error(`FATAL: ${AUDIO_DIR} not found. The audio catalogue is missing.`);
  process.exit(1);
}

const clips = new Set(
  fs
    .readdirSync(AUDIO_DIR)
    .filter((f) => f.toLowerCase().endsWith('.mp3'))
    .map((f) => AUDIO_PREFIX + f),
);

const cards = JSON.parse(fs.readFileSync(VOCAB_PATH, 'utf8')) as SeedCard[];

/** lower(lemma) -> clip. Last write wins, matching buildManifest(). */
const lemmaToClip = new Map<string, string>();
for (const c of cards) {
  const lemma = (c.lemma ?? '').trim();
  if (!lemma || !c.audioUrl) continue;
  if (!clips.has(c.audioUrl)) {
    console.warn(`  ! seed claims a clip that is not on disk: ${lemma} -> ${c.audioUrl}`);
    continue;
  }
  lemmaToClip.set(lemma.toLowerCase(), c.audioUrl);
}

console.log('=== Candidate mapping (from public/data/enriched-vocab.json) ===');
console.log(`  ${lemmaToClip.size} lemmas carry a bundled clip`);
if (lemmaToClip.size === 0) {
  console.error('FATAL: no lemma/clip pairs resolved — refusing to run.');
  process.exit(1);
}

/* ── 2. Dry run stops here ────────────────────────────────────────────────── */

if (dryRun) {
  const sample = [...lemmaToClip.entries()].slice(0, 8);
  for (const [lemma, url] of sample) console.log(`  ${lemma.padEnd(22)} -> ${url}`);
  console.log(`  … and ${lemmaToClip.size - sample.length} more`);
  console.log('\n--dry-run: no database access.');
  process.exit(0);
}

/* ── 3. Connect ───────────────────────────────────────────────────────────── */

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('FATAL: set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).');
  process.exit(1);
}
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log('\n=== Reading vocabulary table ===');
const { data: rows, error: readErr } = await supabase
  .from('vocabulary')
  .select('id, word, audio_url')
  .limit(5000);
if (readErr) {
  console.error('FATAL: read failed —', readErr.message);
  console.error('Did you apply supabase/migrations/20260930170000_vocabulary_audio_url.sql?');
  process.exit(1);
}
console.log(`  ${rows?.length ?? 0} rows`);

const existing = new Map<string, string | null>();
for (const r of rows ?? []) {
  existing.set(String(r.word ?? '').trim().toLowerCase(), r.audio_url ?? null);
}

/* ── 4. Plan the writes ───────────────────────────────────────────────────── */

interface Plan {
  word: string;
  audio_url: string;
  id: unknown;
}
const toSet: Plan[] = [];
let alreadySet = 0;
let conflict = 0;
let noClip = 0;

for (const [lemmaLower, clip] of lemmaToClip) {
  const current = existing.get(lemmaLower);
  if (current === undefined) {
    noClip++; // the word isn't in the table at all
    continue;
  }
  if (current) {
    if (current !== clip) {
      conflict++;
      console.warn(`  ! conflict (left untouched): "${lemmaLower}" table=${current} seed=${clip}`);
    } else {
      alreadySet++;
    }
    continue;
  }
  const row = (rows ?? []).find((r) => String(r.word ?? '').trim().toLowerCase() === lemmaLower);
  toSet.push({ word: String(row!.word), audio_url: clip, id: row!.id });
}

const tableWords = new Set([...existing.keys()]);
const seededNotInTable = [...lemmaToClip.keys()].filter((k) => !tableWords.has(k)).length;

console.log('\n=== Plan ===');
console.log(`  to set:       ${toSet.length}`);
console.log(`  already set:  ${alreadySet}`);
console.log(`  conflicts:    ${conflict}  (left untouched — report these)`);
console.log(`  seeded but absent from the table: ${seededNotInTable} (nothing to update)`);
if (noClip !== seededNotInTable) {
  console.log(`  table words with no clip: ${noClip}`);
}

if (toSet.length === 0) {
  console.log('\nNothing to do.');
  process.exit(0);
}

/* ── 5. Apply in batches ──────────────────────────────────────────────────── */

console.log(`\n=== Applying (batch size ${BATCH}) ===`);
let written = 0;
let failed = 0;
for (let i = 0; i < toSet.length; i += BATCH) {
  const batch = toSet.slice(i, i + BATCH);
  // Patch by primary key so a batch never has to match on `word`, which is not
  // unique across parts of speech.
  const { error } = await supabase
    .from('vocabulary')
    .upsert(batch, { onConflict: 'id' });
  if (error) {
    failed += batch.length;
    console.error(`  ! batch @${i} failed: ${error.message}`);
  } else {
    written += batch.length;
    console.log(`  ${written}/${toSet.length} written`);
  }
}

console.log('\n=== Done ===');
console.log(`  written: ${written}  failed: ${failed}  conflicts: ${conflict}`);
console.log('  Next: `npm run check:audio` to read the per-tag coverage report.');
console.log('  Only un-gate the `listening-gap` checkpoint source once a real category');
console.log('  shows non-zero coverage — otherwise a deck declaring it silently shortens.');
if (failed > 0) process.exit(1);
