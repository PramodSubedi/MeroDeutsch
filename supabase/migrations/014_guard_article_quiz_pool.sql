-- Migration: 014_guard_article_quiz_pool.sql
--
-- Impact guard for the Unit 1 pilot backfill (migration 013 + backfill run):
-- 58 new `vocabulary` rows were inserted with part_of_speech='noun' and
-- article=NULL (number words like "eins", alphabet example words).
--
-- The Articles quiz primary path calls get_random_vocabulary(p_pos='noun'),
-- which previously did NOT require a non-null article — so number words
-- could now surface in gender exercises (and rowToArticle would silently
-- default them to 'der').
--
-- Fix: when explicitly asking for nouns, only return rows that actually
-- carry a definite article. Non-noun queries are unaffected.

CREATE OR REPLACE FUNCTION public.get_random_vocabulary(
  p_pos TEXT DEFAULT NULL,
  p_tag TEXT DEFAULT NULL,
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
    -- Article-quiz guard: nouns must have der/die/das ('-' fallback excluded).
    AND (p_pos IS DISTINCT FROM 'noun' OR article IN ('der', 'die', 'das'))
  ORDER BY random()
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 15), 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.get_random_vocabulary(TEXT, TEXT, INT) TO anon, authenticated;