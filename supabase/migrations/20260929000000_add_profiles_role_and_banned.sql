-- ============================================================================
-- 20260929000000_add_profiles_role_and_banned.sql
-- Admin control center — authorization + suspension on `profiles`.
-- ============================================================================
-- WHY
-- ---
-- The admin control center (admin.merodeutsch.pramods.com.np) is gated on
-- `profiles.role`. The column was designed in an earlier plan but NEVER APPLIED
-- — this is the first migration to create it, so it has to be self-sufficient.
--
-- `banned_at` is added in the same migration because "ban" is a
-- suspension-and-audit feature, not a deletion: the row is kept so a learner's
-- history, review queue and streak statistics survive an appeal, and
-- `admin_audit_log` (20260929010000) can reference the target.
--
-- THE IMPORTANT PART: `role` IS NOT USER-WRITABLE
-- ------------------------------------------------
-- `profiles` already has an owner-scoped UPDATE policy from the initial schema.
-- RLS alone does NOT protect a column from a policy the user already satisfies:
-- without the guard trigger below, any learner could run
-- `update profiles set role='admin' where id=auth.uid()` from a browser console
-- and grant themselves the entire control center — including reading every
-- other user's rows via the admin policies.
--
-- This mirrors `protect_profile_plan()` from 20260927120000_add_profiles_plan.sql
-- exactly: the same SECURITY DEFINER trigger, the same privileged-role list, the
-- same failure mode. A column that decides who may read the database is not
-- something the database's own subject should be able to promote themselves into.
--
-- Bootstrap: the first admin is granted out of band, by hand, in the SQL
-- editor — `UPDATE profiles SET role='admin' WHERE id = '<uuid>';` — which runs
-- as `postgres` and therefore passes the guard. There is deliberately no
-- self-service path, no signup flag, and no "first user becomes admin" rule.
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

-- ── Columns ────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;

-- A CHECK (not an enum) keeps adding a tier a one-line change. Wrapped in a DO
-- block because Postgres has no `ADD CONSTRAINT IF NOT EXISTS`.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('user', 'admin'));
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.role IS
  'Authorization tier. ''admin'' grants access to the control center at admin.merodeutsch.pramods.com.np. Never user-writable; granted out of band.';
COMMENT ON COLUMN public.profiles.banned_at IS
  'When set, the account is suspended. NULL = active.';

-- ── Guard: role and ban state are privileged writes only ────────────────────
-- SECURITY INVOKER, NOT SECURITY DEFINER — this is the whole point.
--
-- A SECURITY DEFINER trigger executes with the function OWNER as current_user,
-- so `IF current_user NOT IN ('postgres', …)` would ALWAYS see 'postgres' and
-- would never raise. That exact bug shipped in the earlier
-- `protect_profile_plan()` (20260927120000), and this function was written the
-- same way; on a live database it was confirmed exploitable — a simulated
-- signed-in learner could run `update profiles set role='admin'` on their own
-- row and succeed. See migration 20260929020000 for the applied fix.
--
-- Because the function reads no tables (only OLD/NEW plus the session role), it
-- needs no elevated rights, so INVOKER is both correct and the stronger option.
--
-- The caller is identified by BOTH:
--   current_user  — what PostgREST reports for a request. PostgREST connects as
--                   `authenticator` and issues `SET LOCAL ROLE <user>`, so a
--                   signed-in learner is current_user='authenticated' and an
--                   anonymous one is 'anon'. Neither is privileged → blocked.
--   session_user  — survives SECURITY DEFINER; OR-ed in so privileged callers
--                   (service_role via the Management API, the SQL editor) pass.
CREATE OR REPLACE FUNCTION public.protect_profile_privilege()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  actor text := session_user;
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role) OR (NEW.banned_at IS DISTINCT FROM OLD.banned_at) THEN
    IF actor NOT IN ('postgres', 'service_role', 'supabase_admin')
       AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin')
    THEN
      RAISE EXCEPTION
        'profiles.role / profiles.banned_at are not user-writable (session_user=%, current_user=%)',
        actor, current_user
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_privilege_guard ON public.profiles;

CREATE TRIGGER profiles_privilege_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privilege();

-- ── Helper: "is the caller an active admin?" ────────────────────────────────
-- SECURITY DEFINER + a fixed search_path so the subquery cannot be hijacked by
-- a caller-controlled schema. STABLE so it can be used in policy predicates
-- without being re-evaluated per row of a large scan.
--
-- A BANNED admin is not an active admin: suspension is not bypassed by rank.
CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.banned_at IS NULL
  );
$$;

-- ── RLS: admins may read every profile; everyone else keeps their own row ────
-- The existing owner policy is left untouched — this ADDS the admin branch, so
-- no learner's access narrows as a result of this migration.
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.is_active_admin());

-- Admins may update any profile, but the guard trigger above still blocks a
-- normal client write from changing role/ban state; promotion and bans are
-- privileged operations run by SQL or service role.
DROP POLICY IF EXISTS "Admins can update any profiles" ON public.profiles;
CREATE POLICY "Admins can update any profiles"
  ON public.profiles
  FOR UPDATE
  USING (public.is_active_admin());

-- ── RLS: admins may READ the user-scoped learning tables ────────────────────
-- Everything below is READ-ONLY for admins. Writing a learner's progress, XP,
-- streak or review queue is never an admin capability — it would corrupt the
-- very statistics the control center exists to report.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'user_progress', 'user_streaks', 'user_achievements',
    'user_xp', 'user_activity_days', 'a1_path_state', 'review_queue'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Admins can read ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (public.is_active_admin())',
      'Admins can read ' || t, t
    );
  END LOOP;
END $$;

COMMIT;

-- Invariant: a non-admin, non-service client must never be able to write
-- `role` or `banned_at`. The guard trigger raises; this asserts the shape of
-- the policy set, so a future migration that adds a blanket UPDATE policy on
-- profiles fails loudly here rather than silently re-opening privilege
-- escalation.
DO $$
DECLARE
  bad text;
BEGIN
  -- `format()` per row, NOT `string_agg(<row alias>, …)`. Passing the table
  -- alias to string_agg passes the whole composite row, which has no
  -- string_agg(text, text) overload and fails with 42883. The column is
  -- `policyname`, not `polname`.
  SELECT string_agg(
           format('%s (cmd=%s, qual=%s)', pol.policyname, pol.cmd, coalesce(pol.qual, 'NULL')),
           ', '
         ) INTO bad
  FROM pg_policies pol
  WHERE pol.schemaname = 'public'
    AND pol.tablename = 'profiles'
    AND pol.cmd IN ('INSERT', 'UPDATE')
    AND pol.qual IS NOT NULL
    AND pol.qual NOT ILIKE '%auth.uid()%'
    AND pol.qual NOT ILIKE '%is_active_admin%';

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'profiles write policy not scoped to the owner or an admin: %', bad;
  END IF;
  RAISE NOTICE 'OK - profiles.role/banned_at guarded; admin read policies installed';
END $$;

NOTIFY pgrst, 'reload schema';
