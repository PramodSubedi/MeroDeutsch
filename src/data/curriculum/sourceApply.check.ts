/**
 * src/data/curriculum/sourceApply.check.ts
 *
 *   npx tsx src/data/curriculum/sourceApply.check.ts
 *
 * The property under test: the learner app NEVER reloads in a loop, and NEVER
 * reloads at all while the flag says bundle.
 *
 * A loop here would be a boot-time denial of service for every learner, and it
 * would look like "the app is broken" rather than "a guard fired".
 */
import { RELOAD_MARKER, decideApply, decisionKey, readReloadMarker, writeReloadMarker } from './sourceApply';
import type { SourceDecision } from './source';

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

const D = (source: 'bundle' | 'db', reason: SourceDecision['reason']): SourceDecision => ({ source, reason });

console.log('\n=== 1. THE DEFAULT NEVER RELOADS ===');
// The flag is "bundle" today. A reload here would be pure harm.
for (const reason of ['flag-is-bundle', 'flag-unreadable', 'no-db-content', 'db-validate-failed', 'db-derive-failed'] as const) {
  const a = decideApply(D('bundle', reason), 'bundle', null);
  check(`bundle/${reason} does not reload`, a.kind === 'none', a.kind);
}

console.log('\n=== 2. NO MISMATCH, NO RELOAD ===');
check('db when already serving db: no reload', decideApply(D('db', 'db-ok'), 'db', null).kind === 'none');
check('bundle when serving db: no reload', decideApply(D('bundle', 'flag-is-bundle'), 'db', null).kind === 'none');

console.log('\n=== 3. THE REAL MISMATCH RELOADS ONCE ===');
const first = decideApply(D('db', 'db-ok'), 'bundle', null);
check('bundle -> db reloads', first.kind === 'reload', first.kind);
check('the reason is stated', first.kind === 'reload' && /reloading/i.test(first.reason));

console.log('\n=== 4. IT NEVER RELOADS TWICE FOR THE SAME DECISION ===');
// This is the loop guard. Without it, the page reloads, resolves, and reloads
// again forever.
const key = decisionKey(D('db', 'db-ok'));
check('the key is stable', decisionKey(D('db', 'db-ok')) === key);
const second = decideApply(D('db', 'db-ok'), 'bundle', key);
check('a second load does NOT reload again', second.kind === 'none', second.kind);

// A genuinely NEW decision must still be able to trigger its reload, or an
// admin fixing a bad publish would be stuck.
const other = decideApply(D('db', 'db-ok-with-different-content'), 'bundle', key);
check('a DIFFERENT decision can still reload', other.kind === 'reload', other.kind);

console.log('\n=== 5. THE KEY DISTINGUISHES SOURCE AND REASON ===');
check('bundle and db differ', decisionKey(D('bundle', 'flag-is-bundle')) !== decisionKey(D('db', 'db-ok')));
check('two db reasons differ', decisionKey(D('db', 'db-ok')) !== decisionKey(D('db', 'db-derive-failed')));
check('the same decision is identical', decisionKey(D('db', 'db-ok')) === decisionKey(D('db', 'db-ok')));

console.log('\n=== 6. STORAGE ACCESS NEVER THROWS ===');
// Private mode and blocked third-party storage both throw on access. Boot must
// survive that.
let threw = false;
try {
  readReloadMarker();
  writeReloadMarker('x');
} catch {
  threw = true;
}
check('reading/writing the marker never throws', !threw);
// Under Node there is no sessionStorage at all, which is the same shape of
// failure: the optional chain must absorb it.
check('a missing sessionStorage reads as null', readReloadMarker() === null);
check('the marker key is namespaced', RELOAD_MARKER.startsWith('mero-'));

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
