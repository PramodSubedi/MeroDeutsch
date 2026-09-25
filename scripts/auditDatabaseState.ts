/**
 * Read-only audit of the LIVE Supabase database vs. the expected state derived
 * from supabase/migrations/*.sql AND from the columns the app actually queries.
 *
 * Answers: "is the database fully updated?" — are all migrations applied
 * (tables, columns, RPCs) and are the seeded content pools populated?
 *
 * Usage: npx tsx scripts/auditDatabaseState.ts
 * Requires VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY)
 * in .env / .env.local.  Makes NO writes.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env', override: false });
dotenv.config({ path: '.env.local', override: true });
import { createClient } from '@supabase/supabase-js';

/** Columns the app actually SELECTs / UPSERTs (src/hooks/useReviewQueue.ts,
 *  src/services/userDataService.ts). Drift here breaks runtime behaviour. */
const CLIENT_USED_COLUMNS: Record<string, string[]> = {
  review_queue: [
    'id', 'user_id', 'module_type', 'item_key', 'user_answer', 'correct_answer',
    'error_count', 'ease', 'interval_days', 'repetitions', 'due_at', 'created_at',
    'updated_at', 'last_result', 'box_level', 'error_tag',
  ],
  user_activity_days: ['user_id', 'activity_date', 'event_count', 'created_at', 'updated_at'],
  a1_path_state: ['user_id', 'unlocked_unit_index', 'completed_node_ids', 'checkpoint_best_by_unit', 'updated_at'],
  user_xp: ['user_id', 'total_xp', 'level', 'updated_at'],
  user_streaks: ['user_id', 'current_streak', 'longest_streak', 'last_activity_date', 'updated_at'],
  user_progress: ['user_id', 'practiced_ids', 'quiz_correct', 'quiz_total', 'spell_completed', 'updated_at'],
  vocabulary: [
    'word', 'article', 'translation_en', 'translation_np', 'translation_ne_roman',
    'example_de', 'example_en', 'example_np', 'part_of_speech', 'level', 'category',
    'plural_form', 'tags',
  ],
  sentences: ['id', 'phrase_de', 'expected_array', 'distractors_array', 'grammar_focus', 'tags'],
  content_items: ['id', 'content_type', 'payload', 'sort', 'created_at'],
};

/** Migration-declared tables (informational row counts). */
const TABLES = [
  'profiles', 'user_progress', 'user_streaks', 'user_achievements', 'daily_quests',
  'high_scores', 'vocabulary', 'review_queue', 'user_xp', 'user_activity_days',
  'a1_path_state', 'sentences', 'content_items',
];

/** RPC name -> arg names the migrations GRANT to anon/authenticated. */
const EXPECTED_RPCS: Record<string, string> = {
  get_random_vocabulary: 'p_pos,p_tag,p_level,p_category,p_limit',
  get_random_sentences: 'p_grammar_focus,p_limit',
  get_vocabulary_glossary: 'p_pos,p_level,p_category,p_limit',
  get_vocab_filter_options: '',
  get_content_items: 'p_content_type,p_limit,p_shuffle',
  increment_activity: 'p_user_id,p_date,p_delta',
};

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('[db-audit] Set VITE_SUPABASE_URL and a Supabase key in .env / .env.local.');
  process.exit(1);
}
const client = createClient(url, key);

const problems: string[] = [];
const notes: string[] = [];

function pass(msg: string): void {
  console.log(`  PASS  ${msg}`);
}
function fail(msg: string): void {
  console.log(`  FAIL  ${msg}`);
  problems.push(msg);
}
function warn(msg: string): void {
  console.log(`  WARN  ${msg}`);
  notes.push(msg);
}

/** Probe each column individually so we can name exactly what is missing. */
async function missingColumns(table: string, columns: string[]): Promise<string[]> {
  const missing: string[] = [];
  for (const col of columns) {
    const { error } = await client.from(table).select(col).limit(1);
    if (error) missing.push(col);
  }
  return missing;
}

async function auditClientContract(): Promise<void> {
  console.log('\n=== 1. APP <-> DB COLUMN CONTRACT (breaks runtime if missing) ===');
  for (const [table, columns] of Object.entries(CLIENT_USED_COLUMNS)) {
    const missing = await missingColumns(table, columns);
    if (missing.length === 0) {
      pass(`${table}: all ${columns.length} client-referenced columns exist`);
    } else {
      fail(`${table}: MISSING column(s) -> ${missing.join(', ')}`);
    }
  }
}

async function auditTables(): Promise<void> {
  console.log('\n=== 2. TABLE ROW COUNTS ===');
  for (const t of TABLES) {
    const { count, error } = await client.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      fail(`table ${t} — ${error.message}`);
      continue;
    }
    console.log(`    ${String(count ?? 0).padStart(5)}  ${t}`);
  }
}

async function auditRpcs(): Promise<void> {
  console.log('\n=== 3. RPC FUNCTIONS (granted to anon/authenticated) ===');
  for (const [name, args] of Object.entries(EXPECTED_RPCS)) {
    // increment_activity is SECURITY DEFINER + owner-scoped: calling it with
    // dummy values MUST fail with the ownership guard, which still proves the
    // function exists and is installed. Probing it with NULLs would instead
    // surface an unrelated NOT NULL violation, so treat that guard as a PASS.
    if (name === 'increment_activity') {
      const { error } = await client.rpc(name as never, {
        p_user_id: '00000000-0000-0000-0000-000000000001',
        p_date: '2000-01-01',
        p_delta: 1,
      } as never);
      if (error && /not allowed for this user/i.test(error.message)) {
        pass(`rpc ${name}(p_user_id,p_date,p_delta) — installed, ownership guard active`);
      } else if (error) {
        fail(`rpc ${name} — unexpected error: ${error.message.slice(0, 180)}`);
      } else {
        pass(`rpc ${name}(p_user_id,p_date,p_delta)`);
      }
      continue;
    }

    const payload: Record<string, unknown> = {};
    for (const a of args.split(',')) if (a) payload[a] = null;
    const { error } = await client.rpc(name as never, payload as never);
    if (error) {
      fail(`rpc ${name}(${args}) — ${error.message.slice(0, 200)}`);
    } else {
      pass(`rpc ${name}(${args})`);
    }
  }
}

async function auditStaleOverload(): Promise<void> {
  console.log('\n=== 4. STALE 3-ARG OVERLOAD (migration 019 must have dropped it) ===');
  const { error } = await client.rpc('get_random_vocabulary' as never, {
    p_pos: null, p_tag: null, p_limit: null,
  } as never);
  if (error && /could not choose|ambiguous/i.test(error.message)) {
    fail(`get_random_vocabulary is AMBIGUOUS — 019 not applied: ${error.message.slice(0, 160)}`);
  } else {
    pass('no ambiguity — only the 5-arg overload exists (019 applied)');
  }
}


interface VocabRow {
  word: string;
  part_of_speech: string | null;
  level: string | null;
  category: string | null;
  tags: string[] | null;
  translation_ne_roman: string | null;
  article: string | null;
  example_de: string | null;
}

async function auditVocabularyData(): Promise<void> {
  console.log('\n=== 5. VOCABULARY DATA HEALTH (migration 018 taxonomy) ===');
  const { data, error } = await client
    .from('vocabulary')
    .select('word, part_of_speech, level, category, tags, translation_ne_roman, article, example_de');
  if (error || !data) {
    fail(`fetch vocabulary — ${error?.message ?? 'no data'}`);
    return;
  }
  const rows = (data ?? []) as unknown as VocabRow[];
  const total = rows.length;

  const missingLevel = rows.filter((r) => !r.level?.trim()).length;
  const invalidLevel = rows.filter(
    (r) => r.level && !['A1', 'A2', 'B1', 'B2'].includes(r.level.toUpperCase()),
  ).length;
  const nonNullCategory = rows.filter((r) => r.category?.trim()).length;
  const emptyTags = rows.filter((r) => !r.tags || r.tags.length === 0).length;
  const junkWords = rows.filter((r) => /[0-9/,_]/.test(r.word) || r.word.length < 2).length;
  const nounNoArticle = rows.filter(
    (r) => r.part_of_speech === 'noun' && !['der', 'die', 'das'].includes(String(r.article)),
  ).length;

  pass(`${total} rows loaded`);
  if (missingLevel) fail(`${missingLevel} rows missing a CEFR level`); else pass('every row has a CEFR level');
  if (invalidLevel) fail(`${invalidLevel} rows have an invalid CEFR level`); else pass('all CEFR levels are A1/A2/B1/B2');
  if (nonNullCategory) fail(`${nonNullCategory} rows still set the retired \`category\` column (018 incomplete)`);
  else pass('legacy `category` column fully retired (018)');
  if (emptyTags) fail(`${emptyTags} rows have an empty tags[] array`); else pass('every row has >=1 tag');
  // NOTE: raw-table junk fragments / article-less nouns are NOT drift. Migrations
  // 014/015/017 deliberately keep them in the base table and filter them inside
  // the RPCs (see auditVocabularyGuards). We only report the raw counts here.
  if (junkWords) warn(`${junkWords} raw-table junk fragments in \`word\` (filtered by get_vocabulary_glossary)`);
  if (nounNoArticle) warn(`${nounNoArticle} raw nouns lack der/die/das (filtered by get_random_vocabulary p_pos='noun')`);

  const byLevel = new Map<string, number>();
  for (const r of rows) {
    const l = r.level ?? '(missing)';
    byLevel.set(l, (byLevel.get(l) ?? 0) + 1);
  }
  console.log('\n  CEFR distribution:');
  for (const [l, n] of [...byLevel].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(5)}  ${l}`);

  const byPos = new Map<string, number>();
  for (const r of rows) {
    const p = r.part_of_speech ?? '(missing)';
    byPos.set(p, (byPos.get(p) ?? 0) + 1);
  }
  console.log('  part_of_speech distribution:');
  for (const [p, n] of [...byPos].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(5)}  ${p}`);

  const missingRoman = rows.filter((r) => r.translation_ne_roman == null).length;
  const missingExample = rows.filter((r) => !r.example_de?.trim()).length;
  console.log(`\n  optional fields: translation_ne_roman missing ${missingRoman}, example_de missing ${missingExample}`);
}


/**
 * The RPCs are the real serving layer for vocabulary, so assert the guards
 * actually hold on the data the APP receives (migrations 014/015/017/018).
 */
async function auditVocabularyGuards(): Promise<void> {
  console.log('\n=== 5b. RPC GUARDS (what the app actually receives) ===');

  const { data: gloss, error: gErr } = await client.rpc('get_vocabulary_glossary' as never, {
    p_limit: 2000,
  } as never);
  if (gErr || !gloss) {
    fail(`get_vocabulary_glossary — ${gErr?.message ?? 'no data'}`);
  } else {
    const leaked = (gloss as unknown as { word: string }[]).filter(
      (r) => /[0-9/,_]/.test(r.word) || r.word.length < 2,
    ).length;
    if (leaked) fail(`get_vocabulary_glossary leaked ${leaked} junk rows (017 guard broken)`);
    else pass(`get_vocabulary_glossary: 0 junk rows leaked of ${gloss.length} served`);
  }

  const { data: arts, error: aErr } = await client.rpc('get_random_vocabulary' as never, {
    p_pos: 'noun', p_limit: 100,
  } as never);
  if (aErr || !arts) {
    fail(`get_random_vocabulary(p_pos='noun') — ${aErr?.message ?? 'no data'}`);
  } else {
    const leaked = (arts as unknown as { article: string | null }[]).filter(
      (r) => !['der', 'die', 'das'].includes(String(r.article)),
    ).length;
    if (leaked) fail(`get_random_vocabulary leaked ${leaked} article-less nouns (014/015 guard broken)`);
    else pass(`get_random_vocabulary(p_pos='noun'): 0 article-less nouns leaked of ${arts.length} served`);
  }
}

async function auditContentData(): Promise<void> {
  console.log('\n=== 6. CONTENT POOLS (sentences 010 / content_items 011-012) ===');
  const { data: sData, error: sErr } = await client
    .from('sentences')
    .select('id, expected_array, distractors_array, grammar_focus');
  if (sErr || !sData) {
    fail(`fetch sentences — ${sErr?.message ?? 'no data'}`);
  } else {
    const sRows = sData as unknown as { expected_array: unknown[]; distractors_array: unknown[]; grammar_focus: string }[];
    const byFocus = new Map<string, number>();
    for (const r of sRows) byFocus.set(r.grammar_focus, (byFocus.get(r.grammar_focus) ?? 0) + 1);
    console.log(`  sentences: ${sRows.length} rows / ${byFocus.size} grammar_focus values`);
    for (const [f, n] of [...byFocus].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(5)}  ${f}`);
    const malformed = sRows.filter((r) => !r.expected_array?.length || !r.distractors_array?.length).length;
    if (malformed) fail(`${malformed} sentences missing expected/distractor tiles`);
    else pass('every sentence has expected + distractor tiles');
  }

  const { data: cData, error: cErr } = await client.from('content_items').select('content_type');
  if (cErr || !cData) {
    fail(`fetch content_items — ${cErr?.message ?? 'no data'}`);
    return;
  }
  const cRows = cData as unknown as { content_type: string }[];
  const byType = new Map<string, number>();
  for (const r of cRows) byType.set(r.content_type, (byType.get(r.content_type) ?? 0) + 1);
  console.log(`\n  content_items: ${cRows.length} rows / ${byType.size} content_type pools`);
  for (const [t, n] of [...byType].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(5)}  ${t}`);

  const EXPECTED_MINIMUMS: Record<string, number> = {
    'alphabet-item': 26, 'number-item': 20, 'greeting-item': 5,
  };
  for (const [type, min] of Object.entries(EXPECTED_MINIMUMS)) {
    const n = byType.get(type) ?? 0;
    if (n < min) warn(`content pool \`${type}\` has ${n} rows (expected >= ${min})`);
    else pass(`content pool ${type} — ${n} rows`);
  }
}

async function main(): Promise<void> {
  console.log(`[db-audit] target ${url}`);
  console.log(`[db-audit] key   ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role (RLS bypassed)' : 'ANON (RLS enforced)'}`);

  await auditClientContract();
  await auditTables();
  await auditRpcs();
  await auditStaleOverload();
  await auditVocabularyData();
  await auditVocabularyGuards();
  await auditContentData();

  console.log('\n' + '='.repeat(72));
  if (problems.length === 0) {
    console.log('RESULT: database is FULLY UP TO DATE (no drift).');
  } else {
    console.log(`RESULT: ${problems.length} PROBLEM(S) - database is NOT fully updated:`);
    for (const p of problems) console.log(`   - ${p}`);
  }
  if (notes.length) {
    console.log(`\n${notes.length} note(s):`);
    for (const n of notes) console.log(`   - ${n}`);
  }
  console.log('='.repeat(72));
  process.exit(problems.length === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error('[db-audit] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});

