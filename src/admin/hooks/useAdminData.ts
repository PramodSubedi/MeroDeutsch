/**
 * src/admin/hooks/useAdminData.ts
 *
 * Read-only aggregates for the control center, in one place.
 *
 * WHY CLIENT-SIDE AGGREGATION (and when that stops being true)
 * -----------------------------------------------------------
 * Every figure here comes from tables the admin RLS policies of
 * 20260929000000 make readable. They are aggregated in the browser rather than
 * via Postgres RPCs, which is the right trade at current scale: a dashboard load
 * is a handful of range-limited `select`s, and a new RPC per chart would mean a
 * migration for every new question.
 *
 * ── WHAT THE TRUNCATION ARRAY IS FOR ─────────────────────────────────────────
 * `profiles` grows without bound, so the moment you want "every user, all time"
 * the row count crosses what a browser should pull. Rather than hide that
 * behind a silent cap, each capped read reports `shown` against `total` and the
 * dashboard says so. A cap you cannot see is indistinguishable from a real
 * number that happens to be smaller than you hoped.
 *
 * When the numbers must be exact, move THIS hook's body to an RPC and leave its
 * signature unchanged; the pages do not care where the number came from.
 *
 * EVERY FUNCTION FAILS SOFT
 * A dashboard should render the panels that work. These return zeros plus a
 * populated `errors` map rather than throwing, so one denied or missing table
 * cannot blank the whole page.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { activeUserCount, denseDailySeries, windowStartIso } from '../data/dayMath';
import { callAdminRpc, shouldFallBack, LEGACY_PATH_NOTICE } from '../data/rpc';

export interface AdminKpis {
  totalUsers: number;
  /**
   * Distinct users with an activity row dated TODAY.
   *
   * Named for what `user_activity_days` can actually measure: one row per user
   * per active DAY. There is no sub-day signal in the table, so this is not
   * "active in the last 24 hours" and must never be labelled as though it were.
   */
  activeToday: number;
  /** Distinct users active in the last 7 calendar days, today included. */
  active7d: number;
  /** Distinct users active in the last 30 calendar days, today included. */
  active30d: number;
  premiumUsers: number;
  premiumShare: number;
  adminCount: number;
  bannedCount: number;
  /** Learners with a row in a1_path_state — i.e. who have started the spine. */
  pathEnrolled: number;
  /** Mean `unlocked_unit_index` across enrolled learners (0-based). */
  avgUnitUnlocked: number;
  totalXp: number;
  /** Daily active users for the last 30 days, oldest first. Exactly 30 points. */
  dauSeries: { date: string; active: number }[];
  /**
   * True when the RPC is not deployed and the figures came from the legacy
   * browser-side read.
   *
   * Surfaced rather than swallowed, because the legacy path is BOUNDED and the
   * RPC is not: a number produced under a 100 000-row cap is a different kind of
   * claim from the same number computed by `COUNT(*)`, and an operator looking at
   * it deserves to know which they have.
   */
  degraded: boolean;
}

const EMPTY_KPIS: AdminKpis = {
  totalUsers: 0,
  activeToday: 0,
  active7d: 0,
  active30d: 0,
  premiumUsers: 0,
  premiumShare: 0,
  adminCount: 0,
  bannedCount: 0,
  pathEnrolled: 0,
  avgUnitUnlocked: 0,
  totalXp: 0,
  dauSeries: [],
  degraded: false,
};

export interface AdminDataState {
  kpis: AdminKpis;
  loading: boolean;
  /**
   * Per-source error messages; empty means everything resolved.
   *
   * With one RPC there is one source, so this is now a 0-or-1 list rather than a
   * per-table breakdown. It stays a list because the CONSUMER (`DashboardPage`)
   * renders a list, and a caller that has to unwrap a bare string to render it
   * is a caller that will get it wrong when a second source appears.
   */
  errors: string[];
  refresh: () => void;
}

/** The row shape `admin_dashboard_kpis` returns. One row, or nothing. */
interface DashboardKpiRow {
  total_users: number;
  premium_users: number;
  admin_count: number;
  suspended_count: number;
  premium_share: number;
  active_today: number;
  active_7d: number;
  active_30d: number;
  path_enrolled: number;
  avg_unit_unlocked: number;
  total_xp: number;
  dau: { date: string; active: number }[];
}

/**
 * Coerce one RPC row into the KPI shape the page renders.
 *
 * PURE and exported, so the mapping is testable with no network and no
 * Supabase client — the same trick `interpretAdminResponse` uses, and for the
 * same reason: a response mapping is where a renamed column becomes a silent
 * `undefined`, and `undefined` renders as a zero that looks like a real figure.
 *
 * Every field is read defensively for that reason. A missing key yields 0, which
 * is visibly wrong on a dashboard; `NaN` is not.
 */
export function mapDashboardKpis(row: DashboardKpiRow | null | undefined): AdminKpis {
  if (!row) return { ...EMPTY_KPIS };
  const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    totalUsers: n(row.total_users),
    premiumUsers: n(row.premium_users),
    adminCount: n(row.admin_count),
    bannedCount: n(row.suspended_count),
    premiumShare: n(row.premium_share),
    activeToday: n(row.active_today),
    active7d: n(row.active_7d),
    active30d: n(row.active_30d),
    pathEnrolled: n(row.path_enrolled),
    avgUnitUnlocked: n(row.avg_unit_unlocked),
    totalXp: n(row.total_xp),
    dauSeries: Array.isArray(row.dau) ? row.dau : [],
    degraded: false,
  };
}

/**
 * The PREVIOUS implementation, kept as a fallback.
 *
 * Four capped reads aggregated in the browser. It is the code that has been
 * running all along and it is correct — bounded, but correct — which is why it
 * is worth keeping rather than deleting: the RPC migrations are applied by a
 * human to a database this repository does not contain, and until that happens
 * the Dashboard must not be a stack trace.
 *
 * It is reached ONLY when the RPC is absent, never when the RPC refuses. See
 * `data/rpc.ts` for why conflating those two would be a security regression.
 *
 * PURE and exported so its output is testable without a client.
 */
export async function fetchDashboardKpisLegacy(): Promise<{ kpis: AdminKpis; errors: string[] }> {
  const kpis: AdminKpis = { ...EMPTY_KPIS };
  const errors: string[] = [];
  const now = new Date();
  const CAP = 100_000;

  const [profiles, activity, path, xp] = await Promise.all([
    supabase.from('profiles').select('role, plan, banned_at', { count: 'exact' }).limit(CAP),
    supabase
      .from('user_activity_days')
      .select('activity_date, user_id')
      .gte('activity_date', windowStartIso(30, now))
      .order('activity_date', { ascending: true }),
    supabase.from('a1_path_state').select('unlocked_unit_index', { count: 'exact' }).limit(CAP),
    supabase.from('user_xp').select('total_xp', { count: 'exact' }).limit(CAP),
  ]);

  if (profiles.error) errors.push(`profiles: ${profiles.error.message}`);
  else {
    const rows = profiles.data ?? [];
    kpis.totalUsers = profiles.count ?? rows.length;
    kpis.premiumUsers = rows.filter((r) => r.plan === 'premium').length;
    kpis.adminCount = rows.filter((r) => r.role === 'admin').length;
    kpis.bannedCount = rows.filter((r) => Boolean(r.banned_at)).length;
    kpis.premiumShare = kpis.totalUsers === 0 ? 0 : kpis.premiumUsers / kpis.totalUsers;
  }

  if (activity.error) errors.push(`user_activity_days: ${activity.error.message}`);
  else {
    const rows = activity.data ?? [];
    const byDate = new Map<string, number>();
    const byUser = new Map<string, Set<string>>();
    for (const row of rows) {
      byDate.set(row.activity_date, (byDate.get(row.activity_date) ?? 0) + 1);
      if (!row.user_id) continue;
      const set = byUser.get(row.user_id);
      if (set) set.add(row.activity_date);
      else byUser.set(row.user_id, new Set([row.activity_date]));
    }
    kpis.activeToday = activeUserCount(byUser, 1, now);
    kpis.active7d = activeUserCount(byUser, 7, now);
    kpis.active30d = activeUserCount(byUser, 30, now);
    kpis.dauSeries = denseDailySeries(byDate, 30, now);
  }

  if (path.error) errors.push(`a1_path_state: ${path.error.message}`);
  else {
    const rows = path.data ?? [];
    kpis.pathEnrolled = path.count ?? rows.length;
    kpis.avgUnitUnlocked =
      rows.length === 0 ? 0 : rows.reduce((sum, r) => sum + (r.unlocked_unit_index ?? 0), 0) / rows.length;
  }

  if (xp.error) errors.push(`user_xp: ${xp.error.message}`);
  else kpis.totalXp = (xp.data ?? []).reduce((sum, r) => sum + (r.total_xp ?? 0), 0);

  kpis.degraded = true;
  return { kpis, errors };
}

export function useAdminData(): AdminDataState {
  const [kpis, setKpis] = useState<AdminKpis>(EMPTY_KPIS);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [nonce, setNonce] = useState(0);

  // Guards against a slow response from a previous run overwriting fresher state
  // after a manual refresh.
  const runId = useRef(0);

  useEffect(() => {
    const id = runId.current + 1;
    runId.current = id;

    let cancelled = false;
    setLoading(true);
    setErrors([]);

    (async () => {
      const outcome = await callAdminRpc<DashboardKpiRow[]>(supabase, 'admin_dashboard_kpis');

      if (cancelled || runId.current !== id) return;

      if (outcome.kind === 'ok') {
        setKpis(mapDashboardKpis((outcome.data as DashboardKpiRow[] | null)?.[0]));
        setErrors([]);
        setLoading(false);
        return;
      }

      if (shouldFallBack(outcome)) {
        // The migration has not been applied. Degrade loudly, not silently.
        const legacy = await fetchDashboardKpisLegacy();
        if (cancelled || runId.current !== id) return;
        setKpis(legacy.kpis);
        setErrors([LEGACY_PATH_NOTICE, ...legacy.errors]);
        setLoading(false);
        return;
      }

      // `refused` and `error` do NOT fall back. A refusal is the RPC working
      // correctly; an error is a problem the operator should see.
      setKpis({ ...EMPTY_KPIS });
      setErrors([`admin_dashboard_kpis: ${outcome.message}`]);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return useMemo(() => ({ kpis, loading, errors, refresh }), [kpis, loading, errors, refresh]);
}
