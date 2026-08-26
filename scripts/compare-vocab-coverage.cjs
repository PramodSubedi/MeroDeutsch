/**
 * Scenario C follow-up: compare previous curriculum vocabulary sources against
 * the current offline bundle (public/data/enriched-vocab.json).
 *
 * Old sources:
 *   1. src/data/vocab/*.json        — curated batch files (seedVocab.ts -> Supabase)
 *   2. scripts/seedCurriculum.ts    — NOUNS / VERBS arrays (service-role seed)
 *
 * Usage: node scripts/compare-vocab-coverage.cjs
 */
const fs = require('fs');
const path = require('path');

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-zäöüß]/g, '');

const cur = require('../public/data/enriched-vocab.json');
const curSet = new Map(cur.map((c) => [norm(c.lemma) + '|' + c.partOfSpeech, c]));
const curLemmas = new Set(cur.map((c) => norm(c.lemma)));

// ── source 1: curated batch files ────────────────────────────────────────────
let batch = [];
const batchDir = path.join(__dirname, '..', 'src', 'data', 'vocab');
for (const f of fs.readdirSync(batchDir)) {
  const rows = JSON.parse(fs.readFileSync(path.join(batchDir, f), 'utf8'));
  for (const r of rows) batch.push({ file: f, ...r });
}
console.log('=== SOURCES ===');
console.log('current bundle cards:', cur.length);
console.log('batch-file rows:', batch.length);

const seenK = new Set();
let inBothB = 0;
const onlyOldB = [];
for (const r of batch) {
  const k = norm(r.word) + '|' + (r.part_of_speech || '');
  if (seenK.has(k)) continue;
  seenK.add(k);
  if (curSet.has(k)) inBothB++;
  else onlyOldB.push(k);
}
const batchLemmas = new Set(batch.map((r) => norm(r.word)));
const lemmaOnlyOldB = [...batchLemmas].filter((l) => !curLemmas.has(l));
console.log('\n=== BATCH FILES vs BUNDLE ===');
console.log('in-both:', inBothB, '| only-in-old:', onlyOldB.length);
console.log('lemma-level only-in-old:', lemmaOnlyOldB.length);

// ── source 2: seedCurriculum.ts NOUNS / VERBS ───────────────────────────────
const scPath = path.join(__dirname, 'seedCurriculum.ts');
const sc = fs.readFileSync(scPath, 'utf8');

function extractArray(name) {
  // Match: const NAME: Type[] = [ ... ]  (skip the type-annotation brackets).
  const declRe = new RegExp(`const ${name}\\b[^=]*=\\s*\\[`);
  const decl = declRe.exec(sc);
  if (!decl) return [];
  const open = decl.index + decl[0].length - 1;
  let depth = 0, end = -1;
  for (let i = open; i < sc.length; i++) {
    if (sc[i] === '[') depth++;
    else if (sc[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
  }
  const body = sc.slice(open + 1, end);
  const rows = [];
  // NounRow = [noun, art, meaning 'EN / NP', sentence]; VerbRow = [verb, meaning, sentence]
  const re = /\[\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*(?:,\s*'([^']*)')?\s*\]/g;
  let m;
  while ((m = re.exec(body))) rows.push(m.slice(1).map((v) => v ?? ''));
  return rows;
}

for (const name of ['NOUNS', 'VERBS']) {
  const rows = extractArray(name);
  console.log(`\n=== ${name} vs BUNDLE ===`);
  console.log('rows parsed:', rows.length);
  if (rows.length === 0) continue;
  let inBoth = 0;
  const onlyOld = [];
  const oldLemmas = new Set();
  for (const r of rows) {
    const pos = name === 'NOUNS' ? 'noun' : 'verb';
    const k = norm(r[0]) + '|' + pos;
    oldLemmas.add(norm(r[0]));
    if (curSet.has(k)) inBoth++;
    else onlyOld.push(k);
  }
  const lemmaOnlyOld = [...oldLemmas].filter((l) => !curLemmas.has(l));
  console.log('in-both:', inBoth, '| only-in-old:', onlyOld.length, '| lemma-level only-in-old:', lemmaOnlyOld.length);
  console.log('only-in-old samples:', onlyOld.slice(0, 20).join(', '));
}
