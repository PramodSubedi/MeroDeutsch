/**
 * scripts/ci/adminAccess.check.ts
 *
 *   npm run check:adminaccess
 *
 * The two client-side predicates that decide whether a person is allowed to act
 * as an administrator, and the unit editor's stale-write guard.
 *
 * All three were wrong, and none was reachable by a suite.
 *
 *   1. `isAdminProfile` read only `role` while its own parameter type declared
 *      `banned_at`, so a SUSPENDED admin reported `isAdmin: true`. The database
 *      says otherwise — `is_active_admin()` requires `banned_at IS NULL`. The
 *      only consumer was correct by accident, because `useAdminAuth` checked
 *      `isBanned` first. Ordering is not a guarantee.
 *
 *   2. The editor's stale-write guard compared `unit.updatedAt` (a SERVER
 *      timestamp) against a baseline set to `new Date().toISOString()` (a CLIENT
 *      timestamp). Two unrelated clocks, never expected to be equal, so every
 *      save between a write landing and its refetch was refused with a confident
 *      message about a collaboration that was not happening.
 *
 *   3. With `updated_at` null — which the column permits and the read model
 *      allows — the guard was inert, so the two-admin case it exists to catch
 *      was never caught. It reported success by doing nothing.
 *
 * The guard is a component's inline logic, so it is asserted here by reading the
 * source AND by executing the exported predicate. Both: a predicate can be
 * correct while never being called, which is the third way this class of bug
 * hides.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAdminProfile, isSuspended, type AdminProfile } from '../../src/lib/adminRole.ts';
import { isStaleRevision, OWN_WRITE_WINDOW_MS } from '../../src/admin/data/revisions.ts';

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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const profile = (over: Partial<AdminProfile> = {}): AdminProfile => ({
  id: '00000000-0000-4000-8000-000000000000',
  username: 'admin',
  full_name: 'Admin',
  avatar_url: null,
  language_preference: null,
  plan: 'free',
  role: 'admin',
  banned_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: null,
  ...over,
});

console.log('\n=== 0. THE SOURCES EXIST ===');
check('adminRole.ts is readable', fs.existsSync(path.join(ROOT, 'src/lib/adminRole.ts')));
check('UnitDocEditor.tsx is readable', fs.existsSync(path.join(ROOT, 'src/admin/components/UnitDocEditor.tsx')));

console.log('\n=== 1. isAdminProfile MIRRORS is_active_admin() ===');
// The SQL, in 20260929000000_add_profiles_role_and_banned.sql:
//     WHERE p.id = auth.uid() AND p.role = 'admin' AND p.banned_at IS NULL
check('a live admin is an admin', isAdminProfile(profile()));
check('a SUSPENDED admin is NOT an admin', !isAdminProfile(profile({ banned_at: '2026-05-01T00:00:00Z' })));
check('a plain user is not an admin', !isAdminProfile(profile({ role: 'user' })));
check('a suspended plain user is not an admin', !isAdminProfile(profile({ role: 'user', banned_at: '2026-05-01T00:00:00Z' })));
check('null is not an admin', !isAdminProfile(null));
// The parameter type declares `banned_at`. If the body ever stops reading it
// again, this fails — the type is the only thing that was lying before.
const roleSource = read('src/lib/adminRole.ts');
const fnBody = /export function isAdminProfile[\s\S]*?\n}/.exec(roleSource)?.[0] ?? '';
check('the function body actually reads banned_at', /banned_at|isSuspended/.test(fnBody), fnBody);
check('the function delegates to isSuspended rather than re-testing it', /isSuspended\(/.test(fnBody));

console.log('\n=== 2. isSuspended ===');
check('a null banned_at is not suspended', !isSuspended(profile()));
check('any banned_at value is suspended', isSuspended(profile({ banned_at: '2026-05-01T00:00:00Z' })));
check('an empty-string banned_at is NOT suspended', !isSuspended(profile({ banned_at: '' })), 'falsy, so not suspended');
check('null is not suspended', !isSuspended(null));
// The two predicates must not disagree about the same row.
const cases: AdminProfile[] = [
  profile(),
  profile({ banned_at: '2026-05-01T00:00:00Z' }),
  profile({ role: 'user' }),
  profile({ role: 'user', banned_at: '2026-05-01T00:00:00Z' }),
];
for (const p of cases) {
  const label = `${p.role}/${p.banned_at ?? 'active'}`;
  check(`"${label}": suspended implies not admin`, !isSuspended(p) || !isAdminProfile(p));
}

console.log('\n=== 3. THE STALE-REVISION GUARD ===');
const T0 = 1_000_000_000_000;
const REVISION_A = '2026-09-29T10:00:00.000Z';
const REVISION_B = '2026-09-29T10:05:00.000Z';

const fresh = isStaleRevision({ current: REVISION_A, base: REVISION_A, savedAt: null, now: T0 });
check('an unchanged row is not stale', !fresh.stale, fresh.reason ?? '');

const moved = isStaleRevision({ current: REVISION_B, base: REVISION_A, savedAt: null, now: T0 });
check('a row that moved since the read IS stale', moved.stale);
check('a stale verdict explains what to do', typeof moved.reason === 'string' && (moved.reason?.length ?? 0) > 20);
check('a stale verdict names the collision', /someone else/.test(moved.reason ?? ''));

// THE REGRESSION. A client clock is not a revision, so a save immediately after a
// write must not be refused. The old code set the baseline to
// `new Date().toISOString()` and compared it to a server timestamp, which could
// never match — so this exact save was refused with a message about someone
// else's edit.
const justSaved = isStaleRevision({ current: REVISION_B, base: REVISION_A, savedAt: T0 - 500, now: T0 });
check('a save immediately after our own write is NOT stale', !justSaved.stale, justSaved.reason ?? '');
const withinWindow = isStaleRevision({ current: REVISION_B, base: REVISION_A, savedAt: T0 - (OWN_WRITE_WINDOW_MS - 1), now: T0 });
check('a save just inside the window is NOT stale', !withinWindow.stale, withinWindow.reason ?? '');
check('the own-write window is 5 seconds', OWN_WRITE_WINDOW_MS === 5_000, String(OWN_WRITE_WINDOW_MS));
const beyondWindow = isStaleRevision({ current: REVISION_B, base: REVISION_A, savedAt: T0 - (OWN_WRITE_WINDOW_MS + 1), now: T0 });
check('beyond the window, a moved row IS stale again', beyondWindow.stale);

// A null `updated_at` is a real state: the column is nullable and the read model
// permits it. The guard must neither refuse every save nor pretend to be working.
const nullCurrent = isStaleRevision({ current: null, base: REVISION_A, savedAt: null, now: T0 });
check('a null current revision does not refuse the save', !nullCurrent.stale, nullCurrent.reason ?? '');
const nullBase = isStaleRevision({ current: REVISION_A, base: null, savedAt: null, now: T0 });
check('a null base revision does not refuse the save', !nullBase.stale, nullBase.reason ?? '');
check('two nulls are not stale', !isStaleRevision({ current: null, base: null, savedAt: null, now: T0 }).stale);

// A `savedAt` in the future must not be a permanent amnesty. `now - savedAt` is
// then negative, which is `< 5000` forever — so the grace period has to be
// bounded at BOTH ends, or a drifted or tampered clock disables the guard
// permanently.
check('a future savedAt still expires', isStaleRevision({ current: REVISION_B, base: REVISION_A, savedAt: T0 + 60_000, now: T0 }).stale === true);
check('a savedAt exactly at now still counts as ours', !isStaleRevision({ current: REVISION_B, base: REVISION_A, savedAt: T0, now: T0 }).stale);

console.log('\n=== 4. THE EDITOR ACTUALLY USES IT ===');
// A correct predicate that nothing calls is the third way this hides.
const editorSource = read('src/admin/components/UnitDocEditor.tsx');
const revisionsSource = read('src/admin/data/revisions.ts');
// Scanned with comment lines stripped, because `revisions.ts` necessarily QUOTES
// the old `new Date().toISOString()` in order to explain what it replaced — and a
// check that cannot tell an explanation from an instruction is a check that gets
// deleted rather than fixed.
const stripComments = (src: string) =>
  src
    .split('\n')
    .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
    .join('\n');
const editorCode = stripComments(editorSource);
const revisionsCode = stripComments(revisionsSource);

check('the editor imports the predicate', /import\s*\{[^}]*isStaleRevision[^}]*\}\s*from\s*'\.\.\/data\/revisions'/.test(editorSource));
check('the editor calls it', /isStaleRevision\s*\(/.test(editorCode));
check('the editor does NOT define it', !/export function isStaleRevision/.test(editorCode));
check('no live code compares against a client clock', !/new Date\(\)\.toISOString\(\)/.test(editorCode));
check('the baseline is never assigned a client clock', !/setBaseRevision\(new Date/.test(editorCode));
check('the stale reason is surfaced, not swallowed', /setParseError\(stale\.reason\)/.test(editorCode));
// And the explanation really is still there, so the next reader learns it.
check('the client-clock bug is still documented', /new Date\(\)\.toISOString\(\)/.test(revisionsSource));
// A predicate module that has grown a React import would have defeated the move.
check('the predicate module has no React dependency', !/from 'react'/.test(revisionsSource));

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
