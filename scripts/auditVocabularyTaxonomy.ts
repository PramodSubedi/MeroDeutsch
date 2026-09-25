/**
 * Read-only audit of live vocabulary CEFR levels and topical tags.
 *
 * Usage: npx tsx scripts/auditVocabularyTaxonomy.ts
 * Requires VITE_SUPABASE_URL plus SUPABASE_SERVICE_ROLE_KEY or
 * VITE_SUPABASE_ANON_KEY in .env / .env.local.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env', override: false });
dotenv.config({ path: '.env.local', override: true });
import { createClient } from '@supabase/supabase-js';
import { firstTopicalTag, isTopicalTag } from '../src/utils/vocabTags';

interface VocabRow {
  word: string;
  part_of_speech: string | null;
  level: string | null;
  category: string | null;
  tags: string[] | null;
}

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('[taxonomy-audit] Set VITE_SUPABASE_URL and a Supabase key in .env / .env.local.');
  process.exit(1);
}

const client = createClient(url, key);
const validLevels = new Set(['A1', 'A2', 'B1', 'B2']);

async function fetchRows(): Promise<VocabRow[]> {
  const rows: VocabRow[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await client
      .from('vocabulary')
      .select('word, part_of_speech, level, category, tags')
      .range(start, start + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...(data as VocabRow[]));
    if (data.length < 1000) break;
  }
  return rows;
}

function printCounts(title: string, counts: Map<string, number>): void {
  console.log(`\n${title}`);
  for (const [label, count] of [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    console.log(`  ${String(count).padStart(4)}  ${label}`);
  }
}

async function main(): Promise<void> {
  const rows = await fetchRows();
  const levelCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  const shownCategoryCounts = new Map<string, number>();
  const missingLevel: VocabRow[] = [];
  const invalidLevel: VocabRow[] = [];
  const missingTopic: VocabRow[] = [];
  const legacyCategory: VocabRow[] = [];

  for (const row of rows) {
    const level = row.level?.trim().toUpperCase() ?? '';
    const tags = row.tags ?? [];
    levelCounts.set(level || '(missing)', (levelCounts.get(level || '(missing)') ?? 0) + 1);
    if (!level) missingLevel.push(row);
    else if (!validLevels.has(level)) invalidLevel.push(row);

    if (row.category?.trim()) legacyCategory.push(row);
    for (const tag of new Set(tags.map((value) => value.trim()).filter(Boolean))) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    const topic = firstTopicalTag(tags);
    if (!topic) missingTopic.push(row);
    else shownCategoryCounts.set(topic, (shownCategoryCounts.get(topic) ?? 0) + 1);
  }

  console.log(`[taxonomy-audit] ${rows.length} live vocabulary rows`);
  printCounts('CEFR level column', levelCounts);
  printCounts('Rows by first valid topic tag', shownCategoryCounts);
  printCounts('Most common tags', tagCounts);
  console.log('\nCoverage issues');
  console.log(`  missing CEFR level: ${missingLevel.length}`);
  console.log(`  invalid CEFR level: ${invalidLevel.length}`);
  console.log(`  missing topical tag: ${missingTopic.length}`);
  console.log(`  non-empty retired category column: ${legacyCategory.length}`);
  console.log(`  topical tag count: ${[...tagCounts.keys()].filter(isTopicalTag).length}`);

  for (const [label, samples] of [
    ['Missing level', missingLevel],
    ['Invalid level', invalidLevel],
    ['Missing topic', missingTopic],
    ['Legacy category', legacyCategory],
  ] as const) {
    if (samples.length) {
      console.log(`\n${label} examples`);
      for (const row of samples.slice(0, 12)) {
        console.log(`  ${row.word} | ${row.part_of_speech ?? '?'} | ${row.level ?? '(null)'} | ${(row.tags ?? []).join(', ')}`);
      }
    }
  }
}

main().catch((error: unknown) => {
  console.error('[taxonomy-audit] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});