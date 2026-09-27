/**
 * supabase/functions/admin-action/publish.check.ts
 *
 *   npx tsx supabase/functions/admin-action/publish.check.ts
 *
 * The property: publishing can only ever move the app from one VALID curriculum
 * to another. Every case below is a way the database could hold content that
 * breaks a lesson for a learner who cannot work around it.
 */
import { CONFIG_KEYS, CHATBOT_CONFIG_KEYS, checkPublishSet, checkRollback, checkUnitShape, normalizeConfigValue, snapshotUnitId, validateConfigWrite } from './publish';

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

console.log('\n=== 13. CONFIG: THE COMPANION KEYS ARE WRITABLE ===');
for (const key of CHATBOT_CONFIG_KEYS) {
  const spec = CONFIG_KEYS[key];
  const sample = spec.types.includes('boolean') ? true : (spec.values ? spec.values[0] : 'x');
  check(`${key} is writable`, validateConfigWrite(key, sample).ok);
}
check('chatbot_enabled refuses a non-boolean', !validateConfigWrite('chatbot_enabled', 'maybe').ok);
check('intensity is constrained to its vocabulary', !validateConfigWrite('chatbot_default_intensity', 'sarcastic').ok);
check('intensity accepts every legal value', ['serious', 'balanced', 'playful'].every((v) => validateConfigWrite('chatbot_default_intensity', v).ok));
check('language mix is constrained', !validateConfigWrite('chatbot_default_language_mix', 'de_np').ok);
check('language mix accepts every legal value', ['de_en', 'de_en_ne'].every((v) => validateConfigWrite('chatbot_default_language_mix', v).ok));
// An EMPTY model list is the "unrestricted" case, so it must be expressible —
// but a blank string is what an operator actually types, and the writer
// refuses it for every other string key, so consistency wins.
check('an empty model name is refused', !validateConfigWrite('chatbot_default_model', '   ').ok);
check('a model name with spaces around it is accepted', validateConfigWrite('chatbot_default_model', '  qwen2.5:3b  ').ok);

console.log('\n=== 14. CONFIG: STORAGE NORMALISATION PRESERVES CASE ===');
// THE REGRESSION THIS SECTION EXISTS FOR. `config.set` used to lowercase every
// string it stored, which was correct while `curriculum_source` was the only
// string key (its whole vocabulary is two lowercase words) and corrupting the
// moment a case-sensitive key was added.
check(
  'a model name keeps its case',
  normalizeConfigValue('chatbot_default_model', 'Qwen2.5:3b') === 'Qwen2.5:3b',
  String(normalizeConfigValue('chatbot_default_model', 'Qwen2.5:3b')),
);
check(
  'a model list keeps the case of every entry',
  normalizeConfigValue('chatbot_allowed_models', 'Foo:7b, Bar:3b') === 'Foo:7b, Bar:3b',
);
check(
  'a base URL keeps its case',
  normalizeConfigValue('chatbot_base_url', 'http://NAS.local:11434/v1/Models') === 'http://NAS.local:11434/v1/Models',
);
check(
  'a model name is still trimmed',
  normalizeConfigValue('chatbot_default_model', '  qwen2.5:3b  ') === 'qwen2.5:3b',
);
// Enumerated vocabularies keep the old folding, because that is how the flag
// reader compares them and a stored '  DB  ' would never match 'db'.
check(
  'an enumerated key is still lowercased',
  normalizeConfigValue('curriculum_source', '  DB  ') === 'db',
  String(normalizeConfigValue('curriculum_source', '  DB  ')),
);
check(
  'an enumerated companion key is lowercased',
  normalizeConfigValue('chatbot_default_intensity', ' Playful ') === 'playful',
);
check(
  'a boolean passes through untouched',
  normalizeConfigValue('chatbot_enabled', true) === true,
);
// An unknown key has no spec, so `values` is undefined and case is preserved.
// It can never be stored (the validator refuses it first), but normalising must
// not throw on it either.
check('an unknown key does not throw', normalizeConfigValue('nope', 'Value') === 'Value');
// The rule and the gate must never disagree: anything normalise is asked to
// store has already passed validation.
check(
  'normalisation never rescues a value the validator refused',
  Object.keys(CONFIG_KEYS).every((key) => {
    const spec = CONFIG_KEYS[key];
    const bad = spec.types.includes('boolean') ? 'maybe' : '';
    return !validateConfigWrite(key, bad).ok;
  }),
);

console.log('\n=== 11. ROLLBACK VALIDATION ===');
// The hazard specific to rollback: a snapshot was valid against an OLDER
// schema. Restoring it can produce a unit that is individually fine but sits in
// a spine with a hole, or a snapshot belonging to a different unit entirely.
const snap = (id: string, order: number) => ({
  lesson_json: {
    id,
    order,
    title: { en: 'T' },
    nodes: [
      { id: `${id}-a`, kind: 'learn' },
      { id: `${id}-b`, kind: 'checkpoint' },
    ],
  },
});
const spine = Array.from({ length: 3 }, (_, i) => unit(`m${String(i + 1).padStart(2, '0')}`, i + 1));

// Peers EXCLUDE the unit being rolled back, exactly as the handler builds them:
// the restored doc is the replacement, not an addition. A test that left the old
// copy in would prove nothing about gaps, because the set would stay contiguous.
const without = (id: string) => spine.filter((u) => u.id !== id);
const withRestored = (id: string, doc: unknown) => [...without(id), doc];

check('a valid snapshot into a valid spine is allowed', checkRollback({ unitId: 'm02', snapshot: snap('m02', 2), peers: withRestored('m02', unit('m02', 2)) }).ok);
check('a missing snapshot is refused', !checkRollback({ unitId: 'm02', snapshot: null, peers: without('m02') }).ok);
check('the refusal names the missing version', checkRollback({ unitId: 'm02', snapshot: null, peers: without('m02') }).errors.some((e) => /no snapshot/i.test(e)));
check('a snapshot for ANOTHER unit is refused', !checkRollback({ unitId: 'm02', snapshot: snap('m03', 3), peers: withRestored('m02', unit('m02', 2)) }).ok);
check('the mismatch names both ids', checkRollback({ unitId: 'm02', snapshot: snap('m03', 3), peers: withRestored('m02', unit('m02', 2)) }).errors.some((e) => /m03/.test(e) && /m02/.test(e)));
check('a structurally broken snapshot is refused', !checkRollback({ unitId: 'm02', snapshot: { lesson_json: { id: 'm02' } }, peers: withRestored('m02', unit('m02', 2)) }).ok);
check('a snapshot with no checkpoint is refused', !checkRollback({ unitId: 'm02', snapshot: { lesson_json: { id: 'm02', order: 2, nodes: [{ id: 'x', kind: 'learn' }] } }, peers: withRestored('m02', unit('m02', 2)) }).ok);
check('a bare doc is accepted as a snapshot', checkRollback({ unitId: 'm02', snapshot: unit('m02', 2), peers: withRestored('m02', unit('m02', 2)) }).ok);
// The real hazard: an old snapshot whose `order` no longer matches its position.
check('a snapshot that would leave a GAP is refused', !checkRollback({ unitId: 'm02', snapshot: snap('m02', 5), peers: withRestored('m02', snap('m02', 5).lesson_json) }).ok);
check('the gap is explained', checkRollback({ unitId: 'm02', snapshot: snap('m02', 5), peers: withRestored('m02', snap('m02', 5).lesson_json) }).errors.some((e) => /contiguous|missing|order/i.test(e)));
check('a bad unit id is refused', !checkRollback({ unitId: 'unit-two', snapshot: snap('m02', 2), peers: spine }).ok);
check('a non-string unit id is refused', !checkRollback({ unitId: 2, snapshot: snap('m02', 2), peers: spine }).ok);
check('a snapshot with no readable id is refused', !checkRollback({ unitId: 'm02', snapshot: { lesson_json: 'nope' }, peers: withRestored('m02', unit('m02', 2)) }).ok);
check('a valid rollback reports no errors', checkRollback({ unitId: 'm02', snapshot: snap('m02', 2), peers: withRestored('m02', unit('m02', 2)) }).errors.length === 0);
check('a short store warns rather than lies', checkRollback({ unitId: 'm02', snapshot: snap('m02', 2), peers: withRestored('m02', unit('m02', 2)), expectedCount: 15 }).ok);
check('and the truncation is surfaced', checkRollback({ unitId: 'm02', snapshot: snap('m02', 2), peers: withRestored('m02', unit('m02', 2)), expectedCount: 15 }).warnings.some((w) => /3 of 15/.test(w)));

console.log('\n=== 12. SNAPSHOT UNIT ID ===');
check('a snapshot row yields its id', snapshotUnitId(snap('m07', 7)) === 'm07');
check('a bare doc is also readable', snapshotUnitId({ id: 'm07', order: 7 }) === 'm07');
check('a string snapshot yields null', snapshotUnitId('nope') === null);
check('an array yields null', snapshotUnitId([]) === null);
check('a snapshot with no id yields null', snapshotUnitId({ lesson_json: { order: 1 } }) === null);

console.log('\n=== 13. AN UNRELATED DRAFT MUST NOT BLOCK A ROLLBACK ===');
// The live bug. The handler passed EVERY unit in the table into the set check,
// not just the published ones. Unit m16 is a draft with no checkpoint, so every
// rollback refused — and the error named m16's defect while the operator was
// trying to fix m01. Unserved drafts cannot break a served spine, so the set the
// rollback validates must contain only published units.
const brokenDraft = { id: 'm09', order: 9, nodes: [{ id: 'm09-a', kind: 'learn' }] };
check(
  'a published rollback is allowed despite a broken draft elsewhere',
  checkRollback({ unitId: 'm01', snapshot: snap('m01', 1), peers: [unit('m01', 1)] }).ok,
);
// Reproduced through the handler's own construction, so the test fails if anyone
// widens the peer set back to the whole table.
const handlerPeers = (publishedIds: string[], drafts: unknown[]) => [
  ...publishedIds.map((id) => unit(id, Number(id.slice(1)))),
  ...drafts,
];
check(
  'the published-only peer set ignores draft defects',
  checkRollback({ unitId: 'm01', snapshot: snap('m01', 1), peers: handlerPeers(['m01'], []) }).ok,
);
check(
  'and the whole-table set would have refused it (the regression, pinned)',
  !checkRollback({ unitId: 'm01', snapshot: snap('m01', 1), peers: handlerPeers(['m01'], [brokenDraft]) }).ok,
);
// A defect in a PUBLISHED peer is still a real blocker and must not be lost.
check(
  'a defect in a published peer is still refused',
  !checkRollback({ unitId: 'm01', snapshot: snap('m01', 1), peers: [unit('m01', 1), brokenDraft] }).ok,
);
// Rolling back a DRAFT does not join the served spine, so the peer set is the
// published units only and the restored doc is still shape-checked alone.
check(
  'a draft rollback does not need itself in the peer set',
  checkRollback({ unitId: 'm09', snapshot: { id: 'm09', order: 9, nodes: [{ id: 'x', kind: 'learn' }, { id: 'y', kind: 'checkpoint' }] }, peers: [unit('m01', 1)] }).ok,
);
check(
  'but a structurally broken draft is still refused on its own',
  !checkRollback({ unitId: 'm09', snapshot: { id: 'm09', order: 9, nodes: [{ id: 'x', kind: 'learn' }] }, peers: [unit('m01', 1)] }).ok,
);

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
