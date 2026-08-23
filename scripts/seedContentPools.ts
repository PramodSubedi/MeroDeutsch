/**
 * scripts/seedContentPools.ts
 *
 * One-time migration of ALL remaining hardcoded curriculum pools into the
 * generic `public.content_items` table (see supabase/migrations/011_content_items.sql).
 *
 * The datasets are EMBEDDED in ./poolsData.ts so this script remains runnable
 * after the original src/data/*.ts files are deleted from the repo.
 *
 * Usage:
 *   1. Apply supabase/migrations/011_content_items.sql in your project.
 *   2. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.
 *   3. Run: npm run seed-content-pools
 *
 * Idempotent: upserts on (content_type, id).
 */

import dotenv from 'dotenv';
// Load .env first, then .env.local (override) so the keys resolve regardless of
// which file the project keeps them in.
dotenv.config({ path: '.env', override: false });
dotenv.config({ path: '.env.local', override: true });
import { createClient } from '@supabase/supabase-js';
import {
  ALPHABET,
  NUMBERS,
  GREETINGS,
  CALENDAR,
  VOCAB,
  GRAMMAR_DRILLS,
  ROLEPLAY,
  DICTATION,
  STORIES,
  RAPID_FIRE,
  SPELLING,
  PRONUNCIATION_TIPS,
} from './poolsData';

interface ContentItemRow {
  id: string;
  content_type: string;
  payload: unknown;
  sort: number;
}

function buildRows(): ContentItemRow[] {
  const rows: ContentItemRow[] = [];

  // Alphabet (ordered — p_shuffle=false)
  ALPHABET.forEach((item, i) =>
    rows.push({ id: `letter-${item.id}`, content_type: 'alphabet-item', payload: item, sort: i })
  );

  // Numbers (ordered)
  NUMBERS.forEach((item, i) =>
    rows.push({ id: `number-${item.n}`, content_type: 'number-item', payload: item, sort: i })
  );

  // Greetings (ordered)
  GREETINGS.forEach((item, i) =>
    rows.push({ id: `greeting-${item.de}`, content_type: 'greeting-item', payload: item, sort: i })
  );

  // Calendar (ordered)
  CALENDAR.forEach((item, i) =>
    rows.push({ id: `calendar-${item.de}`, content_type: 'calendar-item', payload: item, sort: i })
  );

  // Vocabulary
  VOCAB.forEach((item) =>
    rows.push({ id: `vocab-${item.id}`, content_type: 'vocab-item', payload: item, sort: 0 })
  );

  // Grammar drills (per category)
  Object.entries(GRAMMAR_DRILLS).forEach(([category, drills]) => {
    drills.forEach((d, i) =>
      rows.push({
        id: `grammar-${category}-${i}`,
        content_type: 'grammar-drill',
        payload: { ...d, category },
        sort: i,
      })
    );
  });

  // Roleplay scenarios
  ROLEPLAY.forEach((s, i) =>
    rows.push({ id: `roleplay-${s.id}`, content_type: 'roleplay-scenario', payload: s, sort: i })
  );

  // Dictation words
  DICTATION.forEach((w, i) =>
    rows.push({ id: `dictation-${w.word}`, content_type: 'dictation-word', payload: w, sort: i })
  );

  // Stories (each sentence as a row, grouped by story id)
  STORIES.forEach((story) => {
    story.sentences.forEach((s, i) =>
      rows.push({
        id: `${story.id}-${s.id}`,
        content_type: 'story-sentence',
        payload: {
          storyId: story.id,
          title: story.title,
          titleNe: story.titleNe,
          titleEn: story.titleEn,
          level: story.level,
          sentence: s,
        },
        sort: i,
      })
    );
  });

  // Rapid-fire questions
  Object.entries(RAPID_FIRE).forEach(([_type, questions]) => {
    questions.forEach((q, i) =>
      rows.push({
        id: `rapid-${(q as { id: string }).id}`,
        content_type: 'rapidfire-question',
        payload: q,
        sort: i,
      })
    );
  });

  // Spelling words
  Object.entries(SPELLING).forEach(([difficulty, words]) => {
    words.forEach((w, i) =>
      rows.push({
        id: `spelling-${difficulty}-${w.word}`,
        content_type: 'spelling-word',
        payload: { ...w, difficulty },
        sort: i,
      })
    );
  });

  // Pronunciation tips
  Object.entries(PRONUNCIATION_TIPS).forEach(([letterId, tip]) => {
    rows.push({
      id: `pron-tip-${letterId}`,
      content_type: 'pronunciation-tip',
      payload: { letterId, ...tip },
      sort: 0,
    });
  });

  return rows;
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      '[seedContentPools] Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.\n' +
        'The service-role key is required to bypass RLS for seeding. Never commit it.'
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const rows = buildRows();

  const BATCH = 200;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await admin.from('content_items').upsert(batch, {
      onConflict: 'content_type,id',
    });
    if (error) {
      console.error('[seedContentPools] upsert failed:', error.message);
      process.exit(1);
    }
    total += batch.length;
  }
  console.log(`[seedContentPools] ${total} content_items upserted.`);

  const { data, error } = await admin.rpc('get_content_items', {
    p_content_type: 'alphabet-item',
    p_limit: 5,
    p_shuffle: false,
  });
  if (error) {
    console.warn('[seedContentPools] get_content_items smoke test failed:', error.message);
  } else {
    console.log(`[seedContentPools] get_content_items returned ${data?.length ?? 0} alphabet rows.`);
  }

  console.log('[seedContentPools] Done.');
}

void main();