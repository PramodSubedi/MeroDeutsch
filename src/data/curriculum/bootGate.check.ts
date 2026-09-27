/**
 * src/data/curriculum/bootGate.check.ts
 *
 *   npx tsx src/data/curriculum/bootGate.check.ts
 *
 * The property: THE LEARNER ALWAYS GETS A WORKING APP.
 *
 * The bundle is in the JS payload and cannot fail to arrive, so every gate
 * failure must end on the bundle. A blank page caused by a feature flag is a
 * total outage, and it is the failure mode this gate exists to prevent — these
 * checks are the guarantee that it cannot come back.
 */
import { runBootGate, withTimeout } from './bootGate';
import { __clearDbSeed, getDbSeed } from './dbSeed';
import { CURRICULUM_FILE } from './index';

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

const ok = (v: unknown) => Promise.resolve(v);
/**
 * Valid content = the REAL bundle.
 *
 * A hand-written fixture that "looks valid" is the wrong tool here: it tests
 * the fixture rather than the gate, and the first version of this file did
 * exactly that — its doc failed `validateCurriculum` and the db assertions
 * failed for a reason that had nothing to do with the gate. The actual bundle is
 * by definition the content that may be served, so it is the correct fixture.
 */
const validDoc = CURRICULUM_FILE;
const count = (raw: unknown) => ((raw as { units?: unknown[] }).units ?? []).length;
const never = <T,>() => new Promise<T>(() => {});

function gate(over: Partial<Parameters<typeof runBootGate>[0]> = {}) {
  return runBootGate({ readFlag: () => ok('bundle'), fetchDoc: () => ok(validDoc), timeoutMs: 200, ...over });
}

console.log('\n=== 1. BUNDLE IS THE DEFAULT ===');
__clearDbSeed();
check('flag=bundle serves the bundle', (await gate({ readFlag: () => ok('bundle') })).kind === 'bundle');
check('flag=bundle never fetches content', (await gate({ readFlag: () => ok('bundle'), fetchDoc: () => { throw new Error('must not fetch'); } })).kind === 'bundle');
check('a missing flag serves the bundle', (await gate({ readFlag: () => ok(undefined) })).kind === 'bundle');
check('a null flag serves the bundle', (await gate({ readFlag: () => ok(null) })).kind === 'bundle');
check('a typo flag serves the bundle', (await gate({ readFlag: () => ok('DBB') })).kind === 'bundle');
check('a quoted db flag serves the bundle (not exactly "db")', (await gate({ readFlag: () => ok('"db"') })).kind === 'bundle');
check('a numeric flag serves the bundle', (await gate({ readFlag: () => ok(1) })).kind === 'bundle');
check('no seed is planted in bundle mode', getDbSeed() === null);

console.log('\n=== 2. DB IS USED ONLY WHEN IT VALIDATES ===');
__clearDbSeed();
const db = await gate({ readFlag: () => ok('db'), countUnits: count });
check('valid db content is served', db.kind === 'db', JSON.stringify(db));
check('the unit count is reported', db.kind === 'db' && db.units === validDoc.units.length, String(db.kind === 'db' ? db.units : 'n/a'));
check('the seed is planted', getDbSeed() !== null);
check('the seed is the fetched document', getDbSeed() === validDoc);

__clearDbSeed();
const none = await gate({ readFlag: () => ok('db'), fetchDoc: () => ok(null) });
check('no content at all serves the bundle', none.kind === 'bundle');
check('and reports no-db-content', none.kind === 'bundle' && none.reason === 'no-db-content');
check('nothing is planted when there is no content', getDbSeed() === null);
check('content with no units serves the bundle', (await gate({ readFlag: () => ok('db'), fetchDoc: () => ok({ clusters: [{}], units: [] }) })).kind === 'bundle');
check('content with no clusters serves the bundle', (await gate({ readFlag: () => ok('db'), fetchDoc: () => ok({ clusters: [], units: [{}] }) })).kind === 'bundle');
check('a string body serves the bundle', (await gate({ readFlag: () => ok('db'), fetchDoc: () => ok('{}') })).kind === 'bundle');
check('invalid content is never planted', getDbSeed() === null);

console.log('\n=== 3. THE DB IS AN ENHANCEMENT, NEVER A DEPENDENCY ===');
__clearDbSeed();
// A learner on the subway. The fetch rejects; the app must still boot.
const offline = await gate({ readFlag: () => ok('db'), fetchDoc: () => Promise.reject(new Error('network down')) });
check('a failed fetch serves the bundle', offline.kind === 'bundle');
check('and says why', offline.kind === 'bundle' && /network down/.test(offline.reason));
const throwFlag = await gate({ readFlag: () => Promise.reject(new Error('flag fetch failed')) });
check('a failed flag read serves the bundle', throwFlag.kind === 'bundle');
check('nothing is planted after a failure', getDbSeed() === null);

console.log('\n=== 4. A SLOW NETWORK BOOTS ANYWAY ===');
__clearDbSeed();
// The case a naive `await` gets wrong: the request never settles. Without the
// timeout this is an infinite spinner, not a fallback.
const slowFlag = await gate({ readFlag: () => never<string>(), timeoutMs: 60 });
check('a hung flag read resolves to the bundle', slowFlag.kind === 'bundle');
check('and names the timeout', slowFlag.kind === 'bundle' && /timed out/.test(slowFlag.reason));
const slowDoc = await gate({ readFlag: () => ok('db'), fetchDoc: () => never<unknown>(), timeoutMs: 60 });
check('a hung content fetch resolves to the bundle', slowDoc.kind === 'bundle');
check('a hung fetch plants nothing', getDbSeed() === null);
// A response arriving AFTER the deadline must not win.
__clearDbSeed();
let lateResolve: (v: unknown) => void = () => {};
const late = new Promise((r) => {
  lateResolve = r;
});
const raced = await gate({ readFlag: () => ok('db'), fetchDoc: () => late, timeoutMs: 60 });
check('the late race returned the bundle', raced.kind === 'bundle');
lateResolve(validDoc);
await new Promise((r) => setTimeout(r, 20));
check('a late response does not retroactively plant', getDbSeed() === null);

console.log('\n=== 5. WITHIN THE BUDGET, DB WINS ===');
__clearDbSeed();
const fast = await gate({ readFlag: () => ok('db'), timeoutMs: 1000, countUnits: count });
check('a quick db resolution is used', fast.kind === 'db', JSON.stringify(fast));
check('and the seed is planted', getDbSeed() !== null);

console.log('\n=== 6. TIMEOUT PRIMITIVE ===');
check('a fast promise resolves', (await withTimeout(Promise.resolve('v'), 500)) === 'v');
check('a slow promise rejects', await withTimeout(new Promise((r) => setTimeout(r, 500)), 30, 'test').then(() => false, () => true));
check('a rejection propagates', await withTimeout(Promise.reject(new Error('x')), 500).then(() => false, (e: Error) => e.message === 'x'));
check('a non-Error rejection is still an Error', await withTimeout(Promise.reject('plain'), 500).then(() => false, (e: Error) => e instanceof Error));

__clearDbSeed();
console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);