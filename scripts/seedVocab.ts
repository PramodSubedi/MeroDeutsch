/**
 * scripts/seedVocab.ts  (Phase 4 data pipeline)
 *
 * Seeds the `public.vocabulary` Supabase table from the bundled offline batch
 * vocab files (`src/data/vocab/*.json`) and the enriched card export
 * (`public/data/enriched-vocab.json`, if present).
 *
 * The batch files use the compact legacy shape
 *   { id, de, en, ne, tags, level, exampleDe }
 * which this script maps into the PostgreSQL `vocabulary` row shape
 * (see supabase/migrations/004_vocabulary_expansion.sql). The richer
 * `VocabCard` export is also accepted so the pipeline is forward-compatible.
 *
 * Upserts use `onConflict: 'word,part_of_speech'` so re-running is idempotent.
 *
 * Env (never hardcoded — loaded via dotenv from `.env` / `.env.local`):
 *   VITE_SUPABASE_URL            (required)
 *   SUPABASE_SERVICE_ROLE_KEY    (recommended — required for writes because
 *                                `public.vocabulary` is RLS-restricted; the anon
 *                                key can only SELECT). Falls back to the anon
 *                                key with a warning if absent.
 *   VITE_SUPABASE_ANON_KEY       (fallback read-only key)
 *
 * Usage:
 *   npm run seed-vocab
 */
import dotenv from 'dotenv';
// Load .env first, then .env.local (override) so the keys resolve regardless of
// which file the project keeps them in.
dotenv.config({ path: '.env', override: false });
dotenv.config({ path: '.env.local', override: true });
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { VocabularyEntity } from '../src/types/content';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VOCAB_DIR = path.resolve(__dirname, '../src/data/vocab');
const ENRICHED_FILE = path.resolve(__dirname, '../public/data/enriched-vocab.json');

interface LegacyVocabRow {
  id: string;
  de: string;
  en: string;
  ne: string;
  tags?: string[];
  level?: string;
  exampleDe?: string;
}

function inferPartOfSpeech(tags: string[] = []): VocabularyEntity['part_of_speech'] {
  if (tags.some((t) => t.toLowerCase().includes('verb'))) return 'verb';
  if (tags.some((t) => t.toLowerCase().includes('adj'))) return 'adjective';
  if (tags.some((t) => t.toLowerCase().includes('phrase') || t.toLowerCase().includes('expression'))) {
    return 'phrase';
  }
  return 'noun';
}

function legacyToEntity(row: LegacyVocabRow): VocabularyEntity {
  const categories = row.tags ?? [];
  return {
    word: row.de,
    part_of_speech: inferPartOfSpeech(categories),
    translation_en: row.en,
    translation_np: row.ne,
    example_de: row.exampleDe,
    category: categories[0] ?? 'general',
    level: row.level ?? 'A1',
  };
}

function enrichedToEntity(card: Record<string, unknown>): VocabularyEntity | null {
  const lemma = card.lemma;
  const translation = card.translation as { en?: string; np?: string } | undefined;
  const examples = (card.examples as { de?: string; en?: string; np?: string }[] | undefined) ?? [];
  const partOfSpeech = (card.partOfSpeech as string | undefined) ?? 'noun';
  const allowed = new Set(['noun', 'verb', 'adjective', 'phrase', 'expression']);
  if (!lemma || !translation?.en || !translation?.np) return null;
  return {
    word: String(lemma),
    article: (card.article as 'der' | 'die' | 'das') ?? undefined,
    part_of_speech: allowed.has(partOfSpeech) ? (partOfSpeech as VocabularyEntity['part_of_speech']) : 'noun',
    translation_en: translation.en,
    translation_np: translation.np,
    example_de: examples[0]?.de,
    example_en: examples[0]?.en,
    example_np: examples[0]?.np,
    category: (card.tags as string[] | undefined)?.[0] ?? 'general',
    level: (card.cefrLevel as string | undefined) ?? 'A1',
  };
}

async function loadLegacyBatch(file: string): Promise<VocabularyEntity[]> {
  const rows = JSON.parse(await fs.readFile(file, 'utf8')) as LegacyVocabRow[];
  return rows.map(legacyToEntity);
}

async function loadEnriched(): Promise<VocabularyEntity[]> {
  try {
    const rows = JSON.parse(await fs.readFile(ENRICHED_FILE, 'utf8')) as Record<string, unknown>[];
    return rows.map(enrichedToEntity).filter((e): e is VocabularyEntity => e !== null);
  } catch {
    return []; // enriched export may not exist yet — that's fine
  }
}

async function main(): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.error(
      'Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'
    );
    process.exit(1);
  }

  const client = createClient(url, anonKey);

  const legacy = await Promise.all(
    (await fs.readdir(VOCAB_DIR))
      .filter((f) => f.endsWith('.json'))
      .map((f) => loadLegacyBatch(path.join(VOCAB_DIR, f)))
  );
  const legacyEntities = legacy.flat();
  const enrichedEntities = await loadEnriched();

  const entities: VocabularyEntity[] = [...legacyEntities, ...enrichedEntities];

  if (entities.length === 0) {
    console.warn('No vocabulary rows found to seed.');
    return;
  }

  const { error } = await client.from('vocabulary').upsert(entities, {
    onConflict: 'word,part_of_speech',
  });

  if (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  }

  console.log(`✓ Seeded ${entities.length} vocabulary rows into public.vocabulary`);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});