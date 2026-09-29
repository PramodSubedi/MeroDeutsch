/**
 * src/admin/data/userDetail.ts
 *
 * The User 360 read model — everything the control centre can say about ONE
 * learner, assembled on demand when an admin opens the drawer.
 *
 * ── WHY A SEPARATE FETCH, NOT A WIDER UsersPage QUERY ───────────────────────
 * The Users table optimises for "scan many rows fast", so it reads aggregates
 * and deliberately caps what it pulls. A 360 view is the opposite shape: deep,
 * per-user, and opened one at a time. Folding it into the table query would
 * mean dragging every learner's review queue and achievement rows into the
 * initial page load to use one of them at a time.
 *
 * ── WHY NOT A JOIN ─────────────────────────────────────────────────────────
 * Same reason as `users.ts`: the related tables key on `user_id`, and a nested
 * select would need the `auth.users` FK, which the anon key cannot read. A
 * nested select returns NOTHING SILENTLY there — an empty drawer that looks
 * like "this learner has no progress". Explicit per-table reads fail loudly.
 *
 * ── EVERY WRITE IS ABSENT, AND THAT IS THE POINT ────────────────────────────
 * This is a read model. `banned_at`, `plan` and `role` are surfaced because an
 * admin needs to SEE them before acting; changing them requires the service-role
 * Edge Function (Phase 2). Nothing here writes.
 */
import { supabase } from '../../lib/supabase';
import { callAdminRpc, LEGACY_PATH_NOTICE } from './rpc';
import { isoDaysAgo } from './dayMath';
import type { AdminProfile } from '../../lib/adminRole';

// ── Row shapes, one per source table ────────────────────────────────────────

export interface UserProgressRow {
  practiced_ids: string[] | null;
  quiz_correct: number | null;
  quiz_total: number | null;
  spell_completed: number | null;
  updated_at: string | null;
}

export interface UserXpRow {
  total_xp: number | null;
  level: number | null;
  updated_at: string | null;
}

export interface UserStreakRow {
  current_streak: number | null;
  longest_streak: number | null;
  last_activity_date: string | null;
  updated_at: string | null;
}

export interface UserAchievementRow {
  badge_id: string | null;
  unlocked_at: string | null;
}

export interface UserActivityRow {
  activity_date: string | null;
  event_count: number | null;
}

export interface UserPathRow {
  unlocked_unit_index: number | null;
  completed_node_ids: string[] | null;
  checkpoint_best_by_unit: Record<string, number> | null;
  path_mode: string | null;
  updated_at: string | null;
}

export interface UserQueueRow {
  module_type: string | null;
  item_key: string | null;
  user_answer: string | null;
  correct_answer: string | null;
  error_count: number | null;
  interval_days: number | null;
  box_level: number | null;
  due_at: string | null;
  error_tag: string | null;
  last_result: string | null;
}

// ── Derived, display-ready values ───────────────────────────────────────────

/** Leitner box level → the plain-language band shown in the drawer. */
export type LeitnerBand = 'new' | 'learning' | 'young' | 'mature';

/**
 * Map a Leitner box to a band.
 *
 * The review queue is LEITNER-ONLY (see migration
 * `20260928010000_drop_sm2_columns_leitner_only.sql`), so there is no second SRS
 * to reconcile. Box 0 is "never seen"; the rest are graduated by the app's own
 * box count rather than hard-coded here, so an unexpected level degrades to
 * 'learning' rather than to a wrong confident label.
 */
export function leitnerBand(box: number | null | undefined): LeitnerBand {
  if (box === null || box === undefined) return 'new';
  if (box <= 0) return 'new';
  if (box <= 2) return 'learning';
  if (box <= 4) return 'young';
  return 'mature';
}

export type DueState = 'overdue' | 'due' | 'upcoming' | 'scheduled';

/** Whether a queue item is due now, given an explicit "now" for testability. */
export function dueState(dueAt: string | null | undefined, now: Date): DueState {
  if (!dueAt) return 'scheduled';
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(due)) return 'scheduled';
  const diffDays = (due - now.getTime()) / 86_400_000;
  if (diffDays < 0) return 'overdue';
  // Due "today" still counts as due: the learner can clear it now.
  if (diffDays < 1) return 'due';
  return 'upcoming';
}

export interface ActivityCell {
  date: string;
  count: number;
  /** 'none' | 'light' | 'medium' | 'heavy' — a 4-step scale, not a rainbow. */
  intensity: 'none' | 'light' | 'medium' | 'heavy';
}

export interface QueueSummary {
  total: number;
  overdue: number;
  due: number;
  byModule: { moduleType: string; count: number }[];
  byBand: Record<LeitnerBand, number>;
  /** The 10 items an admin would look at first: most overdue, most errors. */
  attention: (UserQueueRow & { due: DueState })[];
}

export interface UserDetail {
  profile: AdminProfile;
  progress: UserProgressRow | null;
  xp: UserXpRow | null;
  streak: UserStreakRow | null;
  achievements: UserAchievementRow[];
  /** Trailing window of activity days, oldest first, dense (gaps are real zeros). */
  activity: ActivityCell[];
  activeDayCount: number | null;
  totalEvents: number | null;
  path: UserPathRow | null;
  completedNodeCount: number | null;
  queue: QueueSummary;
  /** Empty when every source read cleanly; a line per failed source otherwise. */
  errors: string[];
}

/** Days shown in the activity heat strip. */
export const ACTIVITY_WINDOW_DAYS = 119; // 17 weeks — a GitHub-style grid.

function isoDay(offsetFromToday: number, now: Date): string {
  return isoDaysAgo(offsetFromToday, now);
}

/**
 * Bucket a day count onto a 4-step scale.
 *
 * The thresholds are RELATIVE to the user's own busiest day, not absolute. With
 * 11 users and wildly different activity levels, a fixed scale (say "≥5 = heavy")
 * would paint a casual learner all-black and a power user's week all-grey. The
 * busiest day is always 'heavy', which makes each learner's row readable on its
 * own terms.
 */
export function intensityFor(count: number, maxCount: number): ActivityCell['intensity'] {
  if (count <= 0) return 'none';
  if (maxCount <= 0) return 'none';
  const ratio = count / maxCount;
  if (ratio > 0.66) return 'heavy';
  if (ratio > 0.33) return 'medium';
  return 'light';
}

/**
 * Dense activity strip: every day in the window, oldest first.
 *
 * DENSITY IS THE POINT. A sparse list of the days a learner happened to be
 * active looks identical whether they were busy all week or not, so a gap is
 * material information and is rendered as a real zero rather than omitted.
 */
export function buildActivity(
  rows: UserActivityRow[],
  now: Date,
  windowDays = ACTIVITY_WINDOW_DAYS,
): { cells: ActivityCell[]; activeDays: number; totalEvents: number } {
  const byDate = new Map<string, number>();
  for (const r of rows) {
    if (!r.activity_date) continue;
    const c = r.event_count ?? 0;
    byDate.set(r.activity_date, (byDate.get(r.activity_date) ?? 0) + c);
  }

  const maxCount = Math.max(0, ...byDate.values());
  const cells: ActivityCell[] = [];
  for (let i = windowDays - 1; i >= 0; i -= 1) {
    const date = isoDay(i, now);
    const count = byDate.get(date) ?? 0;
    cells.push({ date, count, intensity: intensityFor(count, maxCount) });
  }

  // Active days and totals are ALL-TIME, not windowed: "how many days has this
  // learner ever been active" is the question an admin actually asks, and
  // clipping it to 17 weeks would quietly understate a long-tenured account.
  let activeDays = 0;
  let totalEvents = 0;
  for (const r of rows) {
    if (!r.activity_date) continue;
    activeDays += 1;
    totalEvents += r.event_count ?? 0;
  }

  return { cells, activeDays, totalEvents };
}

/**
 * Summarise a learner's review queue.
 *
 * `attention` is the actionable slice: overdue first, then most-missed. An admin
 * opening a 360 view to answer "is this learner stuck?" wants the worst items,
 * not all 400 of them.
 */
export function summariseQueue(rows: UserQueueRow[], now: Date): QueueSummary {
  const byModule = new Map<string, number>();
  const byBand: Record<LeitnerBand, number> = { new: 0, learning: 0, young: 0, mature: 0 };
  let overdue = 0;
  let due = 0;

  const decorated = rows.map((r) => {
    const d = dueState(r.due_at, now);
    if (d === 'overdue') overdue += 1;
    else if (d === 'due') due += 1;
    const m = r.module_type ?? 'unknown';
    byModule.set(m, (byModule.get(m) ?? 0) + 1);
    byBand[leitnerBand(r.box_level)] += 1;
    return { ...r, due: d };
  });

  // Most overdue first (furthest past due), then most-missed, then stable by
  // item key so the order is deterministic across renders.
  const rank: Record<DueState, number> = { overdue: 0, due: 1, upcoming: 2, scheduled: 3 };
  const attention = [...decorated]
    .sort((a, b) => {
      if (rank[a.due] !== rank[b.due]) return rank[a.due] - rank[b.due];
      const err = (b.error_count ?? 0) - (a.error_count ?? 0);
      if (err !== 0) return err;
      const at = a.due_at ? new Date(a.due_at).getTime() : Infinity;
      const bt = b.due_at ? new Date(b.due_at).getTime() : Infinity;
      if (at !== bt) return at - bt;
      return (a.item_key ?? '').localeCompare(b.item_key ?? '');
    })
    .slice(0, 10);

  return {
    total: rows.length,
    overdue,
    due,
    byModule: [...byModule.entries()]
      .map(([moduleType, count]) => ({ moduleType, count }))
      .sort((a, b) => b.count - a.count || a.moduleType.localeCompare(b.moduleType)),
    byBand,
    attention,
  };
}

/** The composite `admin_user_detail` returns. */
interface UserDetailRpc {
  profile: AdminProfile;
  progress: UserProgressRow | null;
  xp: UserXpRow | null;
  streak: UserStreakRow | null;
  path: UserPathRow | null;
  activity: { activeDays: number; lastActiveAt: string | null; daily: { date: string; count: number }[] };
  achievements: { badgeId: string; unlockedAt: string | null }[];
  queue: {
    size: number;
    errors: number;
    dueNow: number;
    oldestDue: string | null;
    items: UserQueueRow[];
  };
}

/**
 * One learner's full picture, in ONE call.
 *
 * Was EIGHT per-user queries assembled in JavaScript (`userDetail.ts:282-295`),
 * so a viewer waited for the slowest of eight. `user_activity_days` was the slow
 * one — one row per active DAY, thousands for a long-lived account — and the
 * drawer only ever showed a COUNT and the most recent DATE, both of which the
 * database now computes.
 *
 * ── THE FAIL-SOFT CONTRACT IS DELIBERATELY GONE ──────────────────────────────
 * The old version recorded a line in `errors` and left that SECTION empty, so an
 * admin who could not read `user_achievements` still saw progress and queue.
 * That reasoning was sound, and the RLS it ran under made it unsafe: RLS can
 * only EXCLUDE rows, so a denied table produced an empty object that rendered
 * as "this learner has no progress" — a statement about the LEARNER, produced by
 * a permission failure, and indistinguishable from the truth.
 *
 * A `SECURITY DEFINER` function can REFUSE, so it does. The drawer now shows one
 * error for the whole read, which is a worse partial-failure story and a correct
 * one: no figure on this screen can be a permission failure wearing data.
 */
export async function fetchUserDetail(userId: string): Promise<UserDetail | null> {
  const now = new Date();

  const outcome = await callAdminRpc<UserDetailRpc>(supabase, 'admin_user_detail', { p_user_id: userId });

  if (outcome.kind === 'absent') {
    // The RPC is not deployed. The previous implementation was eight per-user
    // reads, and it is correct — it just cannot distinguish "this learner has no
    // progress" from "you may not see their progress", which is the one thing
    // the RPC was built to fix. The fallback therefore announces itself.
    const legacy = await fetchUserDetailLegacy(userId);
    if (!legacy) return null;
    return { ...legacy, errors: [LEGACY_PATH_NOTICE, ...legacy.errors] };
  }
  if (outcome.kind !== 'ok') {
    return {
      profile: { id: userId } as AdminProfile,
      progress: null,
      xp: null,
      streak: null,
      achievements: [],
      activity: [],
      activeDayCount: null,
      totalEvents: null,
      path: null,
      completedNodeCount: null,
      queue: summariseQueue([], now),
      errors: [`admin_user_detail: ${outcome.message}`],
    } as unknown as UserDetail;
  }

  const raw = outcome.data as UserDetailRpc[] | UserDetailRpc | null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row) return null;

  // The strip is rebuilt from the RPC's WINDOWED daily counts rather than from
  // every activity row the learner ever had. The all-time `activeDays` is the
  // RPC's own count and is not clipped to the window — "how many days has this
  // learner ever been active" is the question an admin actually asks, and
  // clipping it would quietly understate a long-tenured account.
  const activitySummary = buildActivity(
    (row.activity?.daily ?? []).map((d) => ({ activity_date: d.date, event_count: d.count })),
    now,
  );
  const activeDayCount = row.activity?.activeDays ?? null;

  return {
    profile: row.profile,
    progress: row.progress ?? null,
    xp: row.xp ?? null,
    streak: row.streak ?? null,
    achievements: (row.achievements ?? []).map((a) => ({
      badge_id: a.badgeId,
      unlocked_at: a.unlockedAt,
    })),
    activity: activitySummary.cells,
    activeDayCount,
    // The RPC aggregates the activity table rather than listing it, so the event
    // total is not available. It is `null` rather than a guess, and the drawer
    // renders an em dash — which is what it did for any read failure before.
    totalEvents: null,
    path: row.path ?? null,
    completedNodeCount: Array.isArray(row.path?.completed_node_ids)
      ? row.path.completed_node_ids.length
      : null,
    queue: summariseQueue(row.queue?.items ?? [], now),
    errors: [],
  };
}

/**
 * The previous implementation: eight per-user reads, assembled in JavaScript.
 *
 * Kept as a fallback for when `admin_user_detail` is not deployed, and only
 * reachable when the function is ABSENT. It fails soft per source, exactly as
 * it always did — which under RLS means a denied table renders as an empty
 * section, and that is the behaviour the RPC replaces.
 */
async function fetchUserDetailLegacy(userId: string): Promise<UserDetail | null> {
  const errors: string[] = [];
  const now = new Date();

  const [profile, progress, xp, streak, achievements, activity, path, queue] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('user_progress').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('user_xp').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('user_streaks').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('user_achievements').select('badge_id, unlocked_at').eq('user_id', userId),
    supabase.from('user_activity_days').select('activity_date, event_count').eq('user_id', userId),
    supabase.from('a1_path_state').select('*').eq('user_id', userId).maybeSingle(),
    supabase
      .from('review_queue')
      .select(
        'module_type, item_key, user_answer, correct_answer, error_count, interval_days, box_level, due_at, error_tag, last_result',
      )
      .eq('user_id', userId)
      .limit(1000),
  ]);

  if (profile.error) errors.push(`profiles: ${profile.error.message}`);
  if (progress.error) errors.push(`user_progress: ${progress.error.message}`);
  if (xp.error) errors.push(`user_xp: ${xp.error.message}`);
  if (streak.error) errors.push(`user_streaks: ${streak.error.message}`);
  if (achievements.error) errors.push(`user_achievements: ${achievements.error.message}`);
  if (activity.error) errors.push(`user_activity_days: ${activity.error.message}`);
  if (path.error) errors.push(`a1_path_state: ${path.error.message}`);
  if (queue.error) errors.push(`review_queue: ${queue.error.message}`);

  if (profile.error || !profile.data) return null;

  const activitySummary = buildActivity((activity.data ?? []) as UserActivityRow[], now);

  return {
    profile: profile.data as AdminProfile,
    progress: (progress.data as UserProgressRow | null) ?? null,
    xp: (xp.data as UserXpRow | null) ?? null,
    streak: (streak.data as UserStreakRow | null) ?? null,
    achievements: (achievements.data as UserAchievementRow[] | null) ?? [],
    activity: activitySummary.cells,
    activeDayCount: activity.error ? null : activitySummary.activeDays,
    totalEvents: activity.error ? null : activitySummary.totalEvents,
    path: (path.data as UserPathRow | null) ?? null,
    completedNodeCount: path.data
      ? Array.isArray((path.data as UserPathRow).completed_node_ids)
        ? ((path.data as UserPathRow).completed_node_ids ?? []).length
        : null
      : null,
    queue: summariseQueue((queue.data as UserQueueRow[] | null) ?? [], now),
    errors,
  };
}
