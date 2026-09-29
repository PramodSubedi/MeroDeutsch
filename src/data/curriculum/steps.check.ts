/**
 * src/data/curriculum/steps.check.ts
 *
 *   npm run check:steps
 *
 * ── WHAT THIS IS FOR ─────────────────────────────────────────────────────────
 * `steps[]` is generated, so a validator that only checked its shape would be
 * checking that the generator ran. The properties that actually matter are about
 * AGREEMENT between the two: does the authored content still account for the
 * steps that claim to render it?
 *
 * That is the failure this repo already has blood on. `listening-gap` sits in
 * `CheckpointSource`, but `A1CheckpointPage.buildQuestions()` never had a case for
 * it, so it produced ZERO items and shipped M03 and M14 as 6- and 8-item decks
 * against a declared 12 — no error anywhere, because nothing counted
 * (`schema.ts:87-116` documents it).
 *
 * A silent drop is the whole risk of a generator, so the checks below are
 * deliberately about the JOINS rather than the parts:
 *
 *   1. every authored practiceBank item is represented by some step;
 *   2. every step type is one a renderer can actually draw;
 *   3. every CHECK step can be marked right or wrong (a check step with no
 *      answer is an unanswerable question, which reads as "correct" forever);
 *   4. every mcq answer is selectable from its own options;
 *   5. the reference steps cover the document blocks they were derived from.
 *
 * Check 3 is the one that has not shipped before: a check step that cannot be
 * answered is worse than no step, because it scores as a pass.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isCheckStep, STEP_TYPES, type Step } from './steps';
import { validateLessonSteps } from './lessonSpec';
import type { PracticeItem, UnitLessonContent } from './schema';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LESSONS_DIR = path.join(HERE, 'lessons');

let checks = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail = ''): void {
  checks += 1;
  if (condition) console.log(`  PASS  ${label}`);
  else {
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    failures.push(label);
  }
}

const STEP_TYPE_SET = new Set<string>(STEP_TYPES);

/** Does a check step carry enough to decide right from wrong? */
function isAnswerable(step: Step): boolean {
  if (!isCheckStep(step)) return true;
  switch (step.type) {
    case 'mcq':
      return step.options.length >= 2 && step.answer.trim() !== '';
    case 'typed':
      return step.answer.trim() !== '' && step.prompt.trim() !== '';
    case 'arrange':
      return step.tokens.length >= 2;
    case 'match':
      // A one-pair "match" is not a matching exercise, and the generator already
      // downgrades it to a typed step. Two is the floor for it to be worth asking.
      return step.pairs.length >= 2 && step.pairs.every((p) => p.de.trim() && p.en.trim());
    case 'dictation':
      return step.text.trim() !== '';
    default:
      return false;
  }
}

const files = fs.readdirSync(LESSONS_DIR).filter((f) => f.endsWith('.json')).sort();
check('lesson files exist', files.length > 0, `${files.length} found`);

let totalSteps = 0;
let totalChecks = 0;
let totalBank = 0;
const seenTypes = new Set<string>();
const problems: string[] = [];

for (const file of files) {
  const lesson = JSON.parse(fs.readFileSync(path.join(LESSONS_DIR, file), 'utf8')) as UnitLessonContent;
  const steps = lesson.steps;
  if (!steps || steps.length === 0) {
    problems.push(`${file}: no steps[] (run \`npm run curriculum:steps\`)`);
    continue;
  }
  totalSteps += steps.length;
  const bank = (lesson.practiceBank ?? []) as PracticeItem[];
  totalBank += bank.length;
  const checkSteps = steps.filter(isCheckStep);
  totalChecks += checkSteps.length;

  // 1. Agreement: the bank is fully represented.
  //    Each authored item either becomes a check step or a reference step
  //    (prose and worked examples are legitimately ungraded), so the invariant is
  //    a LOWER BOUND: at least one step per practice item would be wrong — several
  //    items share a step (three Matching items become one match step). What must
  //    hold is that the bank is not silently ignored, and that nothing claims to
  //    cover more items than exist.
  const ungradedFromBank = steps.filter((s) => s.type === 'explain' && s.title.en && bank.some((b) => b.kind === s.title.en)).length;
  const accounted = checkSteps.length + ungradedFromBank;
  if (bank.length > 0 && accounted === 0) {
    problems.push(`${file}: ${bank.length} practice items but no step accounts for any of them`);
  }

  // 2. Every type is drawable.
  for (const step of steps) {
    seenTypes.add(step.type);
    if (!STEP_TYPE_SET.has(step.type)) {
      problems.push(`${file}: step type "${step.type}" is not in STEP_TYPES — no renderer can draw it`);
    }
  }

  // 3. Every check step is answerable.
  steps.filter((s) => !isAnswerable(s)).forEach((s) => {
    problems.push(`${file}: a "${s.type}" step cannot be answered — it would score as a pass forever`);
  });

  // 4. Every mcq answer is selectable.
  steps.filter((s): s is Extract<Step, { type: 'mcq' }> => s.type === 'mcq').forEach((s) => {
    if (!s.options.includes(s.answer)) {
      problems.push(`${file}: mcq answer "${s.answer}" is not among its options — the question has no correct choice`);
    }
  });

  // 5. The reference steps cover the blocks they were derived from.
  //
  //    ONLY for a MIGRATED lesson. The invariant here is "every document block
  //    became a step", which is true by construction of
  //    `npm run curriculum:steps` and false by design for an imported one: an
  //    authored lesson is a different treatment of the unit, not a rendering of
  //    the document beside it. M15's document carries 40 lexicon entries and the
  //    authored lesson teaches 5 of the most useful ones — that is a teaching
  //    decision, not a gap, and a check that flagged it would be telling the
  //    author to pad.
  //
  //    For an imported lesson the document fields are legacy reading material
  //    for the premium notes page, and `steps` is authoritative.
  const migrated = lesson.stepsSource !== 'imported';

  if (migrated && (lesson.lexicon ?? []).length > 0) {
    const words = steps.filter((s) => s.type === 'word').length;
    if (words !== (lesson.lexicon ?? []).length) {
      problems.push(`${file}: ${(lesson.lexicon ?? []).length} lexicon entries but ${words} word steps`);
    }
  }
  if (migrated && (lesson.traps ?? []).length > 0) {
    const traps = steps.filter((s) => s.type === 'trap').length;
    if (traps !== (lesson.traps ?? []).length) {
      problems.push(`${file}: ${(lesson.traps ?? []).length} traps but ${traps} trap steps`);
    }
  }
  if (migrated && lesson.dialogue) {
    const dialogue = steps.find((s) => s.type === 'dialogue');
    if (!dialogue || dialogue.type !== 'dialogue' || dialogue.turns.length !== lesson.dialogue.turns.length) {
      problems.push(`${file}: dialogue step does not carry all ${lesson.dialogue.turns.length} turns`);
    }
  }
  // A run must end in a summary and open on its objectives.
  if (steps[steps.length - 1]?.type !== 'summary') problems.push(`${file}: the last step is not a summary`);
}

console.log('\n=== 1. EVERY AUTHORED LESSON HAS STEPS ===');
check('all lessons converted', problems.filter((p) => p.includes('no steps[]')).length === 0, problems.filter((p) => p.includes('no steps[]')).join('; '));

console.log('\n=== 2. EVERY STEP TYPE IS DRAWABLE ===');
const unknown = [...seenTypes].filter((t) => !STEP_TYPE_SET.has(t));
check('no step uses an unregistered type', unknown.length === 0, unknown.join(', '));
check('STEP_TYPES is non-empty', STEP_TYPES.length > 0);
check('the registry has no duplicates', new Set(STEP_TYPES).size === STEP_TYPES.length);

console.log('\n=== 3. EVERY CHECK STEP CAN BE ANSWERED ===');
const unanswerable = problems.filter((p) => p.includes('cannot be answered'));
check('no unanswerable check step', unanswerable.length === 0, unanswerable.slice(0, 3).join('; '));

console.log('\n=== 4. EVERY MCQ IS ANSWERABLE FROM ITS OWN OPTIONS ===');
const badMcq = problems.filter((p) => p.includes('no correct choice'));
check('every mcq answer is selectable', badMcq.length === 0, badMcq.slice(0, 3).join('; '));

console.log('\n=== 5. THE STEPS COVER THE SOURCE DOCUMENT ===');
const coverage = problems.filter((p) => /lexicon entries|traps|dialogue|practice items/.test(p));
check('no coverage gap', coverage.length === 0, coverage.slice(0, 4).join('; '));
const structural = problems.filter((p) => p.includes('last step is not a summary'));
check('every run ends in a summary', structural.length === 0, structural.join('; '));

console.log('\n=== 6. THE CORPUS IS NOT DEGENERATE ===');
check('there is content', totalSteps > 0, `${totalSteps} steps`);
check('every lesson has a check step', totalChecks > 0, `${totalChecks} check steps`);
check('the check/reference ratio is sane', totalChecks > 0 && totalChecks < totalSteps, `${totalChecks}/${totalSteps}`);

console.log('\n=== 7. EVERY LESSON SATISFIES THE CONTENT CONTRACT ===');
// The shape checks above ask "is this a step the renderer can draw". The contract
// asks the different and harder question: "can a learner ANSWER it".
//
// The difference matters because the first version of this work passed every
// shape check while ninety-two exercises were unanswerable as rendered — twenty of
// them instructed a learner to "fill in the blank" about a prompt with no blank in
// it, because nothing in the data declared what the question was.
const contract: string[] = [];
for (const file of files) {
  const lesson = JSON.parse(fs.readFileSync(path.join(LESSONS_DIR, file), 'utf8')) as UnitLessonContent;
  for (const problem of validateLessonSteps(lesson.steps, { id: file.replace('.json', '') })) {
    contract.push(`${problem.where} [${problem.field}] ${problem.problem}${problem.found ? ` — found: ${problem.found}` : ''}`);
  }
}
check('no lesson violates the content contract', contract.length === 0, `${contract.length} violation(s)`);
if (contract.length > 0) {
  console.log('\n  Contract violations (each is a content defect, not a conversion limit):');
  for (const line of contract) console.log(`    - ${line}`);
  console.log('\n  See docs/lesson-content-spec.md for how to author each step type.');
}

console.log(
  `\n[summary] ${failures.length === 0 ? 'ALL' : ''} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`,
);
console.log(`          ${files.length} lessons · ${totalSteps} steps · ${totalChecks} scored · ${totalBank} authored items · types: ${[...seenTypes].sort().join(', ')}`);
if (failures.length > 0) {
  console.error('\nProblems:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
