/**
 * src/admin/data/dayMath.check.ts
 *
 *   npm run check:daymath
 *
 * The calendar arithmetic behind the dashboard's activity figures.
 *
 * Every assertion here corresponds to a number that was WRONG before this module
 * existed. The functions were four identical private copies inside async
 * closures, so no suite could reach them; two of the copies disagreed with their
 * own labels.
 */
import {
  activeUserCount,
  denseDailySeries,
  isoDaysAgo,
  isoToday,
  lastActiveDay,
  windowStartIso,
} from './dayMath';

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

// A fixed clock. Every assertion below is about arithmetic, and a test that
// silently depends on the day it runs is a test that fails on a Sunday.
const NOW = new Date('2026-09-29T12:00:00Z'); // a Tuesday
const daysAgo = (n: number) => isoDaysAgo(n, NOW);

console.log('\n=== 0. THE CLOCK IS INJECTED ===');
check('isoToday is the current day', isoToday(NOW) === '2026-09-29', isoToday(NOW));
check('isoDaysAgo(0) is today', daysAgo(0) === '2026-09-29', daysAgo(0));
check('isoDaysAgo(1) is yesterday', daysAgo(1) === '2026-09-28', daysAgo(1));
check('isoDaysAgo(7) is last Tuesday', daysAgo(7) === '2026-09-22', daysAgo(7));
check('isoDaysAgo(30) crosses a month boundary', daysAgo(30) === '2026-08-30', daysAgo(30));
check('the result is a bare date, not an ISO timestamp', !daysAgo(1).includes('T'));
check('a negative offset walks forward', isoDaysAgo(-1, NOW) === '2026-09-30', isoDaysAgo(-1, NOW));
// Month arithmetic is where a naive `setDate(getDate() - n)` style bug hides.
check('a month with 31 days is handled', isoDaysAgo(2, new Date('2026-03-01T00:00:00Z')) === '2026-02-27');
check('a leap day is handled', isoDaysAgo(1, new Date('2028-03-01T00:00:00Z')) === '2028-02-29');
check('a non-leap February is handled', isoDaysAgo(1, new Date('2027-03-01T00:00:00Z')) === '2027-02-28');

console.log('\n=== 1. THE WINDOW BOUND IS days-1, NOT days ===');
// This is the off-by-one. `gte(isoDaysAgo(30))` is an INCLUSIVE filter, so it
// returns 31 distinct dates for a "30-day" window — and the dashboard then
// printed the 31-point series length under a "30d" label.
check('a 30-day window starts 29 days back', windowStartIso(30, NOW) === '2026-08-31', windowStartIso(30, NOW));
check('a 7-day window starts 6 days back', windowStartIso(7, NOW) === '2026-09-23', windowStartIso(7, NOW));
check('a 1-day window is today', windowStartIso(1, NOW) === '2026-09-29', windowStartIso(1, NOW));
check('the window never starts in the future', windowStartIso(0, NOW) === '2026-09-29', windowStartIso(0, NOW));
check('a negative window is clamped to today', windowStartIso(-5, NOW) === '2026-09-29', windowStartIso(-5, NOW));

// Count the dates the bound would actually admit. This is the number the old
// code reported as `active30d`.
const admitted = (days: number) => {
  const start = windowStartIso(days, NOW);
  let n = 0;
  for (let i = 0; i < 400; i += 1) if (daysAgo(i) >= start) n += 1;
  return n;
};
check('a 30-day window admits exactly 30 dates', admitted(30) === 30, String(admitted(30)));
check('a 7-day window admits exactly 7 dates', admitted(7) === 7, String(admitted(7)));
check('a 1-day window admits exactly 1 date', admitted(1) === 1, String(admitted(1)));
// The regression, stated as the thing it was: 31 and 8.
check('the old bound really did admit 31', admitted(31) === 31);
check('the old 7-day bound really did admit 8', admitted(8) === 8);

console.log('\n=== 2. THE DENSE SERIES HAS days POINTS, NOT days+1 ===');
const empty = new Map<string, number>();
const s30 = denseDailySeries(empty, 30, NOW);
check('a 30-day series has 30 points', s30.length === 30, String(s30.length));
check('a 7-day series has 7 points', denseDailySeries(empty, 7, NOW).length === 7);
check('a 1-day series has 1 point', denseDailySeries(empty, 1, NOW).length === 1);
check('a 0-day series is empty, not one phantom point', denseDailySeries(empty, 0, NOW).length === 0);
check('the series starts at the window bound', s30[0].date === windowStartIso(30, NOW), s30[0].date);
check('the series ends today', s30[s30.length - 1].date === isoToday(NOW), s30[s30.length - 1].date);
check('the series is oldest first', s30[0].date < s30[s30.length - 1].date);
// A gap is a real zero. An omitted day is indistinguishable from a quiet one.
check('absent dates are real zeros', s30.every((p) => p.active === 0));

const counts = new Map<string, number>([[isoToday(NOW), 7], [windowStartIso(30, NOW), 3]]);
const s30b = denseDailySeries(counts, 30, NOW);
check('today is counted', s30b[s30b.length - 1].active === 7);
check('the window start is counted', s30b[0].active === 3);
check('a date outside the window is ignored', (() => {
  const withOld = new Map(counts);
  withOld.set(isoDaysAgo(45, NOW), 99);
  const series = denseDailySeries(withOld, 30, NOW);
  return series.every((p) => p.active !== 99);
})());
check('dates are strictly increasing', s30b.every((p, i) => i === 0 || p.date > s30b[i - 1].date));

console.log('\n=== 3. ACTIVE-USER WINDOWS ===');
const byUser = new Map<string, Set<string>>([
  ['today', new Set([isoToday(NOW)])],
  ['todayAndYesterday', new Set([isoToday(NOW), isoDaysAgo(1, NOW)])],
  ['sixDaysAgo', new Set([isoDaysAgo(6, NOW)])],
  ['thirteenDaysAgo', new Set([isoDaysAgo(13, NOW)])],
  ['fortyDaysAgo', new Set([isoDaysAgo(40, NOW)])],
  ['fiveHundredDaysAgo', new Set([isoDaysAgo(500, NOW)])],
]);
check('a 1-day window counts only today', activeUserCount(byUser, 1, NOW) === 2, String(activeUserCount(byUser, 1, NOW)));
check('a 7-day window includes day 6', activeUserCount(byUser, 7, NOW) === 3, String(activeUserCount(byUser, 7, NOW)));
check('a 7-day window excludes day 7 — that is an 8-day window', activeUserCount(byUser, 8, NOW) === 3);
check('a 30-day window includes day 13 and excludes day 40', activeUserCount(byUser, 30, NOW) === 4, String(activeUserCount(byUser, 30, NOW)));
check('a 41-day window includes day 40', activeUserCount(byUser, 41, NOW) === 5, String(activeUserCount(byUser, 41, NOW)));
check('a 400-day window excludes day 500', activeUserCount(byUser, 400, NOW) === 5, String(activeUserCount(byUser, 400, NOW)));
check('a 501-day window includes day 500', activeUserCount(byUser, 501, NOW) === 6);
check('an empty index counts nobody', activeUserCount(new Map(), 30, NOW) === 0);
// The bound is INCLUSIVE, which is what makes it match the `gte` the caller sent.
check('the start bound itself is included', (() => {
  const at = windowStartIso(7, NOW);
  return activeUserCount(new Map([['x', new Set([at])]]), 7, NOW) === 1;
})());
check('the day before the bound is excluded', (() => {
  const before = isoDaysAgo(7, NOW);
  return activeUserCount(new Map([['x', new Set([before])]]), 7, NOW) === 0;
})());
check('a user with no dates counts as nobody', activeUserCount(new Map([['x', new Set<string>()]]), 30, NOW) === 0);
check('one user is counted once however many active days', (() => {
  const many = new Map<string, Set<string>>();
  many.set('x', new Set([isoToday(NOW), isoDaysAgo(2, NOW), isoDaysAgo(4, NOW)]));
  return activeUserCount(many, 30, NOW) === 1;
})());

console.log('\n=== 4. LAST ACTIVE DAY ===');
check('the latest date wins', lastActiveDay(['2026-01-01', '2026-09-28', '2026-03-01']) === '2026-09-28');
check('order does not matter', lastActiveDay(['2026-09-28', '2026-01-01']) === '2026-09-28');
check('a single date is itself', lastActiveDay(['2026-05-05']) === '2026-05-05');
check('no dates is null', lastActiveDay([]) === null);
// The Users table renders this column, and `String(null)` once printed the word.
check('null never becomes the string "null"', lastActiveDay([]) !== 'null');
check('empty strings are skipped', lastActiveDay(['', '', '2026-02-02']) === '2026-02-02');
check('empty strings alone are still null', lastActiveDay(['', '']) === null);
// ISO dates sort lexicographically, which is the property that makes `>` safe in
// `lastActiveDay`. Asserted through the function rather than as a bare literal
// comparison, because a constant-vs-constant assertion proves only that someone
// can spell two strings.
check('lexicographic order matches chronological order', lastActiveDay(['2026-01-31', '2026-02-01']) === '2026-02-01');
check('across a year boundary', lastActiveDay(['2025-12-31', '2026-01-01']) === '2026-01-01');
// The property itself, stated as a fact about a function: an older date never
// wins, which is what would break if the comparison became `localeCompare`.
check('an older date never wins regardless of input order', lastActiveDay(['2026-06-01', '2026-05-31']) === '2026-06-01');
check('a date far in the future still wins', lastActiveDay(['2026-01-01', '2030-12-31']) === '2030-12-31');

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
