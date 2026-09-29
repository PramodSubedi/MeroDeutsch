-- ============================================================================
-- 20261001010000_admin_dashboard_kpis.sql
--
-- The Dashboard's entire read, in one call.
--
-- ── WHAT THIS REPLACES ───────────────────────────────────────────────────────
-- `useAdminData` issued FOUR queries and aggregated the results in JavaScript:
--
--   profiles            100 000-row cap → total / premium / admin / suspended
--   user_activity_days  NO cap, 30-day window → three distinct-user windows
--                                 plus a 30-point daily series
--   a1_path_state       100 000-row cap → enrolled / average unit
--   user_xp             100 000-row cap → total XP
--
-- The caps are why the hook had to grow a `truncated` array and why the page had
-- to render a "showing N of M" banner: a capped read cannot tell you what it is
-- missing. Postgres can, so the caps go away and so does the banner.
--
-- ── WHY THIS RAISES RATHER THAN RETURNING AN EMPTY SET ───────────────────────
-- `admin_table_counts` returns an empty set for a non-admin, on the reasoning
-- that "an error would confirm the function exists, which is itself a small
-- disclosure" (20260929020000:56-61). That reasoning is right for an
-- ANONYMOUS enumeration probe and wrong here: the caller already holds a
-- session and already knows the function exists, so existence is not the secret
-- — and a refusal is actionable, while a zeroed dashboard is not.
--
-- This is the property that makes moving to RPCs worth doing beyond speed. RLS
-- row filtering can only EXCLUDE rows, so every admin read that is denied
-- returns HTTP 200 with an empty array, and a demoted or suspended admin sees a
-- table of nothing. A `SECURITY DEFINER` function can refuse, so it does.
--
-- ── THE WINDOW BOUND IS days-1, NOT days ────────────────────────────────────
-- `gte` is INCLUSIVE. Starting at `today - 30` admits 31 distinct dates, which
-- is how the dashboard came to print "31" under a "30d" label and report an
-- 8-day figure as "active in 7 days". `dayMath.check.ts` pins this on the
-- TypeScript side; this is the same rule on the SQL side.
--
-- `current_date` is evaluated once in a plpgsql DECLARE, so all four window
-- bounds are anchored to the SAME instant even if the call straddles midnight —
-- which is otherwise a rare and very confusing off-by-one.
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_dashboard_kpis()
RETURNS TABLE (
  total_users       bigint,
  premium_users     bigint,
  admin_count       bigint,
  suspended_count   bigint,
  premium_share     double precision,
  active_today      bigint,
  active_7d         bigint,
  active_30d        bigint,
  path_enrolled     bigint,
  avg_unit_unlocked double precision,
  total_xp          bigint,
  dau               jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Anchored once. See the midnight note above.
  v_today    date := current_date;
  v_start_1  date := current_date - 0;   -- 1-day window  = today
  v_start_7  date := current_date - 6;   -- 7-day window  = 7 dates
  v_start_30 date := current_date - 29;  -- 30-day window = 30 dates
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION
      'admin_dashboard_kpis requires an active admin session. An RLS-filtered read would return zero rows with HTTP 200, which is indistinguishable from "no data"; a refusal is not.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH profile_counts AS (
    -- ONE pass, not four. `FILTER` keeps each count a conditional aggregate
    -- rather than a separate scan.
    SELECT
      count(*)                                              AS total,
      count(*) FILTER (WHERE plan = 'premium')              AS premium,
      count(*) FILTER (WHERE role = 'admin')                AS admins,
      count(*) FILTER (WHERE banned_at IS NOT NULL)         AS suspended
      FROM public.profiles
  ),
  activity_windows AS (
    -- DISTINCT users, three windows, one pass. The WHERE clause is the widest
    -- window so the narrower FILTERs can be evaluated on the same rows.
    --
    -- `count(*)` per day is the number of DISTINCT USERS on that day, because
    -- the table carries UNIQUE(user_id, activity_date) — one row per user per
    -- active day. That is what makes the DAU series a user count and not an
    -- event count.
    SELECT
      count(DISTINCT user_id) FILTER (WHERE activity_date >= v_start_1)  AS today,
      count(DISTINCT user_id) FILTER (WHERE activity_date >= v_start_7)  AS d7,
      count(DISTINCT user_id)                                            AS d30
      FROM public.user_activity_days
     WHERE activity_date >= v_start_30
       AND activity_date <= v_today
  ),
  daily AS (
    -- The sparse side of the series: one row per day that HAD activity.
    -- `activity_date` must be in the SELECT list, not only in the GROUP BY —
    -- without it the CTE returns a bare count and the join below has nothing
    -- to match on.
    SELECT
      activity_date,
      count(*)::int AS n
      FROM public.user_activity_days
     WHERE activity_date >= v_start_30
       AND activity_date <= v_today
     GROUP BY activity_date
  ),
  dau_series AS (
    -- DENSITY IS THE POINT. `generate_series` produces every date in the window
    -- whether or not anyone was active, and the LEFT JOIN fills the gaps with a
    -- real zero.
    --
    -- A sparse series draws a straight line through a three-day absence and
    -- hides it, and a learner who skipped three days is exactly the signal a
    -- daily-active chart exists to show. The series is also guaranteed to be
    -- exactly 30 points, which the client asserted in `dayMath.check.ts` and
    -- previously got 31 of.
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object('date', d::date::text, 'active', coalesce(daily.n, 0))
        ORDER BY d::date
      ),
      '[]'::jsonb
    ) AS series
      FROM generate_series(v_start_30::timestamp, v_today::timestamp, interval '1 day') AS cal(d)
      LEFT JOIN daily ON daily.activity_date = cal.d::date
  ),
  path AS (
    -- `unlocked_unit_index` is the highest unit whose checkpoint was passed, so
    -- the average is where the cohort sits in the spine.
    --
    -- NOTE: the cloud row carries no checkpoint TIMESTAMPS — the attempt history
    -- is Dexie-local by design (see `useA1Path.tsx`) — so a
    -- cohort-by-checkpoint-TIME funnel is not derivable from here. A funnel by
    -- unit is; a funnel by when is not.
    SELECT
      count(*)                            AS enrolled,
      coalesce(avg(unlocked_unit_index), 0) AS avg_unlocked
      FROM public.a1_path_state
  ),
  xp AS (
    SELECT coalesce(sum(total_xp), 0)::bigint AS total
      FROM public.user_xp
  )
  SELECT
    profile_counts.total,
    profile_counts.premium,
    profile_counts.admins,
    profile_counts.suspended,
    -- Guarded: an empty product has no premium share, and dividing would raise.
    CASE WHEN profile_counts.total = 0 THEN 0
         ELSE profile_counts.premium::double precision / profile_counts.total
    END,
    activity_windows.today,
    activity_windows.d7,
    activity_windows.d30,
    path.enrolled,
    path.avg_unlocked,
    xp.total,
    dau_series.series
    FROM profile_counts
    CROSS JOIN activity_windows
    CROSS JOIN path
    CROSS JOIN xp
    CROSS JOIN dau_series;
END;
$$;

-- `authenticated` only. The body re-checks `is_active_admin()`, so a signed-in
-- LEARNER gets a refusal even though the grant permits the call.
--
-- `anon` is revoked BY NAME as well as via PUBLIC: anon is a member of PUBLIC,
-- so a PUBLIC-only revoke would leave it executable — the same trap
-- `admin_table_counts` documents at 20260929020000:93-99.
REVOKE ALL ON FUNCTION public.admin_dashboard_kpis() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_dashboard_kpis() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_kpis() TO authenticated;

COMMIT;

-- ============================================================================
-- Post-COMMIT verification
-- ============================================================================

DO $$
DECLARE
  missing text[];
  cfg text[];
BEGIN
  -- The function must exist, be pinned, and be unreachable by anon.
  IF to_regprocedure('public.admin_dashboard_kpis()') IS NULL THEN
    RAISE EXCEPTION 'admin_dashboard_kpis() was not created';
  END IF;

  SELECT p.proconfig INTO cfg
    FROM pg_proc p
   WHERE p.oid = 'public.admin_dashboard_kpis()'::regprocedure;

  IF cfg IS NULL OR NOT (cfg @> ARRAY['search_path=public']) THEN
    RAISE EXCEPTION 'admin_dashboard_kpis() does not have search_path pinned to public (proconfig = %)', coalesce(cfg::text, 'NULL');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.oid = 'public.admin_dashboard_kpis()'::regprocedure
       AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'admin_dashboard_kpis() is not SECURITY DEFINER — it would be subject to RLS and could only ever return zero rows';
  END IF;

  SELECT array_agg(g.rolname)
    INTO missing
    FROM pg_proc p
    CROSS JOIN pg_roles g
   WHERE p.oid = 'public.admin_dashboard_kpis()'::regprocedure
     AND g.rolname IN ('anon', 'PUBLIC')
     AND has_function_privilege(p.oid, g.oid, 'EXECUTE');

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'admin_dashboard_kpis() is executable by % — the REVOKE did not hold', missing;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.oid = 'public.admin_dashboard_kpis()'::regprocedure
       AND p.provolatile = 's'
  ) THEN
    RAISE EXCEPTION 'admin_dashboard_kpis() is not STABLE — it would be re-evaluated per row of any larger query that used it';
  END IF;
END $$;
