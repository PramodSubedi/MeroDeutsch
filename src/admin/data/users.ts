/**
 * src/admin/data/users.ts
 *
 * Read model for the Users section.
 *
 * ── WHY ONE QUERY PER TABLE AND NOT A JOIN ─────────────────────────────────
 * PostgREST embeds related rows with `select('*, other(*)')`, but these tables
 * are keyed on `user_id` and an embed would need the `auth.users` FK — which the
 * anon key cannot read. A nested select would therefore return nothing SILENTLY
 * rather than error, which is the worst failure mode for an admin tool: an empty
 * table that looks like "no users".
 *
 * Explicit per-table reads fail loudly instead, and each table is tiny (the
 * largest is 50 rows).
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
import type { AdminProfile } from '../../lib/adminRole';

const ADMIN_USER_COLUMNS =
  'id, username, full_name, plan, role, banned_at, created_at, avatar_url, language_preference';

/** Per-user learning summary, assembled from the six user-scoped tables. */
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

export interface UsersResult {
  rows: AdminUserRow[];
  errors: string[];
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

/** Group a `{ user_id, ... }` table into a Map for O(1) per-user lookup. */
function groupBy<T extends { user_id: string }>(rows: T[] | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows ?? []) {
    const list = map.get(row.user_id);
    if (list) list.push(row);
    else map.set(row.user_id, [row]);
  }
  return map;
}

/**
 * Load every user with their learning summary.
 *
 * Fails soft per source: a denied or missing table leaves that COLUMN null for
 * everyone and adds a line to `errors`, rather than blanking the table. An admin
 * seeing "XP: unknown" can still act; an admin seeing a blank table cannot.
 */
export async function fetchUsers(): Promise<UsersResult> {
  const errors: string[] = [];

  const [profiles, xp, streaks, activity, path, queue] = await Promise.all([
    supabase.from('profiles').select(ADMIN_USER_COLUMNS).limit(5000),
    supabase.from('user_xp').select('user_id, total_xp, level').limit(5000),
    supabase
      .from('user_streaks')
      .select('user_id, current_streak, longest_streak, last_activity_date')
      .limit(5000),
    supabase.from('user_activity_days').select('user_id, activity_date').limit(20000),
    supabase.from('a1_path_state').select('user_id, unlocked_unit_index, path_mode').limit(5000),
    supabase.from('review_queue').select('user_id, error_count').limit(20000),
  ]);

  if (profiles.error) errors.push(`profiles: ${profiles.error.message}`);
  if (xp.error) errors.push(`user_xp: ${xp.error.message}`);
  if (streaks.error) errors.push(`user_streaks: ${streaks.error.message}`);
  if (activity.error) errors.push(`user_activity_days: ${activity.error.message}`);
  if (path.error) errors.push(`a1_path_state: ${path.error.message}`);
  if (queue.error) errors.push(`review_queue: ${queue.error.message}`);

  // No profiles means no identity to hang anything on, so there is nothing to
  // show regardless of the other tables.
  if (profiles.error || !profiles.data) {
    return { rows: [], errors };
  }

  const xpBy = groupBy(xp.data);
  const streakBy = groupBy(streaks.data);
  const activityBy = groupBy(activity.data);
  const pathBy = new Map((path.data ?? []).map((r) => [r.user_id, r]));
  const queueBy = groupBy(queue.data);

  const rows: AdminUserRow[] = (profiles.data as AdminProfile[]).map((p) => {
    const xpRow = xpBy.get(p.id)?.[0];
    const streakRow = streakBy.get(p.id)?.[0];
    const days = (activityBy.get(p.id) ?? []).map((a) => a.activity_date).sort();
    const pathRow = pathBy.get(p.id);
    const queueRows = queueBy.get(p.id) ?? [];

    return {
      id: p.id,
      username: p.username,
      fullName: p.full_name,
      plan: p.plan,
      role: p.role,
      bannedAt: p.banned_at,
      createdAt: p.created_at,
      totalXp: xpRow ? xpRow.total_xp : null,
      level: xpRow ? xpRow.level : null,
      currentStreak: streakRow ? streakRow.current_streak : null,
      longestStreak: streakRow ? streakRow.longest_streak : null,
      lastActivityDate: streakRow ? streakRow.last_activity_date : null,
      activeDays: activityBy.has(p.id) ? days.length : null,
      lastActiveAt: days.length ? days[days.length - 1] : null,
      unlockedUnitIndex: pathRow ? pathRow.unlocked_unit_index : null,
      pathMode: pathRow ? pathRow.path_mode : null,
      queueSize: queueBy.has(p.id) ? queueRows.length : null,
      queueErrors: queueBy.has(p.id)
        ? queueRows.reduce((sum, r) => sum + (r.error_count ?? 0), 0)
        : null,
    };
  });

  // Newest accounts first: the most likely thing an admin is looking for.
  rows.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  return { rows, errors };
}
