/**
 * src/admin/data/search.check.ts
 *
 *   npx tsx src/admin/data/search.check.ts
 *
 * A search palette that returns the wrong things is worse than no palette: it
 * teaches the operator not to trust it. These pin the RANKING rules, not just
 * the fact that something matched.
 */
import { isDismissKey, isOpenHotkey, scoreMatch, searchAll } from './search';

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

const users = [
  { id: 'u1', username: 'sunny', fullName: 'Sunny Day', role: 'user', plan: 'free' },
  { id: 'u2', username: 'max', fullName: 'Max Muster', role: 'admin', plan: 'premium' },
];
const vocab = [
  { id: 'v1', word: 'Haus', translationEn: 'house', translationNp: 'घर' },
  { id: 'v2', word: 'Auto', translationEn: 'car', translationNp: 'गाडी' },
];
const audit = [{ id: 'a1', action: 'user.ban', targetId: 'u2', adminName: 'Max' }];
const index = { users, vocabulary: vocab, audit } as never;

console.log('\n=== 1. HOTKEY ===');
check('ctrl+k opens', isOpenHotkey({ key: 'k', ctrlKey: true, metaKey: false }));
check('meta+k opens', isOpenHotkey({ key: 'k', ctrlKey: false, metaKey: true }));
check('shifted K opens', isOpenHotkey({ key: 'K', ctrlKey: true, metaKey: false }));
check('a bare k does NOT open', !isOpenHotkey({ key: 'k', ctrlKey: false, metaKey: false }));
check('ctrl+j does not open', !isOpenHotkey({ key: 'j', ctrlKey: true, metaKey: false }));
check('escape dismisses', isDismissKey('Escape'));
check('enter does not dismiss', !isDismissKey('Enter'));

console.log('\n=== 2. SCORING PREFERS PREFIXES ===');
check('a prefix scores', scoreMatch('sun', 'sunny') > 0);
check('a prefix beats a mid-string match', scoreMatch('un', 'sunny') > scoreMatch('un', 'a sunny day'));
check('a title match beats a subtitle match', scoreMatch('max', 'Max', 'maxim') > scoreMatch('max', 'zzz', 'maxim'));
check('no match scores zero', scoreMatch('zzz', 'sunny') === 0);
check('null fields are skipped, not crashed', scoreMatch('x', null, undefined, 'x') > 0);
check('an empty needle scores zero', scoreMatch('', 'anything') === 0);

console.log('\n=== 3. AN EMPTY QUERY SHOWS NAVIGATION ONLY ===');
// Listing 1,000 vocabulary rows before the user types is noise, not help.
const empty = searchAll(index, '');
check('an empty query returns hits', empty.length > 0);
check('an empty query returns only navigation', empty.every((h) => h.group === 'navigation'));
check('an empty query is capped', empty.length <= 6, String(empty.length));

console.log('\n=== 4. NAVIGATION IS ALWAYS REACHABLE ===');
for (const label of ['users', 'review', 'curriculum', 'vocab', 'audit', 'system', 'analytics']) {
  check(`"${label}" finds its page`, searchAll(index, label).some((h) => h.group === 'navigation'), label);
}

console.log('\n=== 5. USERS ARE SEARCHABLE ===');
const byName = searchAll(index, 'sunny');
check('a username matches', byName.some((h) => h.group === 'users'), JSON.stringify(byName.map((h) => h.title)));
check('a full name matches', searchAll(index, 'max muster').some((h) => h.group === 'users'));
check('a user hit links to the user', searchAll(index, 'sunny').find((h) => h.group === 'users')?.to.startsWith('/users'));
check('a user hit carries a subtitle', Boolean(searchAll(index, 'sunny').find((h) => h.group === 'users')?.subtitle));
check('an id matches', searchAll(index, 'u2').some((h) => h.group === 'users'));

console.log('\n=== 6. VOCABULARY IS SEARCHABLE ===');
check('a German word matches', searchAll(index, 'haus').some((h) => h.group === 'vocabulary'));
check('an English translation matches', searchAll(index, 'car').some((h) => h.group === 'vocabulary'));
check('a vocabulary hit shows the translation', searchAll(index, 'haus').find((h) => h.group === 'vocabulary')?.subtitle === 'house');
check('a vocabulary hit links to vocabulary', searchAll(index, 'haus').find((h) => h.group === 'vocabulary')?.to.startsWith('/vocabulary'));

console.log('\n=== 7. AUDIT IS SEARCHABLE ===');
check('an action matches', searchAll(index, 'user.ban').some((h) => h.group === 'audit'));
check('a target id matches', searchAll(index, 'u2').some((h) => h.group === 'audit'));
check('an audit hit links to the log', searchAll(index, 'user.ban').find((h) => h.group === 'audit')?.to === '/audit-log');

console.log('\n=== 8. RANKING PUTS NAVIGATION FIRST ===');
// "use" should reach the Users page before it reaches a user called Sunny.
const use = searchAll(index, 'use');
check('the Users page outranks a user for "use"', use[0]?.to === '/users', JSON.stringify(use.slice(0, 3).map((h) => [h.title, h.score])));
check('results are sorted by score descending', use.every((h, i) => i === 0 || use[i - 1].score >= h.score));

console.log('\n=== 9. PER-GROUP CAPS ===');
const manyUsers = Array.from({ length: 50 }, (_, i) => ({ id: `x${i}`, username: `test${i}`, fullName: `Test ${i}` }));
const capped = searchAll({ users: manyUsers } as never, 'test', { perGroup: 3 });
check('a group is capped at perGroup', capped.filter((h) => h.group === 'users').length <= 3);
check('the cap is honoured exactly', searchAll({ users: manyUsers } as never, 'test', { perGroup: 5 }).filter((h) => h.group === 'users').length === 5);
// A query that matches BOTH a page name and the user rows must keep navigation
// reachable. "c" is in "Curriculum"/"Analytics" and also in "Test 0"…
const both = searchAll({ users: manyUsers } as never, 'c', { perGroup: 3 });
check('a broad query keeps navigation visible', both.some((h) => h.group === 'navigation'), JSON.stringify(both.map((h) => h.group)));
// A query matching NOTHING in navigation must return no navigation hits.
// "test" is a substring of no page name, so surfacing System for it would be
// noise dressed up as a result.
check('a query matching no page name returns no navigation', searchAll({ users: manyUsers } as never, 'test', { perGroup: 3 }).every((h) => h.group !== 'navigation'));

console.log('\n=== 10. DEGENERATE INPUT ===');
check('an empty index returns nothing for a real query', searchAll({}, 'anything').filter((h) => h.group !== 'navigation').length === 0);
check('whitespace is treated as empty', searchAll(index, '   ').every((h) => h.group === 'navigation'));
check('query case is ignored', searchAll(index, 'HAUS').some((h) => h.group === 'vocabulary'));
check('a query with no match returns only navigation', searchAll(index, 'zzzzz').every((h) => h.group === 'navigation'));

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
