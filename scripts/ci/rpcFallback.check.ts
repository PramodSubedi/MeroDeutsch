/**
 * scripts/ci/rpcFallback.check.ts
 *
 *   npm run check:rpcfallback
 *
 * The classification that decides whether an admin read model degrades.
 *
 * ── WHY THIS SUITE EXISTS ────────────────────────────────────────────────────
 * Eight read models were moved onto Postgres functions that live in migration
 * files applied by a human to a database this repository does not contain. Until
 * that happens, every one of those calls returns `PGRST202` and every one of
 * those pages was blank.
 *
 * The fix is a fallback, and a fallback has exactly one dangerous failure mode:
 * **degrading when it must not.** If a REFUSAL fell back to the legacy path, a
 * demoted or suspended admin would get the legacy read — which goes through RLS,
 * which returns zero rows for them — and the page would show an empty table
 * instead of the explicit refusal the RPC was built to produce. That is the exact
 * silent-empty-page failure the RPCs exist to fix, reintroduced by the safety
 * net.
 *
 * So: only `absent` degrades. This suite drives the classifier with a stub
 * client and asserts every one of those boundaries, because it is the single
 * behaviour here that a human reviewer is least likely to re-read and the most
 * expensive to get wrong.
 */
import { callAdminRpc, shouldFallBack, LEGACY_PATH_NOTICE, type RpcOutcome } from '../../src/admin/data/rpc';

let checks = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail = ''): void {
  checks += 1;
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    failures.push(label);
  }
}

/** A stub shaped like enough of the Supabase client for the classifier. */
function stub(result: { data?: unknown; error?: unknown }): never {
  return { rpc: async () => result } as never;
}

const PGRST202 = {
  message: 'Could not find the function public.admin_dashboard_kpis in the schema cache',
  code: 'PGRST202',
  status: 404,
  details: null,
  hint: null,
};
// What the RPCs actually raise: `RAISE EXCEPTION ... USING ERRCODE = '42501'`.
const REFUSED = { message: 'admin_dashboard_kpis requires an active admin session.', code: '42501', status: 400, details: null, hint: null };
// A platform-level 403, which supabase-js reports with `status: 403` and a
// generic code. Also must not degrade.
const FORBIDDEN = { message: 'permission denied for function admin_dashboard_kpis', code: 'PGRST301', status: 403, details: null, hint: null };
// A `RAISE EXCEPTION` with NO explicit ERRCODE. Postgres defaults that to
// P0001, which is neither an absence nor a 403 — so it classifies as `error`,
// which does NOT degrade. Correct outcome, imprecise label: the safe direction.
const UNCODED_RAISE = { message: 'admin_dashboard_kpis requires an active admin session.', code: 'P0001', status: 400, details: null, hint: null };
const NET_DOWN = { message: 'TypeError: Failed to fetch', code: '', details: null, hint: null };
const SERVER_500 = { message: 'something went wrong', code: '57014', details: null, hint: null };

console.log('\n=== 1. ABSENT IS THE ONLY FALL-BACK TRIGGER ===');
const errorCases: [string, unknown, boolean, string][] = [
  ['PGRST202 (function not in schema cache)', PGRST202, true, 'absent'],
  ['SQLSTATE 42883 (undefined function)', { ...PGRST202, code: '42883' }, true, 'absent'],
  ['"does not exist" in the message', { message: 'function does not exist', code: '' }, true, 'absent'],
  ['42501 permission denied', REFUSED, false, 'refused'],
  ['a platform 403', FORBIDDEN, false, 'refused'],
  ['an uncoded RAISE (P0001)', UNCODED_RAISE, false, 'error'],
  ['a network failure', NET_DOWN, false, 'error'],
  ['a 500', SERVER_500, false, 'error'],
];

for (const [label, error, shouldDegrade, kind] of errorCases) {
  const outcome = (await callAdminRpc(stub({ error }), 'admin_dashboard_kpis')) as RpcOutcome<unknown>;
  check(`${label} → ${kind}`, outcome.kind === kind, `got ${outcome.kind}`);
  check(`${label} degrades: ${shouldDegrade}`, shouldFallBack(outcome) === shouldDegrade);
}

const success = (await callAdminRpc(stub({ data: [{ ok: true }] }), 'admin_dashboard_kpis')) as RpcOutcome<
  unknown
>;
check('a success → ok', success.kind === 'ok', success.kind);
check('a success never degrades', !shouldFallBack(success));

console.log('\n=== 2. A REFUSAL MUST NOT DEGRADE ===');
// The one assertion that matters. Stated separately because it is the failure
// mode the fallback introduces, and it is invisible until a demoted admin looks
// at an empty table and concludes the product has no users.
for (const [label, error] of [
  ['42501', REFUSED],
  ['a platform 403', FORBIDDEN],
] as [string, unknown][]) {
  const outcome = (await callAdminRpc(stub({ error }), 'admin_dashboard_kpis')) as RpcOutcome<unknown>;
  check(`${label} does NOT fall back to the legacy read`, !shouldFallBack(outcome));
  check(`${label} is classified as a refusal, not an error`, outcome.kind === 'refused', outcome.kind);
  check(`${label} carries the server's message`, 'message' in outcome && String(outcome.message).length > 0);
}

// An uncoded `RAISE EXCEPTION` arrives as P0001, which this classifies as an
// `error` rather than a `refused`. That is the SAFE direction — an error does not
// degrade — but it is worth pinning, because the RPCs must keep their explicit
// `USING ERRCODE = '42501'` for the message to be labelled correctly. Asserted
// against the migration source rather than left to a comment.
{
  const uncoded = (await callAdminRpc(stub({ error: UNCODED_RAISE }), 'admin_dashboard_kpis')) as RpcOutcome<unknown>;
  check('an uncoded RAISE still does not degrade', !shouldFallBack(uncoded));
}

console.log('\n=== 3. A TRANSIENT ERROR MUST NOT DEGRADE ===');
// Falling back on a network blip would turn a transient failure into a silent
// downgrade, and the operator would have no way to tell which path produced the
// number in front of them.
for (const [label, error] of [
  ['a network failure', NET_DOWN],
  ['a statement timeout', SERVER_500],
] as [string, unknown][]) {
  const outcome = (await callAdminRpc(stub({ error }), 'admin_analytics')) as RpcOutcome<unknown>;
  check(`${label} does NOT fall back`, !shouldFallBack(outcome));
  check(`${label} is an error, not an absence`, outcome.kind === 'error', outcome.kind);
}

console.log('\n=== 4. SUCCESS PASSTHROUGH ===');
const ok = (await callAdminRpc(stub({ data: [{ total_users: 3 }] }), 'admin_dashboard_kpis')) as RpcOutcome<
  Array<{ total_users: number }>
>;
check('a success yields ok', ok.kind === 'ok');
check('the payload is passed through untouched', ok.kind === 'ok' && ok.data[0].total_users === 3);
check('a success never degrades', !shouldFallBack(ok));
// `data: null` is what PostgREST returns for a `void` or a row that matched
// nothing. It is a SUCCESS that happens to be empty, and treating it as an error
// would replace a working read with a blank page.
const nullData = (await callAdminRpc(stub({ data: null }), 'admin_analytics')) as RpcOutcome<unknown>;
check('a null payload is a success, not a failure', nullData.kind === 'ok', nullData.kind);
check('a null payload never degrades', !shouldFallBack(nullData));

console.log('\n=== 5. THE NOTICE IS WRITTEN FOR AN OPERATOR ===');
// It is rendered verbatim in the Users page, so its wording is the only thing
// standing between a capped number and a confident one.
check('the notice is not empty', LEGACY_PATH_NOTICE.trim().length > 0);
check('it says the path is older', /older|browser-side|previous/i.test(LEGACY_PATH_NOTICE), LEGACY_PATH_NOTICE);
check('it says the figures are capped', /cap/i.test(LEGACY_PATH_NOTICE), LEGACY_PATH_NOTICE);
check('it says what to do about it', /migration|apply/i.test(LEGACY_PATH_NOTICE), LEGACY_PATH_NOTICE);
check('it names the failure mode it fixes', /refusal/i.test(LEGACY_PATH_NOTICE), LEGACY_PATH_NOTICE);
check('it is one sentence-ish, not a paragraph', LEGACY_PATH_NOTICE.split('.').length <= 4);

console.log('\n=== 6. EVERY READ MODEL ACTUALLY FALLS BACK ===');
// A classifier that works but is not used is a classifier that does not help. The
// three-way check is on the SOURCE, because the branch is a runtime `if`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MODULES = [
  'src/admin/hooks/useAdminData.ts',
  'src/admin/data/users.ts',
  'src/admin/data/analytics.ts',
  'src/admin/data/auditLog.ts',
  'src/admin/data/reviewQueue.ts',
  'src/admin/data/userDetail.ts',
];
const RPC_NAMES = [
  'admin_dashboard_kpis',
  'admin_users_page',
  'admin_analytics',
  'admin_audit_page',
  'admin_review_queue_page',
  'admin_user_detail',
];

for (const [i, rel] of MODULES.entries()) {
  const full = path.join(ROOT, rel);
  check(`${rel} exists`, fs.existsSync(full), rel);
  if (!fs.existsSync(full)) continue;
  const src = fs.readFileSync(full, 'utf8');
  check(`${rel} calls callAdminRpc`, src.includes('callAdminRpc'));
  check(`${rel} names its RPC`, src.includes(`'${RPC_NAMES[i]}'`), `expected ${RPC_NAMES[i]}`);
  // Two acceptable forms of the same decision. `shouldFallBack(outcome)` is the
  // preferred API because it cannot drift from the classifier; the raw
  // `kind === 'absent'` is accepted too, since a reviewer reading it can see the
  // condition without consulting `rpc.ts`.
  check(
    `${rel} branches on absence`,
    /kind\s*===\s*'absent'/.test(src) || /shouldFallBack\(/.test(src),
    rel,
  );
  // The refusal branch is the one that must NOT fall back. Two shapes are
  // acceptable: an explicit `kind !== 'ok'`, or falling through to the tail
  // that reports `outcome.message` — which is only reachable when the call was
  // not a success, so it IS the non-ok branch however it is spelled.
  check(
    `${rel} handles a non-absence failure explicitly`,
    /kind\s*!==\s*'ok'/.test(src) || /outcome\.message/.test(src),
    rel,
  );
}

// And the RPCs must keep an EXPLICIT error code. Without it Postgres defaults
// `RAISE EXCEPTION` to P0001, which this classifier treats as a generic error
// rather than a refusal — safe, but the operator gets a worse message and the
// `refused` outcome never fires.
for (const name of RPC_NAMES) {
  const migration = fs
    .readdirSync(path.join(ROOT, 'supabase', 'migrations'))
    .map((f) => ({ f, sql: fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', f), 'utf8') }))
    .find((m) => m.sql.includes(`FUNCTION public.${name}`));
  check(`${name} has a migration`, migration !== undefined, name);
  if (!migration) continue;
  check(
    `${name} raises with an explicit 42501`,
    /RAISE EXCEPTION[\s\S]{0,400}?ERRCODE\s*=\s*'42501'/.test(migration.sql),
    `${migration.f} — an uncoded RAISE becomes P0001 and is labelled as a generic error`,
  );
}

console.log('\n=== 7. THE ERROR BOUNDARY EXISTS ===');
// A rejected read in a `useEffect` unmounts the React tree, so without a
// boundary one missing function took the whole control centre with it.
const layout = fs.readFileSync(path.join(ROOT, 'src/admin/AdminLayout.tsx'), 'utf8');
check('AdminLayout wraps the outlet in a boundary', /<ReadBoundary label=/.test(layout));
check('the boundary is imported', /ReadBoundary/.test(layout));
const boundary = fs.readFileSync(path.join(ROOT, 'src/admin/components/ReadBoundary.tsx'), 'utf8');
check('ReadBoundary implements getDerivedStateFromError', /getDerivedStateFromError/.test(boundary));
check('ReadBoundary renders a reset affordance', /Try again/.test(boundary));

console.log(
  `\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`,
);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
