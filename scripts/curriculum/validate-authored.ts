/**
 * scripts/curriculum/validate-authored.ts
 *
 *   npm run curriculum:validate-authored -- <file.json> [...]
 *   npm run curriculum:validate-authored -- --all
 *
 * THE FRONT DOOR TO THE CONTENT CONTRACT.
 *
 * Content arrives from outside the repository — a generator following
 * `docs/notebooklm-lesson-prompt.md`, a human editing in the admin's document
 * editor, a colleague's export. This is the command that decides whether a file
 * can be shipped, so the contract is enforced at the moment of arrival rather
 * than discovered in the app.
 *
 * It is deliberately separate from `npm run check:steps`, which validates the
 * COMMITTED corpus. This one takes a path, so nothing has to be in the repo to be
 * checked — which is the whole point when the content is new.
 *
 * Every message names the step, the field, the rule, and the offending value. A
 * generator cannot act on "invalid content"; it can act on that.
 */
import fs from 'node:fs';
import path from 'node:path';
import { validateLessonSteps, warnLessonSteps } from '../../src/data/curriculum/lessonSpec';
import { isCheckStep, type Step } from '../../src/data/curriculum/steps';

const args = process.argv.slice(2);
const all = args.includes('--all');
const paths = args.filter((a) => !a.startsWith('--'));

if (paths.length === 0 && !all) {
  console.error(
    '\nUsage:\n' +
      '  npm run curriculum:validate-authored -- <file.json> [...]\n' +
      '  npm run curriculum:validate-authored -- --all    (every committed lesson)\n',
  );
  process.exit(2);
}

const targets = all
  ? fs
      .readdirSync('src/data/curriculum/lessons')
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => path.join('src/data/curriculum/lessons', f))
  : paths;

interface LessonDoc {
  label: string;
  steps: unknown;
}

/**
 * Accept every shape a generator actually emits.
 *
 *   { "steps": [...] }                         a single lesson
 *   { "lesson_01": { "steps": [...] }, … }     a map of lessons, keyed by id
 *   [ { "steps": [...] }, … ]                  an array of lessons
 *
 * The first NotebookLM export for the whole A1 course arrived keyed by
 * `lesson_01`…`lesson_15`, which is the natural way to ask for fifteen lessons
 * in one document. A front door that only accepts one shape would send the
 * author into the JSON to restructure their file, which is a waste of a round
 * trip and a good way to lose content.
 */
function extractLessons(parsed: unknown, file: string): LessonDoc[] {
  if (Array.isArray(parsed)) {
    return parsed.map((doc, i) => ({ label: `${file} #${i + 1}`, steps: (doc as { steps?: unknown })?.steps }));
  }
  const asObject = parsed as Record<string, unknown>;
  if (Array.isArray(asObject?.steps)) {
    return [{ label: path.basename(file, '.json'), steps: asObject.steps }];
  }
  if (asObject && typeof asObject === 'object') {
    const lessons = Object.entries(asObject)
      .filter(([, value]) => Array.isArray((value as { steps?: unknown })?.steps))
      .map(([key, value]) => ({ label: key, steps: (value as { steps?: unknown }).steps }));
    if (lessons.length > 0) return lessons;
  }
  // A single lesson that is a bare array of steps.
  if (Array.isArray(parsed)) return [{ label: path.basename(file, '.json'), steps: parsed }];
  return [];
}

let totalProblems = 0;
let totalWarnings = 0;
let lessonsWithProblems = 0;
let lessonsChecked = 0;
const warningCounts = new Map<string, number>();

for (const file of targets) {
  if (!fs.existsSync(file)) {
    console.log(`\n=== ${file} ===\n  NOT FOUND`);
    totalProblems += 1;
    lessonsWithProblems += 1;
    continue;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    // A generator that emitted prose around the JSON produces this, and it is
    // worth naming precisely — the fix is "output only the object".
    console.log(`\n=== ${file} ===\n  NOT VALID JSON: ${err instanceof Error ? err.message : String(err)}`);
    totalProblems += 1;
    lessonsWithProblems += 1;
    continue;
  }

  const lessons = extractLessons(parsed, file);
  if (lessons.length === 0) {
    console.log(`\n=== ${file} ===\n  NO LESSONS FOUND — expected a "steps" array, a map of them, or an array of lessons.`);
    totalProblems += 1;
    lessonsWithProblems += 1;
    continue;
  }

  console.log(`\n=== ${file} — ${lessons.length} lesson(s) ===`);

  for (const lesson of lessons) {
    lessonsChecked += 1;
    const problems = validateLessonSteps(lesson.steps, { id: lesson.label });
    const warnings = warnLessonSteps(lesson.steps, { id: lesson.label });
    const steps = (lesson.steps ?? []) as Step[];
    const checkCount = steps.filter(isCheckStep).length;

    if (problems.length === 0) {
      console.log(`  PASS  ${lesson.label} — ${steps.length} steps, ${checkCount} scored`);
    } else {
      lessonsWithProblems += 1;
      totalProblems += problems.length;
      console.log(`  FAIL  ${lesson.label} — ${steps.length} steps, ${checkCount} scored, ${problems.length} problem(s)`);
      for (const p of problems) {
        console.log(`      ${p.where}  [${p.field}]`);
        console.log(`        ${p.problem}`);
        if (p.found) console.log(`        found: ${p.found}`);
      }
    }

    // Warnings never fail the file. A lesson that renders correctly and merely
    // reads badly is shippable; refusing it would be a rule about tidiness
    // masquerading as a rule about correctness.
    totalWarnings += warnings.length;
    for (const w of warnings) {
      const key = `${w.where} [${w.field}] ${w.warning}`;
      warningCounts.set(key, (warningCounts.get(key) ?? 0) + 1);
    }
  }
}

if (totalWarnings > 0) {
  console.log(`\n--- ${totalWarnings} WARNING(S) — not failures ---`);
  const sorted = [...warningCounts].sort((a, b) => b[1] - a[1]);
  for (const [key, n] of sorted.slice(0, 12)) console.log(`  ${String(n).padStart(4)}x  ${key}`);
  if (sorted.length > 12) console.log(`  ... and ${sorted.length - 12} other distinct warnings`);
}

console.log(
  `\n[summary] ${targets.length} file(s) · ${lessonsChecked} lesson(s) · ${lessonsWithProblems} with problems · ${totalProblems} problem(s) total`,
);

if (totalProblems > 0) {
  console.error(
    '\nFAILED. Fix the JSON — never the app. The validator\'s objections are\n' +
      'specific and correct, and working around one produces the class of defect\n' +
      'the contract exists to prevent. See docs/lesson-content-spec.md.',
  );
  process.exit(1);
}
console.log('\nOK. Ready to ship.');
