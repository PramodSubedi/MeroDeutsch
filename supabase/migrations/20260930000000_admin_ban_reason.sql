-- ============================================================================
-- 20260930000000_admin_ban_reason.sql
-- `profiles.ban_reason` — why an account was suspended.
-- ============================================================================
-- WHY THIS EXISTS
-- The `admin-action` Edge Function writes a reason alongside every ban:
-- a peer admin MUST supply one (enforced in guards.ts), and a learner ban may
-- carry one. Without a column to put it in, that reason could only ever live in
-- `admin_audit_log` — which means the answer to "why is this account
-- suspended?" is unavailable to anyone reading `profiles`, and unavailable
-- outright if the audit trail is ever pruned or the row is exported.
--
-- `banned_at` answers WHEN. This answers WHY. Both are kept.
--
-- NULLABLE and defaulting to NULL, so every existing row is valid and a reason
-- is never required to be retroactively invented. Rows banned before this
-- migration simply have no reason; that is a true statement about them.
--
-- The 500-char cap mirrors the Edge Function's own truncation, so the value
-- stored is exactly the value that was validated.
--
-- SECURITY: like `role` and `banned_at`, this is a privileged column. The
-- existing `protect_profile_privilege()` trigger only watches `role` and
-- `banned_at`, so a learner who satisfies the owner-scoped UPDATE policy could
-- rewrite their OWN ban_reason — erasing the stated justification for their
-- suspension while remaining suspended. It is therefore added to that trigger's
-- watch list in the same migration.
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ban_reason TEXT;

COMMENT ON COLUMN public.profiles.ban_reason IS
  'Why this account was suspended, when a reason was given. NULL for accounts banned before this column existed, and for unbanned accounts.';

-- Belt and braces: the column is documentation, not free text storage. 500
-- matches the Edge Function truncation exactly.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_ban_reason_len') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_ban_reason_len
      CHECK (ban_reason IS NULL OR length(ban_reason) <= 500);
  END IF;
END $$;

-- Extend the existing privilege guard to cover the new column.
--
-- SECURITY INVOKER, matching 20260929020000. The earlier SECURITY DEFINER
-- version of this trigger never raised, which made privilege escalation live on
-- production; re-creating it as DEFINER would reintroduce that exact bug. It
-- reads no tables, so INVOKER costs nothing and is strictly stronger.
CREATE OR REPLACE FUNCTION public.protect_profile_privilege()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  actor text := session_user;
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role)
     OR (NEW.banned_at IS DISTINCT FROM OLD.banned_at)
     OR (NEW.ban_reason IS DISTINCT FROM OLD.ban_reason)
  THEN
    IF actor NOT IN ('postgres', 'service_role', 'supabase_admin')
       AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin')
    THEN
      RAISE EXCEPTION
        'profiles.role / profiles.banned_at / profiles.ban_reason are not user-writable (session_user=%, current_user=%)',
        actor, current_user
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;

-- Assert the guard is still INVOKER. `prosecdef` must be false, or the guard is
-- decorative again — which is precisely how the original shipped broken.
DO $$
DECLARE
  still_definer text;
BEGIN
  SELECT string_agg(proname, ', ') INTO still_definer
  FROM pg_proc
  WHERE proname = 'protect_profile_privilege'
    AND prosecdef;

  IF still_definer IS NOT NULL THEN
    RAISE EXCEPTION 'protect_profile_privilege is SECURITY DEFINER again: %', still_definer;
  END IF;
  RAISE NOTICE 'OK - protect_profile_privilege is SECURITY INVOKER and covers ban_reason';
END $$;

NOTIFY pgrst, 'reload schema';
