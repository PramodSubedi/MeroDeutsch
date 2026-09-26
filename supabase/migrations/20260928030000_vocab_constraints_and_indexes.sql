-- 20260928030000_vocab_constraints_and_indexes.sql
--
-- APPLIED OUT OF BAND to project uiwlioriubixerspdamx on 2026-09-27. Recorded
-- here as the canonical source (see docs/SUPABASE_MIGRATIONS.md).
--
-- vocabulary.level
--   Declared VARCHAR(10) NOT NULL DEFAULT 'A1' in 004 with no CHECK, so any
--   string could land in it and the Trainer level filter would silently return
--   nothing. Live data is 100% A1/A2/B1/B2, so the constraint validates today
--   and simply prevents future drift. C1/C2 are included even though the table
--   holds none yet: the Glossary filter already offers them and vocabTags.ts
--   LEVEL_RE recognises them.
--
-- idx_vocab_level_category -> idx_vocab_level_pos
--   004 created (level, category). Migration 018 moved topical grouping onto
--   tags[], so the category component became dead weight once the column was
--   dropped. (level, part_of_speech) is what the Trainer and Glossary actually
--   query: every filter RPC tests p_pos + p_level together and both are plain
--   btree columns.
--
-- idx_review_queue_user_due
--   20260814000000 intended this index but was recorded as applied without
--   ever running. The Dashboard review queue and useReviewQueue hydration both
--   filter `user_id = ? ORDER BY due_at` - exactly this composite.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vocabulary_level_check'
  ) THEN
    ALTER TABLE public.vocabulary
      ADD CONSTRAINT vocabulary_level_check
      CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));
  END IF;
END $$;

COMMENT ON COLUMN public.vocabulary.level IS
  'CEFR level. Constrained to A1-C2 by vocabulary_level_check.';

DROP INDEX IF EXISTS public.idx_vocab_level_category;

CREATE INDEX IF NOT EXISTS idx_vocab_level_pos
  ON public.vocabulary(level, part_of_speech);

CREATE INDEX IF NOT EXISTS idx_review_queue_user_due
  ON public.review_queue(user_id, due_at);

DO $$
DECLARE
  bad_levels text;
BEGIN
  SELECT string_agg(DISTINCT level, ', ') INTO bad_levels
  FROM public.vocabulary
  WHERE level NOT IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

  IF bad_levels IS NOT NULL THEN
    RAISE EXCEPTION 'vocabulary.level contains off-list values: %', bad_levels;
  END IF;
  RAISE NOTICE 'OK - level CHECK validated against live rows';
END $$;

NOTIFY pgrst, 'reload schema';