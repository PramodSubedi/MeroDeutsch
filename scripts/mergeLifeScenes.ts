/**
 * scripts/mergeLifeScenes.ts  (one-shot build helper)
 *
 * Repairs the incrementally-edited src/data/life_scenes_defs.json buffer,
 * merges in the _parts/*.json scenario objects, validates every branch/ref,
 * and rewrites a canonical life_scenes_defs.json.
 *
 * Run: npx tsx scripts/mergeLifeScenes.ts
 */
import * as fs from 'fs';

const ROOT = '.';
const MAIN = 'src/data/life_scenes_defs.json';
const VOCAB_FILES = [
  'src/data/life_scenes_vocab.json',
  'src/data/conversational_german_vocab.json',
];
const PARTS = [
  'src/data/_parts/part_cafe.json',
  'src/data/_parts/part_bakery.json',
  'src/data/_parts/part_grocery.json',
  'src/data/_parts/part_restaurant.json',
  'src/data/_parts/part_clothing_flea.json',
  'src/data/_parts/part_hotel.json',
  'src/data/_parts/part_travel.json',
  'src/data/_parts/part_health.json',
];

/** Attempt to normalise a "mostly-JSON" fragment into parseable text. */
function tryRepair(raw: string): unknown {
  let text = raw.trim();
  // 1. Kill double commas and comma-newline-openBrace seams.
  for (let i = 0; i < 5; i++) {
    text = text.replace(/,\s*,/g, ',');
    text = text.replace(/\]\s*,\s*,\s*\{/g, '],\n{');
    text = text.replace(/\}\s*\n\s*\{/g, '},\n{');
  }
  // 2. Bracket attempts — append closers until JSON.parse succeeds.
  const suffixes = [' ]', ' ]}', ' ]}]', ' ]}]}', '\n]', '\n]}', '\n]}]', '\n]}]}'];
  for (const s of suffixes) {
    try {
      return JSON.parse(text + s);
    } catch {
      /* keep trying */
    }
  }
  throw new Error('unrepairable fragment');
}

interface StepLike { n: string; nEn?: string; from?: string; p: string; opts: Record<string, unknown>[] }
interface VariantLike { id: string; name: string; roleFlip?: boolean; steps: StepLike[] }
interface DefLike {
  sid: string; title: string; titleEn: string; emoji: string;
  ctx: string; band: string; closing?: string; roleModes?: string[];
  variants: VariantLike[];
}

function collect(source: string): DefLike[] {
  const out: DefLike[] = [];
  const parsed = tryRepair(fs.readFileSync(source, 'utf8'));
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  for (const el of arr) {
    if (el && typeof el === 'object' && 'sid' in (el as object) && String((el as DefLike).sid).startsWith('life-')) {
      out.push(el as DefLike);
    }
  }
  return out;
}

function collectPartsWithWrapper(file: string): DefLike[] {
  // Part files hold bare objects (no array). Strip a possible trailing comma,
  // then wrap in [] so the whole thing parses as an array of objects.
  let body = fs.readFileSync(file, 'utf8').trim();
  body = body.replace(/[,\s]+$/g, '');
  const fixed = ('[' + body + ']').replace(/\}\s*\n\s*\{/g, '},\n{');
  const parsed = JSON.parse(fixed);
  return parsed as DefLike[];
}

const vocab: Record<string, true> = {};
for (const vf of VOCAB_FILES) {
  const cards = JSON.parse(fs.readFileSync(vf, 'utf8')) as { german_text: string }[];
  for (const c of cards) vocab[c.german_text] = true;
}

// PART definitions are the sole source of truth — the old incremental main
// buffer was abandoned mid-edit and is fully replaced by this run.
const partDefs = PARTS.flatMap((p) => collectPartsWithWrapper(p));

// Dedupe by sid, first wins.
const bySid = new Map<string, DefLike>();
for (const d of partDefs) {
  if (!bySid.has(d.sid)) bySid.set(d.sid, d);
}
const defs = Array.from(bySid.values());

/* ── Validation ─────────────────────────────────────────────────── */
let errors = 0;
const titles = new Set<string>();
for (const d of defs) {
  if (titles.has(d.title)) { console.error(`[merge] duplicate title: ${d.sid} "${d.title}"`); errors++; }
  titles.add(d.title);
  d.variants.forEach((v) => {
    v.steps.forEach((st, idx) => {
      const oks = st.opts.filter((o) => o.ok === true);
      if (oks.length === 0) { console.error(`[merge] ${d.sid}/${v.id} step${idx}: no ok option`); errors++; }
      for (const o of st.opts) {
        const ref = o.ref as string | undefined;
        if (typeof ref === 'string' && !vocab[ref]) { console.error(`[merge] ${d.sid}/${v.id} step${idx}: unresolved ref "${ref}"`); errors++; }
        const nxt = o.next as number | undefined;
        if (typeof nxt === 'number' && (o.ok === true) && (nxt < 0 || nxt > v.steps.length)) {
          console.error(`[merge] ${d.sid}/${v.id} step${idx}: ok-option next=${nxt} out of range (${v.steps.length} steps)`); errors++;
        }
      }
    });
  });
}

fs.writeFileSync(
  MAIN,
  `${JSON.stringify(defs, null, 1)}\n`,
  'utf8',
);

console.log(`[merge] wrote ${defs.length} defs -> ${MAIN}`);
console.log(`[merge] sids: ${defs.map((d) => d.sid).join(', ')}`);
if (errors > 0) {
  console.error(`[merge] ${errors} validation error(s)`);
  process.exit(1);
}
console.log('[merge] validation passed ✔');