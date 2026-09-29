-- ============================================================================
-- 20261001020000_admin_analytics.sql
--
-- The Analytics page's entire read, in one call.
--
-- ── WHAT THIS REPLACES ───────────────────────────────────────────────────────
-- `fetchAnalytics` issued SIX queries and aggregated every one in JavaScript:
--
--   profiles            100 000 cap → plan split, total learners
--   user_activity_days  200 000 cap → DAU series + weekly retention
--   user_xp             100 000 cap → total XP, XP by level
--   user_streaks        100 000 cap → streak histogram
--   a1_path_state       100 000 cap → unit funnel, checkpoint averages, on-spine
--   content_items       200 000 cap → content type counts
--
-- A 100 000-row cap on `user_xp` to compute a SUM is the shape of the problem
-- in one line: the database could answer every one of these without a cap, and
-- the browser was doing arithmetic the cap made wrong.
--
-- ── SEMANTICS PRESERVED DELIBERATELY ─────────────────────────────────────────
-- Every definition below is a TRANSLATION of the JavaScript it replaces, not a
-- redesign. Where the original had a filter, the reason is repeated here,
-- because a silent semantic change in a dashboard is worse than a wrong number
-- you can see.
--
--   · `unitFunnel` and `checkpointAverages` label as `index + 1`. The stored
--     `unlocked_unit_index` is 0-based; the panel shows 1-based unit numbers.
--   · `checkpoint_best_by_unit` entries that are not numeric are SKIPPED, not
--     coerced. The TypeScript checked `typeof score === 'number'`; an unguarded
--     `::numeric` cast here would raise on the whole query instead of dropping
--     one malformed row.
--   · Retention trailing zeros are TRIMMED. A cohort formed last week has had
--     no chance to be retained in week 1, so a padded zero asserts "100%
--     churned" when the truth is "not observable yet".
--   · Retention is population-by-week ALIGNED TO COHORT WEEKS, not a true
--     returning-member cohort. `weeks[n]` is everyone active n weeks after the
--     cohort week, not the subset who came back. That is what the original
--     computed and what the chart is drawn to show.
--   · Streaks bucket 0..9 individually and collapse everything ≥10 into "10+".
--
-- `date_trunc('week', …)` returns Monday, which is exactly what the TypeScript
-- `weekStart` computed — so cohort boundaries do not shift by a day.
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_analytics(p_days integer DEFAULT 30)
RETURNS TABLE (
  dau                 jsonb,
  retention           jsonb,
  unit_funnel         jsonb,
  checkpoint_averages jsonb,
  total_xp            bigint,
  xp_by_level         jsonb,
  streak_buckets      jsonb,
  plan_split          jsonb,
  content_types       jsonb,
  on_spine            bigint,
  total_learners      bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Clamped. The window decides how much of `user_activity_days` is scanned, and
  -- an unclamped parameter is an anonymous request to scan a decade of rows.
  v_days   integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_today  date    := current_date;
  -- `gte` is INCLUSIVE, so a `days`-long window starts `days - 1` back.
  v_start  date    := current_date - (least(greatest(coalesce(p_days, 30), 1), 365) - 1);
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION
      'admin_analytics requires an active admin session. An RLS-filtered read would return zero rows with HTTP 200, which is indistinguishable from "no data"; a refusal is not.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH
  -- ── Daily active users, DENSE ─────────────────────────────────────────────
  daily_counts AS (
    SELECT activity_date, count(*)::int AS n
      FROM public.user_activity_days
     WHERE activity_date >= v_start AND activity_date <= v_today
     GROUP BY activity_date
  ),
  dau AS (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object('date', cal.d::date::text, 'active', coalesce(daily_counts.n, 0))
        ORDER BY cal.d::date
      ),
      '[]'::jsonb
    ) AS series
      FROM generate_series(v_start::timestamp, v_today::timestamp, interval '1 day') AS cal(d)
      LEFT JOIN daily_counts ON daily_counts.activity_date = cal.d::date
  ),

  -- ── Weekly retention ──────────────────────────────────────────────────────
  -- Monday-aligned, matching the TypeScript `weekStart`.
  week_activity AS (
    SELECT user_id, date_trunc('week', activity_date)::date AS wk
      FROM public.user_activity_days
     WHERE activity_date >= v_start AND activity_date <= v_today
     GROUP BY 1, 2
  ),
  cohorts AS (
    -- The six most RECENT weeks. The original took `.sort().slice(-6)`, so a
    -- week with nobody active is not a cohort and is simply absent.
    SELECT DISTINCT wk
      FROM week_activity
     ORDER BY wk DESC
     LIMIT 6
  ),
  retention_grid AS (
    SELECT
      c.wk AS cohort,
      g.n::int AS week_no,
      count(DISTINCT wa.user_id)::int AS active
      FROM cohorts c
      CROSS JOIN generate_series(0, 5) AS g(n)
      LEFT JOIN week_activity wa
        ON wa.wk = c.wk + (g.n * 7)
     GROUP BY 1, 2
  ),
  retention_trimmed AS (
    -- The maximum offset at which this cohort still shows activity. Everything
    -- after it is "not observable yet" and is dropped rather than drawn as a
    -- zero, which would read as total churn.
    SELECT cohort, max(week_no) FILTER (WHERE active > 0) AS last_observed
      FROM retention_grid
     GROUP BY cohort
  ),
  retention AS (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'cohort', r.cohort::text,
          -- `coalesce(..., 0)` keeps a cohort with no observable activity down to
          -- a single point, matching the TypeScript `while (length > 1 …)`.
          'weeks', (
            SELECT coalesce(
              jsonb_agg(g.active ORDER BY g.week_no),
              '[]'::jsonb
            )
              FROM retention_grid g
             WHERE g.cohort = r.cohort
               AND g.week_no <= coalesce(r.last_observed, 0)
          )
        )
        ORDER BY r.cohort
      ),
      '[]'::jsonb
    ) AS series
      FROM retention_trimmed r
  ),

  -- ── Unit funnel ───────────────────────────────────────────────────────────
  -- A STAGE marker, not a visit count: `unlocked_unit_index` is the highest unit
  -- whose checkpoint was passed. Labelled 1-based to match the panel.
  unit_counts AS (
    SELECT unlocked_unit_index AS idx, count(*)::bigint AS n
      FROM public.a1_path_state
     GROUP BY 1
  ),
  unit_funnel AS (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object('label', (idx + 1)::text, 'value', n)
        ORDER BY idx
      ),
      '[]'::jsonb
    ) AS series
      FROM unit_counts
  ),

  -- ── Checkpoint averages ───────────────────────────────────────────────────
  -- The fiddly one. `checkpoint_best_by_unit` is a JSONB object of
  -- unit-index → best score, so it has to be exploded with `jsonb_each_text`
  -- before it can be averaged at all.
  --
  -- BOTH guards are load-bearing and mirror the TypeScript:
  --   · the key must look like an integer, or `(e.key)::int` RAISES and takes the
  --     whole query down — the JS `Number.isFinite(u)` skipped it
  --   · the value must look numeric for the same reason, and an unguarded cast
  --     would abort rather than drop one malformed row
  checkpoint_scores AS (
    SELECT (e.key)::int AS idx, (e.value)::numeric AS score
      FROM public.a1_path_state p
      CROSS JOIN LATERAL jsonb_each_text(p.checkpoint_best_by_unit) AS e(key, value)
     WHERE e.key ~ '^\d+$'
       AND e.value ~ '^-?\d+(\.\d+)?$'
  ),
  checkpoint_means AS (
    SELECT idx + 1 AS label, round(avg(score), 2)::double precision AS value
      FROM checkpoint_scores
     GROUP BY idx
  ),
  checkpoint_averages AS (
    -- Numerically ordered: unit "10" must not sort before unit "2", which is
    -- what a plain text `ORDER BY` on the label would do.
    SELECT coalesce(
      jsonb_agg(jsonb_build_object('label', label::text, 'value', value) ORDER BY label),
      '[]'::jsonb
    ) AS series
      FROM checkpoint_means
  ),

  -- ── XP ────────────────────────────────────────────────────────────────────
  xp_totals AS (
    SELECT coalesce(sum(total_xp), 0)::bigint AS total
      FROM public.user_xp
  ),
  xp_levels AS (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object('label', lvl::text, 'value', n)
        ORDER BY lvl
      ),
      '[]'::jsonb
    ) AS series
      FROM (
        SELECT level AS lvl, count(*)::bigint AS n
          FROM public.user_xp
         GROUP BY level
      ) s
  ),

  -- ── Streak histogram ──────────────────────────────────────────────────────
  -- 0..9 individually, everything ≥10 collapsed. `least`/`greatest` clamp a
  -- negative or absurd stored value into the same range the TypeScript did.
  streak_counts AS (
    SELECT least(greatest(coalesce(current_streak, 0), 0), 10) AS bucket, count(*)::bigint AS n
      FROM public.user_streaks
     GROUP BY 1
  ),
  streak_buckets AS (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'label',
          CASE WHEN bucket = 10 THEN '10+' ELSE bucket::text END,
          'value', n
        )
        ORDER BY bucket
      ),
      '[]'::jsonb
    ) AS series
      FROM streak_counts
  ),

  -- ── Population splits ─────────────────────────────────────────────────────
  plan_counts AS (
    SELECT coalesce(plan, 'free') AS label, count(*)::bigint AS n
      FROM public.profiles
     GROUP BY 1
  ),
  plan_split AS (
    SELECT coalesce(
      jsonb_agg(jsonb_build_object('label', label, 'value', n) ORDER BY label),
      '[]'::jsonb
    ) AS series
      FROM plan_counts
  ),
  content_counts AS (
    SELECT content_type AS label, count(*)::bigint AS n
      FROM public.content_items
     GROUP BY 1
  ),
  content_types AS (
    SELECT coalesce(
      jsonb_agg(jsonb_build_object('label', label, 'value', n) ORDER BY label),
      '[]'::jsonb
    ) AS series
      FROM content_counts
  ),

  counts AS (
    SELECT
      (SELECT count(*) FROM public.a1_path_state) AS on_spine,
      (SELECT count(*) FROM public.profiles)     AS total_learners
  )

  SELECT
    dau.series,
    retention.series,
    unit_funnel.series,
    checkpoint_averages.series,
    xp_totals.total,
    xp_levels.series,
    streak_buckets.series,
    plan_split.series,
    content_types.series,
    counts.on_spine,
    counts.total_learners
    FROM dau
    CROSS JOIN retention
    CROSS JOIN unit_funnel
    CROSS JOIN checkpoint_averages
    CROSS JOIN xp_totals
    CROSS JOIN xp_levels
    CROSS JOIN streak_buckets
    CROSS JOIN plan_split
    CROSS JOIN content_types
    CROSS JOIN counts;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_analytics(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_analytics(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_analytics(integer) TO authenticated;

COMMIT;

-- ============================================================================
-- Post-COMMIT verification
-- ============================================================================

DO $$
DECLARE
  cfg text[];
  sig text;
BEGIN
  IF to_regprocedure('public.admin_analytics(integer)') IS NULL THEN
    RAISE EXCEPTION 'admin_analytics(integer) was not created';
  END IF;

  SELECT p.proconfig INTO cfg
    FROM pg_proc p
   WHERE p.oid = 'public.admin_analytics(integer)'::regprocedure;

  IF cfg IS NULL OR NOT (cfg @> ARRAY['search_path=public']) THEN
    RAISE EXCEPTION 'admin_analytics() does not have search_path pinned to public (proconfig = %)', coalesce(cfg::text, 'NULL');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.oid = 'public.admin_analytics(integer)'::regprocedure AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'admin_analytics() is not SECURITY DEFINER — it would be subject to RLS and could only ever return zero rows';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_proc p
      CROSS JOIN pg_roles g
     WHERE p.oid = 'public.admin_analytics(integer)'::regprocedure
       AND g.rolname IN ('anon', 'PUBLIC')
       AND has_function_privilege(p.oid, g.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'admin_analytics() is still executable by anon/PUBLIC';
  END IF;

  -- The default must match the TypeScript default, or a caller that omits the
  -- argument silently gets a different window than the page was written for.
  SELECT pg_get_function_arguments(p.oid) INTO sig
    FROM pg_proc p
   WHERE p.oid = 'public.admin_analytics(integer)'::regprocedure;

  IF sig NOT ILIKE '%30%' THEN
    RAISE EXCEPTION 'admin_analytics() default changed: signature is %', sig;
  END IF;
END $$;
