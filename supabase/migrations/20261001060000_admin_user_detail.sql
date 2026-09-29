-- ============================================================================
-- 20261001060000_admin_user_detail.sql
--
-- The 360 drawer's entire read, in one call.
--
-- ── WHAT THIS REPLACES ───────────────────────────────────────────────────────
-- `userDetail.ts:282-295` issued EIGHT per-user queries:
--
--   profiles  user_progress  user_xp  user_streaks  user_achievements
--   user_activity_days  a1_path_state  review_queue
--
-- then assembled them in JavaScript. Eight round trips to render one drawer, and
-- a viewer that had to wait for the slowest of eight.
--
-- The blocker for a JOIN was real and is worth recording: `review_queue` was
-- declared as selecting `id` and the client read `r.id`, while the live table's
-- primary key is `id` TEXT (`20260928020000` retyped it from UUID to TEXT to
-- match the client's deterministic ids). So the column name was right and the
-- type assumption was not — a mismatch that a join would have surfaced
-- immediately and the per-table reads had been papering over.
--
-- ── WHY THE DATES ARE AGGREGATED, NOT LISTED ─────────────────────────────────
-- `user_activity_days` holds one row per user per active DAY — thousands for a
-- long-lived account, and the last query the drawer fired was the one that took
-- longest. The drawer shows a COUNT and the most recent DATE, so that is what is
-- computed. The full history is available to the learner app, which is where it
-- belongs.
--
-- ── REFUSES, LIKE EVERY OTHER ADMIN RPC ──────────────────────────────────────
-- RLS can only exclude rows, so the per-table reads handed a demoted or
-- suspended admin eight empty arrays and a drawer that rendered as "this learner
-- has no progress" — a statement about the LEARNER, made by a permission
-- failure. A `SECURITY DEFINER` function can raise, and does.
--
-- ── THE DATES ARE `timestamptz` AND THE CLIENT EXPECTS STRINGS ───────────────
-- PostgREST serialises both to the same ISO-8601 string, so the drawer's
-- existing `string` fields are unchanged.
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_user_detail(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile   public.profiles%ROWTYPE;
  v_progress  public.user_progress%ROWTYPE;
  v_xp        public.user_xp%ROWTYPE;
  v_streak    public.user_streaks%ROWTYPE;
  v_path      public.a1_path_state%ROWTYPE;
  v_activity        record;
  v_activity_daily  jsonb;
  v_achievements jsonb;
  v_queue        record;
  v_queue_items  jsonb;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION
      'admin_user_detail requires an active admin session. An RLS-filtered read would return empty objects with HTTP 200, which a drawer cannot distinguish from "this learner has no data"; a refusal is not.'
      USING ERRCODE = '42501';
  END IF;

  -- A missing profile is a real, reportable answer — the id does not exist —
  -- rather than a null-everything payload.
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No profile exists for user %', p_user_id USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_progress FROM public.user_progress WHERE user_id = p_user_id;
  SELECT * INTO v_xp       FROM public.user_xp       WHERE user_id = p_user_id;
  SELECT * INTO v_streak   FROM public.user_streaks  WHERE user_id = p_user_id;
  SELECT * INTO v_path     FROM public.a1_path_state WHERE user_id = p_user_id;

  SELECT
      count(*)::int
    , max(activity_date) AS last_active
  INTO v_activity
    FROM public.user_activity_days
   WHERE user_id = p_user_id;

  -- The DAILY counts for the drawer's activity strip, and only for its window.
  --
  -- The strip is a fixed-width heat strip, so this is a bounded series
  -- regardless of how long the account has existed — which is the point: the old
  -- read pulled every activity row this learner EVER had, which for a
  -- long-tenured account is thousands of rows, in order to render a fixed number
  -- of squares.
  --
  -- 119 DAYS, matching `ACTIVITY_WINDOW_DAYS` in `userDetail.ts`. It is 119
  -- because that is what the constant says, not because 119 is a sensible round
  -- number — and it was briefly written as 17, which would have silently
  -- shortened the learner's activity history by seven weeks. `check:adminrpcs`
  -- §8 now pins the two together, because a restated constant that drifts is
  -- invisible in both places.
  --
  -- `count(*)` is the day figure, not `sum(event_count)`: the strip is
  -- "was this learner here", not "how much did they do". `buildActivity` in
  -- `userDetail.ts` made the same choice, from the same UNIQUE(user_id,
  -- activity_date) constraint.
  v_activity_daily := (
    SELECT coalesce(jsonb_agg(
      jsonb_build_object('date', d.activity_date::text, 'count', d.n)
      ORDER BY d.activity_date
    ), '[]'::jsonb)
      FROM (
        SELECT activity_date, count(*)::int AS n
          FROM public.user_activity_days
         WHERE user_id = p_user_id
           AND activity_date >= (current_date - (119 - 1))   -- ACTIVITY_WINDOW_DAYS
           AND activity_date <= current_date
         GROUP BY activity_date
      ) d
  );

  -- `completed_node_ids` is a JSONB array, so it needs `jsonb_array_length`
  -- rather than `count(*)`; a null or empty array reads as 0.
  SELECT coalesce(jsonb_agg(jsonb_build_object('badgeId', badge_id, 'unlockedAt', unlocked_at)), '[]'::jsonb)
    INTO v_achievements
    FROM public.user_achievements
   WHERE user_id = p_user_id;

  SELECT
      count(*)::int                                   AS size
    , coalesce(sum(error_count), 0)::int               AS errors
    , count(*) FILTER (WHERE due_at < now())::int      AS due_now
    , min(due_at)                                     AS oldest_due
  INTO v_queue
    FROM public.review_queue
   WHERE user_id = p_user_id;

  -- The queue ROWS as well as its totals. `summariseQueue` on the client
  -- produces the by-module and by-result breakdowns the drawer shows, and those
  -- are properties of the items rather than of the count — so returning only
  -- totals would have silently replaced a breakdown with a single number.
  --
  -- Capped at 1,000 to match the `.limit(1000)` this replaces. The cap is NOT
  -- reported: a learner with more than 1,000 open items is a data-quality
  -- problem, and the drawer says which module when the admin asks.
  v_queue_items := (
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'moduleType',     r.module_type,
        'itemKey',        r.item_key,
        'userAnswer',     r.user_answer,
        'correctAnswer',  r.correct_answer,
        'errorCount',     r.error_count,
        'intervalDays',   r.interval_days,
        'boxLevel',       r.box_level,
        'dueAt',          r.due_at,
        'errorTag',       r.error_tag,
        'lastResult',     r.last_result
      )
      ORDER BY r.due_at ASC, r.id ASC
    ), '[]'::jsonb)
      FROM (
        SELECT *
          FROM public.review_queue
         WHERE user_id = p_user_id
         ORDER BY due_at ASC, id ASC
         LIMIT 1000
      ) r
  );

  RETURN jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'progress', case when v_progress IS NULL then null else to_jsonb(v_progress) end,
    'xp',       case when v_xp IS NULL then null else to_jsonb(v_xp) end,
    'streak',   case when v_streak IS NULL then null else to_jsonb(v_streak) end,
    'path',     case when v_path IS NULL then null else to_jsonb(v_path) end,
    'activity', jsonb_build_object(
      'activeDays', coalesce(v_activity.count, 0),
      -- A learner who has never been active gets NULL, not "today". The drawer
      -- renders an em dash for it, and a fabricated date would read as activity.
      'lastActiveAt', v_activity.last_active,
      'daily', v_activity_daily
    ),
    'achievements', v_achievements,
    'queue', jsonb_build_object(
      'size',      coalesce(v_queue.size, 0),
      'errors',    coalesce(v_queue.errors, 0),
      'dueNow',    coalesce(v_queue.due_now, 0),
      'oldestDue', v_queue.oldest_due,
      'items',     v_queue_items
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_detail(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_user_detail(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_user_detail(uuid) TO authenticated;

COMMIT;

-- ============================================================================
-- Post-COMMIT verification
-- ============================================================================

DO $$
DECLARE
  cfg text[];
BEGIN
  IF to_regprocedure('public.admin_user_detail(uuid)') IS NULL THEN
    RAISE EXCEPTION 'admin_user_detail(uuid) was not created';
  END IF;

  SELECT p.proconfig INTO cfg
    FROM pg_proc p
   WHERE p.oid = 'public.admin_user_detail(uuid)'::regprocedure;

  IF cfg IS NULL OR NOT (cfg @> ARRAY['search_path=public']) THEN
    RAISE EXCEPTION 'admin_user_detail() does not have search_path pinned to public (proconfig = %)', coalesce(cfg::text, 'NULL');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.oid = 'public.admin_user_detail(uuid)'::regprocedure AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'admin_user_detail() is not SECURITY DEFINER — it would be subject to RLS and could only ever return empty objects';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_proc p
      CROSS JOIN pg_roles g
     WHERE p.oid = 'public.admin_user_detail(uuid)'::regprocedure
       AND g.rolname IN ('anon', 'PUBLIC')
       AND has_function_privilege(p.oid, g.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'admin_user_detail() is still executable by anon/PUBLIC';
  END IF;
END $$;
