-- Migration: 018_category_tags.sql
--
-- One-time idempotent data heal + filter-logic switch for the vocabulary
-- glossary. Root cause of the online/offline filter mismatch:
--
--   * The cluster backfills (backfillVocabClusters.ts,
--     backfillGlossaryCategories.ts) wrote semantic topical values into the
--     `category` VARCHAR column but left the `tags[]` array empty for cluster
--     rows (Numbers/Alphabet/Greetings rows had empty `tags` arrays).
--   * Filtering was therefore split-brain: offline (Dexie) filtered on `tags`
--     while online (RPC / table SELECT) filtered on `category`, so the two
--     surfaces disagreed.
--
-- This migration:
--   0. Retires the legacy `category` column (drops its migration-004 NOT NULL
--      constraint, re-defaults it to NULL so inserts cannot resurrect it).
--   1. Heals the data: moves every real topical `category` value into `tags`
--      (btrim + DISTINCT rewrite), drops junk/empty tags tokens, keeps
--      structural unitN-* / digit categories OUT of tags, and clears the
--      category column to NULL for every row — all idempotently (safe to
--      re-apply; the now-NULL column makes every UPDATE's `WHERE category IS
--      NOT NULL` a no-op on re-run).
--   2. Switches the filter RPCs to test `p_category = ANY(tags)` so online and
--      offline filtering agree on a single source of truth (tags).
--   3. Adds `get_vocab_filter_options` returning the distinct TOPICAL category
--      values (structural POS/level/gender tags excluded server-side), so the
--      online and offline Trainer option lists match.
--
-- A row whose category is NOT empty is healed in one pass: its topical value
-- (btrim'ed) is merged into tags via a DISTINCT rebuild, then the column is
-- cleared. Because we always map onto the row's own words (English terms),
-- every tag stays a truthful row term and no foreign label is ever injected.
--
-- Re-runnable: after the first successful run every row's category is NULL,
-- so the UPDATEs' `category IS NOT NULL` guards short-circuit and the whole
-- block is a no-op.

BEGIN;

-- ---------------------------------------------------------------------------
-- Step 0 — retire the legacy `category` column (make it nullable, NULL default)
--
-- Migration 004 created `category VARCHAR(50) NOT NULL DEFAULT 'general'`. The
-- Step 2 heal below sets category = NULL, which that NOT NULL constraint would
-- reject (seen live: ERROR 23502) — so drop it first. Re-defaulting to NULL
-- stops future INSERTs from silently resurrecting a column the app no longer
-- reads. Idempotent: both sub-clauses are no-ops on re-run.
-- ---------------------------------------------------------------------------
ALTER TABLE public.vocabulary
  ALTER COLUMN category DROP NOT NULL,
  ALTER COLUMN category SET DEFAULT NULL;

-- ---------------------------------------------------------------------------
-- Step 1 — normalize each row's tags[] (idempotent; drop junk / empties)
--
-- Removes empty strings, 'general' (the "no category" bucket), and junk tokens
-- containing slashes (e.g. '8/15/26,'). Structural POS/level tags (verbs,
-- nouns, A1, …) are intentionally left in place: they are harmless to filters
-- and the client's isTopicalTag()/firstTopicalTag() classify them correctly
-- without needing a solved POS list in SQL. The guard makes re-runs a no-op.
-- ---------------------------------------------------------------------------
UPDATE public.vocabulary
SET tags = (
  SELECT array_agg(DISTINCT t ORDER BY t)
  FROM unnest(tags) AS t
  WHERE t IS NOT NULL
    AND btrim(t) <> ''
    AND t <> 'general'
    AND t NOT LIKE '%/%'
)
WHERE EXISTS (
  SELECT 1 FROM unnest(tags) AS t
  WHERE t IS NOT NULL
    AND btrim(t) <> ''
    AND t <> 'general'
    AND t NOT LIKE '%/%'
);

-- ---------------------------------------------------------------------------
-- Step 2 — migrate the topical `category` value into `tags[]` (idempotent)
--
-- 2a moves every real topical category value into tags (btrim + DISTINCT so a
-- trailing-space value like 'time ' collapses onto an existing 'time', and the
-- value is cleared from the column). Non-topical leftovers — 'general', junk
-- with slashes, and unitN-* / digit structural values ('unit3-adjectives') the
-- client classifier hides — are NOT mirrored into tags and are purged from the
-- retired column in 2b untouched.
--
-- Re-run safety: after the first successful run every row's category is NULL,
-- so both UPDATEs' `category IS NOT NULL` filters match nothing. (The old
-- NOT EXISTS(...) guard is unnecessary for idempotency — clearing the column
-- to NULL is itself the idempotency marker — and it actively skipped rows
-- whose category matched an existing tag, leaving stale category values
-- behind, so it is dropped.)
-- ---------------------------------------------------------------------------
UPDATE public.vocabulary
SET category = NULL,
    tags = (
      SELECT coalesce(array_agg(DISTINCT btrim(t) ORDER BY btrim(t)), '{}')
      FROM unnest(array_append(coalesce(tags, '{}'), category)) AS t
      WHERE t IS NOT NULL
        AND btrim(t) <> ''
        AND btrim(t) <> 'general'
        AND btrim(t) NOT LIKE '%/%'
    )
WHERE category IS NOT NULL
  AND btrim(category) <> ''
  AND btrim(category) <> 'general'
  AND btrim(category) NOT LIKE '%/%'
  AND btrim(category) !~ '[0-9]'
  AND lower(btrim(category)) NOT IN ('der','die','das','pl','plural');

-- 2b — purge the remaining legacy values ('general', junk like '8/15/26,')
-- from the retired column WITHOUT mirroring them into tags. Idempotent: after
-- the first run no row has a non-NULL category, so this matches nothing.
UPDATE public.vocabulary
SET category = NULL
WHERE category IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Step 3 — switch the filter RPCs to test `p_category = ANY(tags)`
--
-- Both RPCs previously compared the plain `category` column, which the heal
-- above has emptied. Filtering on tags keeps online and offline identical.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_random_vocabulary(
  p_pos TEXT DEFAULT NULL,
  p_tag TEXT DEFAULT NULL,
  p_level TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_limit INT DEFAULT 15
)
RETURNS SETOF public.vocabulary
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.vocabulary
  WHERE (p_pos IS NULL OR part_of_speech = p_pos)
    AND (p_tag IS NULL OR p_tag = ANY(tags))
    AND (p_level IS NULL OR level = p_level)
    AND (p_category IS NULL OR p_category = ANY(tags))
    -- Article-quiz guard: nouns must have der/die/das ('-' fallback excluded).
    AND (p_pos IS DISTINCT FROM 'noun' OR article IN ('der', 'die', 'das'))
  ORDER BY random()
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 15), 1), 100);
$$;

CREATE OR REPLACE FUNCTION public.get_vocabulary_glossary(
  p_pos TEXT DEFAULT NULL,
  p_level TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_limit INT DEFAULT 2000
)
RETURNS SETOF public.vocabulary
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.vocabulary
  WHERE (p_pos IS NULL OR part_of_speech = p_pos)
    AND (p_level IS NULL OR level = p_level)
    AND (p_category IS NULL OR p_category = ANY(tags))
    -- Article-quiz guard stays intact for noun-filtered glossary surfaces.
    AND (p_pos IS DISTINCT FROM 'noun' OR article IN ('der', 'die', 'das'))
    -- Junk-fragment guard: digits, '/', '_', ',' or a 1-char token are
    -- leftovers of bad imports, not German words.
    AND word ~ '^[^0-9/,_]+$'
    AND length(word) >= 2
  ORDER BY word ASC, part_of_speech ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 2000), 1), 2000);
$$;

GRANT EXECUTE ON FUNCTION public.get_random_vocabulary(
  TEXT, TEXT, TEXT, TEXT, INT
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_vocabulary_glossary(
  TEXT, TEXT, TEXT, INT
) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Step 4 — get_vocab_filter_options
--
-- Single source of truth for the Trainer filter UI. Returns only tags that
-- look topical (English noun-ish terms, not POS/level/gender structural
-- tags), DISTINCT and sorted, so the client's in-page classifier and the
-- server agree on the option list regardless of what the flag migrated.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_vocab_filter_options()
RETURNS TABLE (category text)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT t
  FROM public.vocabulary, LATERAL unnest(tags) AS t
  WHERE btrim(t) <> ''
    AND length(t) >= 2
    AND t NOT IN ('general')
    AND lower(t) NOT IN (
      'der', 'die', 'das', 'pl', 'plural', 'germany',
      'verb', 'noun', 'adjective', 'adverb', 'preposition', 'pronoun',
      'conjunction', 'interjection', 'numeral', 'particle', 'phrase',
      'abbreviation', 'expression', 'questionword', 'modalverb', 'auxiliary'
    )
    AND lower(t) NOT LIKE '%a1%'
    AND lower(t) NOT LIKE '%a2%'
    AND lower(t) NOT LIKE '%b1%'
    AND lower(t) NOT LIKE '%b2%'
    -- Mirror the client isTopicalTag() junk rule: any token containing a
    -- digit, '/', ',' or '_' is structural/junk (e.g. 'unit3-nouns',
    -- '8/15/26,') and must never surface as a filter option.
    AND t !~ '[0-9/,_]'
  ORDER BY t;
$$;

GRANT EXECUTE ON FUNCTION public.get_vocab_filter_options() TO anon, authenticated;

COMMIT;

