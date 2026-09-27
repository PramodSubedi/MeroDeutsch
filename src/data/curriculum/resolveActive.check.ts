/**
 * src/data/curriculum/resolveActive.check.ts
 *
 *   npx tsx src/data/curriculum/resolveActive.check.ts
 *
 * THE TEST THAT WAS MISSING.
 *
 * `source.check.ts` proved the rules and `flagReader.ts` reads the wire, but
 * nothing proved the two were CONNECTED. A flag whose mechanism is tested and
 * whose invocation does not exist still cannot be switched — which is exactly
 * the state this suite exists to prevent.
 *
 * The wire is injected, so the real resolution path runs with no network and no
 * Supabase.
 */
import {
  __resetCurriculumResolution,
  __setReadersForTest,
  getActivePath,
  getSourceDecision,
  resolveActiveCurriculum,
  startCurriculumResolution,
} from './resolveActive';
import { CURRICULUM_FILE, RESOLVED_PATH, resolvePath } from './index';
import { bundleCurriculum } from './source';

let checks = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail = ''): void {
  checks += 1;
  if (cond) console.log(`  PASS  ${name}`);
  else {
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    failures.push(name);
  }
}

/** Drive the REAL resolution path with the wire replaced. */
async function resolve(flag: () => Promise<unknown>, doc: () => Promise<unknown>) {
  __resetCurriculumResolution();
  __setReadersForTest(flag, doc);
  return resolveActiveCurriculum();
}

const flagIs = (v: string) => async () => v;

console.log('\n=== 1. THE DEFAULT IS THE BUNDLE, WITH NO FLAG ROW ===');
let r = await resolve(async () => undefined, () => null);
check('no flag row falls back to the bundle', r.source === 'bundle', r.source);
check('a missing flag is reported as unreadable', r.reason === 'flag-unreadable', r.reason);
check('the active path is the bundle spine', getActivePath() === RESOLVED_PATH);
check('the bundle has units', getActivePath().units.length > 0);

console.log('\n=== 2. FLAG=bundle IGNORES ANY PUBLISHED CONTENT ===');
r = await resolve(flagIs('bundle'), () => Promise.resolve(CURRICULUM_FILE));
check('flag=bundle uses the bundle', r.source === 'bundle');
check('flag=bundle is reported as intentional', r.reason === 'flag-is-bundle', r.reason);
check('flag=bundle still uses the bundle spine', getActivePath() === RESOLVED_PATH);

console.log('\n=== 3. FLAG=db WITH VALID CONTENT ACTUALLY SWITCHES ===');
// This is the assertion that would have failed while the flag was inert.
r = await resolve(flagIs('db'), () => Promise.resolve(CURRICULUM_FILE));
check('flag=db reports db', r.source === 'db', r.source);
check('flag=db reports db-ok', r.reason === 'db-ok', r.reason);
check('flag=db changed the active path', getActivePath() !== RESOLVED_PATH);
check('the db path has the same unit count', getActivePath().units.length === RESOLVED_PATH.units.length);
check('the db path has the same learn nodes', getActivePath().learnNodes.length === RESOLVED_PATH.learnNodes.length);

console.log('\n=== 4. SWITCHING BACK IS POSSIBLE ===');
// A switch that cannot be turned back is not a rollout, it is a migration.
__resetCurriculumResolution();
__setReadersForTest(flagIs('db'), () => Promise.resolve(CURRICULUM_FILE));
await resolveActiveCurriculum();
check('it switched to db', getActivePath() !== RESOLVED_PATH);
__setReadersForTest(flagIs('bundle'), () => Promise.resolve(CURRICULUM_FILE));
const back = await resolveActiveCurriculum();
check('it switches back to bundle', back.source === 'bundle');
check('the bundle spine is restored', getActivePath() === RESOLVED_PATH);

console.log('\n=== 5. EVERY DB FAILURE RETURNS TO THE BUNDLE ===');
const cases: [string, () => Promise<unknown>, string][] = [
  ['a fetch that throws', () => Promise.reject(new Error('offline')), 'db-derive-failed'],
  ['a fetch returning null', () => Promise.resolve(null), 'no-db-content'],
  ['an empty document', () => Promise.resolve({ clusters: [], units: [] }), 'db-validate-failed'],
  ['a document that is not an object', () => Promise.resolve('nope'), 'db-validate-failed'],
  ['a semantically invalid document', () => Promise.resolve({ clusters: [{ id: 'c' }], units: [{ nope: true }] }), 'db-validate-failed'],
];
for (const [name, doc, reason] of cases) {
  const res = await resolve(flagIs('db'), doc);
  check(`${name} -> bundle`, res.source === 'bundle', res.source);
  check(`${name} -> ${reason}`, res.reason === reason, res.reason);
  check(`${name} -> the bundle spine is intact`, getActivePath() === RESOLVED_PATH);
}

console.log('\n=== 6. A THROWING FLAG READ IS SURVIVED ===');
r = await resolve(
  () => {
    throw new Error('config table missing');
  },
  () => Promise.resolve(CURRICULUM_FILE),
);
check('a throwing flag read falls back to the bundle', r.source === 'bundle', r.source);
check('it is reported as unreadable', r.reason === 'flag-unreadable', r.reason);
check('the bundle spine survives', getActivePath() === RESOLVED_PATH);

console.log('\n=== 7. A BAD FLAG VALUE DEGRADES ===');
for (const bad of ['sql', 'true', '', '  ', 'DBB']) {
  const res = await resolve(flagIs(bad), () => Promise.resolve(CURRICULUM_FILE));
  check(`"${bad}" degrades to the bundle`, res.source === 'bundle', res.source);
  check(`"${bad}" does NOT switch to db`, getActivePath() === RESOLVED_PATH);
}

console.log('\n=== 8. STARTING IS IDEMPOTENT AND SAFE ===');
__resetCurriculumResolution();
startCurriculumResolution();
startCurriculumResolution();
startCurriculumResolution();
check('repeated starts do not throw', true);
check('the decision is readable after start', typeof getSourceDecision().source === 'string');
check('the active path is always defined', getActivePath() !== undefined);

console.log('\n=== 9. THE BUNDLE IS NEVER LOST ===');
// Whatever happens, `bundleCurriculum()` must always answer. It is the floor.
__resetCurriculumResolution();
__setReadersForTest(flagIs('db'), () => Promise.resolve(CURRICULUM_FILE));
await resolveActiveCurriculum();
const b = bundleCurriculum();
check('the bundle baseline is always available', b.path === RESOLVED_PATH);
check('it carries every unit', b.path.units.length > 0);
check('resolvePath on the bundle is stable', resolvePath(b.file).units.length === b.path.units.length);

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
