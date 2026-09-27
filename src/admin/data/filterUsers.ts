/**
 * src/admin/data/filterUsers.ts
 *
 * Pure search / filter / sort for the Users table.
 *
 * SEPARATED FROM THE COMPONENT ON PURPOSE
 * This is where the table's behaviour actually lives, and it is the part most
 * likely to be wrong in a way that is invisible until it matters — a filter that
 * silently matches nothing, a search that misses a username, a sort that puts
 * nulls in the wrong place. As pure functions over plain objects it is directly
 * testable with `tsx` and no DOM, which is the same trick `debugMode.check.ts`
 * uses.
 */

import type { AdminUserRow } from './users';

export type PlanFilter = 'all' | 'free' | 'premium';
export type RoleFilter = 'all' | 'user' | 'admin';
export type StatusFilter = 'all' | 'active' | 'idle' | 'suspended';
export type SortKey = 'createdAt' | 'username' | 'xp' | 'streak' | 'unit';

export interface UserFilters {
  search: string;
  plan: PlanFilter;
  role: RoleFilter;
  status: StatusFilter;
  sort: SortKey;
  desc: boolean;
}

export const DEFAULT_FILTERS: UserFilters = {
  search: '',
  plan: 'all',
  role: 'all',
  status: 'all',
  sort: 'createdAt',
  desc: true,
};

/** A learner is "active" if they touched the app in the last 7 days. */
const ACTIVE_WINDOW_DAYS = 7;

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Match the search box.
 *
 * Deliberately searches the id as well as the name. Admins routinely arrive
 * with a uuid copied from a support email, and a table that cannot find a user
 * by the only identifier they were given is worse than useless.
 */
export function matchesSearch(row: AdminUserRow, rawSearch: string): boolean {
  const search = rawSearch.trim().toLowerCase();
  if (search === '') return true;
  if (
    (row.username ?? '').toLowerCase().includes(search) ||
    (row.fullName ?? '').toLowerCase().includes(search)
  ) {
    return true;
  }
  // PREFIX match on the id, not `includes`. A real uuid is 36 characters, so an
  // `includes` test could only ever match if the admin pasted the whole thing —
  // which defeats the point of searching by id at all. Admins read the first few
  // characters off a support email, so the first 3+ characters must match.
  return row.id.toLowerCase().startsWith(search);
}

/**
 * Was the learner active on or after `from`?
 *
 * Dates are `YYYY-MM-DD`, which compare correctly as STRINGS — but only for
 * values in the same format. The earlier version used `lastActiveAt >= now`
 * where `now` was "7 days ago", which is an UPPER bound: it asked "active in the
 * last week?" by asking "active on or after the week-old date", and so counted
 * everyone as idle. The comparison has to run the other way.
 */
export function isActiveSince(lastActiveAt: string | null, from: string): boolean {
  if (!lastActiveAt) return false;
  return lastActiveAt >= from;
}

export function matchesPlan(row: AdminUserRow, plan: PlanFilter): boolean {
  return plan === 'all' || (row.plan ?? 'free') === plan;
}

export function matchesRole(row: AdminUserRow, role: RoleFilter): boolean {
  return role === 'all' || (row.role ?? 'user') === role;
}

export function matchesStatus(row: AdminUserRow, status: StatusFilter, from: string): boolean {
  if (status === 'all') return true;
  if (status === 'suspended') return row.bannedAt !== null;
  // A suspended user is neither active nor idle: the row is already flagged, and
  // counting them as "idle" would imply they need a nudge rather than a decision.
  if (row.bannedAt !== null) return false;
  const active = isActiveSince(row.lastActiveAt, from);
  return status === 'active' ? active : !active;
}

/**
 * Compare two possibly-null values, keeping NULLs at the BOTTOM.
 *
 * The returned sign is the "nulls last" ordering, INDEPENDENT of sort direction.
 * That separation is the whole point: an earlier version multiplied this result
 * by ±1 to get descending order, which also flipped the null ordering and put
 * every missing value at the TOP of a descending column — burying the real data
 * under a wall of blanks. Direction is applied to the VALUE comparison only.
 */
export function compareNullableInternal(
  a: number | string | null,
  b: number | string | null
): number {
  // An absent value is "no data", never the most interesting thing in a column.
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function valueFor(row: AdminUserRow, key: SortKey): number | string | null {
  switch (key) {
    case 'username':
      return (row.username ?? row.fullName ?? '').toLowerCase();
    case 'xp':
      return row.totalXp;
    case 'streak':
      return row.currentStreak;
    case 'unit':
      return row.unlockedUnitIndex;
    case 'createdAt':
    default:
      return row.createdAt;
  }
}

/**
 * Sort by a column, keeping NULLs at the bottom in BOTH directions.
 *
 * The direction is applied ONLY when both values are present, so flipping the
 * sort can never move a missing value to the top. (Multiplying the comparator's
 * sign by -1 — the obvious implementation — does exactly that, and buries real
 * data under blanks on every descending sort.)
 */
export function sortUsers(rows: AdminUserRow[], sort: SortKey, desc: boolean): AdminUserRow[] {
  const direction = desc ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = valueFor(a, sort);
    const bv = valueFor(b, sort);
    if (av === null || bv === null) {
      // At least one is missing: the nulls-last rule decides, un-directional.
      return compareNullableInternal(av, bv);
    }
    return compareNullableInternal(av, bv) * direction;
  });
}

export interface ApplyResult {
  rows: AdminUserRow[];
  /** The set of ids that survived the filters — drives row selection. */
  matchedIds: Set<string>;
}

/** Search + facet filters, without sorting. Sorting is applied afterwards. */
export function filterUsers(
  rows: AdminUserRow[],
  filters: UserFilters,
  from: string = daysAgo(ACTIVE_WINDOW_DAYS)
): ApplyResult {
  const matched = rows.filter(
    (row) =>
      matchesSearch(row, filters.search) &&
      matchesPlan(row, filters.plan) &&
      matchesRole(row, filters.role) &&
      matchesStatus(row, filters.status, from)
  );
  return { rows: matched, matchedIds: new Set(matched.map((r) => r.id)) };
}

/** Counts per facet value, computed over the SEARCH result so the chips agree. */
export function facetCounts(rows: AdminUserRow[], search: string) {
  const searched = rows.filter((r) => matchesSearch(r, search));
  return {
    total: rows.length,
    searched: searched.length,
    free: searched.filter((r) => (r.plan ?? 'free') === 'free').length,
    premium: searched.filter((r) => r.plan === 'premium').length,
    admin: searched.filter((r) => r.role === 'admin').length,
    user: searched.filter((r) => (r.role ?? 'user') === 'user').length,
    suspended: searched.filter((r) => r.bannedAt !== null).length,
  };
}
