-- Migration: 015_vocab_filters.sql
--
-- Extends get_random_vocabulary with level + category filter params so the
-- Vocab Trainer (/vocab-trainer) can serve leveled/topical practice from the
-- full 1000-row vocabulary pool.
--
-- Keeps the 014 article-quiz guard intact: when p_pos='noun', only rows with
-- a real definite article (der/die/das) are returned, so number words and
-- alphabet example nouns never leak into gender drills.
--
-- Notes:
--   - `level` and `category` are plain VARCHAR columns (see
--     004_vocabulary_expansion.sql), hence `= p_level` / `= p_category`.
--   - `tags[]` remains GIN-indexed (010) and continues to work via p_tag.
--   - Function signature changes from (TEXT, TEXT, INT) to (TEXT, TEXT, TEXT, TEXT, INT);
--     the GRANT is re-issued for the new signature.
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
    AND (p_category IS NULL OR category = p_category)
    -- Article-quiz guard: nouns must have der/die/das ('-' fallback excluded).
    AND (p_pos IS DISTINCT FROM 'noun' OR article IN ('der', 'die', 'das'))
  ORDER BY random()
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 15), 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.get_random_vocabulary(
  TEXT, TEXT, TEXT, TEXT, INT
) TO anon, authenticated;