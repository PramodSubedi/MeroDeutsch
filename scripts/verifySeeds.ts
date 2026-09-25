/**
 * Verify migration 021 took effect, and cross-check every data-carrying
 * migration against what is actually present in the live tables.
 *
 * Read-mostly: performs one harmless probe upsert that it cleans up.
 * Usage: npx tsx scripts/verifySeeds.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env', override: false });
dotenv.config({ path: '.env.local', override: true });
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('[seed-check] Set VITE_SUPABASE_URL and a Supabase key.');
  process.exit(1);
}
const client = createClient(url, key);
const problems: string[] = [];

// ── 1. error_tag column present? ──────────────────────────────────────────────
// (existence only — section 1b does the end-to-end write probe with a valid FK)
console.log('=== 1. review_queue.error_tag column (migration 021) ===');
const { error: tagColErr } = await client.from('review_queue').select('error_tag').limit(1);
if (tagColErr) {
  console.log(`  FAIL  error_tag column missing: ${tagColErr.message}`);
  problems.push('review_queue.error_tag missing — migration 021 not applied');
} else {
  console.log('  PASS  error_tag column exists');
}
const { data: tagged, error: tagErr } = await client.from('review_queue').select('error_tag');
if (!tagErr && tagged) {
  const m = new Map<string, number>();
  for (const r of tagged as unknown as { error_tag: string | null }[]) {
    const k = r.error_tag ?? '(null)';
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  console.log(`  backfill across ${tagged.length} rows:`);
  for (const [k, n] of [...m].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)}  ${k}`);
  const nulls = m.get('(null)') ?? 0;
  if (nulls) {
    console.log(`  WARN  ${nulls} rows still have a null error_tag`);
  }
}

// ── 1b. review_queue.id TYPE (migration 20260826000000) ──────────────────────
// The client writes deterministic STRING ids (`${userId}:${moduleType}|${itemKey}`,
// see useReviewQueue.addWrongAnswer line ~212). If `id` is still UUID, PostgREST
// rejects every cloud write with "invalid input syntax for type uuid".
console.log('\n=== 1b. review_queue.id column type (migration 20260826000000) ===');
// Use a REAL auth.users id: review_queue.user_id has an FK to auth.users, so a
// made-up uuid would fail the FK and mask the column-type signal we care about.
const { data: probeUsers } = await client.from('profiles').select('id').limit(1);
const PROBE_UID = (probeUsers?.[0] as { id: string } | undefined)?.id;
if (!PROBE_UID) {
  console.log('  SKIP  no profile row available to probe with (need a real auth.users id)');
} else {
  const stringId = `${PROBE_UID}:seedcheck|probe`;
  // Mimic exactly what useReviewQueue.itemToRow() sends.
  const { error: strIdErr } = await client.from('review_queue').upsert([{
    id: stringId, user_id: PROBE_UID, module_type: 'seedcheck', item_key: 'probe',
    error_count: 1, error_tag: 'other',
  }], { onConflict: 'id' });

  if (strIdErr && /invalid input syntax for type uuid/i.test(strIdErr.message)) {
    console.log('  FAIL  `id` is still UUID — client string ids are rejected:');
    console.log(`        ${strIdErr.message}`);
    problems.push(
      'review_queue.id is UUID, not TEXT — migration 20260826000000_review_queue_id_text.sql was never applied, so EVERY cloud write of the review queue fails',
    );
  } else if (strIdErr) {
    console.log(`  FAIL  string-id upsert rejected: ${strIdErr.message}`);
    problems.push(`string-id upsert rejected: ${strIdErr.message}`);
  } else {
    console.log('  PASS  `id` accepts TEXT — client string ids upsert correctly');
    await client.from('review_queue').delete().eq('id', stringId);
    console.log('  PASS  probe row cleaned up');
  }
}

const MIG_DIR = join(process.cwd(), 'supabase', 'migrations');
interface SeedExpectation { file: string; type: string; declared: number | null; }
const expectations: SeedExpectation[] = [];

for (const file of readdirSync(MIG_DIR).sort()) {
  if (!file.endsWith('.sql')) continue;
  const sql = readFileSync(join(MIG_DIR, file), 'utf8');
  if (!/^\s*INSERT\s+INTO\s+public\.content_items/im.test(sql)) continue;

  // Each seed migration announces its own row counts, e.g. "-- uhrzeit-item (21 rows)".
  const declared = new Map<string, number>();
  for (const m of sql.matchAll(/^--\s*([a-z-]+)\s*\((\d+)\s+rows?\)/gim)) {
    declared.set(m[1]!, Number(m[2]));
  }
  // Count actual value tuples per content_type in the INSERT bodies.
  const actual = new Map<string, number>();
  for (const m of sql.matchAll(/\(\s*'[^']*'\s*,\s*'([a-z-]+)'\s*,/g)) {
    actual.set(m[1]!, (actual.get(m[1]!) ?? 0) + 1);
  }
  for (const [type, count] of actual) {
    expectations.push({ file, type, declared: declared.get(type) ?? null, });
  }
}

console.log('\n=== 2. content_items seed migrations vs live counts ===');
const { data: ci, error: ciErr } = await client.from('content_items').select('content_type');
if (ciErr) {
  console.log(`  FAIL  ${ciErr.message}`);
  problems.push(ciErr.message);
} else {
  const live = new Map<string, number>();
  for (const r of (ci ?? []) as unknown as { content_type: string }[]) {
    live.set(r.content_type, (live.get(r.content_type) ?? 0) + 1);
  }
  const byType = new Map<string, SeedExpectation[]>();
  for (const e of expectations) {
    if (!byType.has(e.type)) byType.set(e.type, []);
    byType.get(e.type)!.push(e);
  }
  for (const [type, exps] of [...byType].sort()) {
    const n = live.get(type) ?? 0;
    // The newest migration for a type is the one that should have been applied.
    const newest = exps[exps.length - 1]!;
    const want = newest.declared ?? exps.reduce((mx, e) => Math.max(mx, e.declared ?? 0), 0);
    const src = exps.map((e) => e.file.replace(/^\d+_/, '').replace(/\.sql$/, '')).join(' | ');
    if (want && n < want) {
      console.log(`  FAIL  ${type}: live ${n} < expected ${want}  (${src})`);
      problems.push(`content_items pool '${type}' under-seeded: ${n} of ${want}`);
    } else {
      console.log(`  PASS  ${type}: live ${n}${want ? ` >= expected ${want}` : ''}  (${src})`);
    }
  }
}

// ── 3. orphan check: pools present in DB but unknown to every migration ──────
console.log('\n=== 3. content_types in DB with NO seed migration ===');
const known = new Set(expectations.map((e) => e.type));
const { data: allCi } = await client.from('content_items').select('content_type');
const liveTypes = new Map<string, number>();
for (const r of (allCi ?? []) as unknown as { content_type: string }[]) {
  liveTypes.set(r.content_type, (liveTypes.get(r.content_type) ?? 0) + 1);
}
let orphans = 0;
for (const [t, n] of [...liveTypes].sort()) {
  if (!known.has(t)) {
    console.log(`  WARN  '${t}' (${n} rows) has no matching INSERT in any migration file`);
    orphans++;
  }
}
if (!orphans) console.log('  PASS  every live content_type is covered by a migration file');

console.log('\n' + '='.repeat(70));
if (problems.length === 0) {
  console.log('RESULT: all migrations applied and all seed pools present.');
} else {
  console.log(`RESULT: ${problems.length} problem(s):`);
  for (const p of problems) console.log(`   - ${p}`);
}
console.log('='.repeat(70));
process.exit(problems.length === 0 ? 0 : 1);
