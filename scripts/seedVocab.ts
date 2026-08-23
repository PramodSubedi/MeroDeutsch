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
 * Append-only by default: rows whose (word, part_of_speech) already exist in
 * the database are SKIPPED so local files can never clobber live translations
 * or example sentences. Set SEED_FORCE=1 to allow overwriting (explicit opt-in).
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
import { createClient } from '@supabase/supabase-js';
import { devanagariToRoman } from './devanagari';
import type { VocabularyEntity } from '../src/types/content';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VOCAB_DIR = path.resolve(__dirname, '../src/data/vocab');
const ENRICHED_FILE = path.resolve(__dirname, '../public/data/enriched-vocab.json');

interface LegacyVocabRow {
  id: string;
  de: string;
  en: string;
  ne: string;
  /** Optional romanized Nepali (phonetic aid for EN speakers). */
  neRoman?: string;
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
    translation_ne_roman: row.neRoman,
    example_de: row.exampleDe,
    category: categories[0] ?? 'general',
    level: row.level ?? 'A1',
  };
}

/**
 * Convert an entity-shaped row (e.g. from german_vocabulary.json) straight
 * through. Recognises rows that already have `word` and `translation_en`.
 */
function entityToEntity(row: Record<string, unknown>): VocabularyEntity | null {
  const word = row.word as string | undefined;
  const en = row.translation_en as string | undefined;
  const np = row.translation_np as string | undefined;
  if (!word || !en || !np) return null;

  return {
    word,
    article: (row.article as 'der' | 'die' | 'das') ?? undefined,
    part_of_speech: (row.part_of_speech as VocabularyEntity['part_of_speech']) ?? 'noun',
    translation_en: en,
    translation_np: np,
    // Romanized Nepali: explicit value wins, otherwise derive locally so
    // every seeded row gets a consistent phonetic aid for EN speakers.
    translation_ne_roman:
      (row.translation_ne_roman as string | undefined) ??
      (row.neRoman as string | undefined) ??
      devanagariToRoman(np),
    example_de: (row.example_de as string | undefined) ?? undefined,
    example_en: (row.example_en as string | undefined) ?? undefined,
    example_np: (row.example_np as string | undefined) ?? undefined,
    category: (row.category as string | undefined) ?? 'general',
    level: (row.level as string | undefined) ?? 'A1',
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
    translation_ne_roman: card.translationNeRoman as string | undefined,
    example_de: examples[0]?.de,
    example_en: examples[0]?.en,
    example_np: examples[0]?.np,
    category: (card.tags as string[] | undefined)?.[0] ?? 'general',
    level: (card.cefrLevel as string | undefined) ?? 'A1',
  };
}

async function loadLegacyBatch(file: string): Promise<VocabularyEntity[]> {
  const rows = JSON.parse(await fs.readFile(file, 'utf8')) as Record<string, unknown>[];
  // Entity-shaped rows (word + translation_en) pass through directly.
  if (rows.length > 0 && (rows[0] as Record<string, unknown>).word) {
    return rows.map(entityToEntity).filter((e): e is VocabularyEntity => e !== null);
  }
  // Otherwise treat as legacy {id, de, en, ne, tags} shape.
  return (rows as unknown as LegacyVocabRow[]).map(legacyToEntity);
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
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || (!serviceKey && !anonKey)) {
    console.error(
      'Missing Supabase credentials. Set VITE_SUPABASE_URL plus ' +
        'SUPABASE_SERVICE_ROLE_KEY (recommended) or VITE_SUPABASE_ANON_KEY in .env'
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

  // Deduplicate by (word, part_of_speech) — Postgres `ON CONFLICT DO UPDATE`
  // throws "ON CONFLICT DO UPDATE command cannot affect row a second time"
  // when the same conflict key appears more than once in a single upsert.
  const seen = new Set<string>();
  const uniqueEntities: VocabularyEntity[] = [];
  for (const e of entities) {
    const key = `${e.word}|${e.part_of_speech}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueEntities.push(e);
  }

  // Append-only guard: skip rows that already exist unless SEED_FORCE=1.
  const force = process.env.SEED_FORCE === '1';
  let applied = uniqueEntities;
  if (!force && serviceKey) {
    const { data: existingRows, error: exErr } = await client
      .from('vocabulary')
      .select('word, part_of_speech');
    if (exErr) {
      console.error('Could not check existing rows:', exErr.message);
      process.exit(1);
    }
    const existingKeys = new Set((existingRows ?? []).map((r) => `${r.word}|${r.part_of_speech}`));
    const before = applied.length;
    applied = applied.filter((e) => !existingKeys.has(`${e.word}|${e.part_of_speech}`));
    console.log(
      `Append-only: ${before - applied.length} row(s) already in DB and skipped` +
        ` (set SEED_FORCE=1 to overwrite).`,
    );
  }

  if (applied.length === 0) {
    console.log('Nothing new to seed.');
    return;
  }

  const { error } = await client.from('vocabulary').upsert(applied, {
    onConflict: 'word,part_of_speech',
  });

  if (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  }

  console.log(
    `✓ Seeded ${applied.length} vocabulary rows into public.vocabulary` +
      ` (filtered ${entities.length - uniqueEntities.length} duplicates)` +
      `${force ? ' [FORCE: overwrites enabled]' : ''}`,
  );
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});