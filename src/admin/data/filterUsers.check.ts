/**
 * Self-check for the Users table's filter / search / sort behaviour.
 *
 * WHY THIS IS A TEST AND NOT A COMPONENT TEST
 * `filterUsers` is pure and holds the logic that actually decides what an admin
 * sees. The failure mode that matters is SILENT: a filter that matches nothing,
 * a search that misses the one identifier the admin was given, nulls sorting to
 * the top and burying every real value. None of those throw, so none would be
 * caught by a build or a smoke test — they just look like "the data is missing".
 *
 * Run: npx tsx src/admin/data/filterUsers.check.ts
 */
import {
  DEFAULT_FILTERS,
  compareNullableInternal,
  facetCounts,
  filterUsers,
  isActiveSince,
  matchesPlan,
  matchesRole,
  matchesSearch,
  matchesStatus,
  sortUsers,
  type UserFilters,
} from './filterUsers';
import type { AdminUserRow } from './users';

const failures: string[] = [];
let checks = 0;

function check(label: string, condition: boolean, detail = ''): void {
  checks += 1;
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    failures.push(label);
  }
}

/** A row with sensible defaults, so each test overrides only what it exercises. */
function row(overrides: Partial<AdminUserRow> = {}): AdminUserRow {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    username: 'user',
    fullName: null,
    plan: 'free',
    role: 'user',
    bannedAt: null,
    createdAt: '2026-01-01',
    totalXp: 0,
    level: 1,
    currentStreak: 0,
    longestStreak: 0,
    lastActivityDate: null,
    activeDays: 0,
    lastActiveAt: null,
    unlockedUnitIndex: null,
    pathMode: null,
    queueSize: 0,
    queueErrors: 0,
    ...overrides,
  };
}

// The 7-day activity cut-off used by the fixtures below.
const FROM = '2026-09-20';

const users: AdminUserRow[] = [
  row({ id: 'a1', username: 'Pramod', fullName: 'Ram', plan: 'free', role: 'admin', totalXp: 900, currentStreak: 12, unlockedUnitIndex: 4, lastActiveAt: '2026-09-26', createdAt: '2026-08-13' }),
  row({ id: 'b2', username: 'alice', plan: 'premium', role: 'user', totalXp: 150, currentStreak: 3, unlockedUnitIndex: 0, lastActiveAt: '2026-09-10', createdAt: '2026-09-01' }),
  row({ id: 'c3', username: 'bob', plan: 'free', role: 'user', totalXp: null, currentStreak: null, unlockedUnitIndex: null, lastActiveAt: null, createdAt: '2026-09-20' }),
  row({ id: 'd4', username: 'carol', plan: 'premium', role: 'user', totalXp: 400, currentStreak: 30, unlockedUnitIndex: 2, lastActiveAt: '2026-01-05', createdAt: '2026-02-02', bannedAt: '2026-09-20' }),
];

const f = (over: Partial<UserFilters> = {}): UserFilters => ({ ...DEFAULT_FILTERS, ...over });

console.log('\n=== 1. SEARCH ===');
check('empty search matches everyone', users.every((u) => matchesSearch(u, '')));
check('whitespace-only search matches everyone', users.every((u) => matchesSearch(u, '   ')));
check('username match', matchesSearch(users[0], 'pramod'));
check('username match is case-insensitive', matchesSearch(users[0], 'PRAMOD'));
check('partial username match', matchesSearch(users[1], 'ali'));
check('full-name match', matchesSearch(users[0], 'Ram'));
// The one an admin is most likely to be defeated by: pasting a uuid.
check('id match (uuid from a support email)', matchesSearch(users[2], 'c3'));
// A PREFIX, which is the realistic case: an admin reads 3-8 characters off a
// support email rather than pasting all 36.
check('id prefix match', matchesSearch(users[2], 'c'));
// Not a prefix, and not a substring: a real uuid is 36 chars, so an `includes`
// search could only match the whole thing and would be useless.
check('a mid-uuid fragment does NOT match', !matchesSearch(users[2], '3x'));
check('no match returns false', !matchesSearch(users[1], 'zzzz'));

console.log('\n=== 2. PLAN / ROLE FACETS ===');
check('plan=all matches everyone', users.every((u) => matchesPlan(u, 'all')));
check('plan=premium matches only premium', users.filter((u) => matchesPlan(u, 'premium')).length === 2);
check('plan=free matches only free', users.filter((u) => matchesPlan(u, 'free')).length === 2);
// A null plan must be treated as free, not dropped.
check('null plan counts as free', matchesPlan(row({ plan: null }), 'free'));
check('role=admin matches only admins', users.filter((u) => matchesRole(u, 'admin')).length === 1);
check('role=user matches the rest', users.filter((u) => matchesRole(u, 'user')).length === 3);
check('null role counts as user', matchesRole(row({ role: null }), 'user'));

console.log('\n=== 3. STATUS (active window) ===');
// `FROM` is the 7-days-ago cut-off: a learner counts as active if their last
// activity is on or AFTER it.
check('suspended is recognised', matchesStatus(users[3], 'suspended', FROM));
check('not-suspended is excluded from suspended', !matchesStatus(users[0], 'suspended', FROM));
check('activity inside the window counts as active', matchesStatus(users[0], 'active', FROM));
check('activity before the window is not active', !matchesStatus(users[1], 'active', FROM));
check('no activity at all is idle', matchesStatus(users[2], 'idle', FROM));
// A suspended user is neither active nor idle: the row is already flagged, and
// counting them as "idle" would imply they need a nudge rather than a decision.
check('a suspended user is not "active"', !matchesStatus(users[3], 'active', FROM));
check('a suspended user is not "idle"', !matchesStatus(users[3], 'idle', FROM));
check('status=all includes suspended', matchesStatus(users[3], 'all', FROM));

// The boundary itself: the cut-off day is INSIDE the window.
check('activity exactly on the cut-off is active', isActiveSince('2026-09-20', FROM));
check('the day before the cut-off is not active', !isActiveSince('2026-09-19', FROM));
check('a null activity date is never active', !isActiveSince(null, FROM));

console.log('\n=== 4. COMBINED FILTERS ===');
const onlyPremium = filterUsers(users, f({ plan: 'premium' })).rows;
check('premium filter returns 2', onlyPremium.length === 2, String(onlyPremium.length));
check('premium filter excludes the admin (free)', !onlyPremium.some((u) => u.id === 'a1'));

const searchPlusPlan = filterUsers(users, f({ search: 'ca', plan: 'premium' })).rows;
check('search + plan AND together', searchPlusPlan.length === 1 && searchPlusPlan[0].id === 'd4');

const suspended = filterUsers(users, f({ status: 'suspended' })).rows;
check('suspended filter returns just carol', suspended.length === 1 && suspended[0].id === 'd4');

const nothing = filterUsers(users, f({ search: 'nobody-by-that-name' })).rows;
check('an impossible search returns empty (not everything)', nothing.length === 0);

// The matched-id set drives row selection, so it must agree with the rows.
const combo = filterUsers(users, f({ plan: 'premium' }));
check('matchedIds size matches rows length', combo.matchedIds.size === combo.rows.length);
check('matchedIds contains the right ids', combo.matchedIds.has('b2') && combo.matchedIds.has('d4'));

console.log('\n=== 5. SORTING ===');
const byXpDesc = sortUsers(users, 'xp', true);
check('xp desc puts the highest first', byXpDesc[0].id === 'a1');
check('xp desc puts nulls LAST', byXpDesc[byXpDesc.length - 1].id === 'c3');

const byXpAsc = sortUsers(users, 'xp', false);
check('xp asc still puts nulls last', byXpAsc[byXpAsc.length - 1].id === 'c3');
check('xp asc puts the lowest first', byXpAsc[0].id === 'b2');

const byCreated = sortUsers(users, 'createdAt', true);
check('newest account first', byCreated[0].id === 'c3', byCreated[0].id);

const byName = sortUsers(users, 'username', false);
check('username sort is alphabetical ascending', byName[0].username === 'alice', byName[0].username);

// Sorting must not mutate the input — the table keeps `rows` in load order and
// an in-place sort would fight the filter memo.
const snapshot = users.map((u) => u.id);
sortUsers(users, 'xp', true);
check('sortUsers does not mutate its input', users.map((u) => u.id).join() === snapshot.join());

console.log('\n=== 6. NULL ORDERING PRIMITIVE ===');
check('null vs number: number first', compareNullableInternal(5, null) < 0);
check('null vs number reversed: number first', compareNullableInternal(null, 5) > 0);
check('null vs null is equal', compareNullableInternal(null, null) === 0);

console.log('\n=== 7. FACET COUNTS AGREE WITH THE SEARCH ===');
const counts = facetCounts(users, 'ca');
check('facet total is the whole table', counts.total === 4);
check('facet searched is the search subset', counts.searched === 1, String(counts.searched));
check('facet premium reflects the search', counts.premium === 1, String(counts.premium));
check('facet suspended reflects the search', counts.suspended === 1);

console.log(
  `\n[summary] ${failures.length === 0 ? `ALL ${checks} CHECKS PASSED` : `${failures.length} of ${checks} FAILED: ${failures.join(', ')}`}`
);
process.exit(failures.length === 0 ? 0 : 1);
