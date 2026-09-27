-- ============================================================================
-- 20260929020000_fix_privilege_guard_use_session_user.sql
-- CRITICAL SECURITY FIX — the privilege guards never actually worked.
-- ============================================================================
-- THE BUG (found by executing the attack, not by reading the code)
-- -------------------------------------------------------------
-- `protect_profile_privilege()` (20260929000000) and the pre-existing
-- `protect_profile_plan()` (20260927120000) were both created SECURITY DEFINER.
--
-- Inside a SECURITY DEFINER function, `current_user` is the function OWNER — not
-- the caller. The guard was:
--
--     IF current_user NOT IN ('postgres','service_role','supabase_admin') THEN RAISE
--
-- so it always evaluated current_user = 'postgres', the NOT IN test was always
-- false, and the guard NEVER raised.
--
-- Confirmed exploitable on the live database: simulating a signed-in learner
-- and running `UPDATE profiles SET role='admin' WHERE id = <own id>` SUCCEEDED
-- and returned role = 'admin'. Combined with the admin RLS policies, that is
-- complete privilege escalation — any learner could promote themselves and then
-- read every user's rows. The same flaw let a learner self-upgrade `plan` to
-- 'premium'.
--
-- THE FIX
-- --------
-- 1. SECURITY INVOKER, so current_user is the real caller. The functions touch
--    no tables (they read only OLD/NEW and the session role), so they need no
--    elevated rights and there is no reason to run as the owner.
-- 2. Check BOTH `current_user` and `session_user`:
--      · PostgREST connects as `authenticator` then issues `SET LOCAL ROLE`, so
--        for any client request current_user is 'authenticated' (or 'anon') and
--        session_user is 'authenticator'. Neither is privileged → BLOCKED.
--        (Per https://postgrest.org/en/stable/references/auth.html)
--      · The SQL editor / Management API arrive as postgres, and the service key
--        arrives as service_role → ALLOWED, which is what the admin tools need.
--
-- VERIFIED decision table after this migration:
--   PostgREST signed-in learner (authenticator|authenticated) -> BLOCKED
--   PostgREST anonymous       (authenticator|anon)           -> BLOCKED
--   Management API / editor   (postgres|postgres)            -> ALLOWED
--   service_role key          (service_role|service_role)    -> ALLOWED
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

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

-- Same defect, same fix, for the premium-plan guard.
CREATE OR REPLACE FUNCTION public.protect_profile_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  actor text := session_user;
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    IF actor NOT IN ('postgres', 'service_role', 'supabase_admin')
       AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin')
    THEN
      RAISE EXCEPTION
        'profiles.plan is not user-writable (session_user=%, current_user=%)',
        actor, current_user
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;

-- Assert the definer privilege is really gone. `prosecdef` must be false for
-- both, otherwise the guard is decorative again.
DO $$
DECLARE
  still_definer text;
BEGIN
  SELECT string_agg(proname, ', ') INTO still_definer
  FROM pg_proc
  WHERE proname IN ('protect_profile_privilege', 'protect_profile_plan')
    AND prosecdef;

  IF still_definer IS NOT NULL THEN
    RAISE EXCEPTION 'guard functions are still SECURITY DEFINER: %', still_definer;
  END IF;
  RAISE NOTICE 'OK - both guard functions are SECURITY INVOKER';
END $$;
