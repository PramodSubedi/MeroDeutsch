/**
 * src/data/curriculum/source.check.ts
 *
 * Tests for the `curriculum_source` shadow switch.
 *
 *   npx tsx src/data/curriculum/source.check.ts
 *
 * The property under test is NOT "does db work" — it is "does the app still
 * work when db does not". Every failure mode below is something a real learner
 * on a flaky connection will hit, and each one must land on the bundle.
 */
import {
  CURRICULUM_SOURCE_KEY,
  bundleCurriculum,
  deriveFromDb,
  isUsableDbContent,
  loadCurriculum,
  resolveSource,
} from './source';
import { resolvePath, type ResolvedPath } from './index';
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

const BUNDLE = bundleCurriculum();

console.log('\n=== 1. THE DEFAULT IS THE BUNDLE ===');
// The single most important property. If this inverts, every learner depends on
// the network before they can open a lesson.
check('the flag key is the agreed name', CURRICULUM_SOURCE_KEY === 'curriculum_source');
check('an absent flag uses the bundle', resolveSource(undefined).source === 'bundle');
check('an absent flag is reported as unreadable', resolveSource(undefined).reason === 'flag-unreadable');
check('an explicit "bundle" uses the bundle', resolveSource('bundle').source === 'bundle');
check('an explicit "db" selects db', resolveSource('db').source === 'db');
check('"bundle" is reported as intentional', resolveSource('bundle').reason === 'flag-is-bundle');

console.log('\n=== 2. A BAD FLAG DEGRADES, NEVER THROWS ===');
// A typo in a flag must not take the app down on boot.
for (const bad of [null, 0, 1, true, {}, [], '', '  ', 'dbs', 'DB2', 'yes', 'true', 'sql']) {
  check(`${JSON.stringify(bad)} falls back to bundle`, resolveSource(bad).source === 'bundle');
}
check('"DB" (case) still selects db', resolveSource('DB').source === 'db');
check('" db " (padded) still selects db', resolveSource(' db ').source === 'db');

console.log('\n=== 3. FETCHED CONTENT IS VALIDATED ===');
check('the real bundle is usable', isUsableDbContent(CURRICULUM_FILE));
check('null is not usable', !isUsableDbContent(null));
check('undefined is not usable', !isUsableDbContent(undefined));
check('a string is not usable', !isUsableDbContent('nope'));
check('an empty object is not usable', !isUsableDbContent({}));
check('missing units is not usable', !isUsableDbContent({ clusters: [{ id: 'c' }] }));
check('empty clusters is not usable', !isUsableDbContent({ clusters: [], units: [{}] }));
check('empty units is not usable', !isUsableDbContent({ clusters: [{ id: 'c' }], units: [] }));
// Structurally plausible but semantically broken: a unit with no id/order can
// never survive the real validator, and must not be served.
check('a semantically invalid unit is rejected', !isUsableDbContent({ clusters: [{ id: 'c' }], units: [{ nope: true }] }));

console.log('\n=== 4. FALLBACK: EVERY FAILURE LANDS ON THE BUNDLE ===');
// Each of these is a real failure a learner can hit on a bad network.
const never = async () => {
  throw new Error('network down');
};

async function expectBundle(name: string, fetchDb: () => Promise<unknown>, readFlag: () => Promise<unknown>, reason: string) {
  const { path, decision } = await loadCurriculum(fetchDb, resolvePath, readFlag);
  check(`${name} -> bundle`, decision.source === 'bundle', decision.source);
  check(`${name} -> reason is ${reason}`, decision.reason === reason, decision.reason);
  check(`${name} -> the bundle spine is intact`, path === BUNDLE.path);
}

await expectBundle('flag=bundle, no fetch attempted', never, async () => 'bundle', 'flag-is-bundle');
await expectBundle('flag unreadable', never, async () => { throw new Error('db down'); }, 'flag-unreadable');
await expectBundle('flag=db, fetch throws', never, async () => 'db', 'db-derive-failed');
await expectBundle('flag=db, fetch returns null', async () => null, async () => 'db', 'no-db-content');
await expectBundle('flag=db, invalid content', async () => ({ units: [] }), async () => 'db', 'db-validate-failed');

console.log('\n=== 5. THE HAPPY PATH USES THE DB ===');
// A *valid* document must actually be preferred, or the switch is decorative.
const good = loadCurriculum(async () => CURRICULUM_FILE, resolvePath, async () => 'db');
const goodRes = await good;
check('valid content is used', goodRes.decision.source === 'db', goodRes.decision.source);
check('valid content reports db-ok', goodRes.decision.reason === 'db-ok');
check('the db spine has the same units as the bundle', goodRes.path.units.length === BUNDLE.path.units.length);
check('the db spine has the same learn nodes', goodRes.path.learnNodes.length === BUNDLE.path.learnNodes.length);

console.log('\n=== 6. DERIVE GUARDS resolvePath THROWING ===');
// Structurally valid but throwing during derivation must still fall back.
const thrower = (): ResolvedPath => {
  throw new Error('bad node graph');
};
const derived = deriveFromDb(CURRICULUM_FILE, thrower);
check('a throwing resolve is reported, not propagated', 'error' in derived, JSON.stringify(derived));
check('the error message is captured', 'error' in derived && derived.error === 'bad node graph');

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
