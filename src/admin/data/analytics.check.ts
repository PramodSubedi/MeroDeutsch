/**
 * Self-check for the Analytics aggregation helpers.
 *
 * WHY THIS MATTERS MORE THAN USUAL
 * Every one of these functions decides what a chart DRAWS. A wrong value does not
 * throw and does not look broken — it looks like a real finding. The specific
 * trap here is retention: padding an immature cohort with zeros renders as
 * "100% of learners churned", which is a claim about product behaviour that no
 * data supports. That is the kind of bug a reviewer reads a chart and believes.
 *
 * Run: npx tsx src/admin/data/analytics.check.ts
 */
import {
  addWeeks,
  bucketStreaks,
  buildRetention,
  denseDaily,
  tally,
  tallyNumeric,
  weekStart,
} from './analytics';

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

console.log('\n=== 1. WEEK BOUNDARIES ===');
// 2026-09-27 is a Sunday, so its week starts Monday 2026-09-21.
check('Sunday belongs to the week starting Monday', weekStart('2026-09-27') === '2026-09-21', weekStart('2026-09-27'));
check('a Monday maps to itself', weekStart('2026-09-21') === '2026-09-21');
check('a Wednesday maps back to Monday', weekStart('2026-09-23') === '2026-09-21');
check('the next Monday is a new week', weekStart('2026-09-28') === '2026-09-28');
check('addWeeks(0) is identity', addWeeks('2026-09-21', 0) === '2026-09-21');
check('addWeeks(1) adds seven days', addWeeks('2026-09-21', 1) === '2026-09-28', addWeeks('2026-09-21', 1));
check('addWeeks(4) crosses into the next month', addWeeks('2026-09-28', 4) === '2026-10-26', addWeeks('2026-09-28', 4));

console.log('\n=== 2. DENSE DAILY SERIES (no gaps) ===');
const dense = denseDaily(new Map([['2026-09-27', 3], ['2026-09-25', 1]]), 3, '2026-09-27');
// `days` is the number of POINTS. It used to be `days + 1`, which is how the
// Analytics page plotted a 31-point series under the heading "Last 30 days" and
// the Dashboard printed "31" beside a "30d" label. Both labels were honest
// descriptions of the number and wrong about the window.
check('series length is exactly days', dense.length === 3, String(dense.length));
check('ends on the requested today', dense[dense.length - 1].date === '2026-09-27');
check('starts days-1 earlier', dense[0].date === '2026-09-25', dense[0].date);
// A missing day must be a REAL zero. A sparse series would draw a straight line
// through a three-day absence and hide it.
// today = 2026-09-27, days = 3  ->  [09-25, 09-26, 09-27]
// so 09-26 has no activity and must read 0, and today is the last index.
check('a day with no activity is zero, not missing', dense[1].active === 0, String(dense[1].active));
check('recorded activity is carried through', dense[0].active === 1, String(dense[0].active));
check("today's count is used", dense[2].active === 3, String(dense[2].active));
check('the series is in ascending date order', dense.every((d, i) => i === 0 || d.date > dense[i - 1].date));
check('a 30-day request yields 30 points', denseDaily(new Map(), 30, '2026-09-27').length === 30);
check('a 1-day request yields 1 point', denseDaily(new Map(), 1, '2026-09-27').length === 1);
check('an activity date outside the window is excluded', denseDaily(new Map([['2026-01-01', 99]]), 3, '2026-09-27').every((p) => p.active === 0));

console.log('\n=== 3. RETENTION: TRAILING ZEROS ARE NOT CHURN ===');
{
  // One learner active only in the week of 2026-09-21, and nobody after.
  const byUser = new Map([['u1', new Set(['2026-09-22'])]]);
  const cohorts = buildRetention(byUser, 5, 4);
  check('one cohort is produced', cohorts.length === 1, String(cohorts.length));
  // Week 0 = 1 learner. Weeks 1..4 are all unobservable, so the row must TRIM to
  // [1] rather than reading as "retained 1 → 0 → 0 → 0 → 0" (i.e. total churn).
  check('an immature cohort trims its trailing zeros', cohorts[0].weeks.length === 1, JSON.stringify(cohorts[0].weeks));
  check('week 0 still reports the cohort size', cohorts[0].weeks[0] === 1, JSON.stringify(cohorts[0].weeks));
}
{
  // Two learners in week 0, one comes back in week 1.
  const byUser = new Map([
    ['u1', new Set(['2026-09-21', '2026-09-28'])],
    ['u2', new Set(['2026-09-22'])],
  ]);
  const cohorts = buildRetention(byUser, 5, 4);
  check('cohort of two is counted', cohorts[0].weeks[0] === 2, JSON.stringify(cohorts[0].weeks));
  check('one returning learner is retained in week 1', cohorts[0].weeks[1] === 1, JSON.stringify(cohorts[0].weeks));
  check('retention trims after the last real observation', cohorts[0].weeks.length === 2, JSON.stringify(cohorts[0].weeks));
}
check('no activity at all yields no cohorts', buildRetention(new Map(), 5, 4).length === 0);

console.log('\n=== 4. STREAK BUCKETS ===');
const buckets = bucketStreaks([0, 0, 3, 7, 10, 25, 99]);
check('zeros are counted', buckets.find((b) => b.label === '0')?.value === 2, JSON.stringify(buckets));
check('an exact 10 becomes the "10+" bucket', buckets.find((b) => b.label === '10+')?.value === 3, JSON.stringify(buckets));
check('no individual bucket above 9 exists', !buckets.some((b) => b.label === '10' || b.label === '25'));
check('buckets sort numerically', buckets.map((b) => b.label).join(',') === '0,3,7,10+', buckets.map((b) => b.label).join(','));
check('a negative streak is clamped to 0', bucketStreaks([-5]).find((b) => b.label === '0')?.value === 1);
check('an empty input yields no buckets', bucketStreaks([]).length === 0);

console.log('\n=== 5. TALLY ===');
check('counts occurrences', tally(['a', 'b', 'a'], (v) => v).find((p) => p.label === 'a')?.value === 2);
check('drops null keys', tally(['a', null], (v) => v).length === 1);
check('tolerates a null list', tally(null, () => 'x').length === 0);
// Natural sort matters: as TEXT, "10" sorts before "2", which would scramble any
// numbered axis (units, levels).
const levels = tallyNumeric([{ l: 10 }, { l: 2 }, { l: 1 }], (r) => r.l);
check('numeric sort puts 2 before 10', levels.map((p) => p.label).join(',') === '1,2,10', levels.map((p) => p.label).join(','));

console.log(
  `\n[summary] ${failures.length === 0 ? `ALL ${checks} CHECKS PASSED` : `${failures.length} of ${checks} FAILED: ${failures.join(', ')}`}`
);
process.exit(failures.length === 0 ? 0 : 1);
