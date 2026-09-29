-- ============================================================================
-- 20261001040000_admin_audit_and_queue_pages.sql
--
-- Keyset pagination for the two remaining capped admin lists.
--
-- ── WHY THE AUDIT LOG'S FILTERS MUST MOVE HERE TOO ──────────────────────────
-- `fetchAuditLog(500)` fetched a capped prefix and `filterAuditEntries` then
-- filtered it IN THE BROWSER. That is correct only while the filter runs over
-- the whole set. The moment the read is paged, filtering a page answers a
-- different question: "bans on page 3" is not "bans", it is "bans, among the
-- 200 most recent audit rows". So the filters come with the pagination, or the
-- pagination is a lie about what the page shows.
--
-- ── THE OUTCOME SUFFIX ──────────────────────────────────────────────────────
-- `action` carries its outcome as a suffix — `user.ban`, `user.ban.denied`,
-- `user.ban.failed` — and the client collapses those back to a facet by stripping
-- the suffix (`auditLog.ts` `actionFacets`). Filtering therefore matches the
-- BASE action, so choosing "user.ban" shows allowed, denied and failed
-- attempts together rather than quietly hiding the refusals.
--
-- ── WHY THE QUEUE'S NONDETERMINISM GOES AWAY ─────────────────────────────────
-- `reviewQueue.ts:161` was `.limit(20000)` with NO `.order()` and no count. That
-- is not a slow query, it is an undefined one: PostgREST returns an unspecified
-- subset, so the overview changed between two reloads of an unchanged database,
-- and the totals were whatever happened to arrive. The ordering here is
-- `(due_at, id)` — `id` because `due_at` is not unique, and without the tiebreak
-- paging skips and repeats rows.
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

-- ── The audit log ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_audit_page(
  p_search            text    DEFAULT '',
  p_action            text    DEFAULT '',
  p_target_id         text    DEFAULT '',
  p_admin_id          uuid    DEFAULT NULL,
  p_limit             integer DEFAULT 50,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id         uuid    DEFAULT NULL
)
RETURNS TABLE (
  entries     jsonb,
  total       bigint,
  next_cursor jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text    := coalesce(p_search, '');
  v_action text    := coalesce(p_action, '');
  v_target text    := coalesce(p_target_id, '');
  v_limit  integer := least(greatest(coalesce(p_limit, 50), 1), 500);
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION
      'admin_audit_page requires an active admin session. An RLS-filtered read would return zero rows with HTTP 200, which is indistinguishable from "no activity"; a refusal is not.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH matched AS (
    SELECT a.*
      FROM public.admin_audit_log a
     WHERE
       (v_action = '' OR a.action = v_action OR a.action LIKE v_action || '.%')
       AND (v_target = '' OR a.target_id = v_target)
       AND (p_admin_id IS NULL OR a.admin_id = p_admin_id)
       AND (
         v_search = ''
         OR a.action ILIKE '%' || v_search || '%'
         OR coalesce(a.target_id, '') ILIKE '%' || v_search || '%'
       )
  ),
  total_ct AS (
    SELECT count(*)::bigint AS total FROM matched
  ),
  -- One extra row proves another page exists.
  paged AS (
    SELECT * FROM matched
     WHERE p_cursor_id IS NULL
        OR (created_at, id) < (p_cursor_created_at, p_cursor_id)
     ORDER BY created_at DESC, id DESC
     LIMIT v_limit + 1
  ),
  numbered AS (
    SELECT pg.*, row_number() OVER (ORDER BY created_at DESC, id DESC) AS rn
      FROM paged
  ),
  payload AS (
    -- `admin_name` is resolved by a SEPARATE read rather than a nested select on
    -- the client, because a nested select against an RLS-filtered table returns
    -- NULL names SILENTLY (`auditLog.ts:161-162`). The same reasoning applies
    -- here, so the name is deliberately NOT joined: the client resolves it and
    -- fails loudly if it cannot.
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'id',         n.id,
        'adminId',    n.admin_id,
        'action',     n.action,
        'targetType', n.target_type,
        'targetId',   n.target_id,
        'before',     n.before,
        'after',      n.after,
        'userAgent',  n.user_agent,
        'createdAt',  n.created_at
      )
      ORDER BY n.rn
    ), '[]'::jsonb) AS entries
      FROM numbered n
     WHERE n.rn <= v_limit
  ),
  cursor_ct AS (
    SELECT jsonb_build_object('createdAt', created_at, 'id', id) AS c
      FROM numbered
     WHERE rn = v_limit
     LIMIT 1
  )
  SELECT payload.entries, total_ct.total, cursor_ct.c
    FROM payload, total_ct, cursor_ct;
END;
$$;

-- ── The review queue ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_review_queue_page(
  p_search       text    DEFAULT '',
  p_module       text    DEFAULT '',
  p_box          integer DEFAULT NULL,
  p_overdue_only boolean DEFAULT false,
  p_limit        integer DEFAULT 50,
  p_cursor_due   timestamptz DEFAULT NULL,
  p_cursor_id    text    DEFAULT NULL
)
RETURNS TABLE (
  items       jsonb,
  total       bigint,
  totals      jsonb,
  next_cursor jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text    := coalesce(p_search, '');
  v_module text    := coalesce(p_module, '');
  v_limit  integer := least(greatest(coalesce(p_limit, 50), 1), 500);
  v_now    timestamptz := now();
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION
      'admin_review_queue_page requires an active admin session. An RLS-filtered read would return zero rows with HTTP 200, which is indistinguishable from "an empty queue"; a refusal is not.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH matched AS (
    SELECT r.*
      FROM public.review_queue r
     WHERE
       (v_module = '' OR r.module_type = v_module)
       AND (p_box IS NULL OR r.box_level = p_box)
       -- Overdue is a comparison against NOW, not against a caller-supplied
       -- string, so it cannot be widened or narrowed by the caller.
       AND (NOT coalesce(p_overdue_only, false) OR r.due_at < v_now)
       AND (
         v_search = ''
         OR r.item_key ILIKE '%' || v_search || '%'
         OR coalesce(r.user_answer, '') ILIKE '%' || v_search || '%'
       )
  ),
  total_ct AS (
    SELECT count(*)::bigint AS total FROM matched
  ),
  -- The header totals, over the WHOLE filtered set rather than the page — a
  -- count of what is on screen is not a backlog.
  totals_ct AS (
    SELECT jsonb_build_object(
      'total',     count(*),
      'overdue',   count(*) FILTER (WHERE due_at < v_now),
      'due',       count(*) FILTER (WHERE due_at >= v_now),
      -- `stale` is a SEPARATE figure from `overdue` and must not be aliased to
      -- it: stale means overdue by more than STALE_AFTER_DAYS, which is a much
      -- smaller and much more alarming number than "overdue".
      --
      -- 30 DAYS, matching `STALE_AFTER_DAYS` in `reviewQueue.ts:95` — which its
      -- own check suite pins ("the stale threshold is exactly 30 days"). This
      -- was written as 7 on the assumption that the constant was a week, which
      -- would have overstated the stale backlog more than fourfold and looked
      -- entirely plausible on a dashboard. If you change one, change both.
      'stale',     count(*) FILTER (
                      WHERE due_at < v_now
                        AND due_at < v_now - interval '30 days'
                    ),
      'oldestDue', min(due_at)
    ) AS totals
      FROM public.review_queue
     WHERE (v_module = '' OR module_type = v_module)
       AND (p_box IS NULL OR box_level = p_box)
  ),
  paged AS (
    -- ASCENDING by due date: this is a work queue, and the most overdue item is
    -- the one an admin is looking for. The previous read had no order at all.
    SELECT * FROM matched
     WHERE p_cursor_id IS NULL
        OR (due_at, id) > (p_cursor_due, p_cursor_id)
     ORDER BY due_at ASC, id ASC
     LIMIT v_limit + 1
  ),
  numbered AS (
    SELECT pg.*, row_number() OVER (ORDER BY due_at ASC, id ASC) AS rn
      FROM paged
  ),
  payload AS (
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'id',              n.id,
        'userId',          n.user_id,
        'itemKey',         n.item_key,
        'moduleType',      n.module_type,
        'box',             n.box,
        'errorCount',      n.error_count,
        'successCount',    n.success_count,
        'lastReviewedAt',  n.last_reviewed_at,
        'dueAt',           n.due_at,
        'createdAt',       n.created_at,
        'userAnswer',      n.user_answer,
        'correctAnswer',   n.correct_answer,
        'intervalDays',    n.interval_days,
        'lastResult',      n.last_result,
        'boxLevel',        n.box_level,
        'errorTag',        n.error_tag,
        -- Derived here rather than in the browser, because "overdue by how much"
        -- is a number every row in the table shows and one formula should own it.
        'overdueDays', greatest(
          0,
          floor(extract(epoch FROM (v_now - n.due_at)) / 86400)::int
        )
      )
      ORDER BY n.rn
    ), '[]'::jsonb) AS items
      FROM numbered n
     WHERE n.rn <= v_limit
  ),
  cursor_ct AS (
    SELECT jsonb_build_object('dueAt', due_at, 'id', id) AS c
      FROM numbered
     WHERE rn = v_limit
     LIMIT 1
  )
  SELECT payload.items, total_ct.total, totals_ct.totals, cursor_ct.c
    FROM payload, total_ct, totals_ct, cursor_ct;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_audit_page(text, text, text, uuid, integer, timestamptz, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_audit_page(text, text, text, uuid, integer, timestamptz, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_audit_page(text, text, text, uuid, integer, timestamptz, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_review_queue_page(text, text, integer, boolean, integer, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_review_queue_page(text, text, integer, boolean, integer, timestamptz, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_review_queue_page(text, text, integer, boolean, integer, timestamptz, text) TO authenticated;

COMMIT;

-- ============================================================================
-- Post-COMMIT verification
-- ============================================================================

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.admin_audit_page(text,text,text,uuid,integer,timestamptz,uuid)',
    'public.admin_review_queue_page(text,text,integer,boolean,integer,timestamptz,text)'
  ]
  LOOP
    IF to_regprocedure(fn) IS NULL THEN
      RAISE EXCEPTION '% was not created', fn;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
       WHERE p.oid = fn::regprocedure AND p.prosecdef
    ) THEN
      RAISE EXCEPTION '% is not SECURITY DEFINER — it would be subject to RLS and could only ever return zero rows', fn;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
       WHERE p.oid = fn::regprocedure
         AND p.proconfig @> ARRAY['search_path=public']
    ) THEN
      RAISE EXCEPTION '% does not have search_path pinned to public', fn;
    END IF;

    IF EXISTS (
      SELECT 1
        FROM pg_proc p
        CROSS JOIN pg_roles g
       WHERE p.oid = fn::regprocedure
         AND g.rolname IN ('anon', 'PUBLIC')
         AND has_function_privilege(p.oid, g.oid, 'EXECUTE')
    ) THEN
      RAISE EXCEPTION '% is still executable by anon/PUBLIC', fn;
    END IF;
  END LOOP;
END $$;
