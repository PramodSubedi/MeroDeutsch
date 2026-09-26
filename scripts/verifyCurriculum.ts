/**
 * scripts/verifyCurriculum.ts
 *
 * Contract check: does the LIVE data actually back what `src/data/a1Path.ts`
 * PROMISES the learner?
 *
 * WHY THIS EXISTS
 * ---------------
 * The 15-module A1 spine declares, per module, which `vocabCategories` and
 * `grammarCategories` its checkpoint draws from. Those declarations are load-
 * bearing in three separate places:
 *
 *   1. `A1CheckpointPage` -> `curriculumService.getVocabularyByCategories(...)`
 *      and `getGrammarDrills(cat)`, which build the actual question deck.
 *   2. `useModuleVocabStats` -> the "N words / N new / N due" line on the card.
 *   3. `ModuleVocabBar` -> the per-category "Review N due" drill buttons.
 *
 * Nothing verified that those categories RESOLVE to content. Two real defects
 * survived that way and shipped to production:
 *
 *   a) `stem` / `prefix` / `modals` / `perfekt` had ZERO rows in
 *      `content_items`, so M08/M09/M13/M15 online learners got an empty
 *      grammar pool. The declared category was fiction.
 *   b) The core family nouns (Mutter, Vater, Bruder, ...) were tagged only
 *      ['A1','noun'] — both STRUCTURAL tags that src/utils/vocabTags.ts
 *      classifies as non-topical — so M04's themed pool resolved to 10 cards of
 *      which exactly one was an actual family word.
 *
 * Both were invisible: the pages never crashed. `getVocabularyByCategories`
 * has an "A1 fill" pass 3 that tops a thin deck up with generic A1 cards, and
 * `getGrammarDrills` falls back to the four baseline categories. The learner
 * got a *non-empty but wrong* quiz. That is the worst failure mode — it looks
 * like it works.
 *
 * This script closes that hole. It reads the SAME `a1Path.ts` the app reads, so
 * adding a module or retagging a category is automatically covered.
 *
 * It is strictly READ-ONLY (mirrors auditDatabaseState.ts): no writes, no
 * upserts, no probes. Safe to run against production.
 *
 * Usage:  npm run verify-curriculum
 *         npx tsx scripts/verifyCurriculum.ts
 * Requires VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY).
 *
 * Exit code: 0 = all contracts pass, 1 = at least one FAIL.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env', override: false });
dotenv.config({ path: '.env.local', override: true });
import { createClient } from '@supabase/supabase-js';
import { A1_UNITS, A1_LEARN_NODES, A1_CURRICULUM } from '../src/data/a1Path';

// ── Thresholds ────────────────────────────────────────────────────────────────

/**
 * Minimum themed vocab cards a module should resolve to.
 *
 * 12 is chosen deliberately. A checkpoint deck is 10–15 items drawn WITHOUT
 * replacement from this pool, so a pool below 12 guarantees the learner sees
 * substantially the same items on every retry and the deck is memorised rather
 * than tested. Below this we want a WARN, not a hard FAIL, because a thin pool
 * may simply mean the module is new and its vocabulary is still being authored
 * in src/data/a1Units/*.
 */
const MIN_VOCAB_CARDS = 12;

/**
 * Minimum grammar drills per declared category.
 *
 * A module declaring a grammar category that yields <3 items is almost
 * certainly mis-declared (a typo, or a category that exists in the offline
 * snapshot but was never seeded). This is a hard FAIL: it means the module
 * teaches a grammar point it has no drills for.
 */
const MIN_GRAMMAR_DRILLS = 3;

// ── Env ────────────────────────────────────────────────────────────────────────

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('[curriculum-check] Set VITE_SUPABASE_URL and a Supabase key.');
  process.exit(1);
}
const client = createClient(url, key);

const failures: string[] = [];
const warnings: string[] = [];

const fail = (m: string) => { failures.push(m); console.log(`  FAIL  ${m}`); };
const warn = (m: string) => { warnings.push(m); console.log(`  WARN  ${m}`); };
const pass = (m: string) => console.log(`  PASS  ${m}`);


// ── 1. Every declared grammarCategory resolves ────────────────────────────────
//
// Checked against `content_items` because that is where grammar drills live
// (contentType 'grammar-drill', category carried INSIDE the payload). Reading
// the pool once and bucketing in JS avoids 15 round trips.

console.log('=== 1. grammarCategories resolve to real drills ===');
{
  const { data, error } = await client
    .from('content_items')
    .select('payload')
    .eq('content_type', 'grammar-drill');

  if (error) {
    fail(`could not read grammar-drill pool: ${error.message}`);
  } else {
    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      const cat = (row.payload as { category?: string } | null)?.category;
      if (cat) counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }

    let clean = true;
    for (const unit of A1_UNITS) {
      for (const cat of unit.grammarCategories ?? []) {
        const n = counts.get(cat) ?? 0;
        if (n === 0) {
          clean = false;
          fail(
            `${unit.id} declares grammarCategory '${cat}' but content_items has ZERO drills for it — ` +
            `its checkpoint will silently fall back to the baseline categories and test the wrong thing`,
          );
        } else if (n < MIN_GRAMMAR_DRILLS) {
          warn(`${unit.id} grammarCategory '${cat}' has only ${n} drill(s) (want >= ${MIN_GRAMMAR_DRILLS})`);
        }
      }
    }
    if (clean) pass('all declared grammarCategories resolve');
  }
}

// ── 2. Every declared vocabCategory resolves ──────────────────────────────────
//
// Vocabulary lives in its own `vocabulary` table, selected by tag overlap —
// this is exactly what getVocabularyByCategories pass 1 does.

console.log('\n=== 2. vocabCategories resolve to real vocabulary ===');
{
  const { data, error } = await client
    .from('vocabulary')
    .select('word, tags')
    .eq('level', 'A1');

  if (error) {
    fail(`could not read vocabulary table: ${error.message}`);
  } else {
    const byTag = new Map<string, Set<string>>();
    for (const row of (data ?? []) as { word: string; tags: string[] }[]) {
      for (const tag of row.tags ?? []) {
        let set = byTag.get(tag);
        if (!set) byTag.set(tag, (set = new Set()));
        set.add(row.word);
      }
    }

    let clean = true;
    for (const unit of A1_UNITS) {
      const cats = unit.vocabCategories ?? [];
      if (!cats.length) continue;

      const empty = cats.filter((c) => !byTag.get(c)?.size);
      if (empty.length) {
        clean = false;
        fail(
          `${unit.id} declares vocabCategory [${empty.join(', ')}] with ZERO A1 vocabulary — ` +
          `getVocabularyByCategories will fall through to the generic A1 fill`,
        );
      }

      const pool = new Set<string>();
      for (const c of cats) for (const w of byTag.get(c) ?? []) pool.add(w);
      if (pool.size > 0 && pool.size < MIN_VOCAB_CARDS) {
        warn(
          `${unit.id} themed pool is ${pool.size} card(s) (want >= ${MIN_VOCAB_CARDS}) ` +
          `from [${cats.join(', ')}] — a 10-15 item deck cannot vary on that`,
        );
      }
    }
    if (clean) pass('all declared vocabCategories resolve');
  }
}


// ── 3. Every learn/practice node points at a route the app actually serves ────
//
// A node whose `to` is not a registered route renders as a dead link. Checked
// against App.tsx's route table, which is the only authority on what exists.

console.log('\n=== 3. path nodes point at real routes ===');
{
  // Mirrors the <Route path="..."> table in src/App.tsx. Keep in sync — this
  // is the guardrail that catches a node added before its route (or a route
  // deleted while a node still points at it).
  const ROUTES = new Set([
    '/', '/welcome', '/auth', '/home', '/alphabet', '/numbers', '/calendar',
    '/articles', '/greetings', '/glossary', '/vocab-trainer', '/dictation',
    '/grammar', '/pronunciation', '/roleplay', '/dashboard', '/learn',
    '/sentence-builder', '/games', '/email-builder', '/practice',
    '/article-sprint', '/rapid-fire', '/rapid-blitz', '/stories', '/analytics',
    '/import', '/settings', '/privacy', '/terms', '/help', '/feedback',
  ]);
  const DYNAMIC = [/^\/checkpoint\/\d+$/, /^\/games(\?|$)/, /^\/rapid-fire(\?|$)/];

  let clean = true;
  for (const node of A1_LEARN_NODES) {
    const path = node.to.split('?')[0];
    if (ROUTES.has(path) || DYNAMIC.some((re) => re.test(node.to))) continue;
    clean = false;
    fail(`${node.id} points at '${node.to}', which is not a registered route`);
  }
  if (clean) pass('all learn/practice nodes resolve to routes');
}

// ── 4. Every module's declared nodeIds exist in the node map ──────────────────
//
// `buildCurriculum()` in a1Path.ts only console.warns about these, which is
// invisible in CI and in production.

console.log('\n=== 4. unit.nodeIds resolve ===');
{
  let clean = true;
  for (const unit of A1_UNITS) {
    for (const id of unit.nodeIds) {
      if (!A1_CURRICULUM.nodeMap[id]) {
        clean = false;
        fail(`${unit.id} references node '${id}', which is not in A1_CURRICULUM.nodeMap`);
      }
    }
  }
  if (clean) pass('all unit nodeIds resolve');
}

// ── 5. Structural sanity on the spine itself ─────────────────────────────────

console.log('\n=== 5. spine structure ===');
{
  const indexes = A1_UNITS.map((u) => u.index);
  const expected = A1_UNITS.map((_, i) => i);
  if (indexes.join(',') !== expected.join(',')) {
    fail(`unit indexes are not a dense 0..n-1 range: ${indexes.join(',')}`);
  } else {
    pass(`${A1_UNITS.length} modules, dense 0..${A1_UNITS.length - 1}`);
  }

  let clean = true;
  for (const unit of A1_UNITS) {
    const hasGate = unit.nodeIds.some((id) => A1_CURRICULUM.nodeMap[id]?.kind === 'checkpoint');
    if (unit.kind === 'core' && !hasGate) {
      clean = false;
      fail(`${unit.id} is a core module but declares no checkpoint node — nothing can unlock the next one`);
    }
  }
  if (clean) pass('every core module declares a checkpoint');
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n' + '-'.repeat(64));
if (failures.length) {
  console.log(`[curriculum-check] ${failures.length} FAILURE(S), ${warnings.length} warning(s)`);
  process.exit(1);
}
console.log(
  `[curriculum-check] all contracts pass` +
  (warnings.length ? ` (${warnings.length} warning(s))` : ''),
);
if (warnings.length) for (const w of warnings) console.log(`  WARN  ${w}`);
