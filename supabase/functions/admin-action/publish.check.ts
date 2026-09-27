/**
 * supabase/functions/admin-action/publish.check.ts
 *
 *   npx tsx supabase/functions/admin-action/publish.check.ts
 *
 * The property: publishing can only ever move the app from one VALID curriculum
 * to another. Every case below is a way the database could hold content that
 * breaks a lesson for a learner who cannot work around it.
 */
import { CONFIG_KEYS, checkPublishSet, checkUnitShape, validateConfigWrite } from './publish';

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

const unit = (id: string, order: number, nodes?: unknown[]) => ({
  id,
  order,
  cluster: 'basics',
  title: { en: 'A unit', de: 'Eine Einheit' },
  nodes: nodes ?? [
    { id: `${id}-learn`, kind: 'learn', route: '/x' },
    { id: `${id}-cp`, kind: 'checkpoint', route: `/checkpoint/${order - 1}` },
  ],
});

console.log('\n=== 1. A WELL-FORMED UNIT PASSES ===');
check('a good unit is ok', checkUnitShape(unit('m01', 1)).ok);
check('a good unit has no errors', checkUnitShape(unit('m01', 1)).errors.length === 0);
check('a good unit has no warnings', checkUnitShape(unit('m01', 1)).warnings.length === 0);

console.log('\n=== 2. MALFORMED INPUT NEVER PASSES ===');
for (const bad of [null, undefined, 'nope', 42, true, []]) {
  check(`${JSON.stringify(bad)} is refused`, !checkUnitShape(bad).ok, JSON.stringify(bad));
}
check('a missing id is refused', !checkUnitShape({ order: 1, nodes: [] }).ok);
check('a bad id format is refused', !checkUnitShape(unit('unit-one', 1)).ok);
check('an uppercase id is refused', !checkUnitShape(unit('M01', 1)).ok);
check('a short id is refused', !checkUnitShape(unit('m1', 1)).ok);
check('a missing order is refused', !checkUnitShape({ id: 'm01', nodes: [] }).ok);
check('order 0 is refused', !checkUnitShape(unit('m01', 0)).ok);
check('a negative order is refused', !checkUnitShape(unit('m01', -1)).ok);
check('a fractional order is refused', !checkUnitShape(unit('m01', 1.5)).ok);
check('a string order is refused', !checkUnitShape({ id: 'm01', order: '1', nodes: [] }).ok);
check('empty nodes are refused', !checkUnitShape({ id: 'm01', order: 1, nodes: [] }).ok);
check('missing nodes are refused', !checkUnitShape({ id: 'm01', order: 1 }).ok);

console.log('\n=== 3. A UNIT WITHOUT A CHECKPOINT IS REFUSED ===');
// Otherwise a learner completes the unit without ever being gated.
const noCp = { id: 'm01', order: 1, title: {}, nodes: [{ id: 'a', kind: 'learn' }, { id: 'b', kind: 'practice' }] };
check('a unit with no checkpoint is refused', !checkUnitShape(noCp).ok);
check('the reason is stated', checkUnitShape(noCp).errors.some((e) => /checkpoint/i.test(e)));
check('a unit WITH a checkpoint is fine', checkUnitShape(unit('m01', 1)).ok);

console.log('\n=== 4. DUPLICATE NODE IDS ARE REFUSED ===');
// Route lookup would return whichever matched first, silently losing a step.
const dupeNodes = { id: 'm01', order: 1, nodes: [{ id: 'same', kind: 'learn' }, { id: 'same', kind: 'checkpoint' }] };
check('duplicate node ids are refused', !checkUnitShape(dupeNodes).ok);
check('the duplicates are named', checkUnitShape(dupeNodes).errors.some((e) => /duplicate node id/i.test(e)));

console.log('\n=== 5. WARNINGS DO NOT BLOCK ===');
const w = checkUnitShape({ id: 'm01', order: 1, nodes: [{ id: 'a', kind: 'checkpoint' }] });
check('a missing title only warns', w.ok, JSON.stringify(w.errors));
check('the warning is recorded', w.warnings.length > 0);

console.log('\n=== 6. A COMPLETE SET PASSES ===');
const all = Array.from({ length: 15 }, (_, i) => unit(`m${String(i + 1).padStart(2, '0')}`, i + 1));
check('15 units in order pass', checkPublishSet(all).ok, JSON.stringify(checkPublishSet(all).errors));
check('order does not matter', checkPublishSet([...all].reverse()).ok);
check('an empty set is refused', !checkPublishSet([]).ok);
check('a non-array is refused', !checkPublishSet(null as never).ok);
check('a single unit at order 1 is allowed', checkPublishSet([unit('m01', 1)]).ok);
check('a single unit at order 2 is refused', !checkPublishSet([unit('m02', 2)]).ok);

console.log('\n=== 7. GAPS ARE A HARD ERROR, SHORT SETS ARE NOT ===');
// A gap is internally broken: orders 1,2,4 cannot be right no matter how many
// units exist. A SHORT set is only suspicious in context.
const gap = checkPublishSet([unit('m01', 1), unit('m02', 2), unit('m04', 4)]);
check('a gap is refused', !gap.ok);
check('the gap is explained', gap.errors.some((e) => /contiguous/i.test(e)), JSON.stringify(gap.errors));
// 1-7 contiguous IS internally valid; the function cannot know 8-15 exist unless
// told. Asserting otherwise would be testing a rule that does not exist.
check('1-7 contiguous is internally valid', checkPublishSet(all.slice(0, 7)).ok);
check('1-14 contiguous is internally valid', checkPublishSet(all.slice(0, 14)).ok);
check('2-15 (no unit 1) is refused', !checkPublishSet(all.slice(1)).ok);
check('publishing all 15 is allowed', checkPublishSet(all).ok);
// With the count supplied, a short publish is surfaced rather than silent.
const short = checkPublishSet(all.slice(0, 7), { expectedCount: 15 });
check('a short publish is still allowed', short.ok, JSON.stringify(short.errors));
check('a short publish WARNS about the truncation', short.warnings.some((w) => /7 of 15/.test(w)), JSON.stringify(short.warnings));
check('a full publish does not warn', checkPublishSet(all, { expectedCount: 15 }).warnings.filter((w) => /shorter/.test(w)).length === 0);
check('no expectedCount means no truncation warning', checkPublishSet(all.slice(0, 7)).warnings.filter((w) => /shorter/.test(w)).length === 0);

console.log('\n=== 8. DUPLICATES ACROSS A SET ===');
const dupIdSet = checkPublishSet([unit('m01', 1), unit('m01', 2)]);
check('a duplicate id is refused', !dupIdSet.ok);
check('the duplicate id is named', dupIdSet.errors.some((e) => /duplicate unit id/i.test(e)));
const dupOrderSet = checkPublishSet([unit('m01', 1), unit('m02', 1)]);
check('a duplicate order is refused', !dupOrderSet.ok);
check('the duplicate order is named', dupOrderSet.errors.some((e) => /duplicate order/i.test(e)));

console.log('\n=== 9. ONE BAD UNIT SPOILS THE SET ===');
check('a set with one bad unit is refused', !checkPublishSet([...all.slice(0, 14), unit('m15', 0)]).ok);
check('a set with one bad node list is refused', !checkPublishSet([...all.slice(0, 14), { id: 'm15', order: 15, nodes: [{ id: 'x', kind: 'learn' }] }]).ok);

console.log('\n=== 10. CONFIG: ONLY KNOWN KEYS ===');
// app_config is read by the LEARNER APP on every boot. An arbitrary key is a
// channel for enabling something nobody reviewed.
check('curriculum_source is writable', validateConfigWrite('curriculum_source', 'bundle').ok);
check('maintenance_mode is writable', validateConfigWrite('maintenance_mode', true).ok);
check('registration_open is writable', validateConfigWrite('registration_open', false).ok);
check('an unknown key is refused', !validateConfigWrite('nope', 'x').ok);
check('an unknown key lists the valid ones', /curriculum_source/.test((validateConfigWrite('nope', 'x') as { message: string }).message));
check('a SQL-ish key is refused', !validateConfigWrite("x'; DROP TABLE app_config; --", 'x').ok);
check('a null key is refused', !validateConfigWrite(null, 'x').ok);
check('an empty key is refused', !validateConfigWrite('', 'x').ok);
check('a non-string key is refused', !validateConfigWrite(42, 'x').ok);
check('maintenance_mode is not writable as a string key', !validateConfigWrite('curriculum_source', true).ok);
check('every spec has a description', Object.values(CONFIG_KEYS).every((s) => s.description.length > 10));

console.log('\n=== 11. CONFIG: VALUES ARE CONSTRAINED ===');
check('curriculum_source=bundle is allowed', validateConfigWrite('curriculum_source', 'bundle').ok);
check('curriculum_source=db is allowed', validateConfigWrite('curriculum_source', 'db').ok);
check('case and padding are tolerated', validateConfigWrite('curriculum_source', '  DB  ').ok);
for (const bad of ['sql', 'true', '1', 'bundles', 'drop table', '']) {
  check(`curriculum_source="${bad}" is refused`, !validateConfigWrite('curriculum_source', bad).ok, bad);
}
check('a non-string source is refused', !validateConfigWrite('curriculum_source', true).ok);
check('a number source is refused', !validateConfigWrite('curriculum_source', 1).ok);
check('a null source is refused', !validateConfigWrite('curriculum_source', null).ok);

console.log('\n=== 12. CONFIG: BOOLEANS ===');
check('true is accepted', validateConfigWrite('maintenance_mode', true).ok);
check('false is accepted', validateConfigWrite('maintenance_mode', false).ok);
// A hand-written row may hold the STRING "true" even though the column is JSONB.
check('the string "true" is accepted', validateConfigWrite('maintenance_mode', 'true').ok);
check('the string "false" is accepted', validateConfigWrite('maintenance_mode', 'false').ok);
for (const bad of ['yes', 'on', 1, 0, null, 'TRUE', {}]) {
  check(`${JSON.stringify(bad)} is refused for a boolean key`, !validateConfigWrite('maintenance_mode', bad).ok, JSON.stringify(bad));
}

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
