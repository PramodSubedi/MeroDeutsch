/**
 * src/admin/data/users.ts
 *
 * Read model for the Users section.
 *
 * ── WHY THE HEADER USED TO EXPLAIN ONE QUERY PER TABLE ──────────────────────
 * It said a JOIN was impossible because PostgREST embeds need the `auth.users`
 * FK, which the anon key cannot read — and a nested select would return nothing
 * SILENTLY rather than error, which is the worst failure mode for an admin tool.
 *
 * That reasoning was correct for the BROWSER and is now obsolete. `admin_users_page`
 * runs with the service role, so it joins `user_xp`, `user_streaks` and
 * `a1_path_state` on `user_id` directly and aggregates `review_queue` in SQL. The
 * silent-nested-select hazard is gone because there are no nested selects at all.
 *
 * The principle it encoded has not: a read that fails quietly is worse than one
 * that fails loudly. That is now enforced by the RPC refusing a non-admin rather
 * than returning zero rows, which the browser could not do.
 *
 * ── WHAT IS DELIBERATELY ABSENT ────────────────────────────────────────────
 * `email`. Emails live in `auth.users`, unreadable with the anon key, so this
 * exposes the `username` column. Real addresses need a service-role Edge
 * Function; until then the id is the identifier.
 *
 * EVERY WRITE IS ABSENT BY DESIGN
 * `role`, `plan` and `banned_at` are guarded by `protect_profile_privilege()`
 * and `protect_profile_plan()` — a client write raises SQLSTATE 42501. These are
 * strictly read paths; ban / promote / grant-premium need an Edge Function.
 */
import { supabase } from '../../lib/supabase';
import { csvLine } from './csv';
import { lastActiveDay, windowStartIso } from './dayMath';
import { callAdminRpc, shouldFallBack, LEGACY_PATH_NOTICE } from './rpc';
import {
  facetCounts,
  matchesSearch,
  matchesStatus,
  sortUsers,
  type PlanFilter,
  type RoleFilter,
  type SortKey,
  type StatusFilter,
} from './filterUsers';

/** Per-user learning summary, assembled by `admin_users_page`. */
export interface AdminUserRow {
  id: string;
  username: string | null;
  fullName: string | null;
  plan: string | null;
  role: string | null;
  bannedAt: string | null;
  createdAt: string | null;
  /** Null when the learner has no row in that table. */
  totalXp: number | null;
  level: number | null;
  currentStreak: number | null;
  longestStreak: number | null;
  lastActivityDate: string | null;
  /** Distinct days with an activity row, and the most recent one. */
  activeDays: number | null;
  lastActiveAt: string | null;
  /** A1 spine progress, when the learner has started the campaign. */
  unlockedUnitIndex: number | null;
  pathMode: string | null;
  /** Open review-queue items — the "needs work" signal. */
  queueSize: number | null;
  queueErrors: number | null;
}

/** A page of users, plus the totals and facets that go with it. */
export interface UsersResult {
  rows: AdminUserRow[];
  errors: string[];
  /**
   * How many users matched, exactly. Server-side, so it is the real population
   * rather than "however many rows arrived" — which is what made "5,000 of
   * 5,000" a plausible-looking lie above a table that was quietly missing
   * everyone past the cap.
   */
  total: number;
  /** Chip counts, computed over the SEARCH result so the chips agree. */
  facets: UserFacets;
  /**
   * Cursor for the next page, or null when there is none.
   *
   * Present only for the chronological sort. The other four sorts return the top
   * N of the matching set instead — a deliberate product decision, argued in
   * the RPC's header: an admin sorting by XP wants "who are my highest-XP
   * learners", which is complete at the top, not page 7 of it.
   */
  nextCursor: UsersCursor | null;
  /**
   * True when the RPC is not deployed and this came from the legacy capped read.
   * Surfaced, because "capped at 5,000" and "exact" are different claims and the
   * operator should be able to tell which one they are looking at.
   */
  degraded: boolean;
  /**
   * Non-empty only on the legacy path. The RPCs return exact counts, so a capped
   * read is a state the data cannot be in once they are deployed.
   */
  truncated: { source: string; shown: number; total: number }[];
}

export interface UserFacets {
  total: number;
  searched: number;
  free: number;
  premium: number;
  admin: number;
  user: number;
  suspended: number;
}

export const EMPTY_USER_FACETS: UserFacets = {
  total: 0,
  searched: 0,
  free: 0,
  premium: 0,
  admin: 0,
  user: 0,
  suspended: 0,
};

/** A keyset cursor into the user list. */
export interface UsersCursor {
  createdAt: string;
  id: string;
}

/** The page size the table asks for. The RPC clamps to 200. */
export const USERS_PAGE_SIZE = 50;

/**
 * The ⌘K palette index cap.
 *
 * Deliberately separate from the page size and from any "total". The palette
 * searches IN MEMORY, so its ceiling is a real limit on what a browser can hold —
 * not a number the database should pretend to have. It is stated here rather
 * than discovered: the previous implementation was an unbounded read that
 * happened to stop at 5,000 with no indication of it anywhere.
 */
export const USERS_INDEX_CAP = 200;

/** The row `admin_users_page` returns. */
interface UsersRpcRow {
  rows: AdminUserRow[];
  total: number;
  facets: UserFacets;
  next_cursor: UsersCursor | null;
}

/**
 * ONE page of users, filtered, sorted and joined in the database.
 *
 * Two properties gained beyond speed:
 *
 *   · the total is EXACT, so "3,214 of 3,214" is a fact rather than a cap
 *   · a REFUSAL rather than zero rows. RLS can only exclude rows, so the old read
 *     handed a demoted or suspended admin `[]` with no error at all. A
 *     `SECURITY DEFINER` function can raise, and does.
 */
export async function fetchUsersPage(
  args: {
    search?: string;
    plan?: PlanFilter;
    role?: RoleFilter;
    status?: StatusFilter;
    sort?: SortKey;
    desc?: boolean;
    limit?: number;
    cursor?: UsersCursor | null;
  } = {},
): Promise<UsersResult> {
  const outcome = await callAdminRpc<UsersRpcRow[]>(supabase, 'admin_users_page', {
    p_search: args.search ?? '',
    p_plan: args.plan ?? 'all',
    p_role: args.role ?? 'all',
    p_status: args.status ?? 'all',
    p_sort: args.sort ?? 'createdAt',
    p_desc: args.desc ?? true,
    p_limit: args.limit ?? USERS_PAGE_SIZE,
    p_cursor_created_at: args.cursor?.createdAt ?? null,
    p_cursor_id: args.cursor?.id ?? null,
  });

  if (outcome.kind === 'ok') {
    const row = (outcome.data as UsersRpcRow[] | null)?.[0];
    return {
      rows: Array.isArray(row?.rows) ? row.rows : [],
      errors: [],
      total: typeof row?.total === 'number' ? row.total : 0,
      facets: row?.facets ?? EMPTY_USER_FACETS,
      nextCursor: row?.next_cursor ?? null,
      degraded: false,
      truncated: [],
    };
  }

  if (shouldFallBack(outcome)) {
    // The RPC migration is not applied. Fall back to the previous browser-side
    // path, and say so — it is capped, and a capped number should not be
    // presented as though it were exact.
    //
    // The cap is the SAME one the old page had. The difference is that it is now
    // disclosed: the old page rendered "5,000 of 5,000" with no error, which
    // read as complete and was not.
    const legacy = await fetchUsersLegacy(args);
    return { ...legacy, errors: [LEGACY_PATH_NOTICE, ...legacy.errors] };
  }

  return {
    rows: [],
    // A refusal is the RPC working. Falling back here would replace "you may not
    // see this" with an empty table — the exact silent failure the RPCs exist to
    // prevent.
    errors: [`admin_users_page: ${outcome.message}`],
    total: 0,
    facets: EMPTY_USER_FACETS,
    nextCursor: null,
    degraded: false,
    truncated: [],
  };
}

/**
 * The previous implementation: six capped reads, hand-joined in JavaScript.
 *
 * Kept as a fallback, and reachable ONLY when the RPC is absent. It is correct
 * but bounded, and `truncated` is what makes that bound visible.
 */
async function fetchUsersLegacy(args: {
  search?: string;
  plan?: PlanFilter;
  role?: RoleFilter;
  status?: StatusFilter;
  sort?: SortKey;
  desc?: boolean;
  limit?: number;
}): Promise<UsersResult> {
  const errors: string[] = [];
  const truncated: UsersResult['truncated'] = [];
  const CAP = 5_000;

  const [profiles, xp, streaks, activity, path, queue] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(CAP),
    supabase.from('user_xp').select('user_id, total_xp, level', { count: 'exact' }).limit(CAP),
    supabase
      .from('user_streaks')
      .select('user_id, current_streak, longest_streak, last_activity_date', { count: 'exact' })
      .limit(CAP),
    supabase
      .from('user_activity_days')
      .select('user_id, activity_date', { count: 'exact' })
      .order('activity_date', { ascending: true })
      .limit(200_000),
    supabase.from('a1_path_state').select('user_id, unlocked_unit_index, path_mode', { count: 'exact' }).limit(CAP),
    supabase.from('review_queue').select('user_id, error_count', { count: 'exact' }).limit(200_000),
  ]);

  if (profiles.error) errors.push(`profiles: ${profiles.error.message}`);
  if (xp.error) errors.push(`user_xp: ${xp.error.message}`);
  if (streaks.error) errors.push(`user_streaks: ${streaks.error.message}`);
  if (activity.error) errors.push(`user_activity_days: ${activity.error.message}`);
  if (path.error) errors.push(`a1_path_state: ${path.error.message}`);
  if (queue.error) errors.push(`review_queue: ${queue.error.message}`);

  const note = (source: string, res: { error: unknown; count: number | null; data: unknown[] | null }) => {
    if (res.error) return;
    const total = res.count ?? res.data?.length ?? 0;
    if (total > (res.data?.length ?? 0)) {
      truncated.push({ source, shown: res.data?.length ?? 0, total });
    }
  };
  note('profiles', profiles);
  note('user_xp', xp);
  note('user_streaks', streaks);
  note('user_activity_days', activity);
  note('a1_path_state', path);
  note('review_queue', queue);

  if (profiles.error || !profiles.data) {
    return { rows: [], errors, total: 0, facets: EMPTY_USER_FACETS, nextCursor: null, truncated, degraded: true };
  }

  const byUser = <T extends { user_id: string }>(rows: T[] | null): Map<string, T> => {
    const map = new Map<string, T>();
    for (const r of rows ?? []) map.set(r.user_id, r);
    return map;
  };
  const groupBy = <T extends { user_id: string }>(rows: T[] | null): Map<string, T[]> => {
    const map = new Map<string, T[]>();
    for (const row of rows ?? []) {
      const list = map.get(row.user_id);
      if (list) list.push(row);
      else map.set(row.user_id, [row]);
    }
    return map;
  };

  const xpBy = byUser(xp.data as unknown as { user_id: string; total_xp: number; level: number }[]);
  const streakBy = byUser(
    streaks.data as unknown as {
      user_id: string;
      current_streak: number;
      longest_streak: number;
      last_activity_date: string | null;
    }[],
  );
  const activityBy = groupBy(activity.data as unknown as { user_id: string; activity_date: string }[]);
  const pathBy = new Map(
    ((path.data ?? []) as unknown as { user_id: string; unlocked_unit_index: number; path_mode: string }[]).map(
      (r) => [r.user_id, r],
    ),
  );
  const queueBy = groupBy(queue.data as unknown as { user_id: string; error_count: number }[]);

  let rows: AdminUserRow[] = (profiles.data as Record<string, unknown>[]).map((p) => {
    const id = p.id as string;
    const xpRow = xpBy.get(id) as { total_xp: number; level: number } | undefined;
    const streakRow = streakBy.get(id) as
      | { current_streak: number; longest_streak: number; last_activity_date: string | null }
      | undefined;
    const days = (activityBy.get(id) ?? []).map((a) => (a as { activity_date: string }).activity_date).sort();
    const pathRow = pathBy.get(id) as { unlocked_unit_index: number; path_mode: string } | undefined;
    const queueRows = queueBy.get(id) ?? [];
    return {
      id,
      username: (p.username as string) ?? null,
      fullName: (p.full_name as string) ?? null,
      plan: (p.plan as string) ?? null,
      role: (p.role as string) ?? null,
      bannedAt: (p.banned_at as string) ?? null,
      createdAt: (p.created_at as string) ?? null,
      totalXp: xpRow ? xpRow.total_xp : null,
      level: xpRow ? xpRow.level : null,
      currentStreak: streakRow ? streakRow.current_streak : null,
      longestStreak: streakRow ? streakRow.longest_streak : null,
      lastActivityDate: streakRow ? streakRow.last_activity_date : null,
      activeDays: activityBy.has(id) ? days.length : null,
      lastActiveAt: lastActiveDay(days),
      unlockedUnitIndex: pathRow ? pathRow.unlocked_unit_index : null,
      pathMode: pathRow ? pathRow.path_mode : null,
      queueSize: queueBy.has(id) ? queueRows.length : null,
      queueErrors: queueBy.has(id)
        ? queueRows.reduce((sum, r) => sum + (r.error_count ?? 0), 0)
        : null,
    };
  });

  // Filter and sort in the browser, because that is what this path IS. The RPC
  // does it in the database; the fallback cannot and must not pretend to.
  const from = windowStartIso(7);
  const search = (args.search ?? '').trim().toLowerCase();
  rows = rows.filter((r) => {
    if (search !== '' && !matchesSearch(r, search)) return false;
    if ((args.plan ?? 'all') !== 'all' && (r.plan ?? 'free') !== args.plan) return false;
    if ((args.role ?? 'all') !== 'all' && (r.role ?? 'user') !== args.role) return false;
    const status = args.status ?? 'all';
    if (status === 'all') return true;
    if (status === 'suspended') return r.bannedAt !== null;
    if (r.bannedAt !== null) return false;
    return matchesStatus(r, status, from);
  });
  rows = sortUsers(rows, args.sort ?? 'createdAt', args.desc ?? true);

  // The legacy path has no keyset cursor. It returns a top-N and says so by
  // returning a null cursor, which the page renders as "All loaded" — a claim
  // that is true of the rows it holds, and about a cap it has disclosed.
  return {
    rows,
    errors,
    total: profiles.count ?? rows.length,
    facets: facetCounts(rows, args.search ?? ''),
    nextCursor: null,
    truncated,
    degraded: true,
  };
}

/**
 * The ⌘K palette index.
 *
 * A BOUNDED read, and it says so. The palette searches in memory, so its ceiling
 * is a real limit on what a browser holds — not a number the database should
 * pretend to have. `capped` lets the shell surface it.
 *
 * The honest consequence is unchanged and now explicit: a user past the cap
 * cannot be found by palette search. The route to them is the Users page, which
 * is server-filtered and therefore complete.
 */
export async function fetchUsersIndex(
  cap: number = USERS_INDEX_CAP,
): Promise<{ rows: AdminUserRow[]; capped: boolean }> {
  const outcome = await callAdminRpc<UsersRpcRow[]>(supabase, 'admin_users_page', {
    p_search: '',
    p_plan: 'all',
    p_role: 'all',
    p_status: 'all',
    p_sort: 'createdAt',
    p_desc: true,
    p_limit: Math.min(cap, 200),
    p_cursor_created_at: null,
    p_cursor_id: null,
  });
  if (outcome.kind === 'absent') {
    const legacy = await fetchUsersLegacy({ limit: cap });
    return { rows: legacy.rows.slice(0, cap), capped: legacy.truncated.length > 0 || legacy.rows.length >= cap };
  }
  if (outcome.kind !== 'ok') return { rows: [], capped: false };
  const row = (outcome.data as UsersRpcRow[] | null)?.[0];
  const rows = Array.isArray(row?.rows) ? row.rows : [];
  return { rows: rows.slice(0, cap), capped: (row?.total ?? 0) > rows.length };
}

/**
 * CSV export of the CURRENTLY FILTERED users.
 *
 * Two deliberate choices:
 *
 * 1. It exports the rows passed in, not the whole table. An admin who has
 *    filtered to "banned accounts" and then exports should get exactly that —
 *    exporting the unfiltered set because the function re-queried would be a
 *    quiet way to hand over data the operator did not ask for.
 *
 * 2. `full_name` is USER-SUPPLIED text and `username` may be too, so every cell
 *    goes through the shared encoder. A learner who signed up as
 *    `=HYPERLINK("http://evil","click")` would otherwise execute when the file
 *    is opened. Quoting alone does not prevent that; the leading apostrophe
 *    does.
 */
export function usersToCsv(rows: AdminUserRow[]): string {
  const header = [
    'id', 'username', 'full_name', 'plan', 'role', 'banned_at', 'created_at',
    'total_xp', 'level', 'current_streak', 'longest_streak', 'last_activity_date',
    'active_days', 'last_active_at', 'unlocked_unit_index', 'path_mode',
    'queue_size', 'queue_errors',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      csvLine([
        r.id,
        r.username,
        r.fullName,
        r.plan,
        r.role,
        r.bannedAt,
        r.createdAt,
        r.totalXp,
        r.level,
        r.currentStreak,
        r.longestStreak,
        r.lastActivityDate,
        r.activeDays,
        r.lastActiveAt,
        r.unlockedUnitIndex,
        r.pathMode,
        r.queueSize,
        r.queueErrors,
      ])
    );
  }
  return lines.join('\n');
}
