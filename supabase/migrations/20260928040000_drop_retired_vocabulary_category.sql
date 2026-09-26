-- 20260928040000_drop_retired_vocabulary_category.sql
--
-- APPLIED OUT OF BAND to project uiwlioriubixerspdamx on 2026-09-27. Recorded
-- here as the canonical source (see docs/SUPABASE_MIGRATIONS.md).
--
-- HISTORY
--   004 created `category VARCHAR(50) NOT NULL DEFAULT 'general'`; the cluster
--   backfills (backfillVocabClusters.ts, backfillGlossaryCategories.ts) wrote
--   topical values into it while leaving tags[] empty, which split filtering in
--   two: offline (Dexie) filtered on tags, online (RPC) filtered on category.
--   Migration 018 healed the data - every real topical value was merged into
--   tags[], the column was cleared to NULL for all rows, and all filter RPCs
--   switched to testing `p_category = ANY(tags)`. From 018 onward the column was
--   write-only dead weight: 0 of 1062 rows held a non-NULL value.
--
-- CLIENT CLEANUP DONE FIRST (a bare DROP would 400 every read)
--   src/services/supabaseCurriculumService.ts no longer SELECTs the column in
--   any of its 4 projection lists, and rowToVocabCard no longer merges
--   `row.category` into the Dexie card's tags. tags[] is now the single source
--   of truth end to end.
--
-- NOT AFFECTED
--   get_random_vocabulary / get_vocabulary_glossary keep their `p_category`
--   PARAMETER - that name is the public RPC contract the client calls, but the
--   body matches it against tags[] (migration 018), never the column.
--   get_vocab_filter_options returns an output column literally NAMED
--   `category`; that is an alias over a DISTINCT list of tags, not a reference
--   to this column, and it keeps its name so the client's
--   `(row as { category?: string }).category` read stays valid.
--
-- No data is lost: the topical values all live in tags[].

ALTER TABLE public.vocabulary
  DROP COLUMN IF EXISTS category;

DO $$
DECLARE
  col_count int;
  topical    bigint;
  vocab_rows bigint;
BEGIN
  SELECT count(*) INTO col_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'vocabulary' AND column_name = 'category';

  IF col_count <> 0 THEN
    RAISE EXCEPTION 'vocabulary.category still exists';
  END IF;

  SELECT count(*) INTO topical
  FROM public.vocabulary, LATERAL unnest(tags) t
  WHERE t IS NOT NULL AND btrim(t) <> '' AND t !~ '[0-9/,_]';

  SELECT count(*) INTO vocab_rows FROM public.vocabulary;

  RAISE NOTICE 'OK - category dropped; % vocab rows, % topical tag values retained',
    vocab_rows, topical;
END $$;

NOTIFY pgrst, 'reload schema';