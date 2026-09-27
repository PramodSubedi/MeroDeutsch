-- ============================================================================
-- 20260929020000_admin_table_counts.sql
-- Row counts for the control centre's System section.
-- ============================================================================
-- WHY A FUNCTION AND NOT A CLIENT-SIDE COUNT
--   The admin app must not enumerate the schema: `information_schema.tables` is
--   world-readable but useless for row counts, and counting rows from the client
--   means one request per table. A single call returning (table_name, row_count)
--   is one round trip and a stable contract.
--
-- WHY NOT `pg_class.reltuples`
--   That is a planner approximation and is frequently -1 on a table that has
--   never been ANALYZEd — which is most of them on a small database. An admin
--   tool that reports "about 1000" for a table holding 1062 is worse than no
--   number at all, and the error is invisible.
--
-- THE SECURITY POSTURE, EXPLICITLY
--   SECURITY DEFINER is REQUIRED: reading every table's rows would otherwise
--   need every RLS policy relaxed, which is the opposite of what this database
--   does. The function therefore runs as its owner, but it is deliberately
--   dumb — it returns a table NAME and a COUNT and nothing else. No rows, no
--   column values, no user data.
--
-- `to_regclass` returns NULL for a missing table, so this is safe to re-run
-- before a table exists: the row is omitted rather than raising.
--
-- The grant block, and WHY IT REVOKES FROM `anon` EXPLICITLY
-- -------------------------------------------------------------
--   Supabase grants EXECUTE on new functions to `PUBLIC` by default, and `anon`
--   is a member of PUBLIC. So `GRANT … TO authenticated` does NOT exclude anon,
--   and `REVOKE … FROM PUBLIC` ALONE IS NOT SUFFICIENT — the first version of
--   this file asserted clean and failed on exactly this point, which is what
--   produced a follow-up migration whose only job was to revoke from anon.
--
--   Both roles are therefore revoked here, in the file that creates the
--   function, and the assertion below runs LAST so a fresh `supabase db reset`
--   passes instead of failing on a leak this file had just introduced.
--   `authenticated` keeps EXECUTE; its shared-by-every-learner nature is handled
--   by the in-body `is_active_admin()` check, not by the grant.
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_table_counts()
RETURNS TABLE (table_name text, row_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t text;
BEGIN
  -- Re-check authorization at CALL time, not just at grant time. A non-admin,
  -- and a BANNED admin, both get an empty set rather than an error — an error
  -- would confirm the function exists, which is itself a small disclosure.
  IF NOT public.is_active_admin() THEN
    RETURN;
  END IF;

  FOREACH t IN ARRAY ARRAY[
    'profiles',
    'user_progress',
    'user_streaks',
    'user_achievements',
    'user_xp',
    'user_activity_days',
    'a1_path_state',
    'review_queue',
    'vocabulary',
    'sentences',
    'content_items',
    'curriculum_versions',
    'admin_audit_log',
    'app_config'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      -- plpgsql cannot interpolate an identifier into a static query, so the
      -- count is issued with format() + EXECUTE. `%I` quotes the identifier.
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO row_count;
      table_name := t;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- `authenticated` only. The body re-checks `is_active_admin()`, so a signed-in
-- LEARNER calling this gets zero rows even though the grant permits the call.
--
-- `anon` is revoked by name as well as via PUBLIC. It has to be: anon is a
-- member of PUBLIC, so a PUBLIC-only revoke left it able to execute, and the
-- assertion below is what caught that. Revoking both roles here means a fresh
-- replay of this file is self-consistent — it can no longer fail on a leak it
-- introduced three statements earlier.
REVOKE ALL ON FUNCTION public.admin_table_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_table_counts() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_table_counts() TO authenticated;

COMMIT;

-- Invariant: `anon` must not be able to call this. NOTE that this check is on
-- effective privilege, which is what caught the PUBLIC-membership leak: a
-- grant-only assertion on `pg_proc.proacl` would have reported clean while
-- anon could still execute.
DO $$
DECLARE
  anon_exec boolean;
BEGIN
  SELECT has_function_privilege('anon', 'public.admin_table_counts()', 'EXECUTE')
    INTO anon_exec;

  IF anon_exec THEN
    RAISE EXCEPTION
      'anon can execute admin_table_counts() — revoke EXECUTE from anon and PUBLIC explicitly';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.admin_table_counts()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated lost EXECUTE on admin_table_counts()';
  END IF;

  RAISE NOTICE 'OK - anon blocked, authenticated permitted (and re-gated in the body)';
END $$;
