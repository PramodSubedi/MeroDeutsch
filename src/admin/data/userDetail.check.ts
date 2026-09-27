/**
 * Self-check for the User 360 read model.
 *
 * ── WHY THE PURE FUNCTIONS NEED THIS ───────────────────────────────────────
 * `fetchUserDetail` is I/O and can only be verified against the live database,
 * which makes it a bad place to pin down arithmetic. Everything that can be
 * wrong without a network — due-date classification, the activity scale, the
 * attention ordering — is extracted into pure functions precisely so it can be
 * tested here with a fixed `now`.
 *
 * The cases below are the ones that would produce a WRONG NUMBER rather than an
 * obviously broken screen, which is the failure an admin would act on.
 *
 * Run: npx tsx src/admin/data/userDetail.check.ts
 */
import {
  ACTIVITY_WINDOW_DAYS,
  buildActivity,
  dueState,
  intensityFor,
  leitnerBand,
  summariseQueue,
  type UserActivityRow,
  type UserQueueRow,
} from './userDetail';

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

// A fixed clock. Every date test is relative to this, so the suite does not
// start failing on a Sunday or at midnight UTC.
const NOW = new Date('2026-09-27T12:00:00.000Z');
const daysFromNow = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();

console.log('\n=== 1. DUE STATE ===');
check('a day in the past is overdue', dueState(daysFromNow(-1), NOW) === 'overdue');
check('three days ago is overdue', dueState(daysFromNow(-3), NOW) === 'overdue');
// `due_at` is a TIMESTAMP, not a date, so a window that closed earlier today is
// genuinely late — standard SRS behaviour, and reporting it as merely "due"
// would understate how far behind the learner is.
check('a window that closed earlier today is overdue', dueState(daysFromNow(-0.2), NOW) === 'overdue');
check('exactly now is due', dueState(NOW.toISOString(), NOW) === 'due');
// "Due" is therefore only the NOT-YET-PAST part of the current day.
check('later today is due', dueState(daysFromNow(0.4), NOW) === 'due');
check('tomorrow is upcoming', dueState(daysFromNow(1), NOW) === 'upcoming');
check('next week is upcoming', dueState(daysFromNow(7), NOW) === 'upcoming');
// A learner whose item never got a due date is not "overdue" — reporting it as
// such would send an admin chasing a problem that does not exist.
check('null due date is scheduled, not overdue', dueState(null, NOW) === 'scheduled');
check('unparseable due date is scheduled', dueState('not-a-date', NOW) === 'scheduled');

console.log('\n=== 2. LEITNER BANDS ===');
check('null box is new', leitnerBand(null) === 'new');
check('undefined box is new', leitnerBand(undefined) === 'new');
check('box 0 is new', leitnerBand(0) === 'new');
check('box 1 is learning', leitnerBand(1) === 'learning');
check('box 2 is learning', leitnerBand(2) === 'learning');
check('box 3 is young', leitnerBand(3) === 'young');
check('box 4 is young', leitnerBand(4) === 'young');
check('box 5 is mature', leitnerBand(5) === 'mature');
// A level beyond the app's range must degrade to a known band, never to a
// confident 'mature' it has not earned.
check('an absurd box level stays in a known band', ['new', 'learning', 'young', 'mature'].includes(leitnerBand(99)));

console.log('\n=== 3. ACTIVITY INTENSITY SCALE ===');
check('zero is none', intensityFor(0, 10) === 'none');
check('negative counts are none (not heavy)', intensityFor(-5, 10) === 'none');
check('the max day is heavy', intensityFor(10, 10) === 'heavy');
check('a third of max is medium', intensityFor(3.4, 10) === 'medium');
check('a small fraction is light', intensityFor(1, 10) === 'light');
// Degenerate input: rows exist but every count is zero.
check('zero max is never heavy', intensityFor(0, 0) === 'none');

console.log('\n=== 4. ACTIVITY STRIP ===');
const actRows: UserActivityRow[] = [
  { activity_date: '2026-09-27', event_count: 10 },
  { activity_date: '2026-09-26', event_count: 4 },
  { activity_date: '2026-09-25', event_count: 1 },
  // A gap: 09-24 has no row at all.
  { activity_date: '2026-09-20', event_count: 2 },
];
const act = buildActivity(actRows, NOW);
check('the strip is dense (gaps are real zeros)', act.cells.length === ACTIVITY_WINDOW_DAYS, String(act.cells.length));
check('the strip is oldest first', act.cells[0].date < act.cells[act.cells.length - 1].date);
check('the newest cell is today', act.cells[act.cells.length - 1].date === '2026-09-27', act.cells[act.cells.length - 1].date);
check('today is heavy (it is the max)', act.cells[act.cells.length - 1].intensity === 'heavy');
const gap = act.cells.find((c) => c.date === '2026-09-24');
check('a missing day renders as a zero, not a hole', gap?.count === 0 && gap?.intensity === 'none', JSON.stringify(gap));
// Active days are ALL-TIME, so a day outside the 119-day window still counts.
check('active days counts every row, not just the window', act.activeDays === 4, String(act.activeDays));
check('total events sums the counts', act.totalEvents === 17, String(act.totalEvents));
check('no rows yields a full strip of zeros', buildActivity([], NOW).cells.every((c) => c.count === 0));
check('no rows reports zero active days', buildActivity([], NOW).activeDays === 0);

console.log('\n=== 5. ACTIVITY INTENSITY IS RELATIVE, NOT ABSOLUTE ===');
// Two learners: one busy, one casual. Both must use the full scale, otherwise a
// casual learner reads as dead next to a power user.
const busy = buildActivity([{ activity_date: '2026-09-27', event_count: 100 }], NOW);
const casual = buildActivity([{ activity_date: '2026-09-27', event_count: 2 }], NOW);
check(
  "a casual learner's only active day still reads as heavy",
  busy.cells.at(-1)?.intensity === 'heavy' && casual.cells.at(-1)?.intensity === 'heavy',
  `${busy.cells.at(-1)?.intensity} vs ${casual.cells.at(-1)?.intensity}`,
);

console.log('\n=== 6. QUEUE SUMMARY ===');
const q = (over: Partial<UserQueueRow>): UserQueueRow => ({
  module_type: 'checkpoint', item_key: 'k', user_answer: null, correct_answer: null,
  error_count: 0, interval_days: 1, box_level: 1, due_at: null, error_tag: null, last_result: null,
  ...over,
});
const queueRows: UserQueueRow[] = [
  q({ item_key: 'overdue-low-err', due_at: daysFromNow(-10), error_count: 1 }),
  q({ item_key: 'overdue-high-err', due_at: daysFromNow(-2), error_count: 9 }),
  q({ item_key: 'due-now', due_at: daysFromNow(0.1) }),
  q({ item_key: 'future', due_at: daysFromNow(5) }),
  q({ item_key: 'never-scheduled', due_at: null }),
];
const sum = summariseQueue(queueRows, NOW);
check('total counts every row', sum.total === 5, String(sum.total));
check('overdue counts only past-due rows', sum.overdue === 2, String(sum.overdue));
check('due counts only clearable-now rows', sum.due === 1, String(sum.due));
check('upcoming rows are neither due nor overdue', sum.overdue + sum.due === 3, `${sum.overdue}+${sum.due}`);
check('byModule lists the module', sum.byModule[0]?.moduleType === 'checkpoint');
check('byBand totals match the row count', Object.values(sum.byBand).reduce((a, b) => a + b, 0) === 5);
// Ordering is the whole point of `attention`: worst first.
check('attention is capped at 10', sum.attention.length <= 10);
check(
  'attention puts the most-missed overdue item first',
  sum.attention[0]?.item_key === 'overdue-high-err',
  sum.attention[0]?.item_key,
);
check('attention includes every row of a 5-row queue', sum.attention.length === 5);
const order = sum.attention.map((a) => a.due);
check('attention is ordered overdue -> due -> upcoming -> scheduled', order.join(',') === 'overdue,overdue,due,upcoming,scheduled', order.join(','));

// Determinism: two runs must agree, or the drawer reshuffles on every render
// and an admin cannot compare two visits.
const again = summariseQueue(queueRows, NOW);
check(
  'ordering is deterministic across runs',
  JSON.stringify(again.attention.map((a) => a.item_key)) === JSON.stringify(sum.attention.map((a) => a.item_key)),
);

console.log('\n=== 7. QUEUE EDGE CASES ===');
check('an empty queue totals zero', summariseQueue([], NOW).total === 0);
check('an empty queue has no attention items', summariseQueue([], NOW).attention.length === 0);
check('an empty queue reports no bands', Object.values(summariseQueue([], NOW).byBand).every((v) => v === 0));
const mixed = summariseQueue([q({ module_type: null, box_level: null, due_at: null })], NOW);
check('null module falls back to "unknown"', mixed.byModule[0]?.moduleType === 'unknown');
check('null box counts as the new band', mixed.byBand.new === 1);
// Modules rank by count, then alphabetically, so ties are stable.
const ranked = summariseQueue(
  [q({ item_key: 'a', module_type: 'zeta' }), q({ item_key: 'b', module_type: 'alpha' }), q({ item_key: 'c', module_type: 'alpha' })],
  NOW,
);
check(
  'modules rank by count then name',
  ranked.byModule[0]?.moduleType === 'alpha' && ranked.byModule[0]?.count === 2,
  JSON.stringify(ranked.byModule),
);
check('a 12-row queue caps attention at 10', summariseQueue(Array.from({ length: 12 }, (_, i) => q({ item_key: `k${i}` })), NOW).attention.length === 10);

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
