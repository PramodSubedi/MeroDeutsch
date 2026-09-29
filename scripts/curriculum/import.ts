/**
 * scripts/curriculum/import.ts
 *
 *   npm run curriculum:import -- <file.json>            # dry run — writes nothing
 *   npm run curriculum:import -- <file.json> --write    # apply
 *   npm run curriculum:import -- <file.json> --write --unit m07
 *
 * THE INGEST PATH. Takes an authored, validated lesson file and installs its
 * `steps` into the lesson JSONs the app actually loads.
 *
 * ── WHY ONLY `steps` ─────────────────────────────────────────────────────────
 * `lessons/mNN.json` carries both the document blocks (`lexicon`, `grammar`,
 * `practiceBank`, `traps`, `culture`, `dialogue`) and the step sequence. An
 * authored file contains only `steps` — and the premium notes page still renders
 * the document blocks as a reading surface. So this writes `steps` and leaves
 * every other key alone. Overwriting the whole file would silently delete the
 * reading material.
 *
 * ── WHY THE WHOLE IMPORT IS ALL-OR-NOTHING ───────────────────────────────────
 * Validating each lesson and importing the ones that pass would leave a corpus
 * that is half authored and half machine-reconstructed, with nothing in the data
 * saying which is which. So one bad lesson refuses the import entirely, and the
 * name of the offending lesson is printed.
 *
 * ── WHY IT IS A DRY RUN BY DEFAULT ───────────────────────────────────────────
 * It rewrites the content every learner sees. `--write` should be a decision,
 * not the state you land in by running a command to look.
 */
import fs from 'node:fs';
import path from 'node:path';
import { validateLessonSteps, warnLessonSteps } from '../../src/data/curriculum/lessonSpec';
import { isCheckStep, type Step } from '../../src/data/curriculum/steps';
import type { UnitLessonContent } from '../../src/data/curriculum/schema';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const LESSONS_DIR = path.join(ROOT, 'src', 'data', 'curriculum', 'lessons');

const args = process.argv.slice(2);
const write = args.includes('--write');
const unitArg = args.includes('--unit') ? args[args.indexOf('--unit') + 1] : undefined;
const file = args.find((a) => !a.startsWith('--') && a !== unitArg);

if (!file) {
  console.error(
    '\nUsage:\n' +
      '  npm run curriculum:import -- <file.json>              dry run\n' +
      '  npm run curriculum:import -- <file.json> --write      apply\n' +
      '  npm run curriculum:import -- <file.json> --write --unit m07\n',
  );
  process.exit(2);
}

/**
 * Pull the lessons out of whatever shape the export used.
 *
 * The keys are what establish the mapping to a unit, so they are NOT guessed:
 * `lesson_07` maps to `m07` only because the number says so, and the topics were
 * checked by hand against the unit titles before this was written. A key that
 * carries no number is refused rather than applied in file order — importing a
 * lesson into the wrong unit is a content error nobody would notice.
 */
function extractLessons(parsed: unknown, source: string): { unit: string; steps: unknown }[] {
  const rows: { unit: string; steps: unknown }[] = [];

  const push = (key: string, value: unknown) => {
    const steps = (value as { steps?: unknown })?.steps;
    if (!Array.isArray(steps)) return;
    const m = /(\d{2})\s*$/.exec(key);
    if (!m) {
      throw new Error(
        `"${key}" in ${source} has no unit number in its key, so it cannot be matched to a unit.\n` +
          'Keys must look like "lesson_07" or "m07". Refusing rather than guessing — the\n' +
          'wrong lesson in the wrong unit is a content error nobody would notice.',
      );
    }
    rows.push({ unit: `m${m[1]}`, steps });
  };

  if (Array.isArray(parsed) && Array.isArray(parsed[0]?.steps)) {
    parsed.forEach((doc, i) => push(`m${String(i + 1).padStart(2, '0')}`, doc));
    return rows;
  }
  if (Array.isArray(parsed?.steps)) {
    rows.push({ unit: path.basename(source, '.json'), steps: parsed.steps });
    return rows;
  }
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) push(key, value);
  return rows;
}

let parsed: unknown;
try {
  parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (err) {
  console.error(`\nNOT VALID JSON: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

let lessons: { unit: string; steps: unknown }[];
try {
  lessons = extractLessons(parsed, file);
} catch (err) {
  console.error(`\n${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

if (unitArg) lessons = lessons.filter((l) => l.unit === unitArg);
if (lessons.length === 0) {
  console.error(`\nNo lessons found${unitArg ? ` for ${unitArg}` : ''} in ${file}`);
  process.exit(1);
}

/* ── validate everything before touching anything ───────────────────────────── */

const failures: string[] = [];
let warningTotal = 0;

for (const lesson of lessons) {
  const problems = validateLessonSteps(lesson.steps, { id: lesson.unit });
  if (problems.length > 0) {
    failures.push(lesson.unit);
    console.log(`\n  REFUSED  ${lesson.unit} — ${problems.length} problem(s)`);
    for (const p of problems) {
      console.log(`      ${p.where}  [${p.field}]`);
      console.log(`        ${p.problem}`);
      if (p.found) console.log(`        found: ${p.found}`);
    }
  }
  warningTotal += warnLessonSteps(lesson.steps, { id: lesson.unit }).length;
}

if (failures.length > 0) {
  console.error(
    `\nIMPORT CANCELLED. ${failures.join(', ')} ${failures.length === 1 ? 'fails' : 'fail'} the content\n` +
      'contract. Nothing was written. Fix the JSON — see docs/lesson-content-spec.md.',
  );
  process.exit(1);
}

/* ── report the diff, then apply it ─────────────────────────────────────────── */

console.log(`\n${write ? 'APPLYING' : 'DRY RUN'} — ${lessons.length} lesson(s) from ${path.basename(file)}${warningTotal ? `, ${warningTotal} warning(s)` : ''}\n`);

const changes: { unit: string; from: number; to: number; fromChecks: number; toChecks: number; target: string }[] = [];

for (const lesson of lessons) {
  const target = path.join(LESSONS_DIR, `${lesson.unit}.json`);
  if (!fs.existsSync(target)) {
    console.log(`  SKIP  ${lesson.unit} — no ${lesson.unit}.json in the corpus`);
    continue;
  }
  const current = JSON.parse(fs.readFileSync(target, 'utf8')) as UnitLessonContent;
  const incoming = lesson.steps as Step[];
  const toChecks = incoming.filter(isCheckStep).length;
  const fromChecks = (current.steps ?? []).filter(isCheckStep).length;

  const kind = current.stepsSource === 'imported' ? 'replaces imported' : current.steps?.length ? 'replaces migrated' : 'fills empty';
  console.log(
    `  ${lesson.unit}  ${kind}: ${(current.steps ?? []).length} steps (${fromChecks} scored)` +
      ` → ${incoming.length} steps (${toChecks} scored)`,
  );
  changes.push({ unit: lesson.unit, from: (current.steps ?? []).length, to: incoming.length, fromChecks, toChecks, target });
}

const untouched = fs
  .readdirSync(LESSONS_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace('.json', ''))
  .filter((u) => !changes.some((c) => c.unit === u))
  .sort();
if (untouched.length > 0) console.log(`\n  untouched: ${untouched.join(', ')}`);

if (!write) {
  console.log(`\nDry run — nothing written. Re-run with --write to apply.`);
  console.log(`Total: ${changes.reduce((n, c) => n + c.to, 0)} steps, ${changes.reduce((n, c) => n + c.toChecks, 0)} scored.`);
  process.exit(0);
}

for (const change of changes) {
  const doc = JSON.parse(fs.readFileSync(change.target, 'utf8')) as UnitLessonContent;
  const lesson = lessons.find((l) => l.unit === change.unit)!;
  // Only `steps` and its provenance. Every document block — lexicon, grammar,
  // practiceBank, traps, culture, dialogue — is left exactly as it was, because
  // the premium notes page still renders them and the authored file does not
  // carry them at all.
  doc.steps = lesson.steps as Step[];
  doc.stepsSource = 'imported';
  fs.writeFileSync(change.target, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  console.log(`  wrote ${change.unit}`);
}

console.log(
  `\nImported ${changes.length} lesson(s): ` +
    `${changes.reduce((n, c) => n + c.to, 0)} steps, ${changes.reduce((n, c) => n + c.toChecks, 0)} scored.\n` +
    `Marked stepsSource: "imported", so \`npm run curriculum:steps\` will not overwrite them.`,
);
