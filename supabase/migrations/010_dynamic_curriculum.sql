-- Migration: 010_dynamic_curriculum.sql
--
-- Dynamic curriculum pipeline (replaces hardcoded src/data/nouns.json +
-- src/data/unit2Sentences.ts):
--
--   1. `vocabulary.tags`  — array column so clients can filter by tag.
--   2. `sentences`        — sentence-building exercises (phrase + expected
--                           word order + distractor tiles + grammar focus).
--   3. Randomized RPC "endpoints" (the Supabase equivalent of
--      GET /api/vocabulary?pos=&tags=&limit= and GET /api/sentences):
--        - get_random_vocabulary(pos, tag, limit)
--        - get_random_sentences(grammar_focus, limit)
--      Both return a RANDOMIZED SUBSET, never the full table.
--
-- Seeding is performed by scripts/seedCurriculum.ts (service-role upsert).
-- RLS: curriculum content is public-read (like `vocabulary`); writes are
-- service-role only (no anon/authenticated INSERT/UPDATE policies granted).

-- ────────────────────────────────────────────────────────────
-- 1. vocabulary.tags
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.vocabulary
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_vocab_tags ON public.vocabulary USING gin(tags);

-- ────────────────────────────────────────────────────────────
-- 2. sentences
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sentences (
  id TEXT PRIMARY KEY,
  phrase_de TEXT NOT NULL,
  expected_array JSONB NOT NULL DEFAULT '[]'::jsonb,
  distractors_array JSONB NOT NULL DEFAULT '[]'::jsonb,
  grammar_focus VARCHAR(50) NOT NULL DEFAULT 'general',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentences_grammar_focus ON public.sentences(grammar_focus);
CREATE INDEX IF NOT EXISTS idx_sentences_tags ON public.sentences USING gin(tags);

ALTER TABLE public.sentences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for sentences"
  ON public.sentences FOR SELECT USING (true);

-- ────────────────────────────────────────────────────────────
-- 3. Randomized RPC endpoints
-- ────────────────────────────────────────────────────────────

/**
 * GET /api/vocabulary equivalent.
 * Params:
 *   p_pos   – part_of_speech filter ('noun', 'verb', …) or NULL for all
 *   p_tag   – single tag filter (member of tags[]) or NULL
 *   p_limit – max rows (default 15, hard-capped at 100)
 * Returns a RANDOMIZED subset (ORDER BY random()).
 */
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
  ORDER BY random()
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 15), 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.get_random_vocabulary(TEXT, TEXT, INT) TO anon, authenticated;

/**
 * GET /api/sentences equivalent.
 * Params:
 *   p_grammar_focus – grammar_focus filter or NULL for all
 *   p_limit         – max rows (default 10, hard-capped at 100)
 * Returns a RANDOMIZED subset.
 */
CREATE OR REPLACE FUNCTION public.get_random_sentences(
  p_grammar_focus TEXT DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS SETOF public.sentences
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.sentences
  WHERE (p_grammar_focus IS NULL OR grammar_focus = p_grammar_focus)
  ORDER BY random()
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.get_random_sentences(TEXT, INT) TO anon, authenticated;