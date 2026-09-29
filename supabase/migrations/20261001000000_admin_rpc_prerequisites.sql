-- ============================================================================
-- 20261001000000_admin_rpc_prerequisites.sql
--
-- Prerequisites for moving admin aggregation into the database.
--
-- Two unrelated jobs, one file, because neither is useful alone and both are
-- prerequisites for the first admin RPC:
--
--   PART 1  pin the recursion-safety of `is_active_admin()`, and stop `anon`
--           from calling it
--   PART 2  index the columns the admin reads actually filter and sort on
--
-- ── WHY PART 1 EXISTS ────────────────────────────────────────────────────────
-- `is_active_admin()` is `SECURITY DEFINER` and its body reads `public.profiles`
-- (20260929000000:118-132). Two policies ON `profiles` call it:
--
--   "Admins can view all profiles"   USING (public.is_active_admin())   :141
--   "Admins can update any profiles" USING (public.is_active_admin())   :150
--
-- That is the textbook `42P17 infinite recursion detected in policy for
-- relation "profiles"` shape: evaluating a `profiles` policy calls a function
-- that reads `profiles`, whose policies call the function again.
--
-- It does not fire, and the reason is narrow: `SECURITY DEFINER` runs the body
-- as the function OWNER, and migrations are applied through the Management API
-- as `postgres`, which has BYPASSRLS. So the inner read skips RLS entirely and
-- the cycle never forms.
--
-- THAT IS A PROPERTY OF WHO OWNS THE FUNCTION, AND NOTHING IN THE REPO ASSERTS
-- IT. One `ALTER FUNCTION public.is_active_admin() OWNER TO <role>` — a single
-- statement, no migration — makes every admin-gated read fail with 42P17.
--
-- And it fails SILENTLY. RLS row filtering is not an error: a policy that
-- excludes everything returns ZERO ROWS with HTTP 200. So a demoted or
-- suspended admin, or an ownership slip, produces an empty Users table and an
-- empty Analytics page rather than an error anywhere. This is the single
-- highest-leverage invariant in the database, and it was unenforced.
--
-- Part 1a pins it with an assertion that FAILS the migration.
-- Part 1b removes a real, if small, disclosure: the function is currently
-- executable by `anon` at `/rest/v1/rpc/is_active_admin`.
--
-- ── WHY PART 2 EXISTS ────────────────────────────────────────────────────────
-- The admin computes aggregates in the browser, so every dashboard load pulls
-- rows to do arithmetic Postgres was built to do. These are the indexes those
-- reads were missing:
--
--   · `user_activity_days (activity_date)` — the ONLY existing index is
--     `(user_id, activity_date DESC)` (20260928050000:66-67). Every windowed
--     activity read filters on `activity_date`, which is the TRAILING column, so
--     a 30-day window is a sequential scan of the whole table.
--   · `profiles (created_at DESC, id DESC)` — the Users list sorts by
--     `created_at`, and keyset pagination needs the `id` tiebreak in the index
--     because `created_at` is not unique.
--   · `profiles (id) WHERE banned_at IS NOT NULL` — so counting suspended
--     accounts costs O(suspensions) rather than O(users).
--
-- `admin_audit_log` also needs `(created_at DESC, id DESC)` for its keyset
-- read; the existing index is `(created_at DESC)` with no tiebreak.
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1a. Pin the recursion-safety of is_active_admin()
-- ============================================================================

-- Assert the owner has BYPASSRLS. If it does not, the two `profiles` policies
-- that call this function recurse infinitely and every admin read returns zero
-- rows with no error. Failing the migration is the only outcome that surfaces
-- that while there is still someone watching.
DO $$
DECLARE
  owner_name  text;
  owner_bypass boolean;
BEGIN
  SELECT r.rolname, r.rolbypassrls
    INTO owner_name, owner_bypass
    FROM pg_proc p
    JOIN pg_roles r ON r.oid = p.proowner
   WHERE p.oid = 'public.is_active_admin()'::regprocedure;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'is_active_admin() does not exist — the admin RLS policies that call it would not compile. Expected 20260929000000 to have run.';
  END IF;

  IF NOT COALESCE(owner_bypass, false) THEN
    RAISE EXCEPTION
      'is_active_admin() is owned by %, which does NOT have BYPASSRLS. Two policies on public.profiles call it while its body reads public.profiles, so this is infinite recursion (42P17): every admin read would return zero rows with HTTP 200 and no error anywhere. Fix with: ALTER FUNCTION public.is_active_admin() OWNER TO <a role with BYPASSRLS>;',
      owner_name;
  END IF;

  RAISE NOTICE 'is_active_admin() is owned by % (BYPASSRLS) — recursion-safe.', owner_name;
END $$;

-- Belt and braces on the search_path pin, which is what stops a caller-supplied
-- schema from hijacking the body's `public.profiles` reference. Asserted rather
-- than re-set, because re-setting would mask a regression in the definition.
DO $$
DECLARE
  cfg text[];
BEGIN
  SELECT p.proconfig INTO cfg
    FROM pg_proc p
   WHERE p.oid = 'public.is_active_admin()'::regprocedure;

  IF cfg IS NULL OR NOT (cfg @> ARRAY['search_path=public']) THEN
    RAISE EXCEPTION
      'is_active_admin() does not have search_path pinned to public (proconfig = %). Without it a caller-controlled schema can shadow public.profiles inside the SECURITY DEFINER body.',
      coalesce(cfg::text, 'NULL');
  END IF;
END $$;

-- ============================================================================
-- PART 1b. Stop `anon` calling the privilege predicate
-- ============================================================================
--
-- `anon` is a member of PUBLIC, so revoking from PUBLIC alone is not enough —
-- the same trap `admin_table_counts` documents at 20260929020000:93-99. Both
-- roles are revoked by name.
--
-- Impact is limited: `auth.uid()` is null for anon, so the function returns
-- false. What it leaks is the function's existence and, in principle, the
-- caller's admin status if the predicate were ever changed to read a claim.
REVOKE ALL ON FUNCTION public.is_active_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_active_admin() TO authenticated;

-- ============================================================================
-- PART 1c. Assert the fix held
-- ============================================================================
DO $$
DECLARE
  leaked text;
BEGIN
  SELECT string_agg(DISTINCT has_function_privilege(
           p.oid, g.oid, 'EXECUTE')::text, ', ')
    INTO leaked
    FROM pg_proc p
    CROSS JOIN pg_roles g
   WHERE p.oid = 'public.is_active_admin()'::regprocedure
     AND g.rolname IN ('anon', 'PUBLIC')
     AND has_function_privilege(p.oid, g.oid, 'EXECUTE');

  IF leaked IS NOT NULL THEN
    RAISE EXCEPTION 'is_active_admin() is still executable by anon/PUBLIC (has_function_privilege = %). The REVOKE above did not hold.', leaked;
  END IF;
END $$;

-- ============================================================================
-- PART 2. Indexes for the admin read path
-- ============================================================================
--
-- `CREATE INDEX IF NOT EXISTS` throughout, so a re-run is a no-op rather than
-- an error. These are additive: no query changes behaviour, only how fast it
-- reaches the same answer.

-- The 30-day activity window, which is every dashboard load. The existing
-- index leads with `user_id`, so a `WHERE activity_date >= …` scan cannot use
-- it at all.
CREATE INDEX IF NOT EXISTS idx_user_activity_days_date
  ON public.user_activity_days (activity_date);

-- Keyset pagination for the Users list. `id` is in the index because
-- `created_at` is NOT unique, and a cursor of `(created_at, id)` needs both
-- columns to be seekable — without the tiebreak, paging skips and repeats rows.
CREATE INDEX IF NOT EXISTS idx_profiles_created_id
  ON public.profiles (created_at DESC, id DESC);

-- Counting suspended accounts. Without this, `count(*) FILTER (WHERE banned_at
-- IS NOT NULL)` costs a full scan of profiles; with it, the cost is the number
-- of suspensions.
CREATE INDEX IF NOT EXISTS idx_profiles_banned
  ON public.profiles (id)
  WHERE banned_at IS NOT NULL;

-- Keyset pagination for the audit log. The existing
-- `idx_admin_audit_log_created (created_at DESC)` has no tiebreak, so a
-- `(created_at, id)` cursor is not seekable against it.
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_id
  ON public.admin_audit_log (created_at DESC, id DESC);

-- Keyset pagination for the review queue, and the "what is due" read.
-- `idx_review_queue_user_due` is `(user_id, due_at)`, which does not serve a
-- global `ORDER BY due_at`.
CREATE INDEX IF NOT EXISTS idx_review_queue_due_id
  ON public.review_queue (due_at, id);

COMMIT;

-- ============================================================================
-- Post-COMMIT verification.
--
-- Assertions live OUTSIDE the transaction on purpose: the change is durable
-- first, and only the verification can fail. Same ordering as
-- 20260929020000:36-39.
-- ============================================================================

DO $$
DECLARE
  present text;
BEGIN
  FOREACH present IN ARRAY ARRAY[
    'idx_user_activity_days_date',
    'idx_profiles_created_id',
    'idx_profiles_banned',
    'idx_admin_audit_log_created_id',
    'idx_review_queue_due_id'
  ]
  LOOP
    IF to_regclass('public.' || present) IS NULL THEN
      RAISE EXCEPTION 'index public.% was not created', present;
    END IF;
  END LOOP;
END $$;

-- The partial index must actually be PARTIAL. A non-partial index of the same
-- name would be a silently different (and much larger) object.
DO $$
DECLARE
  def text;
BEGIN
  SELECT indexdef INTO def
    FROM pg_indexes
   WHERE schemaname = 'public' AND indexname = 'idx_profiles_banned';

  IF def NOT ILIKE '%WHERE%' THEN
    RAISE EXCEPTION 'idx_profiles_banned is not a partial index: %', def;
  END IF;
END $$;
