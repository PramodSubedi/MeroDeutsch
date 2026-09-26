-- 20260928010000_drop_sm2_columns_leitner_only.sql
--
-- APPLIED OUT OF BAND to project uiwlioriubixerspdamx on 2026-09-27. Recorded
-- here as the canonical source (see docs/SUPABASE_MIGRATIONS.md).
--
-- SRS consolidation: review_queue is LEITNER-ONLY.
--
-- The app schedules reviews with a 4-box Leitner model (src/lib/db.ts:
-- LEITNER_INTERVALS = [1, 3, 7, 14]; useReviewQueue.markCorrect advances `box`
-- and graduates the card at box 4). It never used SM-2. `ease` and
-- `repetitions` were inherited from 20240520000000_initial_schema as part of an
-- SM-2 implementation that was never finished: written on every queue change,
-- never read for scheduling. The only readers were round-trip plumbing
-- (remoteToItem -> itemToRow) that fed them straight back to the same column.
--
-- All three cloud writers were removed first, so nothing sends them:
--   useReviewQueue.itemToRow / the login-merge SELECT
--   userDataService.getReviewQueue / saveReviewQueue
--   syncService.pushReviewQueue
-- The Dexie-side UserProgress.ease/repetitions fields stay: they are local-only
-- bookkeeping with no cloud column behind them.
--
-- `interval_days` is KEPT - useReviewQueue still reads it when hydrating the
-- queue, and unlike ease/repetitions it reflects the real Leitner interval.
--
-- `box_level` is deliberately left CHECK-bounded to 1..4 (from migration 005).
-- 20260814000000 intended 1..5 but used ADD COLUMN IF NOT EXISTS on a column
-- that already existed, so the CHECK never changed. 1..4 is correct:
-- LEITNER_INTERVALS has 4 entries and markCorrect graduates at box 4. Widening
-- it would only permit the out-of-range value the graduation logic exists to
-- prevent (LEITNER_INTERVALS[4] === undefined).

ALTER TABLE public.review_queue
  DROP COLUMN IF EXISTS ease,
  DROP COLUMN IF EXISTS repetitions;

COMMENT ON COLUMN public.review_queue.box_level IS
  'Leitner box 1-4 (4 = graduated/retired). CHECK-bounded 1..4 to match LEITNER_INTERVALS in src/lib/db.ts.';
COMMENT ON COLUMN public.review_queue.interval_days IS
  'Days until next review, derived from box_level via LEITNER_INTERVALS. Leitner-only; not SM-2.';

DO $$
DECLARE
  leftovers text;
BEGIN
  SELECT string_agg(column_name, ', ') INTO leftovers
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'review_queue'
    AND column_name IN ('ease', 'repetitions', 'box');

  IF leftovers IS NOT NULL THEN
    RAISE EXCEPTION 'SM-2 / duplicate columns still present: %', leftovers;
  END IF;
  RAISE NOTICE 'OK - review_queue is Leitner-only';
END $$;

NOTIFY pgrst, 'reload schema';