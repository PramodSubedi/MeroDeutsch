/**
 * scripts/backfillGlossaryCategories.ts
 *
 * Normalize category / level / tags on live `public.vocabulary` rows using the
 * enriched card export (public/data/enriched-vocab.json).
 *
 * Why: rows seeded from batch files / the enriched export can carry
 *   - category = part-of-speech ('noun'/'verb'/...) because tags[0] is POS
 *   - empty tags (tags = '{}')
 * which pollute the Glossary's category filter with 'noun'-style buckets and
 * a catch-all 'general' bucket. This script recomputes each field:
 *   - category = first NON-basic tag (POS values, CEFR levels and 'general'
 *     are ignored), else 'general'
 *   - level    = card.cefrLevel when A1/A2/B1/B2, else 'A1'
 *   - tags     = existing tags + acquired topical category (deduped; POS and
 *     CEFR tags are preserved for feature filtering)
 *
 * Idempotent: re-running is safe (same inputs → same outputs).
 *
 * Env (see seedVocab.ts): VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * Usage: npm run backfill-glossary
 */
import dotenv from 'dotenv';

dotenv.config({ path: '.env', override: false });
dotenv.config({ path: '.env.local', override: true });
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENRICHED_FILE = path.resolve(__dirname, '../public/data/enriched-vocab.json');

const POS_SET = new Set(['noun', 'verb', 'adjective', 'phrase', 'expression', 'adverb']);
const LEVEL_SET = new Set(['A1', 'A2', 'B1', 'B2']);
const BUCKET_SET = new Set([...POS_SET, ...LEVEL_SET, 'general']);

interface EnrichedCard {
  lemma: string;
  partOfSpeech?: string;
  cefrLevel?: string;
  tags?: string[];
}

function normalizeParts(card: EnrichedCard): { pos: string; level: string; category: string; tags: string[] } {
  const pos = POS_SET.has((card.partOfSpeech ?? '').toLowerCase())
    ? (card.partOfSpeech ?? '').toLowerCase()
    : 'noun';
  const level = LEVEL_SET.has((card.cefrLevel ?? '').toUpperCase())
    ? (card.cefrLevel ?? '').toUpperCase()
    : 'A1';
  const rawTags = (card.tags ?? []).map((t) => t.trim()).filter(Boolean);
  const topical = rawTags.filter((t) => !BUCKET_SET.has(t));
  const category = topical[0] ?? 'general';
  const tags = Array.from(new Set([...rawTags, ...(category !== 'general' ? [category] : [])]));
  return { pos, level, category, tags };
}

async function main(): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      'Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env — ' +
        'cannot update the RLS-protected vocabulary table.'
    );
    process.exit(1);
  }
  const client = createClient(url, serviceKey);

  let cards: EnrichedCard[];
  try {
    cards = JSON.parse(await fs.readFile(ENRICHED_FILE, 'utf8')) as EnrichedCard[];
  } catch {
    console.error('Could not read ' + ENRICHED_FILE);
    process.exit(1);
  }
  if (!Array.isArray(cards)) {
    console.error('Enriched export must be a JSON array.');
    process.exit(1);
  }

  let updated = 0;
  let skipped = 0;
  const posBuckets: Record<string, number> = {};
  const categoryBuckets: Record<string, number> = {};

  for (const card of cards) {
    if (!card || typeof card.lemma !== 'string' || !card.lemma.trim()) {
      skipped++;
      continue;
    }
    const { pos, level, category, tags } = normalizeParts(card);
    const { error, count } = await client
      .from('vocabulary')
      .update({ category, level, tags }, { count: 'exact' })
      .eq('word', card.lemma.trim())
      .eq('part_of_speech', pos);
    if (error) {
      // Row may simply not exist for this word in the DB — that's fine.
      skipped++;
      continue;
    }
    updated += count ?? 1;
    posBuckets[pos] = (posBuckets[pos] ?? 0) + 1;
    categoryBuckets[category] = (categoryBuckets[category] ?? 0) + 1;
  }

  console.log(`✓ Backfill complete: ${updated} row(s) updated, ${skipped} skipped.`);
  console.log('  By POS:', JSON.stringify(posBuckets, null, 0));
  const topCats = Object.entries(categoryBuckets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  console.log('  Top categories:', JSON.stringify(topCats, null, 0));
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});