/**
 * src/admin/data/reviewQueue.ts
 *
 * The global Review Queue read model — every queued item across every learner.
 *
 * ── WHY THIS IS A SEPARATE READ, AND WHAT IT EXPOSES ───────────────────────
 * The Users table shows a per-user `queueSize` count. That count answers "does
 * this learner have a backlog?" but not "what is it, and is anyone clearing
 * it?" — and on the live database the answer was genuinely alarming:
 *
 *     49 of 50 queued items are OVERDUE, 30 of them by 30+ days,
 *     and only ONE item is still inside a future window.
 *
 * That is not a database fault — the Leitner transitions are demonstrably
 * correct (every `wrong` sits at box 1 / interval 1, every `correct` has
 * graduated to interval 3–7). It is uncollected review DEBT: the backlog grows
 * and nobody drains it. Surfacing that is the point of this page; a per-user
 * count hides it completely.
 *
 * ── REUSE, NOT DUPLICATION ─────────────────────────────────────────────────
 * The due-date and Leitner classification are the SAME pure functions the User
 * 360 drawer uses, imported rather than reimplemented. Two copies of "what does
 * overdue mean" is exactly how a dashboard and a drawer start disagreeing.
 */
import { supabase } from '../../lib/supabase';
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

  let total = 0;
  let overdue = 0;
  let due = 0;
  let upcoming = 0;
  let scheduled = 0;
  let stale = 0;
  let oldest: number | null = null;

  for (const it of items) {
    total += 1;
    const state = dueState(it.dueAt, now);
    if (state === 'overdue') overdue += 1;
    else if (state === 'due') due += 1;
    else if (state === 'upcoming') upcoming += 1;
    else scheduled += 1;

    if (state === 'overdue') {
      const late = overdueDays(it.dueAt, now);
      if (late > STALE_AFTER_DAYS) stale += 1;
      const t = new Date(it.dueAt!).getTime();
      if (!Number.isNaN(t) && (oldest === null || t < oldest)) oldest = t;
    }

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
    due,
    upcoming,
    scheduled,
    stale,
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
    oldestDue: oldest === null ? null : new Date(oldest).toISOString().slice(0, 10),
  };
}

export interface QueueFilters {
  search: string;
  module: string;
  user: string;
  due: 'all' | 'overdue' | 'due' | 'upcoming';
}

/**
 * Apply the page filters.
 *
 * Extracted as a pure function for the same reason `filterUsers` is: a table with
 * 50 rows today and thousands later should not re-read on every keystroke, and
 * the filter logic is the part that can quietly show the wrong rows.
 */
export function filterQueue(
  items: (QueueItem & { due: DueState; overdueDays: number })[],
  filters: QueueFilters,
): (QueueItem & { due: DueState; overdueDays: number })[] {
  const q = filters.search.trim().toLowerCase();
  return items.filter((it) => {
    if (filters.module !== 'all' && (it.moduleType ?? 'unknown') !== filters.module) return false;
    if (filters.user !== 'all' && it.userId !== filters.user) return false;
    if (filters.due !== 'all' && it.due !== filters.due) return false;
    if (!q) return true;
    // A single box searches the things an admin would actually type: the item
    // key, the module, the learner's name, or the id.
    return [it.itemKey, it.moduleType, it.username, it.userId, it.errorTag]
      .some((v) => (v ?? '').toLowerCase().includes(q));
  });
}

export const DEFAULT_QUEUE_FILTERS: QueueFilters = {
  search: '',
  module: 'all',
  user: 'all',
  due: 'all',
};

/** Escape a CSV cell. Leading `=`/`+`/`-`/`@` are prefixed so a value cannot
 *  be interpreted as a formula when the export is opened in a spreadsheet. */
export function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(items: (QueueItem & { due: DueState; overdueDays: number })[]): string {
  const header = [
    'item_key', 'module_type', 'user', 'user_id', 'due_state', 'overdue_days',
    'due_at', 'box_level', 'interval_days', 'error_count', 'error_tag',
    'last_result', 'user_answer', 'correct_answer',
  ];
  const lines = [header.join(',')];
  for (const it of items) {
    lines.push(
      [
        it.itemKey, it.moduleType, it.username, it.userId, it.due, it.overdueDays,
        it.dueAt, it.boxLevel, it.intervalDays, it.errorCount, it.errorTag,
        it.lastResult, it.userAnswer, it.correctAnswer,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\n');
}

/**
 * Load the whole queue with its owners denormalised.
 *
 * `review_queue` has no embeddable relation to `profiles` readable by the anon
 * key, so the usernames come from a second explicit read rather than a nested
 * select — a nested select would return NULL usernames silently here, and a
 * table of ids is much less useful to the person reading it.
 */
export async function fetchReviewQueue(): Promise<QueueResult> {
  const errors: string[] = [];
  const now = new Date();

  const [queue, profiles] = await Promise.all([
    supabase
      .from('review_queue')
      .select(
        'id, user_id, module_type, item_key, user_answer, correct_answer, error_count, interval_days, box_level, due_at, updated_at, error_tag, last_result',
      )
      .limit(20000),
    supabase.from('profiles').select('id, username').limit(5000),
  ]);

  if (queue.error) errors.push(`review_queue: ${queue.error.message}`);
  if (profiles.error) errors.push(`profiles: ${profiles.error.message}`);

  const nameBy = new Map((profiles.data ?? []).map((p) => [p.id as string, (p as { username: string | null }).username]));

  const items = ((queue.data ?? []) as unknown as Record<string, unknown>[]).map((r) => {
    const userId = String(r.user_id);
    return {
      id: String(r.id),
      userId,
      username: nameBy.get(userId) ?? null,
      moduleType: (r.module_type as string | null) ?? null,
      itemKey: (r.item_key as string | null) ?? null,
      userAnswer: (r.user_answer as string | null) ?? null,
      correctAnswer: (r.correct_answer as string | null) ?? null,
      errorCount: (r.error_count as number | null) ?? null,
      intervalDays: (r.interval_days as number | null) ?? null,
      boxLevel: (r.box_level as number | null) ?? null,
      dueAt: (r.due_at as string | null) ?? null,
      updatedAt: (r.updated_at as string | null) ?? null,
      errorTag: (r.error_tag as string | null) ?? null,
      lastResult: (r.last_result as string | null) ?? null,
    } satisfies QueueItem;
  });

  const decorated = items.map((it) => {
    const state = dueState(it.dueAt, now);
    return { ...it, due: state, overdueDays: state === 'overdue' ? overdueDays(it.dueAt, now) : 0 };
  });

  // Worst first: longest overdue, then most-missed. That is the order a human
  // would triage in, so the default view is already the useful one.
  const rank: Record<DueState, number> = { overdue: 0, due: 1, upcoming: 2, scheduled: 3 };
  decorated.sort((a, b) => {
    if (rank[a.due] !== rank[b.due]) return rank[a.due] - rank[b.due];
    if (a.overdueDays !== b.overdueDays) return b.overdueDays - a.overdueDays;
    const e = (b.errorCount ?? 0) - (a.errorCount ?? 0);
    if (e !== 0) return e;
    return (a.itemKey ?? '').localeCompare(b.itemKey ?? '');
  });

  return { items: decorated, totals: buildTotals(items, now), errors };
}
