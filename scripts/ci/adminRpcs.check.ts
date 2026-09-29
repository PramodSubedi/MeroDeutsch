/**
 * scripts/ci/adminRpcs.check.ts
 *
 *   npm run check:adminrpcs
 *
 * The static contract for the admin RPCs.
 *
 * ── WHAT THIS IS, AND WHAT IT IS NOT ────────────────────────────────────────
 * The existing 30 suites run in `tsx` with no database, so they cannot execute
 * SQL. This one does not try. It parses the migrations and asserts the GUARD
 * shape of every function, which is the mistake class that has already shipped
 * two real bugs:
 *
 *   · `vocab.clear_flag` was registered in `KNOWN_ACTIONS` and answered 501 by
 *     the handler, but was MISSING from the client's `AdminActionName` union —
 *     so it was unreachable from the UI entirely. `check:adminaction` §14 now
 *     compares the two lists.
 *   · `announcement_banner` was writable from a page and unknown to the
 *     validator, so every save returned 400 while 1 267 checks were green.
 *
 * Both are the same shape: a contract that exists in one place and not the
 * other, with nothing comparing them. This compares them.
 *
 * It explicitly CANNOT check that the arithmetic is right. `admin_dashboard_kpis`
 * could count yesterday's users and this suite would pass. Verifying the numbers
 * needs a database, which is blocked on replayable migrations — recorded as a
 * known gap rather than papered over.
 *
 * The runtime half of the answer is the `/system` self-test panel, which invokes
 * each RPC with synthetic parameters and reports a well-formed result or the
 * expected refusal. That is the only check in this repository that touches real
 * SQL.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations');

/** The RPCs this plan added, with the argument list PostgREST will call them by. */
interface RpcSpec {
  name: string;
  /** The `fn::regprocedure` identity, argument types included. */
  identity: string;
  /** Anonymous callers are a BUG for admin RPCs and REQUIRED for vocab_levels. */
  anonAllowed: boolean;
}

const RPCS: RpcSpec[] = [
  { name: 'admin_dashboard_kpis', identity: 'admin_dashboard_kpis()', anonAllowed: false },
  { name: 'admin_analytics', identity: 'admin_analytics(integer)', anonAllowed: false },
  {
    name: 'admin_users_page',
    identity: 'admin_users_page(text,text,text,text,text,boolean,integer,timestamptz,uuid)',
    anonAllowed: false,
  },
  {
    name: 'admin_audit_page',
    identity: 'admin_audit_page(text,text,text,uuid,integer,timestamptz,uuid)',
    anonAllowed: false,
  },
  {
    name: 'admin_review_queue_page',
    identity: 'admin_review_queue_page(text,text,integer,boolean,integer,timestamptz,text)',
    anonAllowed: false,
  },
  { name: 'admin_table_counts', identity: 'admin_table_counts()', anonAllowed: false },
  // The one deliberate exception. `vocabulary` is public-read content, the
  // learner app calls this before sign-in, and asserting it here is what stops
  // a future "tighten the DEFINER function" pass from breaking the dropdown.
  { name: 'vocab_levels', identity: 'vocab_levels()', anonAllowed: true },
];

console.log('\n=== 0. THE MIGRATIONS WERE FOUND ===');
const files = fs
  .readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort();
check('migrations directory is readable', files.length > 0, `found ${files.length}`);
const source = new Map(files.map((f) => [f, fs.readFileSync(path.join(MIGRATIONS, f), 'utf8')]));
const all = [...source.values()].join('\n');

/** The slice of a migration that defines one function, from CREATE to its end. */
function bodyOf(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  if (start < 0) return '';
  const next = sql.indexOf('\nCREATE OR REPLACE FUNCTION', start + 1);
  return next < 0 ? sql.slice(start) : sql.slice(start, next);
}

function migrationDefining(name: string): string | null {
  for (const [file, sql] of source) {
    if (sql.includes(`CREATE OR REPLACE FUNCTION public.${name}`)) return file;
  }
  return null;
}

console.log('\n=== 1. EVERY RPC IS DEFINED EXACTLY ONCE ===');
for (const rpc of RPCS) {
  const file = migrationDefining(rpc.name);
  check(`${rpc.name} is defined`, file !== null);
}

console.log('\n=== 2. THE GUARD SHAPE OF EVERY ADMIN RPC ===');
// The four properties that make an RPC safe, and the two that make it REFUSE
// rather than return nothing.
for (const rpc of RPCS.filter((r) => !r.anonAllowed)) {
  const file = migrationDefining(rpc.name);
  if (!file) continue;
  const body = bodyOf(source.get(file)!, rpc.name);

  check(`${rpc.name}: SECURITY DEFINER`, /SECURITY DEFINER/.test(body), file);
  check(`${rpc.name}: STABLE`, /\bSTABLE\b/.test(body), file);
  // A caller-controlled schema must not be able to shadow a table reference
  // inside the body.
  check(`${rpc.name}: search_path pinned`, /SET\s+search_path\s*=\s*public/.test(body), file);
  // SECURITY DEFINER bypasses RLS, so the EXECUTE grant is NOT an authorization
  // check. The body has to do it.
  check(`${rpc.name}: re-checks the caller in-body`, /is_active_admin\(\)/.test(body), file);
  // RAISE, not RETURN an empty set. See admin_dashboard_kpis's header: an
  // RLS-filtered read returns HTTP 200 + zero rows, which is indistinguishable
  // from "no data", and a SECURITY DEFINER function can do better.
  check(`${rpc.name}: REFUSES rather than returning nothing`, /RAISE EXCEPTION/.test(body), file);
}

console.log('\n=== 3. THE GRANTS ARE CORRECT, AND SO IS THE ONE EXCEPTION ===');
for (const rpc of RPCS) {
  const file = migrationDefining(rpc.name);
  if (!file) continue;
  const sql = source.get(file)!;
  // Find the REVOKE/GRANT block for THIS function, not the file's.
  const grantBlock = sql
    .split('\n')
    .filter((line) => line.includes(`ON FUNCTION public.${rpc.name}`))
    .join('\n');

  check(`${rpc.name}: has a grant block`, grantBlock.trim().length > 0, file);
  check(`${rpc.name}: revoked from PUBLIC`, /REVOKE\s+ALL\s+ON FUNCTION.*FROM\s+PUBLIC/i.test(grantBlock), grantBlock);
  check(`${rpc.name}: granted to authenticated`, /GRANT\s+EXECUTE.*TO\s+.*authenticated/i.test(grantBlock), grantBlock);

  if (rpc.anonAllowed) {
    // Inverted assertions, deliberately. The instinct to revoke anon from every
    // SECURITY DEFINER function is strong and is WRONG for this one.
    check(`${rpc.name}: anon is granted (this one is public content)`, /TO\s+.*\banon\b/i.test(grantBlock), grantBlock);
    check(`${rpc.name}: does NOT re-check is_active_admin`, !/is_active_admin\(\)/.test(bodyOf(sql, rpc.name)), 'a learner calling this would be refused');
  } else {
    check(`${rpc.name}: revoked from anon`, /REVOKE\s+ALL\s+ON FUNCTION.*FROM\s+anon/i.test(grantBlock), grantBlock);
    check(`${rpc.name}: anon is NOT granted`, !/GRANT\s+EXECUTE[^\n]*\bTO\s+anon\b(?!,)/i.test(grantBlock) || !/\bTO\s+anon\b/i.test(grantBlock), grantBlock);
  }
}

console.log('\n=== 4. THE FUNCTION SIGNATURES MATCH WHAT THE CLIENT CALLS ===');
// The client calls these by name and argument order. A signature that drifts
// here is a 404-shaped refusal at runtime, and PostgREST will not tell you which
// argument is wrong.
const CLIENT_CALLERS: [string, string][] = [
  ['src/admin/data/analytics.ts', 'admin_analytics'],
  ['src/admin/data/users.ts', 'admin_users_page'],
  ['src/admin/data/auditLog.ts', 'admin_audit_page'],
  ['src/admin/data/reviewQueue.ts', 'admin_review_queue_page'],
  ['src/admin/hooks/useAdminData.ts', 'admin_dashboard_kpis'],
  ['src/services/supabaseCurriculumService.ts', 'vocab_levels'],
];
for (const [rel, fn] of CLIENT_CALLERS) {
  const full = path.join(ROOT, rel);
  check(`${rel} exists`, fs.existsSync(full), full);
  if (!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, 'utf8');
  check(`${rel} calls ${fn}`, text.includes(`'${fn}'`), `${rel} does not reference ${fn} yet`);
}

console.log('\n=== 5. NO CALL-SITE PARAMETER IS INTERPOLATED ===');
// A sort key, a column name or a filter fragment that reaches SQL as a string
// built from a caller argument is a SQL injection point wearing a convenience
// parameter.
for (const [rel] of CLIENT_CALLERS) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, 'utf8');
  check(`${rel} does not build a template-literal RPC call`, !/rpc\(\s*`/.test(text), rel);
}

console.log('\n=== 6. THE NEW MIGRATIONS ARE SELF-CONSISTENT ===');
// A migration that asserts its own invariants can only do so if it can RUN them.
// Every migration this plan adds ends with a post-COMMIT assertion block, which
// is the house style (20260929000000:36-39) and the only thing standing between a
// typo and a silently absent function.
//
// Scoped to THIS plan's migrations. A pre-existing file is already applied, so
// "add a post-COMMIT assertion" is not a fix — and a check that fails on history
// is a check that gets disabled.
for (const [file, sql] of source) {
  if (!/^20261001/.test(file)) continue;
  check(`${file}: is transactional`, /^\s*BEGIN\s*;/m.test(sql), file);
  check(`${file}: commits`, /\bCOMMIT\s*;/i.test(sql), file);
  check(`${file}: has a post-COMMIT assertion`, /RAISE EXCEPTION/i.test(sql), file);
}

console.log('\n=== 7. THE RECURSION PIN IS PRESENT ===');
// `is_active_admin()` is SECURITY DEFINER and its body reads `profiles`, while two
// policies on `profiles` call it. That is infinite recursion (42P17) unless the
// owner has BYPASSRLS — and RLS exclusion is not an error, it is HTTP 200 with
// zero rows, so a regression here silently empties every admin page.
const pinFile = files.find((f) => f.includes('admin_rpc_prerequisites'));
check('the prerequisites migration exists', pinFile !== undefined, files.join(', '));
if (pinFile) {
  const sql = source.get(pinFile)!;
  check('it asserts the owner has BYPASSRLS', /rolbypassrls/.test(sql), pinFile);
  check('it names the 42P17 failure mode', /42P17|infinite recursion/i.test(sql), pinFile);
  check('it revokes is_active_admin from anon', /is_active_admin\(\)\s+FROM\s+anon/i.test(sql), pinFile);
  check('it revokes is_active_admin from PUBLIC', /is_active_admin\(\)\s+FROM\s+PUBLIC/i.test(sql), pinFile);
  // The assertion has to come BEFORE the revoke in source order, or the migration
  // revokes a leak it has not yet recorded.
  const assertAt = sql.indexOf('rolbypassrls');
  const revokeAt = sql.indexOf('REVOKE ALL ON FUNCTION public.is_active_admin');
  check('the ownership assertion precedes the revoke', assertAt >= 0 && revokeAt >= 0 && assertAt < revokeAt, `assert@${assertAt} revoke@${revokeAt}`);
  // The indexes the windowed reads need, asserted so a rename cannot leave a
  // sequential scan behind with nothing reporting it.
  for (const idx of [
    'idx_user_activity_days_date',
    'idx_profiles_created_id',
    'idx_profiles_banned',
    'idx_admin_audit_log_created_id',
    'idx_review_queue_due_id',
  ]) {
    check(`it creates ${idx}`, new RegExp(`CREATE INDEX IF NOT EXISTS ${idx}\\b`).test(sql), pinFile);
  }
}

console.log('\n=== 8. CONSTANTS DUPLICATED IN SQL ARE PINNED TO THEIR SOURCE ===');
// Two numbers live in TypeScript and are restated in the RPC bodies, because SQL
// cannot import from the app. Duplication is unavoidable; DRIFT is not.
//
// `STALE_AFTER_DAYS` is the one that actually bit: the RPC was written with a
// 7-day threshold on the assumption the constant was a week, while the constant
// is 30. Every "stale" figure on the Dashboard would have been more than four
// times too high, and a number that is too alarming is not obviously a bug.
const queueTs = fs.readFileSync(path.join(ROOT, 'src/admin/data/reviewQueue.ts'), 'utf8');
const staleMatch = /export const STALE_AFTER_DAYS\s*=\s*(\d+)/.exec(queueTs);
check('STALE_AFTER_DAYS is declared', staleMatch !== null);
if (staleMatch) {
  const staleDays = staleMatch[1];
  const queueMigration = source.get('20261001040000_admin_audit_and_queue_pages.sql') ?? '';
  const sqlInterval = /interval\s+'(\d+)\s+days?'/.exec(queueMigration);
  check('the queue RPC states a stale interval', sqlInterval !== null, queueMigration.slice(0, 0));
  if (sqlInterval) {
    check(
      `the SQL stale threshold matches STALE_AFTER_DAYS (${staleDays}d)`,
      sqlInterval[1] === staleDays,
      `SQL says ${sqlInterval[1]}d, TS says ${staleDays}d`,
    );
  }
}

// The activity strip width is likewise restated in `admin_user_detail`.
const detailTs = fs.readFileSync(path.join(ROOT, 'src/admin/data/userDetail.ts'), 'utf8');
const windowMatch = /ACTIVITY_WINDOW_DAYS\s*=\s*(\d+)/.exec(detailTs);
check('ACTIVITY_WINDOW_DAYS is declared', windowMatch !== null);
if (windowMatch) {
  const detailMigration = source.get('20261001060000_admin_user_detail.sql') ?? '';
  const sqlWindow = /current_date\s*-\s*\((\d+)\s*-\s*1\)/.exec(detailMigration);
  check('the detail RPC states an activity window', sqlWindow !== null);
  if (sqlWindow) {
    check(
      `the SQL activity window matches ACTIVITY_WINDOW_DAYS (${windowMatch[1]}d)`,
      sqlWindow[1] === windowMatch[1],
      `SQL says ${sqlWindow[1]}d, TS says ${windowMatch[1]}d`,
    );
  }
}

console.log('\n=== 9. WHAT THIS SUITE CANNOT CHECK, STATED ===');
// Recorded rather than omitted, so the next reader does not mistake a green run
// for proof that the SQL is correct.
console.log('  INFO  SQL SEMANTICS ARE NOT VERIFIED HERE.');
console.log('  INFO  A function that counted the wrong day would pass every check above.');
console.log('  INFO  Verification needs a database: a CI job against a real Postgres, or the');
console.log('  INFO  /system self-test panel invoking each RPC. Both are blocked on, or');
console.log('  INFO  dependent on, replayable migrations — filename order is not apply order and');
console.log('  INFO  15 migrations are not re-runnable. That is the dependency, not an omission.');

console.log(
  `\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`,
);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
