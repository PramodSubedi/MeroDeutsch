-- ============================================================================
-- Premium entitlement: add profiles.plan
-- ============================================================================
-- WHY
-- The A1 curriculum has two tiers:
--   FREE — the interactive lesson surface (the 7-step unit scaffold, word cards,
--          generated exercises, checkpoints).
--   PAID — the document-style "notes" deep-dive, i.e. the full NotebookLM
--          lesson read as an article.
--
-- `profiles` already exists (initial_schema) with RLS limited to each user's own
-- row, so a plan column is all the app needs to read entitlement. There is NO
-- billing provider wired up yet: this migration creates the SEAM, and the plan
-- is granted manually (dashboard/SQL) until Stripe exists. A client must never
-- be able to write its own plan, so the column is write-protected by leaving the
-- existing own-row UPDATE policy in place but adding a guard trigger below —
-- without it, the existing "Users can update their own profile" policy would
-- happily let a user self-upgrade.
--
-- Idempotent: safe to re-run.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';

-- Constrain to the two tiers we actually ship. A CHECK (not an enum) keeps
-- adding a tier a one-line change with no type migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_plan_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_plan_check
      CHECK (plan IN ('free', 'premium'));
  END IF;
END $$;

COMMENT ON COLUMN profiles.plan IS
  'Entitlement tier. ''free'' = interactive lessons. ''premium'' = document-style notes deep-dive. Granted manually until a billing provider is wired up.';

-- Guard: the plan column may only be changed by a privileged role (service
-- role / SQL editor / a future Stripe webhook running as service_role). Clients
-- authenticated as `authenticated` are rejected.
--
-- This is what makes the gate a real gate. RLS alone does not protect a column
-- from the user's own UPDATE policy, and without this a learner could run
-- `update profiles set plan='premium'` in the console and unlock everything.
CREATE OR REPLACE FUNCTION public.protect_profile_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
      RAISE EXCEPTION 'profiles.plan is not user-writable (current_user=%)', current_user
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_plan_guard ON profiles;

CREATE TRIGGER profiles_plan_guard
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_plan();
