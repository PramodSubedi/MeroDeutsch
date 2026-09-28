/**
 * scripts/genContentPools.ts
 *
 * Generates TWO artifacts from the single source-of-truth pool data so the
 * runtime can cold-start offline and the cloud `content_items` table can carry:
 *
 *   1. `src/data/content_pools.json`
 *        Every curriculum pool (the seedContentPools.buildRows output PLUS the
 *        new `uhrzeit-item`, `conversation-def` and `conversation-vocab` pools)
 *        serialized for the runtime boot-seed (`useDexieInit` → `seedContentItems`).
 *        This gives the app real content on a first-ever OFFLINE cold start —
 *        previously every pool returned [] until the first online fetch.
 *
 *   2. `supabase/migrations/<ts>_seed_uhrzeit_conversation_pools.sql`
 *        The three NEW pools (uhrzeit + conversational roleplay defs/vocab) as
 *        idempotent `INSERT ... ON CONFLICT (content_type, id) DO UPDATE` rows,
 *        mirroring migration 012's self-contained seed approach.
 *
 * Run:  npx tsx scripts/genContentPools.ts   (idempotent)
 *
 * Optional: pass an explicit migration timestamp so the emitted filename sorts
 * AFTER migrations that have already been applied:
 *   npx tsx scripts/genContentPools.ts --ts=20260930140000
 * Without it the wall clock is used — which silently produces a filename that
 * sorts before existing migrations whenever the local clock is behind CI.
 */
import * as fs from 'fs';
import { TIME_PHRASES } from '../src/data/uhrzeit';
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

interface Row {
  id: string;
  payload: unknown;
  sort: number;
}

interface Pool {
  contentType: string;
  items: Row[];
}

function readJson(path: string): unknown[] {
  return JSON.parse(fs.readFileSync(path, 'utf8')) as unknown[];
}

function buildRows(): Pool[] {
  const pools: Pool[] = [];

  const push = (contentType: string, id: string, payload: unknown, sort: number) => {
    let p = pools.find((x) => x.contentType === contentType);
    if (!p) {
      p = { contentType, items: [] };
      pools.push(p);
    }
    p.items.push({ id, payload, sort });
  };

  ALPHABET.forEach((item, i) => push('alphabet-item', `letter-${item.id}`, item, i));
  NUMBERS.forEach((item, i) => push('number-item', `number-${item.n}`, item, i));
  GREETINGS.forEach((item, i) => push('greeting-item', `greeting-${item.de}`, item, i));
  CALENDAR.forEach((item, i) => push('calendar-item', `calendar-${item.de}`, item, i));
  VOCAB.forEach((item) => push('vocab-item', `vocab-${item.id}`, item, 0));

  Object.entries(GRAMMAR_DRILLS).forEach(([category, drills]) => {
    drills.forEach((d, i) => push('grammar-drill', `grammar-${category}-${i}`, { ...d, category }, i));
  });

  ROLEPLAY.forEach((s, i) => push('roleplay-scenario', `roleplay-${s.id}`, s, i));
  DICTATION.forEach((w, i) => push('dictation-word', `dictation-${w.word}`, w, i));

  STORIES.forEach((story) => {
    story.sentences.forEach((s, i) =>
      push('story-sentence', `${story.id}-${s.id}`, {
        storyId: story.id,
        title: story.title,
        titleNe: story.titleNe,
        titleEn: story.titleEn,
        level: story.level,
        sentence: s,
      }, i)
    );
  });

  Object.entries(RAPID_FIRE).forEach(([_type, questions]) => {
    questions.forEach((q, i) => push('rapidfire-question', `rapid-${(q as { id: string }).id}`, q, i));
  });

  Object.entries(SPELLING).forEach(([difficulty, words]) => {
    words.forEach((w, i) => push('spelling-word', `spelling-${difficulty}-${w.word}`, { ...w, difficulty }, i));
  });

  Object.entries(PRONUNCIATION_TIPS).forEach(([letterId, tip]) => {
    push('pronunciation-tip', `pron-tip-${letterId}`, { letterId, ...tip }, 0);
  });

  // NEW pool: Uhrzeit (telling time) — moved from src/data/uhrzeit.ts into content.
  TIME_PHRASES.forEach((t, i) => push('uhrzeit-item', `zeit-${t.de}`, t, i));

  // NEW pools: conversational roleplay (scenario defs + vocab bank).
  readJson('src/data/conversational_scenario_defs.json').forEach((def, i) =>
    push('conversation-def', `conversation-${(def as { sid: string }).sid}`, def, i)
  );
  readJson('src/data/conversational_german_vocab.json').forEach((card, i) =>
    push('conversation-vocab', `conv-vocab-${i}`, card, i)
  );

  // v0.3 A1 life-scenes conversation pack (14 base scenarios + role-flip twins).
  readJson('src/data/life_scenes_defs.json').forEach((def, i) =>
    push('conversation-def', `life-${(def as { sid: string }).sid}`, def, i)
  );
  readJson('src/data/life_scenes_vocab.json').forEach((card, i) =>
    push('conversation-vocab', `life-vocab-${i}`, card, i)
  );

  return pools;
}
/** Idempotent INSERT for the cloud `content_items` table (dollar-quoted JSONB). */
function rowsToSql(pools: Pool[], contentTypes: string[]): string {
  const lines: string[] = [];
  for (const pool of pools) {
    if (!contentTypes.includes(pool.contentType)) continue;
    if (pool.items.length === 0) continue;
    lines.push(`-- ${pool.contentType} (${pool.items.length} rows)`);
    lines.push(
      `INSERT INTO public.content_items (id, content_type, payload, sort) VALUES`
    );
    const valueRows = pool.items.map(
      (r) => `('${r.id}', '${pool.contentType}', $json$${JSON.stringify(r.payload)}$json$::jsonb, ${r.sort})`
    );
    lines.push(valueRows.join(',\n'));
    lines.push(
      `ON CONFLICT (content_type, id) DO UPDATE SET payload = EXCLUDED.payload, sort = EXCLUDED.sort;`
    );
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Pools that are seeded into `public.content_items` by the emitted migration.
 *
 * `greeting-item` and `rapidfire-question` joined this list when both pools
 * were grown (8 -> 20 greetings, 4 -> 12 per Blitz section). Migration 012
 * still holds the old, tiny versions, and because the runtime prefers the DB
 * pool over the bundled JSON (bundle is only the fallback), online learners
 * would otherwise keep drawing from the exhausted pools forever.
 */
const SEEDED_POOLS = [
  'uhrzeit-item',
  'conversation-def',
  'conversation-vocab',
  'greeting-item',
  'rapidfire-question',
];

/** `--ts=YYYYMMDDHHMMSS` override; falls back to the wall clock. */
function resolveTimestamp(): string {
  const override = process.argv.find((a) => a.startsWith('--ts='))?.slice('--ts='.length);
  if (override && /^\d{14}$/.test(override)) return override;
  return new Date().toISOString().slice(0, 19).replace(/[-T:]/g, '');
}

function main(): void {
  const pools = buildRows();

  // 1) Runtime JSON (all pools) → cold-start Dexie seeding.
  const runtime = pools.map((p) => ({ contentType: p.contentType, items: p.items }));
  fs.writeFileSync(
    'src/data/content-pools.json',
    `${JSON.stringify(runtime, null, 2)}\n`,
    'utf8'
  );

  // 2) Idempotent DB migration for the seeded pools (ON CONFLICT DO UPDATE).
  const timestamp = resolveTimestamp();
  const filename = `${timestamp}_seed_content_pools.sql`;
  const sql = `-- Migration: ${filename}
-- AUTO-GENERATED by scripts/genContentPools.ts — do not edit by hand.
--
-- Seeds these curriculum pools into public.content_items so the app can source
-- them from the database (curriculumService → get_content_items RPC → Dexie
-- cache), with the bundled JSON as the offline fallback.
--
--   uhrzeit-item       : telling-time phrases (de/en/ne)
--   conversation-def   : conversational scenario definitions
--   conversation-vocab : conversational sentence bank the defs reference
--   greeting-item      : greetings + courtesy phrases (Module 1)
--   rapidfire-question : Rapid Blitz question pool, 6 challenge types
--
-- Idempotency mirrors 012 — ON CONFLICT (content_type, id) DO UPDATE.

${rowsToSql(pools, SEEDED_POOLS)}
`;
  fs.writeFileSync(`supabase/migrations/${filename}`, sql, 'utf8');

  const total = pools.reduce((acc, p) => acc + p.items.length, 0);
  console.log(`[genContentPools] ${pools.length} pools / ${total} rows written.`);
  console.log('[genContentPools] updated src/data/content-pools.json');
  console.log(`[genContentPools] wrote supabase/migrations/${filename}`);
}

main();