/**
 * scripts/curriculum/repoint-learn-nodes.ts
 *
 *   npm run curriculum:repoint            # dry run
 *   npm run curriculum:repoint -- --write
 *
 * ── WHAT IT FIXES ────────────────────────────────────────────────────────────
 * Every unit's `learn` node pointed at a SHARED TOOL PAGE rather than at the
 * unit's own lesson. The sixteen learn nodes collapsed onto eight tool routes:
 *
 *     m07-learn → /grammar?tab=v2      a general reference panel about V2
 *     m07-learn → /lesson/6            M07's own 60-step authored lesson
 *
 * So the learning path never reached the content. Clicking the main node on the
 * spine landed on a static panel that never mentioned that unit's traps,
 * dialogue or exercises — which is the original complaint, in one line of data.
 *
 * ── WHY THE TOOL ROUTE IS HANDED DOWN, NOT DROPPED ───────────────────────────
 * `/grammar?tab=v2` is real, working teaching material. Orphaning it would lose
 * a page; keeping it on the learn node would be exactly what is being fixed. So
 * each unit's practice node inherits it, with a label that says what it now is —
 * a reference or a tool, beside the lesson rather than instead of it.
 *
 * ── WHY NODE IDS DO NOT CHANGE ───────────────────────────────────────────────
 * `completedNodeIds` is keyed on node id, and the schema calls those permanent.
 * Repointing the `to` of an existing node keeps every learner's progress intact;
 * a learner who already completed `m07-learn` still shows it complete, and will
 * see the new lesson when they next open it.
 *
 * ── WHY THIS IS A SCRIPT ─────────────────────────────────────────────────────
 * Sixteen files, three fields each, and a mapping that is easy to get subtly
 * wrong by hand. A dry run prints every change for review, and re-running is a
 * no-op because a node already pointing at `/lesson/` is left alone.
 */
import fs from 'node:fs';
import path from 'node:path';

const UNITS_DIR = path.resolve(import.meta.dirname, '..', '..', 'src', 'data', 'curriculum', 'units');

const write = process.argv.includes('--write');

/**
 * What each inherited tool route is called, now that it sits under a practice
 * node rather than the learn node.
 *
 * Hand-written rather than generated from the path because the path is an
 * implementation detail (`?tab=v2`) and the label is what a learner reads. The
 * word "Reference" distinguishes a panel you consult from a lesson you work
 * through, which is the whole point of the move.
 */
const INHERITED_LABELS: Record<string, { en: string; de: string }> = {
  '/greetings': { en: 'Greetings Practice', de: 'Begrüßungsübungen' },
  '/numbers': { en: 'Numbers Practice', de: 'Zahlenübungen' },
  '/alphabet': { en: 'Alphabet Practice', de: 'Alphabetübungen' },
  '/articles': { en: 'Articles Practice', de: 'Artikelübungen' },
  '/calendar': { en: 'Calendar Practice', de: 'Kalenderübungen' },
  '/stories': { en: 'Reading Practice', de: 'Leseübungen' },
  '/grammar': { en: 'Grammar Reference', de: 'Grammatik-Referenz' },
  '/vocab-trainer?category=family': { en: 'Family Vocabulary', de: 'Familienvokabeln' },
  '/vocab-trainer?category=clothing': { en: 'Clothing Vocabulary', de: 'Kleidungsvokabeln' },
  '/grammar?tab=conjugation': { en: 'Conjugation Reference', de: 'Konjugations-Referenz' },
  '/grammar?tab=v2': { en: 'V2 Reference', de: 'V2-Referenz' },
  '/grammar?tab=modals': { en: 'Modals Reference', de: 'Modalverben-Referenz' },
  '/sentence-builder?focus=akkusativ': { en: 'Accusative Builder', de: 'Akkusativ-Baukasten' },
  '/sentence-builder?focus=separable': { en: 'Separable Verb Builder', de: 'Trennbare-Verben-Baukasten' },
  '/roleplay?scene=cafe': { en: 'Café Roleplay', de: 'Café-Rollenspiel' },
  '/roleplay?scene=directions': { en: 'Directions Roleplay', de: 'Wegbeschreibungs-Rollenspiel' },
};

/**
 * Learn-node labels that must change, because the practice node is inheriting
 * the same words.
 *
 * M04's learn node was "Family Vocabulary" and M08's was "Accusative Builder" —
 * and those are exactly the names the inherited tool routes would take. Two
 * nodes on the same spine with the same label is a worse thing than a slightly
 * generic label, so the lesson takes the UNIT's title and the tool keeps the
 * specific name. A learner reads the spine and cannot tell which is which.
 */
const LEARN_LABEL_OVERRIDES: Record<string, { en: string; de: string }> = {
  m04: { en: 'Family & Relationships', de: 'Familie & Beziehungen' },
  m08: { en: 'Accusative Case & Direct Objects', de: 'Akkusativ & direkte Objekte' },
};

const files = fs.readdirSync(UNITS_DIR).filter((f) => f.endsWith('.json')).sort();
const changes: string[] = [];
/** Units actually mutated, kept with their on-disk text so only real changes are written. */
const mutated = new Map<string, { before: string; after: string }>();
let repointed = 0;
let unlabelled: string[] = [];

for (const file of files) {
  const full = path.join(UNITS_DIR, file);
  const original = fs.readFileSync(full, 'utf8');
  const unit = JSON.parse(original) as {
    id: string;
    nodes: { id: string; kind: string; label?: { en: string; de?: string }; to?: string; xp?: number }[];
  };

  const learn = unit.nodes.find((n) => n.kind === 'learn');
  if (!learn?.to) continue;

  // Already repointed — re-running must change nothing.
  if (learn.to.startsWith('/lesson/')) continue;

  const index = Number(unit.id.slice(1)) - 1;
  const lessonRoute = `/lesson/${index}`;
  const practice = unit.nodes.find((n) => n.kind === 'practice');
  const label = INHERITED_LABELS[learn.to];
  const learnOverride = LEARN_LABEL_OVERRIDES[unit.id];
  const previousLearnLabel = learn.label?.en ?? '—';

  if (learnOverride) learn.label = { ...learn.label, ...learnOverride };

  changes.push(
    `  ${unit.id}  learn  ${learn.to.padEnd(38)} → ${lessonRoute.padEnd(12)}  "${previousLearnLabel}"${learnOverride ? ` → "${learn.label?.en}"` : ' (label unchanged)'}`,
  );

  if (practice) {
    const before = `${practice.to} · "${practice.label?.en ?? '—'}"`;
    practice.to = learn.to;
    if (label) {
      practice.label = { ...practice.label, ...label };
    } else {
      unlabelled.push(`${unit.id}: ${learn.to}`);
    }
    changes.push(`  ${' '.repeat(unit.id.length)}  pract ${before.padEnd(38)} → ${practice.to.padEnd(12)}  (label: "${practice.label?.en ?? '—'}")`);
  }

  learn.to = lessonRoute;
  repointed += 1;
  mutated.set(file, { before: original, after: `${JSON.stringify(unit, null, 2)}\n` });
}

console.log(`\n${write ? 'APPLYING' : 'DRY RUN'} — ${repointed} learn node(s) to repoint\n`);
for (const line of changes) console.log(line);

if (unlabelled.length > 0) {
  console.log(`\n  NO LABEL AVAILABLE for ${unlabelled.length} inherited route(s) — the practice node keeps its old label:`);
  for (const u of unlabelled) console.log(`    - ${u}`);
}

if (repointed === 0) {
  console.log('  Nothing to do: every learn node already points at a lesson.');
  process.exit(0);
}

if (!write) {
  console.log(`\nDry run — nothing written. Re-run with --write to apply.`);
  process.exit(0);
}

for (const [file, { before, after }] of mutated) {
  if (before === after) continue;
  fs.writeFileSync(path.join(UNITS_DIR, file), after, 'utf8');
}

console.log(`\nRepointed ${repointed} learn node(s) across ${mutated.size} unit file(s).`);
console.log('Node ids unchanged, so completedNodeIds still match every existing learner.');
