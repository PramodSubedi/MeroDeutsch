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
 * The ceiling is real and worth stating plainly: `user_activity_days` holds one
 * row per user per ACTIVE day, so a 30-day DAU series is 30 rows no matter how
 * many learners there are — cheap. But `profiles` grows without bound, so the
 * moment you want "every user, all time" the row count crosses what a browser
 * should pull. At that point move THIS function's body to an RPC and leave its
 * signature unchanged; the pages do not care where the number came from.
 *
 * EVERY FUNCTION FAILS SOFT
 * A dashboard should render the panels that work. These return zeros plus a
 * populated `errors` map rather than throwing, so one denied or missing table
 * cannot blank the whole page.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

export interface AdminKpis {
  totalUsers: number;
  active24h: number;
  active7d: number;
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
  /** Cumulative daily active users for the last 30 days, oldest first. */
  dauSeries: { date: string; active: number }[];
}

const EMPTY_KPIS: AdminKpis = {
  totalUsers: 0,
  active24h: 0,
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
};

export interface AdminDataState {
  kpis: AdminKpis;
  loading: boolean;
  /** Per-source error messages; empty means everything resolved. */
  errors: string[];
  refresh: () => void;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Build a dense day list so gaps render as real zeros, not a short series. */
function denseDailySeries(rows: { activity_date: string; count: number }[], days: number) {
  const byDate = new Map(rows.map((r) => [r.activity_date, r.count]));
  const out: { date: string; active: number }[] = [];
  for (let i = days; i >= 0; i -= 1) {
    const date = isoDaysAgo(i);
    out.push({ date, active: byDate.get(date) ?? 0 });
  }
  return out;
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
      const next: AdminKpis = { ...EMPTY_KPIS };
      const problems: string[] = [];

      // 1. Profiles — counts by role / plan / suspension. Only the three
      //    filterable columns are selected, to keep the payload small.
      const profiles = await supabase
        .from('profiles')
        .select('role, plan, banned_at')
        .limit(100000);

      if (profiles.error) {
        problems.push(`profiles: ${profiles.error.message}`);
      } else {
        const rows = profiles.data ?? [];
        next.totalUsers = rows.length;
        next.premiumUsers = rows.filter((r) => r.plan === 'premium').length;
        next.adminCount = rows.filter((r) => r.role === 'admin').length;
        next.bannedCount = rows.filter((r) => Boolean(r.banned_at)).length;
        next.premiumShare = next.totalUsers === 0 ? 0 : next.premiumUsers / next.totalUsers;
      }

      // 2. Activity — one row per user per active day, so a 30-day window is
      //    small regardless of user count. `gte` is inclusive, hence 30/7/1.
      const activity = await supabase
        .from('user_activity_days')
        .select('activity_date, user_id')
        .gte('activity_date', isoDaysAgo(30));

      if (activity.error) {
        problems.push(`user_activity_days: ${activity.error.message}`);
      } else {
        const rows = activity.data ?? [];
        const byDateCounts = new Map<string, number>();
        const day1 = isoDaysAgo(1);
        const day7 = isoDaysAgo(7);

        const active1 = new Set<string>();
        const active7 = new Set<string>();

        for (const row of rows) {
          const date = row.activity_date;
          byDateCounts.set(date, (byDateCounts.get(date) ?? 0) + 1);
          if (!row.user_id) continue;
          if (date >= day1) active1.add(row.user_id);
          if (date >= day7) active7.add(row.user_id);
        }

        next.active24h = active1.size;
        next.active7d = active7.size;
        next.active30d = new Set(rows.map((r) => r.user_id).filter(Boolean)).size;
        next.dauSeries = denseDailySeries(
          Array.from(byDateCounts, ([activity_date, count]) => ({ activity_date, count })),
          30
        );
      }

      // 3. Path state — spine progress. `unlocked_unit_index` is the highest
      //    unit whose checkpoint was passed, so it is the funnel's stage marker.
      //    NOTE: the cloud row carries no checkpoint TIMESTAMPS — the attempt
      //    history is Dexie-local by design (see useA1Path.tsx), so a
      //    cohort-by-checkpoint-time funnel is not derivable from here.
      const path = await supabase
        .from('a1_path_state')
        .select('unlocked_unit_index')
        .limit(100000);

      if (path.error) {
        problems.push(`a1_path_state: ${path.error.message}`);
      } else {
        const rows = path.data ?? [];
        next.pathEnrolled = rows.length;
        next.avgUnitUnlocked =
          rows.length === 0
            ? 0
            : rows.reduce((sum, r) => sum + (r.unlocked_unit_index ?? 0), 0) / rows.length;
      }

      // 4. XP totals.
      const xp = await supabase.from('user_xp').select('total_xp').limit(100000);
      if (xp.error) {
        problems.push(`user_xp: ${xp.error.message}`);
      } else {
        next.totalXp = (xp.data ?? []).reduce((sum, r) => sum + (r.total_xp ?? 0), 0);
      }

      if (cancelled || runId.current !== id) return;
      setKpis(next);
      setErrors(problems);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return useMemo(() => ({ kpis, loading, errors, refresh }), [kpis, loading, errors, refresh]);
}
