-- Migration: 017_glossary_quality.sql
--
-- Deterministic full-pool fetch for reference surfaces (Glossary,
-- Pronunciation, legacy VocabEntry consumers).
--
-- The quiz-side get_random_vocabulary RPC (015) is intentionally clamped to
-- p_limit <= 100 and randomizes row order — the Glossary needs the whole pool
-- in a stable shape. This adds get_vocabulary_glossary:
--   * word-ordered (stable pagination, no randomization)
--   * honors pos / level / category filters (same semantics as 015)
--   * hard-capped at 2000 rows (the live table holds ~1060)
--   * drops corrupt import fragments with a conservative regex that mirrors
--     the client-side isLikelyJunkWord() helper, so NotebookLM residue like
--     "1/2" or "Berlin," never surfaces in the Glossary or Trainer
--   * keeps the noun-article guard from 014/015 when p_pos='noun'
--
-- No schema change, no data writes — additive function only (same pattern as
-- 015 / 016).

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
    AND (p_category IS NULL OR category = p_category)
    -- Article-quiz guard stays intact for noun-filtered glossary surfaces.
    AND (p_pos IS DISTINCT FROM 'noun' OR article IN ('der', 'die', 'das'))
    -- Junk-fragment guard: digits, '/', '_', ',' or a 1-char token are
    -- leftovers of bad imports, not German words.
    AND word ~ '^[^0-9/,_]+$'
    AND length(word) >= 2
  ORDER BY word ASC, part_of_speech ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 2000), 1), 2000);
$$;

GRANT EXECUTE ON FUNCTION public.get_vocabulary_glossary(
  TEXT, TEXT, TEXT, INT
) TO anon, authenticated;