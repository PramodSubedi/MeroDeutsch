/**
 * scripts/auditCategoryTags.ts  (read-only verification for migration 018)
 *
 * Confirms the online/offline tag alignment end-state against the live Supabase
 * project:
 *   1. `get_vocab_filter_options()` RPC exists and no longer errors
 *   2. No vocabulary row still carries a non-empty `category` column value
 *      (migration 018 Step 2 heals them into `tags[]` and NULLs it)
 *   3. The RPC's topical option list matches the client classifier
 *      (`isTopicalTag` over DISTINCT tags) — i.e. online == offline options
 *   4. `get_vocabulary_glossary` / `get_random_vocabulary` return rows when
 *      filtered by a topical category (proves `p_category = ANY(tags)`)
 *
 * Row access strategy (same env convention as seedVocab.ts):
 *   * SUPABASE_SERVICE_ROLE_KEY  → full `vocabulary` table scan (bypasses RLS)
 *   * VITE_SUPABASE_ANON_KEY only → falls back to the `get_vocabulary_glossary`
 *     RPC result (up to 2000 rows) for the same aggregation.
 *
 * Read-only: issues only SELECT + STABLE RPC calls. Safe to run anytime.
 *
 * Usage:  npx tsx scripts/auditCategoryTags.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env', override: false });
dotenv.config({ path: '.env.local', override: true });
import { createClient } from '@supabase/supabase-js';
import { isTopicalTag } from '../src/utils/vocabTags';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!url) {
  console.error('[audit] VITE_SUPABASE_URL missing — set it in .env / .env.local');
  process.exit(1);
}

const key = serviceKey ?? anonKey ?? '';
const mode = serviceKey ? 'service-role' : 'anon';
const supabase = createClient(url, key);

type VocabRow = {
  word: string | null;
  part_of_speech: string | null;
  article: string | null;
  level: string | null;
  category: string | null;
  tags: string[] | null;
};

const failures: string[] = [];
const pass = (msg: string) => console.log(`  PASS  ${msg}`);
const fail = (msg: string) => {
  failures.push(msg);
  console.log(`  FAIL  ${msg}`);
};
const info = (msg: string) => console.log(`  info  ${msg}`);

async function fetchRows(): Promise<{ rows: VocabRow[]; truncated: boolean }> {
  // Primary path: service-role direct scan (bypasses RLS).
  // Page through 1000-row chunks (PostgREST default cap) until the table is
  // fully covered, so counts / option lists are computed over ALL rows.
  if (serviceKey) {
    const out: VocabRow[] = [];
    for (let start = 0; ; start += 1000) {
      const { data, error } = await supabase
        .from('vocabulary')
        .select('word, part_of_speech, article, level, category, tags')
        .range(start, start + 999);
      if (error) {
        info(`direct table scan failed at ${start} (${error.message ?? 'no data'}) — trying RPC rows`);
        break;
      }
      if (!data || data.length === 0) break;
      out.push(...(data as VocabRow[]));
      if (data.length < 1000) break;
    }
    if (out.length > 0) return { rows: out, truncated: false };
  }
  // Fallback: full glossary dump via the (granted-to-anon) RPC.
  const { data, error } = await supabase.rpc('get_vocabulary_glossary', {
    p_pos: null,
    p_level: null,
    p_category: null,
    p_limit: 2000,
  });
  if (error) {
    fail(`get_vocabulary_glossary unavailable: ${error.message}`);
    return { rows: [], truncated: true };
  }
  const rows = (data as VocabRow[]).map((r) => ({
    word: r.word ?? null,
    part_of_speech: r.part_of_speech ?? null,
    article: r.article ?? null,
    level: r.level ?? null,
    category: r.category ?? null,
    tags: r.tags ?? [],
  }));
  return { rows, truncated: true };
}

async function main() {
  console.log(`[audit] mode=${mode} url=${url}\n`);
  const { rows, truncated } = await fetchRows();
  if (rows.length === 0) return exit(1);
  info(`rows analyzed: ${rows.length}${truncated ? ' (RPC dump cap 2000 — counts partial; RPC behavior still checked)' : ''}`);

  // 1) category column must be empty everywhere.
  const withCategory = rows.filter((r) => r.category && r.category.trim() !== '');
  console.log(`\n[1] legacy category column`);
  if (withCategory.length === 0) {
    pass(`0 rows still hold a category value (migration 018 step 2 applied / never populated)`);
  } else {
    fail(`${withCategory.length} rows still carry category — migration not applied yet`);
    const sample = new Set(withCategory.slice(0, 8).map((r) => r.category?.trim()));
    info(`sample values: ${[...sample].join(', ')}`);
  }

  // 2) online options RPC vs client classifier over DISTINCT tags.
  console.log(`\n[2] filter options: RPC (online) vs isTopicalTag over tags (offline)`);
  const rpcResult = await supabase.rpc('get_vocab_filter_options');
  let rpcOptions: string[] = [];
  if (rpcResult.error) {
    fail(`get_vocab_filter_options errored: ${rpcResult.error.message} (hint: function created by migration 018 — likely not applied yet)`);
  } else {
    rpcOptions = ((rpcResult.data as { category?: string }[]) ?? [])
      .map((r) => r.category ?? '')
      .filter(Boolean)
      .sort();
    info(`RPC returned ${rpcOptions.length} topical options (server classifier online)`);
  }
  const distinctTags = new Set<string>();
  for (const r of rows) for (const t of r.tags ?? []) if (t) distinctTags.add(t.trim());
  const expected = [...distinctTags].filter(isTopicalTag).sort();
  info(`expected = ${expected.length} topical options (client classifier offline)`);

  const expectedSet = new Set(expected);
  const missingOnline = expected.filter((t) => !rpcOptions.includes(t));
  const extraOnline = rpcOptions.filter((t) => !expectedSet.has(t));
  if (missingOnline.length === 0 && extraOnline.length === 0) {
    pass(`online RPC option list == offline classifier option list (${expected.length} options)`);
  } else {
    if (missingOnline.length) fail(`RPC is missing options the client would show: ${missingOnline.join(', ')}`);
    if (extraOnline.length) fail(`RPC shows options the client classifier would hide: ${extraOnline.join(', ')}`);
  }

  // Cluster rows that must surface as topical options after migration.
  const clusterCheck = ['numbers', 'alphabet', 'greetings'];
  for (const c of clusterCheck) {
    const inRpc = rpcOptions.includes(c);
    const inExpected = expected.includes(c);
    const tagCount = rows.filter((r) => (r.tags ?? []).some((t) => t.trim() === c)).length;
    console.log(`\n[3] cluster '${c}'`);
    info(`rows tagged '${c}': ${tagCount}`);
    if (tagCount > 0 && inRpc && inExpected) pass(`present in both online options & offline classifier`);
    else if (tagCount > 0) fail(`present in tags (${tagCount} rows) but ${!inRpc ? 'missing from RPC options' : ''}${!inExpected ? ' hidden by client classifier' : ''}`);
    else info(`no rows carry this tag yet (expected pre-migration if 018 not applied)`);
  }

  // 4) RPC category filters return rows for sampled topical categories.
  console.log(`\n[4] RPC filtering by p_category = ANY(tags)`);
  const probeCats = [...new Set([...clusterCheck.filter((c) => expected.includes(c)), ...expected.slice(0, 3)])].slice(0, 5);
  for (const cat of probeCats) {
    const g = await supabase.rpc('get_vocabulary_glossary', { p_pos: null, p_level: null, p_category: cat, p_limit: 3 });
    const r = await supabase.rpc('get_random_vocabulary', { p_pos: null, p_tag: null, p_level: null, p_category: cat, p_limit: 3 });
    const gN = Array.isArray(g.data) ? g.data.length : 0;
    const rN = Array.isArray(r.data) ? r.data.length : 0;
    const gErr = g.error ? g.error.message : '';
    const rErr = r.error ? r.error.message : '';
    if (gN > 0 && rN > 0) pass(`category='${cat}' → glossary ${gN} / random ${rN} rows`);
    else {
      const why = [gErr && `glossary [${gErr}]`, rErr && `random [${rErr}]`].filter(Boolean).join(' ');
      fail(`category='${cat}' → glossary ${gN} / random ${rN} rows${why ? ' — ' + why : ''}`);
    }
  }

  console.log(`\n[summary] ${failures.length === 0 ? 'ALL CHECKS PASSED' : failures.length + ' check(s) failed'}`);
  exit(failures.length === 0 ? 0 : 1);
}

function exit(code: number): never {
  process.exit(code);
}

main().catch((err) => {
  console.error('[audit] fatal:', err);
  process.exit(1);
});