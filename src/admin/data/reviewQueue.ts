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
 * The Dashboard's four queue figures, counted in the database.
 *
 * This was `.select('due_at').limit(20000)` with NO `.order()` and no count,
 * which is not a slow query but an UNDEFINED one: PostgREST returns an
 * unspecified subset, so the backlog changed between two reloads of an unchanged
 * database and the totals were whatever happened to arrive.
 *
 * It also now REFUSES. RLS can only exclude rows, so a non-admin previously got
 * `total: 0` — a Dashboard figure that reads as "the backlog is empty" rather
 * than "you may not see this". A `SECURITY DEFINER` function can raise.
 */
export async function fetchQueueKpis(): Promise<{
  kpis: DueSummary | null;
  error: string | null;
}> {
  const outcome = await callAdminRpc<
    { totals: { total: number; overdue: number; stale: number; oldestDue: string | null } }[]
  >(supabase, 'admin_review_queue_page', QUEUE_RPC_ARGS(1));

  if (outcome.kind === 'absent') {
    // The RPC is not deployed. The old read was `.select('due_at').limit(20000)`
    // with no order and no count — a nondeterministic subset whose totals were
    // whatever happened to arrive. It is the fallback, and it says so.
    const legacy = await fetchQueueKpisLegacy();
    return { ...legacy, error: `${LEGACY_PATH_NOTICE} (${legacy.error})` };
  }
  if (outcome.kind !== 'ok') {
    return { kpis: null, error: `admin_review_queue_page: ${outcome.message}` };
  }

  const row = (outcome.data as { totals: { total: number; overdue: number; stale: number; oldestDue: string | null } }[] | null)?.[0];
  if (!row?.totals) return { kpis: null, error: 'admin_review_queue_page returned no totals' };

  const t = row.totals;
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    kpis: {
      total: num(t.total),
      overdue: num(t.overdue),
      // NOT aliased to `overdue`. "Stale" means overdue by more than
      // `STALE_AFTER_DAYS` (30) — a much smaller and much more alarming number
      // than "overdue". Reporting one as the other turns a real backlog into a
      // thirtyfold overstatement.
      stale: num(t.stale),
      oldestDue: t.oldestDue ?? null,
    },
    error: null,
  };
}

/** The previous read, kept as a fallback. Bounded, and reports the bound. */
async function fetchQueueKpisLegacy(): Promise<{ kpis: DueSummary | null; error: string | null }> {
  const { data, error } = await supabase.from('review_queue').select('due_at').limit(20_000);
  if (error) return { kpis: null, error: `review_queue: ${error.message}` };
  const dueAts = ((data ?? []) as unknown as Array<{ due_at: string | null }>).map((r) => r.due_at);
  return { kpis: summariseDue(dueAts, new Date()), error: null };
}

/** The RPC's argument shape, so the two call sites cannot drift apart. */
const QUEUE_RPC_ARGS = (limit: number) => ({
  p_search: '',
  p_module: '',
  p_box: null,
  p_overdue_only: false,
  p_limit: limit,
  p_cursor_due: null,
  p_cursor_id: null,
});

/** A keyset cursor into the queue. */
export interface QueueCursor {
  dueAt: string;
  id: string;
}

/** The page size the queue asks for. The RPC clamps to 500. */
export const QUEUE_PAGE_SIZE = 100;

/**
 * ONE page of the work queue, most-overdue first, filtered in the database.
 *
 * Ascending `due_at`, because this is a work queue and the most overdue item is
 * the one an admin is looking for. The `id` tiebreak is mandatory — `due_at` is
 * not unique, and a cursor without one silently skips and repeats rows.
 *
 * ── KNOWN GAP, STATED ────────────────────────────────────────────────────────
 * `buildTotals` also produces `byModule`, `byUser` and `byBand` breakdowns, and
 * those need the WHOLE set rather than a page — so they are not served here.
 * They still work for any caller holding a full item list, and adding them is a
 * follow-up aggregate column on the RPC. What is deliberately NOT done is
 * computing them from the page, which would report a breakdown of the visible
 * slice as though it were the backlog.
 */
export async function fetchQueuePage(args: {
  search?: string;
  module?: string;
  box?: number | null;
  overdueOnly?: boolean;
  limit?: number;
  cursor?: QueueCursor | null;
} = {}): Promise<{
  items: (QueueItem & { due: DueState; overdueDays: number })[];
  total: number;
  errors: string[];
  nextCursor: QueueCursor | null;
}> {
  const outcome = await callAdminRpc<
    { items: QueueItem[]; total: number; next_cursor: QueueCursor | null }[]
  >(supabase, 'admin_review_queue_page', {
    p_search: args.search ?? '',
    p_module: args.module ?? '',
    p_box: args.box ?? null,
    p_overdue_only: args.overdueOnly ?? false,
    p_limit: args.limit ?? QUEUE_PAGE_SIZE,
    p_cursor_due: args.cursor?.dueAt ?? null,
    p_cursor_id: args.cursor?.id ?? null,
  });

  if (outcome.kind === 'absent') {
    // Fall back to the flat read, filtered in the browser, and report the cap.
    const legacy = await fetchQueueLegacy(args);
    return { ...legacy, errors: [LEGACY_PATH_NOTICE, ...legacy.errors] };
  }
  if (outcome.kind !== 'ok') {
    return { items: [], total: 0, errors: [`admin_review_queue_page: ${outcome.message}`], nextCursor: null };
  }

  const row = (outcome.data as { items: QueueItem[]; total: number; next_cursor: QueueCursor | null }[] | null)?.[0];
  const now = new Date();
  const items = (Array.isArray(row?.items) ? row.items : []).map((it) => ({
    ...it,
    due: dueState(it.dueAt, now),
    overdueDays: typeof it.dueAt === 'string'
      ? Math.max(0, Math.floor((now.getTime() - new Date(it.dueAt).getTime()) / 86_400_000))
      : 0,
  }));

  return {
    items,
    total: typeof row?.total === 'number' ? row.total : items.length,
    errors: [],
    nextCursor: row?.next_cursor ?? null,
  };
}

/** The previous flat read, kept as a fallback. */
async function fetchQueueLegacy(args: {
  search?: string;
  module?: string;
  box?: number | null;
  overdueOnly?: boolean;
  limit?: number;
}): Promise<{
  items: (QueueItem & { due: DueState; overdueDays: number })[];
  total: number;
  errors: string[];
  nextCursor: null;
}> {
  const errors: string[] = [];
  const now = new Date();
  const { data, error } = await supabase
    .from('review_queue')
    .select(
      'id, user_id, item_key, module_type, box, error_count, success_count, last_reviewed_at, due_at, created_at, user_answer, correct_answer, interval_days, last_result, box_level, error_tag',
    )
    .limit(20_000);
  if (error) {
    return { items: [], total: 0, errors: [`review_queue: ${error.message}`], nextCursor: null };
  }

  let rows = ((data ?? []) as unknown as QueueItem[]).map((it) => ({
    ...it,
    due: dueState(it.dueAt, now),
    overdueDays: typeof it.dueAt === 'string'
      ? Math.max(0, Math.floor((now.getTime() - new Date(it.dueAt).getTime()) / 86_400_000))
      : 0,
  }));

  if (args.module) rows = rows.filter((r) => r.moduleType === args.module);
  if (args.box != null) rows = rows.filter((r) => r.boxLevel === args.box);
  if (args.overdueOnly) rows = rows.filter((r) => r.due === 'overdue');
  if (args.search) {
    const needle = args.search.toLowerCase();
    rows = rows.filter(
      (r) =>
        (r.itemKey ?? '').toLowerCase().includes(needle) ||
        (r.userAnswer ?? '').toLowerCase().includes(needle),
    );
  }
  rows.sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''));

  return { items: rows, total: rows.length, errors, nextCursor: null };
}
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
import { callAdminRpc, LEGACY_PATH_NOTICE } from './rpc';

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
