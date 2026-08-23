/**
 * scripts/backfillVocabClusters.ts  (Phase 3 — targeted translation backfill)
 *
 * PILOT SCOPE: Unit 1 clusters only (Greetings, Numbers, Alphabet ≈ 60 rows).
 *
 * Data authority: the LOCAL bilingual baseline in `scripts/poolsData.ts`
 * (the embedded copy of the former src/data JSON files that also seeds
 * `content_items`). No external translation APIs, no API keys, identical
 * data across dev and production.
 *
 * What it does (append-only semantics — never overwrites existing values):
 *   1. Builds Unit 1 cluster candidates:
 *        - GREETINGS        → part_of_speech 'phrase', category 'greetings'
 *        - NUMBERS          → part_of_speech 'noun',   category 'numbers'
 *        - ALPHABET examples→ part_of_speech 'noun',   category 'alphabet'
 *          (exampleFull "Apfel (Apple / स्याउ)" is parsed into en/ne)
 *   2. Computes `translation_ne_roman` via a deterministic built-in
 *      Devanagari → Roman transliterator (ISO-15919-style). The local
 *      baseline stores Nepali only in Devanagari script, so romanization
 *      is derived locally instead of fetched from an API.
 *   3. Fetches matching rows from `public.vocabulary` by word.
 *   4. UPDATE: fills `translation_ne_roman` (and `translation_np` if
 *      currently NULL/empty) on matched rows — existing values untouched.
 *   5. INSERT: adds cluster words not yet present as full vocabulary rows
 *      (article left NULL; migration 013 relaxed the CHECK for this).
 *
 * Env (same convention as seedVocab.ts):
 *   VITE_SUPABASE_URL            (required)
 *   SUPABASE_SERVICE_ROLE_KEY    (recommended — writes are RLS-restricted)
 *   VITE_SUPABASE_ANON_KEY       (fallback read-only key; writes will fail)
 *
 * Usage:
 *   npm run backfill-unit1            (apply Unit 1 clusters to database)
 *   npm run backfill-unit1 -- --dry-run   (print candidates only, no DB access)
 *   npm run backfill-unit1 -- --fill-roman  (NULL-fill translation_ne_roman
 *     for ALL vocabulary rows with Devanagari but no romanization — append-only)
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env', override: false });
dotenv.config({ path: '.env.local', override: true });
import { createClient } from '@supabase/supabase-js';
import { ALPHABET, GREETINGS, NUMBERS } from './poolsData';
import { devanagariToRoman } from './devanagari';
import type { VocabularyEntity } from '../src/types/content';

/* ────────────────────────────────────────────────────────────
 * Unit 1 cluster candidates from the LOCAL authority baseline
 * ──────────────────────────────────────────────────────────── */

/** Parse "Apfel (Apple / स्याउ)" → { en, ne }; "(Xylophone)" → ne ''. */
function parseExampleFull(full: string): { en: string; ne: string } {
  const match = full.match(/^(.*?)\s*\((.*)\)\s*$/);
  if (!match) return { en: full.trim(), ne: '' };
  const inner = match[2];
  const slashIdx = inner.indexOf('/');
  if (slashIdx === -1) return { en: inner.trim(), ne: '' };
  return { en: inner.slice(0, slashIdx).trim(), ne: inner.slice(slashIdx + 1).trim() };
}

interface ClusterCandidate extends VocabularyEntity {
  /** Source cluster label for reporting. */
  cluster: 'greetings' | 'numbers' | 'alphabet';
}

function buildCandidates(): ClusterCandidate[] {
  const candidates: ClusterCandidate[] = [];

  for (const g of GREETINGS) {
    candidates.push({
      cluster: 'greetings',
      word: g.de,
      part_of_speech: 'phrase',
      translation_en: g.en,
      translation_np: g.ne,
      translation_ne_roman: devanagariToRoman(g.ne),
      category: 'greetings',
      level: 'A1',
    });
  }

  for (const num of NUMBERS) {
    candidates.push({
      cluster: 'numbers',
      word: num.de,
      part_of_speech: 'noun',
      translation_en: num.en,
      translation_np: num.ne,
      translation_ne_roman: devanagariToRoman(num.ne),
      category: 'numbers',
      level: 'A1',
    });
  }

  for (const letter of ALPHABET) {
    const { en, ne } = parseExampleFull(letter.exampleFull);
    if (!ne) continue; // no Nepali available locally (e.g. Xylophon) — skip
    candidates.push({
      cluster: 'alphabet',
      word: letter.example,
      part_of_speech: 'noun',
      translation_en: en,
      translation_np: ne,
      translation_ne_roman: devanagariToRoman(ne),
      category: 'alphabet',
      level: 'A1',
    });
  }

  // Dedupe by (word, part_of_speech) — first occurrence wins
  // (greetings > numbers > alphabet precedence).
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = `${c.word}|${c.part_of_speech}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ────────────────────────────────────────────────────────────
 * Backfill against public.vocabulary (append-only)
 * ──────────────────────────────────────────────────────────── */

/** NULL-fill translation_ne_roman for every row that has Devanagari but no roman. */
async function fillRomanGaps(): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('❌ --fill-roman requires VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }
  const client = createClient(url, serviceKey);

  const { data, error } = await client
    .from('vocabulary')
    .select('word, part_of_speech, translation_np')
    .is('translation_ne_roman', null);
  if (error) {
    console.error('Select failed:', error.message);
    process.exit(1);
  }

  const targets = (data ?? []).filter(
    (r) => typeof r.translation_np === 'string' && r.translation_np.trim().length > 0,
  );
  console.log(`Filling romanized Nepali for ${targets.length} row(s) with empty translation_ne_roman...`);

  let filled = 0;
  for (const row of targets) {
    const roman = devanagariToRoman(row.translation_np as string);
    if (!roman) continue;
    const { error: upErr } = await client
      .from('vocabulary')
      .update({ translation_ne_roman: roman })
      .eq('word', row.word)
      .eq('part_of_speech', row.part_of_speech);
    if (upErr) {
      console.error(`Update failed for "${row.word}":`, upErr.message);
      process.exit(1);
    }
    filled += 1;
  }
  console.log(`✓ Filled ${filled}/${targets.length} row(s).`);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const fillRoman = process.argv.includes('--fill-roman');

  if (fillRoman) {
    await fillRomanGaps();
    return;
  }

  const candidates = buildCandidates();
  console.log(
    `Unit 1 pilot clusters: ${candidates.length} candidate rows ` +
      `(greetings ${candidates.filter((c) => c.cluster === 'greetings').length}, ` +
      `numbers ${candidates.filter((c) => c.cluster === 'numbers').length}, ` +
      `alphabet ${candidates.filter((c) => c.cluster === 'alphabet').length})`,
  );

  if (dryRun) {
    console.log('--dry-run: candidates that would be upserted (no DB access):');
    for (const c of candidates) {
      console.log(
        `[${c.cluster}] ${c.word} (${c.part_of_speech}) → en="${c.translation_en}" ` +
          `np="${c.translation_np}" roman="${c.translation_ne_roman}"`,
      );
    }
    return;
  }

  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || (!serviceKey && !anonKey)) {
    console.error(
      'Missing Supabase credentials. Set VITE_SUPABASE_URL plus ' +
        'SUPABASE_SERVICE_ROLE_KEY (recommended) or VITE_SUPABASE_ANON_KEY.',
    );
    process.exit(1);
  }
  if (!serviceKey) {
    console.warn(
      '⚠ SUPABASE_SERVICE_ROLE_KEY not set — falling back to anon key. ' +
        '`vocabulary` is RLS-restricted, so writes will likely fail.',
    );
  }
  const client = createClient(url, serviceKey ?? anonKey!);

  // 1. Fetch existing rows matching these words (chunked .in()).
  const words = [...new Set(candidates.map((c) => c.word))];
  const existing = new Map<string, { word: string; part_of_speech: string; translation_np: string | null; translation_ne_roman: string | null }>();
  const CHUNK = 100;
  for (let i = 0; i < words.length; i += CHUNK) {
    const chunk = words.slice(i, i + CHUNK);
    const { data, error } = await client
      .from('vocabulary')
      .select('word, part_of_speech, translation_np, translation_ne_roman')
      .in('word', chunk);
    if (error) {
      console.error('Select failed:', error.message);
      process.exit(1);
    }
    for (const row of data ?? []) {
      existing.set(`${row.word}|${row.part_of_speech}`, row);
    }
  }

  // 2. Split into updates (matched) vs inserts (missing).
  const updates: ClusterCandidate[] = [];
  const inserts: ClusterCandidate[] = [];
  for (const c of candidates) {
    if (existing.has(`${c.word}|${c.part_of_speech}`)) updates.push(c);
    else inserts.push(c);
  }

  // 3. Targeted column updates — never overwrite non-null values.
  let updatedRoman = 0;
  let updatedNp = 0;
  for (const c of updates) {
    const row = existing.get(`${c.word}|${c.part_of_speech}`)!;
    const patch: Record<string, string> = {};
    if (!row.translation_ne_roman && c.translation_ne_roman) {
      patch.translation_ne_roman = c.translation_ne_roman;
    }
    if ((!row.translation_np || row.translation_np.trim() === '') && c.translation_np) {
      patch.translation_np = c.translation_np;
    }
    if (Object.keys(patch).length === 0) continue;

    const { error } = await client
      .from('vocabulary')
      .update(patch)
      .eq('word', c.word)
      .eq('part_of_speech', c.part_of_speech);
    if (error) {
      console.error(`Update failed for "${c.word}" (${c.part_of_speech}):`, error.message);
      process.exit(1);
    }
    if (patch.translation_ne_roman) updatedRoman++;
    if (patch.translation_np) updatedNp++;
  }

  // 4. Insert missing cluster words as full rows.
  let inserted = 0;
  if (inserts.length > 0) {
    const payload = inserts.map(({ cluster: _cluster, ...entity }) => entity);
    const { error } = await client.from('vocabulary').insert(payload);
    if (error) {
      console.error('Insert failed:', error.message);
      process.exit(1);
    }
    inserted = inserts.length;
  }

  console.log('✓ Unit 1 pilot backfill complete:');
  console.log(`  • matched rows updated : ${updates.length} (roman filled: ${updatedRoman}, np gaps filled: ${updatedNp})`);
  console.log(`  • new rows inserted    : ${inserted}`);
  console.log(`  • already complete     : ${candidates.length - updates.length - inserted}`);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});