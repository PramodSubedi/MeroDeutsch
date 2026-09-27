/**
 * src/admin/data/auditLog.check.ts
 *
 *   npx tsx src/admin/data/auditLog.check.ts
 *
 * The property under test: the log must make a REFUSED privileged action
 * visible and unmistakable. A compliance record that renders denials the same
 * way as successes is decoration.
 */
import {
  actionFacets,
  auditToCsv,
  baseAction,
  filterAuditEntries,
  outcomeOf,
  safeText,
  summariseAudit,
  targetTypeFacets,
  type AuditEntry,
  type AuditFilters,
} from './auditLog';

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

function entry(over: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: 'e1', adminId: 'a1', action: 'user.ban', targetType: 'user', targetId: 'u1',
    before: { role: 'user' }, after: { banned_at: 'now' }, userAgent: 'UA',
    createdAt: '2026-09-30T00:00:00Z', adminName: 'Admin One', ...over,
  };
}

const all: AuditFilters = { search: '', outcome: 'all', action: '', targetType: '' };

console.log('\n=== 1. OUTCOME CLASSIFICATION ===');
// These suffixes are what the Edge Function actually writes. If the writer
// changes, these must change with it.
check('a plain action is allowed', outcomeOf('user.ban') === 'allowed');
check('.denied is a denial', outcomeOf('user.demote.denied') === 'denied');
check('.rejected is a denial', outcomeOf('vocab.repair.rejected') === 'denied');
check('.failed is a failure', outcomeOf('user.ban.failed') === 'failed');
check('.unimplemented is flagged', outcomeOf('unit.publish.unimplemented') === 'unimplemented');
check('an unknown suffix is treated as allowed', outcomeOf('weird.thing') === 'allowed');
check('baseAction strips .denied', baseAction('user.demote.denied') === 'user.demote');
check('baseAction strips .rejected', baseAction('vocab.repair.rejected') === 'vocab.repair');
check('baseAction leaves a plain action alone', baseAction('user.ban') === 'user.ban');
check('baseAction strips only the LAST suffix', baseAction('a.b.denied') === 'a.b');

console.log('\n=== 2. THE SUMMARY SEPARATES DENIALS ===');
const mixed = [
  entry({ id: '1', action: 'user.ban' }),
  entry({ id: '2', action: 'user.demote.denied' }),
  entry({ id: '3', action: 'user.promote' }),
  entry({ id: '4', action: 'user.ban.failed' }),
  entry({ id: '5', action: 'vocab.repair.rejected' }),
];
const s = summariseAudit(mixed);
check('total counts everything', s.total === 5, String(s.total));
check('allowed counts only successes', s.allowed === 2, String(s.allowed));
check('denied counts refusals', s.denied === 2, String(s.denied));
check('failed counts errors', s.failed === 1, String(s.failed));
check('needsAttention is denials + failures', s.needsAttention === 3, String(s.needsAttention));
check('an empty log summarises to zero', summariseAudit([]).needsAttention === 0);
check('an empty log has no admins', summariseAudit([]).admins === 0);

console.log('\n=== 3. DISTINCT ADMINS ===');
check('two admins are counted separately', summariseAudit([entry({ adminId: 'a' }), entry({ adminId: 'b' })]).admins === 2);
check('the same admin twice is one admin', summariseAudit([entry({ adminId: 'a' }), entry({ adminId: 'a' })]).admins === 1);

console.log('\n=== 4. FILTERING BY OUTCOME ===');
check('all returns everything', filterAuditEntries(mixed, all).length === 5);
check('denied returns only refusals', filterAuditEntries(mixed, { ...all, outcome: 'denied' }).length === 2);
check('failed returns only failures', filterAuditEntries(mixed, { ...all, outcome: 'failed' }).length === 1);
check('allowed returns only successes', filterAuditEntries(mixed, { ...all, outcome: 'allowed' }).length === 2);
check('unimplemented filters correctly', filterAuditEntries([entry({ action: 'x.unimplemented' })], { ...all, outcome: 'unimplemented' }).length === 1);

console.log('\n=== 5. FILTERING BY ACTION AND TARGET ===');
check('by base action, ignoring suffix', filterAuditEntries(mixed, { ...all, action: 'user.ban' }).length === 2);
check('by a different action', filterAuditEntries(mixed, { ...all, action: 'user.promote' }).length === 1);
check('by target type', filterAuditEntries([entry({ targetType: 'vocab' }), entry({ targetType: 'user' })], { ...all, targetType: 'vocab' }).length === 1);
check('a null target type matches "none"', filterAuditEntries([entry({ targetType: null })], { ...all, targetType: 'none' }).length === 1);
check('a null target type does not match "user"', filterAuditEntries([entry({ targetType: null })], { ...all, targetType: 'user' }).length === 0);

console.log('\n=== 6. SEARCH REACHES THE FIELDS THAT MATTER ===');
// "Did anyone touch THIS user?" is the question the box exists to answer.
check('by target id', filterAuditEntries(mixed, { ...all, search: 'u1' }).length === 5);
check('by action', filterAuditEntries(mixed, { ...all, search: 'promote' }).length === 1);
check('by admin name', filterAuditEntries(mixed, { ...all, search: 'Admin One' }).length === 5);
check('by admin id', filterAuditEntries(mixed, { ...all, search: 'a1' }).length === 5);
check('by a before value', filterAuditEntries(mixed, { ...all, search: 'role' }).length === 5);
check('search is case-insensitive', filterAuditEntries(mixed, { ...all, search: 'PROMOTE' }).length === 1);
check('search ignores surrounding space', filterAuditEntries(mixed, { ...all, search: '  promote  ' }).length === 1);
check('a non-match returns nothing', filterAuditEntries(mixed, { ...all, search: 'zzzz' }).length === 0);
check('an empty search returns everything', filterAuditEntries(mixed, { ...all, search: '   ' }).length === 5);
check('filters compose', filterAuditEntries(mixed, { search: 'user', outcome: 'denied' }).length === 2);

console.log('\n=== 7. RENDERING NEVER THROWS ===');
// One odd row must not cost the operator the ability to read the log.
check('null renders empty', safeText(null) === '');
check('undefined renders empty', safeText(undefined) === '');
check('a string passes through', safeText('hi') === 'hi');
check('an object is JSON', safeText({ a: 1 }) === '{"a":1}');
check('a number is JSON', safeText(5) === '5');
const circular: Record<string, unknown> = { a: 1 };
circular.self = circular;
check('a circular object does NOT throw', safeText(circular) === '(unrenderable)');
check('a bigint does not throw', typeof safeText(1n) === 'string');

console.log('\n=== 8. FACETS ===');
check('action facets are distinct and sorted', JSON.stringify(actionFacets(mixed)) === '["user.ban","user.demote","user.promote","vocab.repair"]', JSON.stringify(actionFacets(mixed)));
check('facets collapse outcome suffixes', actionFacets([entry({ action: 'user.ban' }), entry({ action: 'user.ban.denied' })]).length === 1);
check('target facets are sorted', JSON.stringify(targetTypeFacets([entry({ targetType: 'user' }), entry({ targetType: 'vocab' })])) === '["user","vocab"]');
check('a null target type becomes "none"', targetTypeFacets([entry({ targetType: null })]).includes('none'));

console.log('\n=== 9. CSV EXPORT IS INJECTION-SAFE ===');
// Reuses the shared encoder, so a hostile `user_agent` or JSON blob cannot
// execute when the export is opened.
const hostile = auditToCsv([
  entry({ action: '=1+1', userAgent: '@cmd', before: { v: '=SUM(1+1)' } }),
]);
const lines = hostile.split('\n').slice(1);
check('no audit data line starts with a bare trigger', lines.every((l) => !/^[=+\-@\t\r]/.test(l)), hostile);
check('a hostile action is defused', hostile.includes("'=1+1"), hostile);
check('a hostile user agent is defused', hostile.includes("'@cmd"), hostile);
check('the header is present', hostile.split('\n')[0].startsWith('created_at,admin'), hostile.split('\n')[0]);
check('an empty log is header-only', auditToCsv([]).split('\n').length === 1);

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
