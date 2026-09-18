-- Migration: 020_increment_activity.sql
--
-- Two fixes for the activity/XP cloud-sync layer:
--
-- 1) Schema drift repair: the LIVE `user_activity_days` table (created by
--    migration 005) predates migration 20260814010000, whose
--    `CREATE TABLE IF NOT EXISTS` silently no-oped — so the `updated_at`
--    column the client writes was NEVER added. Add it idempotently.
--
-- 2) Atomic per-day activity increment (`increment_activity` RPC).
--    The previous client flow did SELECT → UPDATE-or-INSERT (2 round trips
--    per quiz answer, racy across devices). This RPC performs the increment
--    in ONE write and is owner-scoped: SECURITY DEFINER bypasses RLS, so the
--    function itself re-checks `auth.uid() = p_user_id` and raises otherwise.
--
-- Grants: authenticated only (anon must never mutate activity).
-- Idempotent: re-running is safe.
-- ---------------------------------------------------------------------------

-- 1. Repair the drifted column.
ALTER TABLE public.user_activity_days
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Atomic increment helper.
CREATE OR REPLACE FUNCTION public.increment_activity(
  p_user_id UUID,
  p_date DATE,
  p_delta INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- SECURITY DEFINER means we bypass RLS — enforce ownership here instead.
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'increment_activity: not allowed for this user';
  END IF;

  INSERT INTO public.user_activity_days (user_id, activity_date, event_count, created_at)
  VALUES (p_user_id, p_date, GREATEST(COALESCE(p_delta, 1), 1), now())
  ON CONFLICT (user_id, activity_date)
  DO UPDATE SET
    event_count = public.user_activity_days.event_count + GREATEST(COALESCE(p_delta, 1), 1),
    updated_at  = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_activity(UUID, DATE, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_activity(UUID, DATE, INT) TO authenticated;

-- 3. Refresh the PostgREST schema cache.
NOTIFY pgrst, 'reload schema';