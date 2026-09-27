/**
 * Self-check for the Review Queue read model.
 *
 * The figures here are the ones an admin acts on ("how much debt is there, and
 * who owns it"), so the aggregation is pinned with a fixed clock. The cases are
 * modelled on the real production shape: mostly box-1 wrong answers, a few
 * graduated ones, and one `error_tag` value shared across every tagged row.
 *
 * Run: npx tsx src/admin/data/reviewQueue.check.ts
 */
import {
  buildTotals,
  csvCell,
  overdueDays,
  summariseDue,
  toCsv,
  STALE_AFTER_DAYS,
  type QueueItem,
} from './reviewQueue';
import type { DueState } from './userDetail';

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

const NOW = new Date('2026-09-27T12:00:00.000Z');
const days = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();

let seq = 0;
const item = (over: Partial<QueueItem> = {}): QueueItem => ({
  id: `q${++seq}`,
  userId: 'u1',
  username: 'learner',
  moduleType: 'rapid',
  itemKey: `key-${seq}`,
  userAnswer: 'x',
  correctAnswer: 'y',
  errorCount: 1,
  intervalDays: 1,
  boxLevel: 1,
  dueAt: days(-1),
  updatedAt: days(-1),
  errorTag: null,
  lastResult: 'wrong',
  ...over,
});

/** Decorate the way the loader does, so filters see the same shape. */
const decorate = (rows: QueueItem[]) =>
  rows.map((it) => {
    const due: DueState = it.dueAt && new Date(it.dueAt).getTime() < NOW.getTime() ? 'overdue' : 'upcoming';
    return { ...it, due, overdueDays: due === 'overdue' ? overdueDays(it.dueAt, NOW) : 0 };
  });

console.log('\n=== 1. OVERDUE DAYS ===');
check('a day late is 1', overdueDays(days(-1), NOW) === 1);
check('40 days late is 40', overdueDays(days(-40), NOW) === 40);
check('exactly now is 0', overdueDays(NOW.toISOString(), NOW) === 0);
check('a future date floors at 0, never negative', overdueDays(days(5), NOW) === 0);
check('null is 0, not a fake large number', overdueDays(null, NOW) === 0);
check('garbage is 0', overdueDays('nope', NOW) === 0);

console.log('\n=== 2. TOTALS ===');
const rows: QueueItem[] = [
  item({ dueAt: days(-45), errorCount: 3 }), // stale
  item({ dueAt: days(-5) }), // overdue, not stale
  item({ dueAt: days(-31) }), // just past the stale line
  item({ dueAt: days(0.1), boxLevel: 2 }), // due
  item({ dueAt: days(6), boxLevel: 3 }), // upcoming
  item({ dueAt: null, boxLevel: 5 }), // scheduled
];
const t = buildTotals(rows, NOW);
check('total counts every row', t.total === 6, String(t.total));
check('overdue counts only past-due', t.overdue === 3, String(t.overdue));
check('due counts only the not-yet-past window', t.due === 1, String(t.due));
check('upcoming counts future items', t.upcoming === 1, String(t.upcoming));
check('scheduled counts items with no due date', t.scheduled === 1, String(t.scheduled));
// The four buckets must partition the set exactly — a leak means a row is
// counted twice or not at all, and the page shows a wrong denominator.
check('the four states partition the total', t.overdue + t.due + t.upcoming + t.scheduled === t.total, `${t.overdue}+${t.due}+${t.upcoming}+${t.scheduled} != ${t.total}`);
check('stale means over 30 days late', t.stale === 2, String(t.stale));
check('the stale threshold is exactly 30 days', STALE_AFTER_DAYS === 30);
check('oldest due is the furthest past', t.oldestDue === days(-45).slice(0, 10), String(t.oldestDue));

console.log('\n=== 3. EMPTY QUEUE ===');
const empty = buildTotals([], NOW);
check('empty totals are all zero', empty.total === 0 && empty.overdue === 0 && empty.stale === 0);
check('empty queue has no oldest due date', empty.oldestDue === null);
check('empty queue has no module rows', empty.byModule.length === 0);
check('empty queue has no user rows', empty.byUser.length === 0);
check('empty queue bands are all zero', Object.values(empty.byBand).every((v) => v === 0));

console.log('\n=== 4. GROUPINGS ===');
// `lastResult` is set EXPLICITLY on every row here. The `item()` helper defaults
// it to 'wrong', so leaving it alone would have made every row 'wrong' and the
// grouping assertions below would pass or fail for the wrong reason.
const g = buildTotals(
  [
    item({ moduleType: 'rapid', userId: 'a', username: 'ann', dueAt: days(-3), lastResult: 'wrong' }),
    item({ moduleType: 'rapid', userId: 'a', username: 'ann', dueAt: days(-3), lastResult: 'wrong' }),
    item({ moduleType: 'alphabet', userId: 'b', username: 'bob', dueAt: days(2), boxLevel: 2, lastResult: 'correct' }),
    item({ moduleType: null, userId: 'b', username: 'bob', dueAt: null, boxLevel: 4, lastResult: null }),
  ],
  NOW,
);
check('modules rank by size', g.byModule[0]?.moduleType === 'rapid' && g.byModule[0]?.total === 2, JSON.stringify(g.byModule));
check('a null module is grouped as unknown', g.byModule.some((m) => m.moduleType === 'unknown'));
check('users rank by overdue count', g.byUser[0]?.userId === 'a' && g.byUser[0]?.overdue === 2, JSON.stringify(g.byUser));
check('a non-overdue module reports zero overdue', g.byModule.find((m) => m.moduleType === 'alphabet')?.overdue === 0);
check('bands sum to the total', Object.values(g.byBand).reduce((a, b) => a + b, 0) === g.total);
check('results are grouped by value', g.byResult.some((r) => r.result === 'wrong' && r.count === 2), JSON.stringify(g.byResult));
check('a null last_result is grouped as unknown', g.byResult.some((r) => r.result === 'unknown' && r.count === 1), JSON.stringify(g.byResult));
check('result groups sum to the total', g.byResult.reduce((a, b) => a + b.count, 0) === g.total);

console.log('\n=== 5. THE DASHBOARD SUMMARY ===');
// `summariseDue` is what the Dashboard renders, and `buildTotals` delegates to
// it for the same figures. These cases pin BOTH: the direct call, and the
// agreement between the two, which is the property that actually matters — two
// copies of "what counts as stale" is how an overview and a detail view start
// quietly disagreeing.
const mix = decorate([
  item({ moduleType: 'rapid', itemKey: 'alpha-one', username: 'ann', userId: 'a' }),
  item({ moduleType: 'alphabet', itemKey: 'beta-two', username: 'bob', userId: 'b', dueAt: days(4), boxLevel: 2 }),
  item({ moduleType: 'rapid', itemKey: 'gamma-three', username: 'ann', userId: 'a' }),
]);

const dueOnly = summariseDue(rows.map((r) => r.dueAt), NOW);
check('an empty queue summarises to nothing', summariseDue([], NOW).total === 0);
check('an empty queue has no overdue items', summariseDue([], NOW).overdue === 0);
check('an empty queue has no stale items', summariseDue([], NOW).stale === 0);
check('an empty queue has no oldest due date', summariseDue([], NOW).oldestDue === null);
check('a null due date counts as total, not as overdue', summariseDue([null], NOW).total === 1 && summariseDue([null], NOW).overdue === 0);
check('a future date is total but not overdue', summariseDue([days(5)], NOW).overdue === 0);
check('a past date is overdue', summariseDue([days(-5)], NOW).overdue === 1);
// The whole point of the shared function: the Dashboard's four figures and the
// full aggregation must be the SAME numbers, not two implementations that agree
// today.
check('summariseDue agrees with buildTotals on total', dueOnly.total === buildTotals(rows, NOW).total, `${dueOnly.total} vs ${buildTotals(rows, NOW).total}`);
check('summariseDue agrees with buildTotals on overdue', dueOnly.overdue === buildTotals(rows, NOW).overdue);
check('summariseDue agrees with buildTotals on stale', dueOnly.stale === buildTotals(rows, NOW).stale);
check('summariseDue agrees with buildTotals on oldest', dueOnly.oldestDue === buildTotals(rows, NOW).oldestDue);
check('the oldest due date is the furthest past', summariseDue([days(-2), days(-40), days(1)], NOW).oldestDue === days(-40).slice(0, 10), String(summariseDue([days(-2), days(-40), days(1)], NOW).oldestDue));
check('stale is over 30 days late', summariseDue([days(-31)], NOW).stale === 1);
check('not-yet-stale is not counted stale', summariseDue([days(-30)], NOW).stale === 0);

console.log('\n=== 6. CSV ===');
check('a plain value is unquoted', csvCell('hello') === 'hello');
check('null becomes an empty cell', csvCell(null) === '');
check('undefined becomes an empty cell', csvCell(undefined) === '');
check('a comma forces quoting', csvCell('a,b') === '"a,b"');
check('a quote is doubled inside quotes', csvCell('say "hi"') === '"say ""hi"""');
check('a newline forces quoting', csvCell('a\nb') === '"a\nb"');
// Formula injection: an exported cell beginning with = would EXECUTE when the
// CSV is opened in a spreadsheet, and item answers are user-authored.
check('a leading = is neutralised', csvCell('=1+1') === "'=1+1");
check('a leading + is neutralised', csvCell('+1') === "'+1");
check('a leading - is neutralised', csvCell('-1') === "'-1");
check('a leading @ is neutralised', csvCell('@x') === "'@x");

const csv = toCsv(mix);
const lines = csv.split('\n');
check('the header is present', lines[0].startsWith('item_key,module_type,user'), lines[0]);
check('one line per row plus the header', lines.length === mix.length + 1, String(lines.length));
check('an empty queue still exports a header', toCsv([]).split('\n').length === 1);

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
