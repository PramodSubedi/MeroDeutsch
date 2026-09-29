/**
 * scripts/curriculum/merge-vocabulary.ts
 *
 *   npm run curriculum:merge-vocabulary            # dry run
 *   npm run curriculum:merge-vocabulary -- --write
 *   npm run curriculum:merge-vocabulary -- --write --unit m07
 *
 * FOLDS THE DOCUMENT LEXICON INTO THE WORD SCREEN.
 *
 * ── WHY ──────────────────────────────────────────────────────────────────────
 * The authored lessons teach a focused set — five words in M07, six in M05 — and
 * that is the right number for what the exercises test. But every lesson file
 * also still carries its ORIGINAL lexicon block beside it, and those blocks hold
 * 379 entries in total. Merging them takes the course from 95 taught words to
 * 424, which is the "more contents" the learner actually sees, without asking
 * anyone to regenerate fifteen lessons.
 *
 * ── WHY THE TWO SETS ARE NOT INTERCHANGEABLE ─────────────────────────────────
 * The authored words are what the exercises were written against. The document
 * entries are reference vocabulary. So the authored `word` steps are left exactly
 * as they are, and the document entries are appended as ADDITIONAL steps with no
 * `active` flag — which is what the word screen uses to decide whether to show
 * the "you produce this" badge.
 *
 * They render in one scrollable list, because a vocabulary list that a learner
 * cannot see all of is a worse vocabulary list. The badge is the only difference
 * they need.
 *
 * ── IDEMPOTENCE ──────────────────────────────────────────────────────────────
 * A lexicon entry is skipped when a `word` step for the same headword already
 * exists, comparing case-insensitively and on the stem, so `Buch` and `bücher`
 * are not both added and `Haus` is not added twice. Re-running changes nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Step } from '../../src/data/curriculum/steps';
import type { LexiconEntry, UnitLessonContent } from '../../src/data/curriculum/schema';

const LESSONS_DIR = path.resolve(import.meta.dirname, '..', '..', 'src', 'data', 'curriculum', 'lessons');

const args = process.argv.slice(2);
const write = args.includes('--write');
const unitArg = args.includes('--unit') ? args[args.indexOf('--unit') + 1] : undefined;

/** `Buch` and `bücher` must not both be added for the same headword. */
const stem = (w: string): string =>
  w
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/(en|er|es|e)$/, '');

const files = fs
  .readdirSync(LESSONS_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .filter((f) => (unitArg ? f.replace('.json', '') === unitArg : true));

let totalAdded = 0;
let totalUnits = 0;
const report: { unit: string; added: number; from: number; to: number }[] = [];

for (const file of files) {
  const full = path.join(LESSONS_DIR, file);
  const doc = JSON.parse(fs.readFileSync(full, 'utf8')) as UnitLessonContent;
  const steps = (doc.steps ?? []) as Step[];
  const lexicon = doc.lexicon ?? [];
  if (steps.length === 0 || lexicon.length === 0) continue;

  // Only lessons whose steps are a run can take more word steps, and only an
  // IMPORTED lesson has a document lexicon worth merging — a migrated one
  // already generated one word step per entry.
  if (doc.stepsSource === 'migrated') continue;

  const taught = new Set(
    steps.filter((s): s is Extract<Step, { type: 'word' }> => s.type === 'word').map((s) => stem(s.entry.word)),
  );

  const added: Step[] = [];
  for (const entry of lexicon as LexiconEntry[]) {
    if (!entry?.word) continue;
    if (taught.has(stem(entry.word))) continue;
    taught.add(stem(entry.word));
    // No `active` flag: these are reference words, not the set the exercises
    // test. The authored entries above keep theirs.
    added.push({ type: 'word', entry });
  }

  if (added.length === 0) continue;

  // Appended AFTER the authored words and BEFORE the summary, so the summary is
  // still the last step — `check:steps` requires that, and a run that ends on a
  // word is a run with no ending.
  const summaryAt = steps.findIndex((s) => s.type === 'summary');
  const next: Step[] =
    summaryAt === -1
      ? [...steps, ...added]
      : [...steps.slice(0, summaryAt), ...added, ...steps.slice(summaryAt)];

  doc.steps = next;
  totalUnits += 1;
  totalAdded += added.length;
  report.push({ unit: file.replace('.json', ''), added: added.length, from: steps.length, to: next.length });

  if (write) {
    fs.writeFileSync(full, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
    console.log(`  wrote ${file}  +${added.length} words  (${steps.length} → ${next.length} steps)`);
  }
}

const from = report.reduce((n, r) => n + r.from, 0);
const to = report.reduce((n, r) => n + r.to, 0);
console.log(
  `\n${write ? 'APPLIED' : 'DRY RUN'} — ${totalUnits} lesson(s), +${totalAdded} word step(s)` +
    (report.length ? `\n  steps: ${from} → ${to}` : ''),
);
if (report.length === 0) {
  console.log('  Nothing to merge: every document entry already has a word step, or the lessons are migrated.');
}
if (!write && report.length > 0) console.log('\nRe-run with --write to apply.');
