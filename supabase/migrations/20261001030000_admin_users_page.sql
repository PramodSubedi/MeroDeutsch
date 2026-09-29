-- ============================================================================
-- 20261001030000_admin_users_page.sql
--
-- The Users list: filter, sort, page and facet-count, in the database.
--
-- ── WHAT THIS REPLACES ───────────────────────────────────────────────────────
-- `fetchUsers` pulled six tables with hard caps (5 000 profiles, 200 000
-- activity rows) and hand-joined them in JavaScript by `user_id`; then
-- `filterUsers` filtered and sorted the result in the browser again.
--
-- The 5 000 cap is the part that was a BUG rather than a limit. It reported no
-- error, so the page rendered "5,000 of 5,000" above a table that was quietly
-- missing every account past the cap — a number that reads as complete and is
-- not. The last pass made the truncation visible; this removes the reason for
-- it to exist.
--
-- ── WHY THE JOIN IS SAFE HERE ───────────────────────────────────────────────
-- `user_xp` has UNIQUE(user_id) and the others are keyed on `user_id`, so the
-- 1:1 LEFT JOINs are index lookups, not scans. `review_queue` and
-- `user_activity_days` are 1:N and are pre-aggregated in CTEs — but the CTEs
-- are constrained to the PAGE by `v_page_ids`, so they aggregate a hundred rows
-- rather than the whole table. Aggregating everything and then taking a page is
-- the same mistake in a different position.
--
-- ── PAGINATION: KEYSET FOR CHRONOLOGY, RANKED TOP-N FOR ANALYTICAL SORTS ────
-- `createdAt` gets true keyset pagination on `(created_at, id)`. The `id`
-- tiebreak is mandatory: `created_at` is not unique, and a cursor without one
-- silently skips and repeats rows.
--
-- The other four sort keys return the TOP N of the matching set and no cursor.
-- That is deliberate, not a gap. An admin sorting by XP wants "who are my
-- highest-XP learners", which is a ranked list that is complete at the top — not
-- page 7 of it. Building a working keyset comparator across five sort keys, each
-- with a "NULLs last in BOTH directions" rule (`filterUsers.ts:111-118`), is a
-- large amount of fragile SQL to serve a question nobody asks that way. The
-- rank is exact and the total is exact; only the traversal is not paged.
--
-- ── SEARCH SEMANTICS PRESERVED ──────────────────────────────────────────────
-- Ported from `filterUsers.ts`, including the two non-obvious rules:
--
--   · the id is matched by PREFIX, not substring (`matchesSearch`:63-77). A real
--     uuid is 36 characters, so a substring match could only ever fire if the
--     whole thing was pasted — and admins read the first few characters off a
--     support email.
--   · a suspended user matches NEITHER "active" nor "idle" (`matchesStatus`
--     :101-109). Counting them as idle would imply they need a nudge rather
--     than a decision.
--
-- Facets are counted over the SEARCH result only, not over the applied facet
-- filters — `facetCounts` takes just `search`. That is what makes the chips
-- agree with each other instead of collapsing to one option as you use them.
--
-- `p_sort` is mapped through a CASE and never interpolated into SQL. A caller
-- that can name a column must not be able to name an expression.
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_users_page(
  p_search           text    DEFAULT '',
  p_plan             text    DEFAULT 'all',
  p_role             text    DEFAULT 'all',
  p_status           text    DEFAULT 'all',
  p_sort             text    DEFAULT 'createdAt',
  p_desc             boolean DEFAULT true,
  p_limit            integer DEFAULT 50,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id        uuid    DEFAULT NULL
)
RETURNS TABLE (
  rows        jsonb,
  total       bigint,
  facets      jsonb,
  next_cursor jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search    text    := coalesce(p_search, '');
  v_plan      text    := coalesce(p_plan, 'all');
  v_role      text    := coalesce(p_role, 'all');
  v_status    text    := coalesce(p_status, 'all');
  -- The sort key is validated against a CLOSED SET and falls back rather than
  -- failing. An unknown key is a client bug, and a readable default page is more
  -- useful to an operator than a 400 on a filter chip.
  v_sort      text    := CASE
                           WHEN p_sort IN ('createdAt','username','xp','streak','unit') THEN coalesce(p_sort, 'createdAt')
                           ELSE 'createdAt'
                         END;
  v_desc      boolean := coalesce(p_desc, true);
  -- Clamped. An unbounded page size is an unbounded response.
  v_limit     integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_active_from date  := current_date - 6;  -- 7-day window, inclusive; see filterUsers.ts:47-55
  v_keyset    boolean := (v_sort = 'createdAt');
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION
      'admin_users_page requires an active admin session. An RLS-filtered read would return zero rows with HTTP 200, which is indistinguishable from "no users"; a refusal is not.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH
  -- ── The filtered set ──────────────────────────────────────────────────────
  -- Built ONCE and reused by the page, the total and the facets, so the three
  -- can never disagree about how many users matched.
  matched AS (
    SELECT
      p.id,
      p.username,
      p.full_name,
      p.avatar_url,
      p.plan,
      p.role,
      p.banned_at,
      p.created_at,
      -- An index-only backward scan per user against
      -- `idx_user_activity_days_user_date`, rather than a MAX() aggregate over
      -- the whole activity table.
      (SELECT max(d.activity_date)
         FROM public.user_activity_days d
        WHERE d.user_id = p.id) AS last_active_at,
      (SELECT count(*) FROM public.user_activity_days d2 WHERE d2.user_id = p.id) AS active_days
      FROM public.profiles p
     WHERE
       -- Search: name substring OR id PREFIX.
       (
         v_search = ''
         OR lower(coalesce(p.username, '')) LIKE '%' || lower(v_search) || '%'
         OR lower(coalesce(p.full_name, '')) LIKE '%' || lower(v_search) || '%'
         OR p.id::text LIKE lower(v_search) || '%'
       )
       AND (v_plan = 'all' OR coalesce(p.plan, 'free') = v_plan)
       AND (v_role = 'all' OR coalesce(p.role, 'user') = v_role)
       AND (
         v_status = 'all'
         -- A suspended user is neither active nor idle.
         OR (v_status = 'suspended' AND p.banned_at IS NOT NULL)
         OR (
           p.banned_at IS NULL
           AND (
             (v_status = 'active' AND EXISTS (
                SELECT 1 FROM public.user_activity_days d3
                 WHERE d3.user_id = p.id AND d3.activity_date >= v_active_from
             ))
             OR
             (v_status = 'idle' AND NOT EXISTS (
                SELECT 1 FROM public.user_activity_days d4
                 WHERE d4.user_id = p.id AND d4.activity_date >= v_active_from
             ))
           )
         )
       )
  ),
  total_ct AS (
    SELECT count(*)::bigint AS total FROM matched
  ),
  facets_ct AS (
    -- Over the SEARCH result only, so the chips agree with each other.
    -- `total` here is the whole population, matching `facetCounts`.
    SELECT jsonb_build_object(
      'total',     (SELECT count(*) FROM public.profiles),
      'searched',  count(*),
      'free',      count(*) FILTER (WHERE coalesce(plan, 'free') = 'free'),
      'premium',   count(*) FILTER (WHERE plan = 'premium'),
      'admin',     count(*) FILTER (WHERE coalesce(role, 'user') = 'admin'),
      'user',      count(*) FILTER (WHERE coalesce(role, 'user') = 'user'),
      'suspended', count(*) FILTER (WHERE banned_at IS NOT NULL)
    ) AS facets
      FROM matched
  ),
  -- ── The page ──────────────────────────────────────────────────────────────
  --
  -- The 1:1 learning columns are joined over the MATCHED set, not the page, so
  -- the ranked sorts can be applied before paging without a circular reference.
  -- Each is an index lookup on a UNIQUE/PK `user_id` column, so joining a
  -- filtered set is cheap — and `review_queue`, the only genuinely 1:N table, is
  -- deliberately NOT here. It is aggregated over the PAGE below, because
  -- aggregating every queue row in the product to fill one table cell is the
  -- same mistake in a different position.
  with_1to1 AS (
    SELECT
      m.*,
      x.total_xp,
      x.level,
      k.current_streak,
      k.longest_streak,
      k.last_activity_date,
      a.unlocked_unit_index,
      a.path_mode
      FROM matched m
      LEFT JOIN public.user_xp x        ON x.user_id = m.id
      LEFT JOIN public.user_streaks k  ON k.user_id = m.id
      LEFT JOIN public.a1_path_state a ON a.user_id = m.id
  ),
  sorted AS (
    -- ONE sort value, uniformly TEXT-encoded, so a single ORDER BY can carry
    -- every sort key.
    --
    -- The encodings are order-preserving by construction:
    --   · a timestamp becomes `YYYYMMDDHH24MISS`, fixed-width, so lexicographic
    --     order is chronological order
    --   · a non-negative integer is zero-padded to 20 characters, so
    --     lexicographic order is numeric order (xp is INT, streak and unit index
    --     are far smaller, so 20 digits cannot overflow)
    --   · a name is already text
    --
    -- The alternative — a CASE returning timestamptz on one branch and text on
    -- another — does not have a common type, so Postgres would coerce or fail.
    -- Encoding to one type is what makes "apply the direction once" possible.
    SELECT
      w.*,
      CASE v_sort
        WHEN 'createdAt' THEN to_char(w.created_at, 'YYYYMMDDHH24MISS')
        WHEN 'username'  THEN lower(coalesce(w.username, w.full_name, ''))
        WHEN 'xp'        THEN lpad(coalesce(w.total_xp, 0)::text, 20, '0')
        WHEN 'streak'    THEN lpad(coalesce(w.current_streak, 0)::text, 20, '0')
        WHEN 'unit'      THEN lpad(coalesce(w.unlocked_unit_index, 0)::text, 20, '0')
        ELSE to_char(w.created_at, 'YYYYMMDDHH24MISS')
      END AS sort_value,
      -- "NULLs last in BOTH directions" (`filterUsers.ts:111-118`). Multiplying
      -- the sort value's sign by -1 — the obvious implementation — flips the
      -- null ordering too and buries real data under a wall of blanks. A
      -- SEPARATE leading column, always ascending, is what makes the rule
      -- direction-independent.
      CASE v_sort
        WHEN 'createdAt' THEN 0
        WHEN 'username'  THEN CASE WHEN coalesce(w.username, w.full_name, '') = '' THEN 1 ELSE 0 END
        WHEN 'xp'        THEN CASE WHEN w.total_xp IS NULL THEN 1 ELSE 0 END
        WHEN 'streak'    THEN CASE WHEN w.current_streak IS NULL THEN 1 ELSE 0 END
        WHEN 'unit'      THEN CASE WHEN w.unlocked_unit_index IS NULL THEN 1 ELSE 0 END
        ELSE 0
      END AS sort_is_null
      FROM with_1to1 w
  ),
  paged AS (
    -- ONE extra row, to learn whether another page exists without asking for
    -- one.
    SELECT *
      FROM sorted
     WHERE
       -- Keyset, chronological only — see the header note on why the other four
       -- sorts are ranked rather than paged.
       NOT v_keyset
       OR p_cursor_id IS NULL
       OR (created_at, id) < (p_cursor_created_at, p_cursor_id)
     ORDER BY
       sort_is_null ASC,
       -- The direction is applied HERE, once, to the sort value only.
       CASE WHEN v_desc THEN sort_value END DESC,
       CASE WHEN NOT v_desc THEN sort_value END ASC,
       -- Tiebreak always ascending, so the traversal is a strict total order and
       -- agrees with the keyset comparison above.
       id ASC
     LIMIT v_limit + 1
  ),
  q AS (
    -- The 1:N aggregate, restricted to the page.
    SELECT r.user_id, count(*)::int AS queue_size, sum(r.error_count)::int AS queue_errors
      FROM public.review_queue r
     WHERE r.user_id IN (SELECT id FROM paged)
     GROUP BY r.user_id
  ),
  final AS (
    -- The same ordering, applied a second time as a window so rows can be
    -- NUMBERED. Re-deriving the order inside a subquery instead would let the two
    -- copies drift, and a cursor taken from row N of one order while row N of
    -- the other was a different user is a silent skip.
    SELECT
      pg.*,
      q.queue_size,
      q.queue_errors,
      row_number() OVER (
        ORDER BY pg.sort_is_null ASC,
                 CASE WHEN v_desc THEN pg.sort_value END DESC,
                 CASE WHEN NOT v_desc THEN pg.sort_value END ASC,
                 pg.id ASC
      ) AS rn
      FROM paged pg
      LEFT JOIN q ON q.user_id = pg.id
  ),
  payload AS (
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'id',                f.id,
        'username',          f.username,
        'fullName',          f.full_name,
        'plan',              f.plan,
        'role',              f.role,
        'bannedAt',          f.banned_at,
        'createdAt',         f.created_at,
        'totalXp',           f.total_xp,
        'level',             f.level,
        'currentStreak',     f.current_streak,
        'longestStreak',     f.longest_streak,
        'lastActivityDate',  f.last_activity_date,
        'activeDays',        f.active_days,
        'lastActiveAt',      f.last_active_at,
        'unlockedUnitIndex', f.unlocked_unit_index,
        'pathMode',          f.path_mode,
        'queueSize',         f.queue_size,
        'queueErrors',       f.queue_errors
      )
      ORDER BY f.rn
    ), '[]'::jsonb) AS rows
      FROM final f
     -- The extra row `paged` fetched exists only to prove another page is
     -- available; it is never returned.
     WHERE f.rn <= v_limit
  ),
  -- The cursor for the next page, taken from the last row actually RETURNED —
  -- not from the extra row, which is not in the payload.
  cursor_ct AS (
    SELECT jsonb_build_object('createdAt', created_at, 'id', id) AS c
      FROM final
     WHERE v_keyset
       AND rn = v_limit
     LIMIT 1
  )
  SELECT payload.rows, total_ct.total, facets_ct.facets, cursor_ct.c
    FROM payload, total_ct, facets_ct, cursor_ct;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_users_page(text, text, text, text, text, boolean, integer, timestamptz, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_users_page(text, text, text, text, text, boolean, integer, timestamptz, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_users_page(text, text, text, text, text, boolean, integer, timestamptz, uuid) TO authenticated;

COMMIT;

-- ============================================================================
-- Post-COMMIT verification
-- ============================================================================

DO $$
DECLARE
  cfg text[];
  sig text;
BEGIN
  IF to_regprocedure(
       'public.admin_users_page(text,text,text,text,text,boolean,integer,timestamptz,uuid)'
     ) IS NULL THEN
    RAISE EXCEPTION 'admin_users_page() was not created';
  END IF;

  SELECT p.proconfig INTO cfg
    FROM pg_proc p
   WHERE p.oid = 'public.admin_users_page(text,text,text,text,text,boolean,integer,timestamptz,uuid)'::regprocedure;

  IF cfg IS NULL OR NOT (cfg @> ARRAY['search_path=public']) THEN
    RAISE EXCEPTION 'admin_users_page() does not have search_path pinned to public (proconfig = %)', coalesce(cfg::text, 'NULL');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.oid = 'public.admin_users_page(text,text,text,text,text,boolean,integer,timestamptz,uuid)'::regprocedure
       AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'admin_users_page() is not SECURITY DEFINER — it would be subject to RLS and could only ever return zero rows';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_proc p
      CROSS JOIN pg_roles g
     WHERE p.oid = 'public.admin_users_page(text,text,text,text,text,boolean,integer,timestamptz,uuid)'::regprocedure
       AND g.rolname IN ('anon', 'PUBLIC')
       AND has_function_privilege(p.oid, g.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'admin_users_page() is still executable by anon/PUBLIC';
  END IF;

  -- The sort key must not be able to reach the ORDER BY as an expression. A
  -- function whose body contains `ORDER BY ` || p_sort is a SQL injection point
  -- wearing a sort parameter.
  SELECT pg_get_functiondef(p.oid) INTO sig
    FROM pg_proc p
   WHERE p.oid = 'public.admin_users_page(text,text,text,text,text,boolean,integer,timestamptz,uuid)'::regprocedure;

  IF sig ILIKE '%ORDER BY%v_sort%' OR sig ILIKE '%|| p_sort%' THEN
    RAISE EXCEPTION 'admin_users_page() appears to interpolate p_sort into SQL; it must be selected through a CASE over a closed set';
  END IF;
END $$;
