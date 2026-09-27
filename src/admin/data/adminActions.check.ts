/**
 * src/admin/data/adminActions.check.ts
 *
 *   npx tsx src/admin/data/adminActions.check.ts
 *
 * The property: the UI NEVER claims an action succeeded unless it did, and never
 * hides that a partial batch needs attention.
 *
 * A lie here is not cosmetic. An operator who reads "applied" for a partial
 * repair will assume all 45 rows are fixed, and stop looking.
 */
import { interpretAdminResponse, unreadableResponse } from './adminActions';

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

console.log('\n=== 1. 200 IS SUCCESS ===');
const ok = interpretAdminResponse(200, { ok: true, action: 'user.ban' });
check('200 is ok', ok.ok === true);
check('200 outcome is applied', ok.outcome === 'applied');
check('200 has a message', ok.message.length > 0);

console.log('\n=== 2. 207 IS *NOT* SUCCESS ===');
// The single most important assertion in this file.
const partial = interpretAdminResponse(207, { ok: false, applied: 40, failed: [{ id: 'x', field: 'translationEn', reason: 'row not found' }] });
check('207 is NOT ok', partial.ok === false, String(partial.ok));
check('207 outcome is partial', partial.outcome === 'partial', partial.outcome);
check('207 reports the applied count', partial.applied === 40, String(partial.applied));
check('207 lists the failures', partial.failed?.length === 1);
check('207 message names both numbers', partial.message.includes('40') && partial.message.includes('1'), partial.message);
check('207 message warns before retrying', /retry/i.test(partial.message), partial.message);
// A body that CLAIMS ok:true on a 207 must still be reported as not-ok.
check('a 207 claiming ok:true is still not ok', interpretAdminResponse(207, { ok: true, applied: 1, failed: [] }).ok === false);

console.log('\n=== 3. 403 IS A GUARD REFUSAL ===');
const denied = interpretAdminResponse(403, { ok: false, code: 'last-admin', message: 'You cannot remove the only active admin.' });
check('403 is not ok', denied.ok === false);
check('403 outcome is refused', denied.outcome === 'refused');
check('403 carries the guard code', denied.code === 'last-admin', denied.code);
check("403 shows the server's message", denied.message.includes('only active admin'));
check('403 says nothing changed', /nothing/i.test(denied.message));
check('recoverable refusals are flagged', interpretAdminResponse(403, { code: 'reason-required', recoverable: true }).recoverable === true);
check('non-recoverable by default', interpretAdminResponse(403, { code: 'self-action' }).recoverable !== true);

console.log('\n=== 4. 400 IS A REJECTED REQUEST ===');
const rejected = interpretAdminResponse(400, { ok: false, code: 'invalid-repair', message: 'The repair payload was rejected; no rows were changed.' });
check('400 is not ok', rejected.ok === false);
check('400 outcome is rejected', rejected.outcome === 'rejected');
check('400 carries the code', rejected.code === 'invalid-repair');
check('400 says no rows changed', /no rows were changed/i.test(rejected.message));
check('repair-applied-none is not ok', interpretAdminResponse(400, { code: 'repair-applied-none', failed: [] }).ok === false);

console.log('\n=== 5. 501 IS "NOT BUILT", NOT "REFUSED" ===');
// Distinct from a guard refusal: nothing was wrong with the request, the feature
// simply does not exist yet. Conflating the two would train admins to retry.
const notImpl = interpretAdminResponse(501, { ok: false, code: 'not-implemented', message: 'unit.publish is not implemented yet. No change was made.' });
check('501 is not ok', notImpl.ok === false);
check('501 outcome is not-implemented', notImpl.outcome === 'not-implemented', notImpl.outcome);
check('501 says nothing changed', /no change was made/i.test(notImpl.message));

console.log('\n=== 6. 401 IS A SESSION PROBLEM ===');
const unauth = interpretAdminResponse(401, { ok: false, code: 'unauthenticated' });
check('401 is not ok', unauth.ok === false);
check('401 tells the operator to sign in', /sign in/i.test(unauth.message), unauth.message);
check('401 defaults the code', unauth.code === 'unauthenticated');

console.log('\n=== 7. 500 FAILED CLOSED ===');
const failed = interpretAdminResponse(500, { ok: false, code: 'write-failed', message: 'The change could not be applied.' });
check('500 is not ok', failed.ok === false);
check('500 outcome is failed', failed.outcome === 'failed');
check('500 says nothing changed', /nothing was changed/i.test(failed.message));
check('an unlisted status still fails safe', interpretAdminResponse(418, {}).ok === false);
check('an unlisted status is "failed"', interpretAdminResponse(418, {}).outcome === 'failed');

console.log('\n=== 8. NO RESPONSE IS EVER "SUCCESS" ===');
// The invariant, stated once: only 200 is ok.
for (const s of [0, 199, 201, 204, 206, 208, 300, 302, 400, 401, 403, 404, 409, 418, 422, 500, 502, 503]) {
  check(`status ${s} is never ok`, interpretAdminResponse(s, { ok: true }).ok === false, String(s));
}
for (const s of [201, 204, 206, 302, 409, 422]) {
  check(`an ok-ish status ${s} is still "failed"`, interpretAdminResponse(s, { ok: true }).outcome === 'failed', String(s));
}

console.log('\n=== 9. MALFORMED BODIES NEVER THROW OR PASS ===');
// The function's output is untrusted input to this layer. A body of null, a
// string, or `{}` must still produce a usable, non-ok result.
for (const body of [null, undefined, 'nope', 42, [], {}, { message: 123 }, { code: [] }, { applied: 'many' }]) {
  const r = interpretAdminResponse(500, body);
  check(`body ${JSON.stringify(body)} is not ok`, r.ok === false);
  check(`body ${JSON.stringify(body)} has a message`, r.message.length > 0);
}
check('a non-string code is dropped', interpretAdminResponse(403, { code: 42 }).code === undefined);
check('a non-string message is replaced', interpretAdminResponse(403, { message: {} }).message.length > 0);
check('a non-numeric applied falls back to 0', interpretAdminResponse(207, { applied: 'many' }).applied === 0);
check('a non-array failed falls back to []', interpretAdminResponse(207, { failed: 'x' }).failed?.length === 0);

console.log('\n=== 10. EVERY OUTCOME HAS A DISTINCT SHAPE ===');
const outcomes = [
  interpretAdminResponse(200, {}),
  interpretAdminResponse(207, { applied: 1, failed: [] }),
  interpretAdminResponse(403, {}),
  interpretAdminResponse(400, {}),
  interpretAdminResponse(501, {}),
  interpretAdminResponse(401, {}),
  interpretAdminResponse(500, {}),
];
const KNOWN = ['applied', 'partial', 'refused', 'rejected', 'not-implemented', 'failed', 'unreachable'];
check('only 200 is applied', outcomes.filter((o) => o.outcome === 'applied').length === 1);
check('every outcome is a known value', outcomes.every((o) => KNOWN.includes(o.outcome)));
check('every outcome has a message', outcomes.every((o) => o.message.length > 0));
check('ok implies "applied"', outcomes.every((o) => !o.ok || o.outcome === 'applied'));
check('"applied" implies ok', outcomes.every((o) => o.outcome !== 'applied' || o.ok));

console.log('\n=== 8. AN UNREADABLE RESPONSE IS NOT A FAILED ACTION ===');
// THE REGRESSION. A blank Access-Control-Allow-Origin made the browser discard
// every reply, so the client got a status with no readable body. That used to be
// reported as "The action could not be completed" — pointing an operator at the
// database and the write path, neither of which was involved. The outage was
// diagnosed from the wrong layer and took hours to find.
const blocked = unreadableResponse(403);
check('an unreadable response is NOT ok', blocked.ok === false);
check('its outcome is unreadable, not failed', blocked.outcome === 'unreadable', blocked.outcome);
check('it is distinguishable from "failed"', blocked.outcome !== interpretAdminResponse(500, null).outcome);
check('it carries a code', blocked.code === 'response-unreadable', blocked.code);
check('it names CORS as the cause', /cors|cross-origin/i.test(blocked.message), blocked.message);
check('it says the outcome is UNKNOWN', /unknown/i.test(blocked.message), blocked.message);
check('it does NOT claim success', !/applied|succeeded|done\b/i.test(blocked.message));
check('it does NOT claim the action failed', !/could not be completed/i.test(blocked.message), blocked.message);
check('it says the status it saw', blocked.message.includes('403'), blocked.message);
check('it points at the audit log', /audit/i.test(blocked.message), blocked.message);
check('the status is reflected for any code', unreadableResponse(500).message.includes('500'));
check('a 200 that was unreadable is still not ok', unreadableResponse(200).ok === false);

console.log('\n=== 9. ONLY A REAL SUCCESS MAY CLAIM ONE ===');
// Each outcome is held to ITS OWN rule. A blanket "all failures say nothing
// changed" would be wrong: a 207 partial DID change things, and telling an
// operator otherwise is the same class of lie as claiming it all applied.
const applied = interpretAdminResponse(200, { ok: true, action: 'user.ban' });
const partial2 = interpretAdminResponse(207, { applied: 40, failed: [{ id: 'x' }] });
const refused = interpretAdminResponse(403, { code: 'last-admin', message: 'You cannot remove the only active admin.' });
const session = interpretAdminResponse(401, {});
const blocked2 = unreadableResponse(403);

check('200 is the only ok outcome here', [applied, partial2, refused, session, blocked2].filter((r) => r.ok).length === 1);
check('200 claims it applied', /applied/i.test(applied.message), applied.message);
check('a partial does NOT claim nothing changed', !/nothing changed/i.test(partial2.message), partial2.message);
check('a partial still refuses ok', partial2.ok === false);
check('a guard refusal says nothing changed', /nothing was changed/i.test(refused.message), refused.message);
check('a 401 says nothing changed', /nothing was changed/i.test(session.message), session.message);
check('an unreadable says the outcome is UNKNOWN', /unknown/i.test(blocked2.message), blocked2.message);

// Nothing may imply success unless it is `applied`. The one word that matters.
const all = [applied, partial2, refused, session, blocked2, interpretAdminResponse(500, { code: 'x' })];
check('every message is non-empty', all.every((r) => r.message.trim().length > 0));
check(
  'no non-applied outcome uses the word "applied" as a claim',
  all.filter((r) => r.outcome !== 'applied').every((r) => !/\bapplied\b/i.test(r.message) || r.outcome === 'partial'),
  all.filter((r) => r.outcome !== 'applied').map((r) => r.message).join(' | '),
);
check('ok implies applied', all.every((r) => !r.ok || r.outcome === 'applied'));

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
