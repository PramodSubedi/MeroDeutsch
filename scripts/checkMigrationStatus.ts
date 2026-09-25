/**
 * Per-migration drift check: is every file in supabase/migrations/ actually
 * applied to the LIVE database?
 *
 * Why this exists
 * ---------------
 * `supabase_migrations.schema_migrations` CANNOT be trusted here. Migrations
 * applied through the Management API (scripts/runSql.ts — the documented path
 * for this project) never write a history row, so that table lists only 14 of
 * 27 migrations while more are in fact applied. The authoritative signal is
 * whether each migration's OBJECTS exist in the live catalog.
 *
 * Read-only: runs SELECTs against pg_catalog only.
 *
 * Usage: npx tsx scripts/checkMigrationStatus.ts
 * Requires SUPABASE_ACCESS_TOKEN (catalog introspection is impossible via PostgREST).
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env', override: false });
dotenv.config({ path: '.env.local', override: true });

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF ?? 'uiwlioriubixerspdamx';
if (!TOKEN) {
  console.error('[migration-status] SUPABASE_ACCESS_TOKEN is not set (see .env.example).');
  process.exit(1);
}

async function sql(query: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  const body = text ? JSON.parse(text) : [];
  return Array.isArray(body) ? body : [body];
}

type Check =
  | { kind: 'table'; name: string }
  | { kind: 'column'; table: string; name: string }
  | { kind: 'function'; name: string; args: string }
  | { kind: 'trigger'; table: string; name: string }
  | { kind: 'index'; name: string };

interface MigrationSpec {
  file: string;
  checks: Check[];
  seed?: Record<string, number>;
  /** Pass condition is that these are ABSENT (drop-style migrations). */
  absent?: boolean;
  note?: string;
}


const M: MigrationSpec[] = [
  {
    file: '20240520000000_initial_schema.sql',
    checks: [
      { kind: 'table', name: 'profiles' },
      { kind: 'table', name: 'user_progress' },
      { kind: 'table', name: 'user_streaks' },
      { kind: 'table', name: 'user_achievements' },
      { kind: 'table', name: 'review_queue' },
      { kind: 'function', name: 'handle_new_user', args: '' },
    ],
  },
  {
    file: '20240521000000_user_activity_days.sql',
    checks: [
      { kind: 'table', name: 'user_activity_days' },
      { kind: 'column', table: 'user_activity_days', name: 'activity_date' },
    ],
  },
  {
    file: '003_add_daily_quests_and_high_scores_tables.sql',
    checks: [
      { kind: 'table', name: 'daily_quests' },
      { kind: 'table', name: 'high_scores' },
      { kind: 'function', name: 'update_daily_quests_timestamp', args: '' },
      { kind: 'trigger', table: 'daily_quests', name: 'trg_daily_quests_updated_at' },
      { kind: 'index', name: 'idx_daily_quests_user_id' },
      { kind: 'index', name: 'idx_high_scores_score' },
    ],
  },
  {
    file: '004_vocabulary_expansion.sql',
    checks: [
      { kind: 'table', name: 'vocabulary' },
      { kind: 'index', name: 'idx_vocab_level_category' },
    ],
  },
  {
    file: '005_repair_sync_tables.sql',
    checks: [
      { kind: 'table', name: 'user_xp' },
      { kind: 'column', table: 'review_queue', name: 'box_level' },
      { kind: 'column', table: 'review_queue', name: 'ease' },
      { kind: 'column', table: 'review_queue', name: 'last_result' },
    ],
  },
  {
    file: '008_a1_path_state.sql',
    checks: [
      { kind: 'table', name: 'a1_path_state' },
      { kind: 'function', name: 'update_a1_path_state_timestamp', args: '' },
      { kind: 'trigger', table: 'a1_path_state', name: 'trg_a1_path_state_updated_at' },
      { kind: 'column', table: 'a1_path_state', name: 'checkpoint_best_by_unit' },
    ],
  },
  {
    file: '010_dynamic_curriculum.sql',
    checks: [
      { kind: 'table', name: 'sentences' },
      { kind: 'column', table: 'vocabulary', name: 'tags' },
      { kind: 'function', name: 'get_random_sentences', args: 'p_grammar_focus text, p_limit integer' },
      { kind: 'index', name: 'idx_vocab_tags' },
      { kind: 'index', name: 'idx_sentences_grammar_focus' },
    ],
  },
  {
    file: '011_content_items.sql',
    checks: [
      { kind: 'table', name: 'content_items' },
      { kind: 'function', name: 'get_content_items', args: 'p_content_type text, p_limit integer, p_shuffle boolean' },
      { kind: 'index', name: 'idx_content_items_type' },
    ],
  },
  {
    file: '012_seed_content_items.sql',
    checks: [],
    seed: {
      'alphabet-item': 30, 'number-item': 39, 'greeting-item': 8, 'rapidfire-question': 24,
      'grammar-drill': 20, 'calendar-item': 19, 'spelling-word': 18, 'dictation-word': 12,
      'pronunciation-tip': 12, 'story-sentence': 8, 'roleplay-scenario': 3,
    },
    note: 'pure data seed',
  },
  {
    file: '013_vocab_i18n_extras.sql',
    checks: [{ kind: 'column', table: 'vocabulary', name: 'translation_ne_roman' }],
  },
  {
    file: '014_guard_article_quiz_pool.sql',
    checks: [{ kind: 'function', name: 'get_random_vocabulary', args: 'p_pos text, p_tag text, p_level text, p_category text, p_limit integer' }],
    note: '3-arg overload superseded by 015/018',
  },
  {
    file: '015_vocab_filters.sql',
    checks: [{ kind: 'function', name: 'get_random_vocabulary', args: 'p_pos text, p_tag text, p_level text, p_category text, p_limit integer' }],
  },
  {
    file: '016_notebooklm_vocab.sql',
    checks: [{ kind: 'column', table: 'vocabulary', name: 'plural_form' }],
  },
  {
    file: '017_glossary_quality.sql',
    checks: [{ kind: 'function', name: 'get_vocabulary_glossary', args: 'p_pos text, p_level text, p_category text, p_limit integer' }],
  },
  {
    file: '018_category_tags.sql',
    checks: [
      { kind: 'function', name: 'get_vocab_filter_options', args: '' },
      { kind: 'column', table: 'vocabulary', name: 'category' },
    ],
    note: 'retires `category`, moves topical values into tags[]',
  },
  {
    file: '019_drop_stale_get_random_vocabulary.sql',
    checks: [{ kind: 'function', name: 'get_random_vocabulary', args: 'p_pos text, p_tag text, p_limit integer' }],
    absent: true,
    note: 'passes when the 3-arg overload is GONE',
  },
  {
    file: '020_increment_activity.sql',
    checks: [
      { kind: 'function', name: 'increment_activity', args: 'p_user_id uuid, p_date date, p_delta integer' },
      { kind: 'column', table: 'user_activity_days', name: 'updated_at' },
    ],
  },
  {
    file: '20260814000000_harden_database.sql',
    checks: [
      { kind: 'function', name: 'update_updated_at_column', args: '' },
      { kind: 'trigger', table: 'profiles', name: 'update_profiles_updated_at' },
      { kind: 'trigger', table: 'user_progress', name: 'update_user_progress_updated_at' },
      { kind: 'trigger', table: 'user_streaks', name: 'update_user_streaks_updated_at' },
      { kind: 'trigger', table: 'review_queue', name: 'update_review_queue_updated_at' },
      { kind: 'index', name: 'idx_review_queue_user_due' },
    ],
  },
  {
    file: '20260814010000_user_activity_days.sql',
    checks: [
      { kind: 'column', table: 'user_activity_days', name: 'updated_at' },
      { kind: 'index', name: 'idx_user_activity_days_user_date' },
    ],
  },
  {
    file: '20260826000000_review_queue_id_text.sql',
    checks: [{ kind: 'column', table: 'review_queue', name: 'id' }],
    note: 'id must be TEXT, not uuid',
  },
  {
    file: '20260826164213_seed_uhrzeit_conversation_pools.sql',
    checks: [], seed: { 'uhrzeit-item': 21 },
    note: 'superseded by 20260913210001',
  },
  {
    file: '20260826182436_seed_uhrzeit_conversation_pools.sql',
    checks: [], seed: { 'conversation-def': 25, 'conversation-vocab': 219 },
    note: 'superseded by 20260913210001',
  },
  {
    file: '20260913210001_seed_uhrzeit_conversation_pools.sql',
    checks: [],
    seed: { 'uhrzeit-item': 21, 'conversation-def': 25, 'conversation-vocab': 219 },
    note: 'canonical version',
  },
  {
    file: '021_review_queue_error_tag.sql',
    checks: [{ kind: 'column', table: 'review_queue', name: 'error_tag' }],
  },
];

interface Catalog {
  tables: Set<string>;
  columns: Set<string>;
  functions: Set<string>;
  triggers: Set<string>;
  indexes: Set<string>;
}

async function loadCatalog(): Promise<Catalog> {
  const [tbls, cols, funcs, trigs, idx] = await Promise.all([
    sql(`select c.relname as name from pg_class c join pg_namespace n on n.oid=c.relnamespace
         where n.nspname='public' and c.relkind='r'`),
    sql(`select table_name, column_name from information_schema.columns where table_schema='public'`),
    sql(`select p.proname as name, pg_get_function_identity_arguments(p.oid) as args
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`),
    sql(`select c.relname as tbl, t.tgname as name
         from pg_trigger t join pg_class c on c.oid=t.tgrelid
         join pg_namespace n on n.oid=c.relnamespace
         where n.nspname='public' and not t.tgisinternal`),
    sql(`select indexname as name from pg_indexes where schemaname='public'`),
  ]);
  return {
    tables: new Set(tbls.map((r) => String(r.name))),
    columns: new Set(cols.map((r) => `${r.table_name}.${r.column_name}`)),
    functions: new Set(funcs.map((r) => `${r.name}(${r.args})`)),
    triggers: new Set(trigs.map((r) => `${r.tbl}.${r.name}`)),
    indexes: new Set(idx.map((r) => String(r.name))),
  };
}

function describe(c: Check): string {
  switch (c.kind) {
    case 'table': return `table ${c.name}`;
    case 'column': return `column ${c.table}.${c.name}`;
    case 'function': return `function ${c.name}(${c.args})`;
    case 'trigger': return `trigger ${c.table}.${c.name}`;
    case 'index': return `index ${c.name}`;
  }
}

function isPresent(c: Check, cat: Catalog): boolean {
  switch (c.kind) {
    case 'table': return cat.tables.has(c.name);
    case 'column': return cat.columns.has(`${c.table}.${c.name}`);
    case 'function': return cat.functions.has(`${c.name}(${c.args})`);
    case 'trigger': return cat.triggers.has(`${c.table}.${c.name}`);
    case 'index': return cat.indexes.has(c.name);
  }
}

async function main(): Promise<void> {
  const cat = await loadCatalog();
  const applied: string[] = [];
  const partial: string[] = [];
  const notApplied: string[] = [];

  console.log(`[migration-status] project ref ${REF}`);
  console.log('[migration-status] verdict = do the migration\'s OBJECTS exist in the live catalog\n');

  for (const spec of M) {
    const results = spec.checks.map((c) => ({ c, ok: isPresent(c, cat) }));
    // For drop-style migrations the PASS condition is absence, so invert.
    const bad = spec.absent ? results.filter((r) => r.ok) : results.filter((r) => !r.ok);
    const good = results.length - bad.length;

    if (bad.length === 0) {
      applied.push(spec.file);
      console.log(`  APPLIED     ${spec.file}${good ? `  [${good} check(s)]` : ''}${spec.note ? `  (${spec.note})` : ''}`);
      continue;
    }
    if (good > 0) {
      partial.push(spec.file);
      console.log(`  PARTIAL     ${spec.file}  ${good}/${results.length} check(s) pass`);
    } else {
      notApplied.push(spec.file);
      console.log(`  NOT APPLIED ${spec.file}`);
    }
    for (const { c, ok } of bad) {
      console.log(`                 - ${describe(c)}: ${spec.absent ? (ok ? 'present but should be GONE' : 'absent') : 'MISSING'}`);
    }
  }

  console.log('\n  seed data:');
  for (const spec of M) {
    if (!spec.seed) continue;
    const types = Object.keys(spec.seed);
    const rows = await sql(
      `select content_type, count(*)::int as n from public.content_items
       where content_type in (${types.map((t) => `'${t}'`).join(',')}) group by content_type`,
    ) as unknown as { content_type: string; n: number }[];
    for (const [type, want] of Object.entries(spec.seed)) {
      const got = Number(rows.find((r) => r.content_type === type)?.n ?? 0);
      const ok = got >= want;
      console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${type}: ${got}${ok ? '' : `  < expected ${want}`}`);
      if (!ok) partial.push(`${spec.file} (seed ${type})`);
    }
  }

  console.log('\n' + '='.repeat(72));
  console.log(`applied     : ${applied.length}/${M.length}`);
  console.log(`partial     : ${partial.length}${partial.length ? ` -> ${partial.join(', ')}` : ''}`);
  console.log(`not applied : ${notApplied.length}${notApplied.length ? ` -> ${notApplied.join(', ')}` : ''}`);
  console.log('='.repeat(72));
  process.exit(partial.length || notApplied.length ? 1 : 0);
}

main().catch((e: unknown) => {
  console.error('[migration-status] failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});

