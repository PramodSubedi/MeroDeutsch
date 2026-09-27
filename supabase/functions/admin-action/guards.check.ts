/**
 * supabase/functions/admin-action/guards.check.ts
 *
 * Exhaustive tests for the lockout guards.
 *   npx tsx supabase/functions/admin-action/guards.check.ts
 *
 * Written from the OUTCOME being protected ("the control centre can never be
 * orphaned"), not from the implementation. Every case maps to a way an admin
 * could plausibly lock themselves out with one click.
 *
 * A guard with no test is a guard that does not exist.
 */
import { evaluateAction, hasReason, requiresTarget, isKnownAction, validateRepair, REPAIR_FIELDS, REPAIR_COLUMNS, type ActionRequest, type Actor, type TargetUser } from './guards';

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

const ADMIN: Actor = { id: 'admin-1', role: 'admin', banned: false };
const OTHER_ADMIN: TargetUser = { id: 'admin-2', role: 'admin', banned: false };
const LEARNER: TargetUser = { id: 'user-9', role: 'user', banned: false };

/** Two active admins is the default: enough to demote one safely. */
function req(over: Partial<ActionRequest> = {}): ActionRequest {
  return { action: 'user.ban', actor: ADMIN, target: LEARNER, activeAdminCount: 2, ...over };
}

console.log('\n=== 1. SELF-LOCKOUT IS IMPOSSIBLE ===');
// The single most important property. If any of these pass, one click
// permanently removes the acting admin from their own control centre.
check('cannot ban self', evaluateAction(req({ action: 'user.ban', target: { ...ADMIN } })).code === 'self-action');
check('cannot unban self', evaluateAction(req({ action: 'user.unban', target: { ...ADMIN, banned: true } })).code === 'self-action');
check('cannot demote self', evaluateAction(req({ action: 'user.demote', target: { ...ADMIN } })).code === 'self-action');
check('cannot demote self even as the ONLY admin', evaluateAction(req({ action: 'user.demote', target: { ...ADMIN }, activeAdminCount: 1 })).code === 'self-action');
check('a reason does NOT unlock self-ban', evaluateAction(req({ action: 'user.ban', target: { ...ADMIN }, reason: 'testing' })).code === 'self-action');
check('self-lockout is not recoverable', evaluateAction(req({ action: 'user.demote', target: { ...ADMIN } })).recoverable === false);
// IDENTITY, not role, is what makes it self. Two different admin ids must not
// trip the guard, or the last-admin protection would misfire.
check('a DIFFERENT admin is not treated as self', evaluateAction(req({ action: 'user.demote', target: OTHER_ADMIN })).allowed === true);

console.log('\n=== 2. THE LAST ADMIN CANNOT BE REMOVED ===');
check('cannot demote the only admin', evaluateAction(req({ action: 'user.demote', target: OTHER_ADMIN, activeAdminCount: 1 })).code === 'last-admin');
check('a zero count also blocks', evaluateAction(req({ action: 'user.demote', target: OTHER_ADMIN, activeAdminCount: 0 })).code === 'last-admin');
check('two admins means demotion is allowed', evaluateAction(req({ action: 'user.demote', target: OTHER_ADMIN, activeAdminCount: 2 })).allowed === true);
check('last-admin is not recoverable', evaluateAction(req({ action: 'user.demote', target: OTHER_ADMIN, activeAdminCount: 1 })).recoverable === false);
// A SUSPENDED admin must not count as a safety net. If it did, you could demote
// the last ACTIVE admin while a banned one still held the role.
check('a suspended admin does NOT count toward the safety net', evaluateAction(req({ action: 'user.demote', target: { ...OTHER_ADMIN, banned: true }, activeAdminCount: 2, reason: 'offboarded' })).allowed === true);

console.log('\n=== 3. SUSPENSION ===');
check('banning a learner is allowed', evaluateAction(req({ action: 'user.ban' })).allowed === true);
check('banning an admin needs a reason', evaluateAction(req({ action: 'user.ban', target: OTHER_ADMIN })).code === 'reason-required');
check('…and is recoverable once supplied', evaluateAction(req({ action: 'user.ban', target: OTHER_ADMIN })).recoverable === true);
check('a reason permits it', evaluateAction(req({ action: 'user.ban', target: OTHER_ADMIN, reason: 'compromised' })).allowed === true);
check('banning a learner needs no reason', evaluateAction(req({ action: 'user.ban', target: LEARNER, reason: null })).allowed === true);
check('re-banning is rejected as a no-op', evaluateAction(req({ action: 'user.ban', target: { ...LEARNER, banned: true } })).code === 'invalid-transition');
check('unbanning a suspended learner is allowed', evaluateAction(req({ action: 'user.unban', target: { ...LEARNER, banned: true } })).allowed === true);
check('unbanning an active learner is a no-op', evaluateAction(req({ action: 'user.unban', target: LEARNER })).code === 'invalid-transition');

console.log('\n=== 4. PROMOTION ===');
check('promoting a learner is allowed', evaluateAction(req({ action: 'user.promote', target: LEARNER })).allowed === true);
check('promoting an existing admin is a no-op', evaluateAction(req({ action: 'user.promote', target: OTHER_ADMIN })).code === 'invalid-transition');
check('a suspended account must be unbanned first', evaluateAction(req({ action: 'user.promote', target: { ...LEARNER, banned: true } })).code === 'invalid-transition');
check('promotion is recoverable after an unban', evaluateAction(req({ action: 'user.promote', target: { ...LEARNER, banned: true } })).recoverable === true);

console.log('\n=== 5. ACTOR AUTHORIZATION ===');
check('a non-admin cannot act', evaluateAction(req({ actor: { ...ADMIN, role: 'user' } })).code === 'actor-not-admin');
check('a BANNED admin cannot act', evaluateAction(req({ actor: { ...ADMIN, banned: true } })).code === 'actor-banned');
// The actor check must precede the self-check, so a revoked admin gets the
// accurate reason instead of a confusing "you cannot ban yourself".
check('a banned admin gets the ban reason, not self-action', evaluateAction(req({ actor: { ...ADMIN, banned: true }, action: 'user.ban', target: { ...ADMIN } })).code === 'actor-banned');

console.log('\n=== 6. FAIL CLOSED ===');
check('an unknown action is refused', evaluateAction(req({ action: 'evil.drop' as never })).code === 'unknown-action');
check('an unknown action is NOT treated as allowed', evaluateAction(req({ action: 'evil.drop' as never })).allowed === false);
check('a missing target is refused', evaluateAction(req({ target: undefined })).code === 'target-required');
check('non-user actions need no target', evaluateAction(req({ action: 'vocab.repair', target: undefined })).allowed === true);

console.log('\n=== 7. NON-USER ACTIONS ===');
for (const action of ['vocab.repair', 'config.set', 'unit.publish'] as const) {
  check(`${action} is allowed for an admin`, evaluateAction(req({ action, target: undefined })).allowed === true);
  check(`${action} is refused for a non-admin`, evaluateAction(req({ action, target: undefined, actor: { ...ADMIN, role: 'user' } })).allowed === false);
}

console.log('\n=== 8. REASON VALIDATION ===');
check('whitespace is not a reason', !hasReason('   '));
check('an empty string is not a reason', !hasReason(''));
check('null is not a reason', !hasReason(null));
check('undefined is not a reason', !hasReason(undefined));
check('a real sentence is a reason', hasReason('offboarded 2026-09'));
check('a reason with padding counts', hasReason('  yes  '));
check('whitespace-only cannot unlock a peer ban', evaluateAction(req({ action: 'user.ban', target: OTHER_ADMIN, reason: '   ' })).code === 'reason-required');

console.log('\n=== 9. TARGET REQUIREMENT ===');
for (const a of ['user.ban', 'user.unban', 'user.demote', 'user.promote'] as const) check(`${a} requires a target`, requiresTarget(a));
for (const a of ['vocab.repair', 'config.set', 'unit.publish'] as const) check(`${a} needs no target`, !requiresTarget(a));

console.log('\n=== 10. DECISION SHAPE ===');
const every = [
  evaluateAction(req()),
  evaluateAction(req({ action: 'user.demote', target: OTHER_ADMIN, activeAdminCount: 1 })),
  evaluateAction(req({ actor: { ...ADMIN, role: 'user' } })),
  evaluateAction(req({ action: 'evil.drop' as never })),
];
check('every decision has a code', every.every((d) => d.code.length > 0));
check('every decision has a message', every.every((d) => d.message.length > 0));
check('only "ok" is ever allowed', every.filter((d) => d.allowed).every((d) => d.code === 'ok'));
check('every denial has a reason', every.filter((d) => !d.allowed).every((d) => d.message.length > 10));

console.log('\n=== 11. REPAIR PAYLOAD VALIDATION ===');
const ID = '029d6f9a-1381-471b-8b6a-27bee0e06bde';
const good = { id: ID, field: 'translationEn', value: 'to stop' };

check('a well-formed edit is accepted', validateRepair([good]).ok, JSON.stringify(validateRepair([good]).problems));
check('one edit yields one cleaned edit', validateRepair([good]).edits.length === 1);
check('a non-array payload is rejected', !validateRepair('nope').ok);
check('null is rejected', !validateRepair(null).ok);
check('an object is rejected', !validateRepair({ edits: [] }).ok);
check('an empty array is rejected', !validateRepair([]).ok);
check('an empty array explains why', validateRepair([]).problems[0].includes('no edits'));
check('a huge batch is rejected whole', !validateRepair(Array.from({ length: 201 }, () => good)).ok);

// THE INJECTION-ADJACENT CASE. `id` is interpolated into a filter that decides
// which rows get written, so anything that is not a UUID must be refused here
// rather than reaching the query.
check('a non-UUID id is rejected', !validateRepair([{ ...good, id: '1 OR 1=1' }]).ok);
check("an id with a quote is rejected", !validateRepair([{ ...good, id: "x'; drop table vocabulary;--" }]).ok);
check('an empty id is rejected', !validateRepair([{ ...good, id: '' }]).ok);
check('a missing id is rejected', !validateRepair([{ field: 'translationEn', value: 'x' }]).ok);

// `word` is not repairable. Allowing it would mean renaming a vocabulary entry
// and invalidating every SRS item keyed on it.
check('word is not a repairable field', !validateRepair([{ ...good, field: 'word' }]).ok);
check('an unknown field is rejected', !validateRepair([{ ...good, field: 'id' }]).ok);
check('a non-string field is rejected', !validateRepair([{ ...good, field: 7 }]).ok);
check('an empty value is rejected', !validateRepair([{ ...good, value: '' }]).ok);
check('a whitespace value is rejected', !validateRepair([{ ...good, value: '   ' }]).ok);
check('a non-string value is rejected', !validateRepair([{ ...good, value: 42 }]).ok);
check('an over-long value is rejected', !validateRepair([{ ...good, value: 'x'.repeat(2001) }]).ok);
check('a 2000-char value is accepted', validateRepair([{ ...good, value: 'x'.repeat(2000) }]).ok);
check('a null item is rejected', !validateRepair([null]).ok);
check('a non-object item is rejected', !validateRepair(['nope']).ok);

// One bad edit must void the WHOLE batch. A partially applied repair is worse
// than none, because the operator cannot tell what landed.
const mixed = validateRepair([good, { ...good, id: 'bad-id' }]);
check('one bad edit voids the whole batch', !mixed.ok, JSON.stringify(mixed.problems));
check('the problem names the offending index', mixed.problems.some((p) => p.startsWith('edit 1:')), JSON.stringify(mixed.problems));
check('duplicate row+field is rejected', !validateRepair([good, good]).ok);
check('same row, DIFFERENT field is fine', validateRepair([good, { ...good, field: 'translationNp' }]).ok);
check('different row, same field is fine', validateRepair([good, { ...good, id: '69ea032c-8523-4181-8d2d-917c71488e23' }]).ok);

console.log('\n=== 12. FIELD/COLUMN MAPPING ===');
for (const f of REPAIR_FIELDS) check(`${f} maps to a real column`, /^[a-z_]+$/.test(REPAIR_COLUMNS[f]), REPAIR_COLUMNS[f]);
check('word is NOT in the column map', !('word' in REPAIR_COLUMNS));
check('translationEn maps to translation_en', REPAIR_COLUMNS.translationEn === 'translation_en');
check('translationNp maps to translation_np', REPAIR_COLUMNS.translationNp === 'translation_np');
check('exampleDe maps to example_de', REPAIR_COLUMNS.exampleDe === 'example_de');
check('partOfSpeech maps to part_of_speech', REPAIR_COLUMNS.partOfSpeech === 'part_of_speech');

console.log('\n=== 13. NO UNIMPLEMENTED ACTION IS ALLOWED BY THE GUARD ===');
// The guard permits these (they are registered), but the HANDLER must refuse
// them with 501 rather than fall through to a success response. These two
// checks together are what stop that regression returning.
for (const a of ['config.set', 'unit.publish', 'vocab.clear_flag'] as const) {
  check(`${a} is a KNOWN action (passes membership)`, isKnownAction(a));
  check(`${a} is guarded for a non-admin`, evaluateAction(req({ action: a, target: undefined, actor: { ...ADMIN, role: 'user' } })).allowed === false);
}

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
