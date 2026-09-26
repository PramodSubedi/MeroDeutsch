-- 20260928020000_harden_review_queue_user_scope.sql
--
-- APPLIED OUT OF BAND to project uiwlioriubixerspdamx on 2026-09-27. Recorded
-- here as the canonical source (see docs/SUPABASE_MIGRATIONS.md).
--
-- ISSUES FOUND BY AUDIT
--  1. user_id was NULLABLE. A NULL user_id row is invisible to every RLS
--     policy (`auth.uid() = user_id` is NULL, not true) AND to SettingsPage's
--     "delete my cloud data" sweep - i.e. an unerasable orphan. It also
--     referenced profiles(id) while user_xp / user_activity_days / a1_path_state
--     reference auth.users(id) directly; the two hold the same value (profiles.id
--     is the PK with an FK to auth.users) but the nullable column was the real
--     problem. Repointed at auth.users(id) for consistency.
--  2. THREE overlapping policies granted write access, accumulated one migration
--     at a time:
--       "Manage own review_queue"                 FOR ALL     (005)
--       "Users can update their own review queue" FOR ALL     (initial_schema)
--       "Users can view their own review queue"   FOR SELECT  (initial_schema)
--     Two FOR ALL policies with no with_check meant Postgres fell back to the
--     USING expression, so the write surface was defined twice and the two
--     definitions had to be kept in sync by hand.
--
-- FIX: one FOR ALL policy with explicit USING *and* WITH CHECK, and user_id
-- NOT NULL. Safe: 0 NULL user_id rows existed. Guest rows are never written
-- here - useReviewQueue only reaches the cloud paths behind isAuthenticated.

DELETE FROM public.review_queue WHERE user_id IS NULL;

ALTER TABLE public.review_queue
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.review_queue
  DROP CONSTRAINT review_queue_user_id_fkey;

ALTER TABLE public.review_queue
  ADD CONSTRAINT review_queue_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Users can view their own review queue"   ON public.review_queue;
DROP POLICY IF EXISTS "Users can update their own review queue" ON public.review_queue;
DROP POLICY IF EXISTS "Manage own review_queue"                 ON public.review_queue;

CREATE POLICY "Manage own review_queue"
  ON public.review_queue
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DO $$
DECLARE
  policy_count int;
  nullable     boolean;
BEGIN
  SELECT count(*) INTO policy_count
  FROM pg_policies WHERE schemaname = 'public' AND tablename = 'review_queue';
  SELECT is_nullable INTO nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'review_queue' AND column_name = 'user_id';

  IF policy_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly 1 review_queue policy, found %', policy_count;
  END IF;
  IF nullable THEN
    RAISE EXCEPTION 'review_queue.user_id is still nullable';
  END IF;
  RAISE NOTICE 'OK - review_queue: 1 own-row policy, user_id NOT NULL';
END $$;

NOTIFY pgrst, 'reload schema';