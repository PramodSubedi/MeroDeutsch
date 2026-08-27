-- Migration: 20260826000000_review_queue_id_text.sql
--
-- Fix: `review_queue.id` was declared as UUID (migrations 20240520… / 005), but the
-- client never uses UUIDs. `useReviewQueue` / `userDataService.saveReviewQueue`
-- upsert with deterministic client string ids like `${userId}:articles|der Tisch`
-- using `onConflict: 'id'`, and `markCorrect`/`markResolved` filter with
-- `.eq('id', <stringId>)`. PostgreSQL UUID columns reject those strings, so every
-- cloud write of the SRS review queue silently errors and queue state never
-- survives cross-device.
--
-- This changes the primary key column to TEXT so the existing deterministic
-- client ids work unchanged. It does NOT touch the SRS algorithm — it only aligns
-- the column type with what the app actually writes.
--
-- Existing UUID rows are converted to their text representation (`::text`), so no
-- live data is lost; the `gen_random_uuid()` default is dropped because the client
-- always supplies the id.

ALTER TABLE public.review_queue
  ALTER COLUMN id DROP DEFAULT,
  ALTER COLUMN id TYPE TEXT USING id::text;

-- Refresh the PostgREST schema cache so the new column type is served immediately.
NOTIFY pgrst, 'reload schema';