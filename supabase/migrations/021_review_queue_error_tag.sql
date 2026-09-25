-- Migration: 021_review_queue_error_tag.sql
--
-- Problem
-- ------
-- `useReviewQueue.itemToRow()` (src/hooks/useReviewQueue.ts) has written an
-- `error_tag` column into its debounced `review_queue` upsert since commit
-- b1039f3 ("feat: implement hybrid curriculum service with Supabase fallback",
-- the Phase C error-category tagging work). No migration in this folder ever
-- created the column, so the live table does not have it.
--
-- Impact: there are TWO writers for this table, and only one of them breaks.
--
--   a) src/hooks/useReviewQueue.ts — debounced (300ms) upsert that spreads
--      `...itemToRow(item)`, which includes `error_tag`. PostgREST validates
--      the whole payload against its schema cache, so this upsert is rejected
--      100% of the time:
--        Could not find the 'error_tag' column of 'review_queue' in the schema cache
--      The caller only `console.warn`s it, so the failure is silent.
--
--   b) src/services/syncService.ts -> userDataService.saveReviewQueue — the
--      60s / on-reconnect sync bridge. It builds its payload field-by-field and
--      does NOT include `error_tag`, so it still succeeds.
--
-- Net effect today: the SRS queue does still reach the cloud via (b), so this is
-- not total data loss. What IS broken is (1) the primary low-latency write path
-- in (a), which fails on every single queue change, and (2) `error_tag` itself
-- is never persisted — it is silently dropped by (b) and has no column to land
-- in, so the Phase C error-category tagging does not survive cross-device.
--
-- Fix
-- ---
-- Add the one missing column, nullable, with a CHECK restricted to the exact
-- union the client writes (src/types/index.ts -> WrongAnswerItem.errorTag:
-- 'article' | 'verb' | 'spelling' | 'listening' | 'other'). Nullable on purpose:
-- the 34 pre-existing rows have no tag, and the client always sends
-- `error_tag: item.errorTag ?? null`.
--
-- Safe to re-run (IF NOT EXISTS). Idempotent.
-- ---------------------------------------------------------------------------

ALTER TABLE public.review_queue
  ADD COLUMN IF NOT EXISTS error_tag TEXT
  CHECK (error_tag IS NULL OR error_tag IN ('article', 'verb', 'spelling', 'listening', 'other'));

COMMENT ON COLUMN public.review_queue.error_tag IS
  'Phase C error category: article | verb | spelling | listening | other. Nullable — pre-existing rows are untagged.';

-- Backfill the rows the app can infer server-side, so the new column is not
-- entirely NULL for data already in the table. Mirrors the inference in
-- useReviewQueue.addWrongAnswer() so cloud rows agree with local ones.
UPDATE public.review_queue
SET error_tag = CASE
  WHEN lower(module_type) IN ('articles', 'blitz', 'rapid-fire', 'rapid-blitz', 'pronoun-traps') THEN 'article'
  WHEN lower(module_type) IN ('grammar', 'verb-tictactoe', 'verb-dice')                      THEN 'verb'
  WHEN lower(module_type) IN ('alphabet', 'spelling', 'email-builder', 'email-evaluator')  THEN 'spelling'
  WHEN lower(module_type) IN ('dictation', 'pronunciation', 'phonetic-traps')                THEN 'listening'
  ELSE 'other'
END
WHERE error_tag IS NULL;

-- Force PostgREST to reload its schema cache so the upsert starts working
-- immediately instead of waiting for the next periodic reload.
NOTIFY pgrst, 'reload schema';
