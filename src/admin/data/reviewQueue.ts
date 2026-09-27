/**
 * src/admin/data/reviewQueue.ts
 *
 * The Review Queue read model — every queued item across every learner.
 *
 * ── SCOPE AFTER THE STANDALONE PAGE WAS REMOVED ─────────────────────────────
 * This used to back a dedicated `/review-queue` page. The page is gone; what
 * remains here is the part that outlived it:
 *
 *   summariseDue + fetchQueueKpis   the four figures the Dashboard shows
 *   buildTotals / QueueItem         the full aggregation, and the shape the
 *                                   CSV encoder is tested against
 *   toCsv                           consumed by `csv.check.ts` (see below)
 *
 * The per-user view a learner actually needs is `fetchUserDetail`, which reads
 * `review_queue` scoped to one user and is what the User 360 drawer shows.
 *
 * ── WHAT WAS DELETED, AND WHY IT WAS SAFE ────────────────────────────────────
 * `fetchReviewQueue()` selected 13 columns across up to 20 000 rows PLUS a second
 * 5 000-row `profiles` read, joined them, sorted by severity and decorated every
 * row — to render a filterable table. The Dashboard needs four scalars, so it now
 * reads one column through `fetchQueueKpis` instead. A full-table loader with a
 * username join on an overview page is a real cost for no informational gain.
 *
 * `filterQueue` / `QueueFilters` / `DEFAULT_QUEUE_FILTERS` went with the page
 * that used them. They were pure and tested, so their removal is covered by
 * deleting the matching section of `reviewQueue.check.ts` — not by leaving dead
 * code behind a green suite.
 *
 * ── `toCsv` IS DELIBERATELY KEPT ─────────────────────────────────────────────
 * It has no production caller any more. It is still imported by
 * `csv.check.ts`, a CI gate whose entire subject is "nothing an admin exports
 * can execute in a spreadsheet", and it is the most realistic fixture that
 * suite has for the shared encoder. Deleting an export to satisfy tidiness
 * would mean editing a security suite for cosmetic reasons, so it stays.
 *
 * ── REUSE, NOT DUPLICATION ─────────────────────────────────────────────────
 * The due-date and Leitner classification are the SAME pure functions the User
 * 360 drawer uses, imported rather than reimplemented. Two copies of "what does
 * overdue mean" is exactly how a dashboard and a drawer start disagreeing.
 */
import { supabase } from '../../lib/supabase';
import { csvLine } from './csv';
import { dueState, leitnerBand, type DueState, type LeitnerBand } from './userDetail';

export interface QueueItem {
  id: string;
  userId: string;
  /** Denormalised from `profiles` so the table can show a name without a join. */
  username: string | null;
  moduleType: string | null;
  itemKey: string | null;
  userAnswer: string | null;
  correctAnswer: string | null;
  errorCount: number | null;
  intervalDays: number | null;
  boxLevel: number | null;
  dueAt: string | null;
  updatedAt: string | null;
  errorTag: string | null;
  lastResult: string | null;
}

export interface QueueTotals {
  total: number;
  overdue: number;
  due: number;
  upcoming: number;
  scheduled: number;
  /** Overdue by 30+ days — the "stale debt" figure that needs a human. */
  stale: number;
  byModule: { moduleType: string; total: number; overdue: number }[];
  byUser: { userId: string; username: string | null; total: number; overdue: number }[];
  byBand: Record<LeitnerBand, number>;
  byResult: { result: string; count: number }[];
  /** Oldest `due_at` still outstanding, ISO date. */
  oldestDue: string | null;
}

export interface QueueResult {
  items: (QueueItem & { due: DueState; overdueDays: number })[];
  totals: QueueTotals;
  errors: string[];
}

/** Days past due, floored at 0. Null/unparseable → 0, never a fake large number. */
export function overdueDays(dueAt: string | null, now: Date): number {
  if (!dueAt) return 0;
  const t = new Date(dueAt).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}

/** An item is STALE once it is more than 30 days past due. */
export const STALE_AFTER_DAYS = 30;

/**
 * The four aggregate figures the Dashboard shows, derived from due dates alone.
 *
 * ── WHY IT IS SPLIT OUT ──────────────────────────────────────────────────────
 * `buildTotals` answers a research question — where is the debt and who owns it —
 * and needs every column: module, user, Leitner box, last result. The Dashboard
 * needs four SCALARS and would otherwise have to pull a 13-column, 20 000-row
 * read plus a 5 000-row `profiles` join to render four numbers on an overview
 * page that already loads six other aggregates.
 *
 * So this takes the one column it actually needs (`due_at`) and nothing else.
 *
 * `buildTotals` DELEGATES to it rather than reimplementing the arithmetic. Two
 * copies of "what counts as stale" is precisely how an overview page and a
 * detailed one start disagreeing, and nobody notices until the numbers differ.
 */
export interface DueSummary {
  total: number;
  overdue: number;
  /** Overdue by more than `STALE_AFTER_DAYS`. */
  stale: number;
  /** Oldest `due_at` still outstanding, ISO date, or null when nothing is. */
  oldestDue: string | null;
}

/**
 * Pure, clock-injected aggregation. Exported so the figures are testable without
 * a database — "49 of 50 are overdue and 30 are a month late" is a claim worth
 * being able to prove.
 */
export function summariseDue(dueAts: readonly (string | null)[], now: Date): DueSummary {
  let total = 0;
  let overdue = 0;
  let stale = 0;
  let oldest: number | null = null;

  for (const dueAt of dueAts) {
    total += 1;
    if (dueState(dueAt, now) !== 'overdue') continue;
    overdue += 1;
    if (overdueDays(dueAt, now) > STALE_AFTER_DAYS) stale += 1;
    const t = new Date(dueAt!).getTime();
    if (!Number.isNaN(t) && (oldest === null || t < oldest)) oldest = t;
  }

  return {
    total,
    overdue,
    stale,
    oldestDue: oldest === null ? null : new Date(oldest).toISOString().slice(0, 10),
  };
}

/**
 * Load only what the four Dashboard figures need.
 *
 * One column, one query, no join. Fails soft to `null` rather than throwing, and
 * the caller renders a muted em dash — the same contract as every other admin
 * read model, because a denied table must leave the page working.
 */
export async function fetchQueueKpis(): Promise<{
  kpis: DueSummary | null;
  error: string | null;
}> {
  const { data, error } = await supabase.from('review_queue').select('due_at').limit(20000);

  if (error) return { kpis: null, error: `review_queue: ${error.message}` };

  const dueAts = ((data ?? []) as unknown as Array<{ due_at: string | null }>).map(
    (r) => r.due_at,
  );
  return { kpis: summariseDue(dueAts, new Date()), error: null };
}

/**
 * Aggregate a flat item list into every figure the page shows.
 *
 * Pure, so the totals are testable without a database — and because "49 of 50
 * overdue" is a claim worth being able to prove.
 */
export function buildTotals(items: QueueItem[], now: Date): QueueTotals {
  const byModule = new Map<string, { total: number; overdue: number }>();
  const byUser = new Map<string, { username: string | null; total: number; overdue: number }>();
  const byBand: Record<LeitnerBand, number> = { new: 0, learning: 0, young: 0, mature: 0 };
  const byResult = new Map<string, number>();

  // The scalar figures are NOT recomputed here. `summariseDue` owns them so the
  // Dashboard and any future detail view cannot disagree about what "stale" or
  // "oldest" means.
  const due = summariseDue(items.map((it) => it.dueAt), now);
  let total = 0;
  let overdue = 0;
  let due2 = 0;
  let upcoming = 0;
  let scheduled = 0;

  for (const it of items) {
    total += 1;
    const state = dueState(it.dueAt, now);
    if (state === 'overdue') overdue += 1;
    else if (state === 'due') due2 += 1;
    else if (state === 'upcoming') upcoming += 1;
    else scheduled += 1;

    const m = it.moduleType ?? 'unknown';
    const mRow = byModule.get(m) ?? { total: 0, overdue: 0 };
    mRow.total += 1;
    if (state === 'overdue') mRow.overdue += 1;
    byModule.set(m, mRow);

    const uRow = byUser.get(it.userId) ?? { username: it.username, total: 0, overdue: 0 };
    uRow.total += 1;
    if (state === 'overdue') uRow.overdue += 1;
    byUser.set(it.userId, uRow);

    byBand[leitnerBand(it.boxLevel)] += 1;

    const r = it.lastResult ?? 'unknown';
    byResult.set(r, (byResult.get(r) ?? 0) + 1);
  }

  return {
    total,
    overdue,
    due: due2,
    upcoming,
    scheduled,
    stale: due.stale,
    byModule: [...byModule.entries()]
      .map(([moduleType, v]) => ({ moduleType, ...v }))
      .sort((a, b) => b.total - a.total || a.moduleType.localeCompare(b.moduleType)),
    byUser: [...byUser.entries()]
      .map(([userId, v]) => ({ userId, ...v }))
      .sort((a, b) => b.overdue - a.overdue || b.total - a.total || a.userId.localeCompare(b.userId)),
    byBand,
    byResult: [...byResult.entries()]
      .map(([result, count]) => ({ result, count }))
      .sort((a, b) => b.count - a.count || a.result.localeCompare(b.result)),
    oldestDue: due.oldestDue,
  };
}

/**
 * Re-exported from `./csv` so existing importers keep working while there is
 * exactly ONE implementation. Two divergent encoders is how a formula-injection
 * fix ends up applied to one export and not the other.
 */
export { csvCell, csvLine, csvDocument } from './csv';

export function toCsv(items: (QueueItem & { due: DueState; overdueDays: number })[]): string {
  const header = [
    'item_key', 'module_type', 'user', 'user_id', 'due_state', 'overdue_days',
    'due_at', 'box_level', 'interval_days', 'error_count', 'error_tag',
    'last_result', 'user_answer', 'correct_answer',
  ];
  const lines = [header.join(',')];
  for (const it of items) {
    lines.push(
      csvLine([
        it.itemKey, it.moduleType, it.username, it.userId, it.due, it.overdueDays,
        it.dueAt, it.boxLevel, it.intervalDays, it.errorCount, it.errorTag,
        it.lastResult, it.userAnswer, it.correctAnswer,
      ])
    );
  }
  return lines.join('\n');
}
