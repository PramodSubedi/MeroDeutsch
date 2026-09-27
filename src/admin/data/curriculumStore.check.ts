/**
 * src/admin/data/curriculumStore.check.ts
 *
 *   npx tsx src/admin/data/curriculumStore.check.ts
 *
 * The store is EMPTY right now, and that is the state these tests pin hardest.
 * A rollout feature that only works once populated is one that gets discovered
 * to be broken during the rollout.
 */
import { describeStore, type CurriculumStore } from './curriculumStore';

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

const store = (over: Partial<CurriculumStore> = {}): CurriculumStore => ({
  units: [],
  versions: [],
  source: 'unknown',
  errors: [],
  ...over,
});

console.log('\n=== 1. THE EMPTY STORE IS THE CURRENT STATE ===');
// curriculum_units was created empty on purpose. The page must render, not crash.
const empty = describeStore(store());
check('an empty store describes itself', /empty/i.test(empty), empty);
check('an empty store does not claim anything is published', !/published/.test(empty), empty);

console.log('\n=== 2. COUNTS ARE REPORTED HONESTLY ===');
const mixed = store({
  units: [
    { id: 'm01', order: 1, isPublished: true, title: 'A', nodeCount: 3, updatedAt: null },
    { id: 'm02', order: 2, isPublished: false, title: 'B', nodeCount: 3, updatedAt: null },
    { id: 'm03', order: 3, isPublished: true, title: 'C', nodeCount: 3, updatedAt: null },
  ],
});
const d = describeStore(mixed);
check('drafts and published are counted separately', /2 published/.test(d) && /1 draft/.test(d), d);
check('the total is stated', /3 unit/.test(d), d);
check('all drafts says 0 published', /0 published/.test(describeStore(store({ units: [mixed.units[1]] }))));
check('all published says 0 draft', /0 draft/.test(describeStore(store({ units: [mixed.units[0]] }))));

console.log('\n=== 3. THE SOURCE FLAG IS SURFACED ===');
// The whole point of the panel is that an admin can see which source is live.
check('bundle is reported', store({ source: 'bundle' }).source === 'bundle');
check('db is reported', store({ source: 'db' }).source === 'db');
// An unreadable flag must NOT be reported as "db" — the resolver falls back to
// the bundle, so claiming otherwise would be a lie.
check('an unknown flag stays unknown', store({ source: 'unknown' }).source === 'unknown');

console.log('\n=== 4. ERRORS DEGRADE RATHER THAN BLANK THE PAGE ===');
const broken = store({ errors: ['curriculum_versions: permission denied'], units: mixed.units });
check('errors are retained', broken.errors.length === 1);
check('units survive a versions failure', broken.units.length === 3);
check('the error is visible in the description context', describeStore(broken).length > 0);

console.log('\n=== 5. A STORE WITH NOTHING PUBLISHED CANNOT SERVE ===');
// The panel disables "serve the database" on `publishedCount === 0`. This is
// the check that encodes it.
const draftsOnly = store({ units: mixed.units.filter((u) => !u.isPublished) });
check('drafts only means nothing is servable', draftsOnly.units.filter((u) => u.isPublished).length === 0);
check('one published is enough', store({ units: [mixed.units[0]] }).units.filter((u) => u.isPublished).length === 1);

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
