-- Migration: 011_content_items.sql
--
-- Generic curriculum "content pool" table. Replaces ALL remaining hardcoded
-- static data pools (src/data/*.ts / src/data/vocab/*.json) with a single
-- database table:
--
--   content_type: 'alphabet-item' | 'number-item' | 'greeting-item' |
--                 'calendar-item' | 'vocab-item' | 'grammar-drill' |
--                 'roleplay-scenario' | 'dictation-word' | 'story-sentence' |
--                 'rapidfire-question' | 'spelling-word' | 'pronunciation-tip'
--   payload:      the full item object verbatim (JSONB) — every field the
--                 original TS interface carried.
--   sort:         stable ordering for pools that must not randomize
--                 (e.g. alphabet letters).
--
-- Seeding is performed by scripts/seedContentPools.ts (service-role upsert;
-- it imports the still-existing src/data modules, then those files are
-- deleted once verified). RLS: public read, like vocabulary/sentences.

CREATE TABLE IF NOT EXISTS public.content_items (
    id TEXT PRIMARY KEY,              -- e.g. 'fam-mutter', 'letter-a', 'story-1'
    content_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (content_type, id)
);
CREATE INDEX IF NOT EXISTS idx_content_items_type ON public.content_items(content_type);
CREATE INDEX IF NOT EXISTS idx_content_items_type_sort ON public.content_items(content_type, sort);

ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for content_items"
  ON public.content_items FOR SELECT USING (true);

/**
 * GET /api/content (pool equivalent).
 * Returns a randomized subset of one pool. Pass p_shuffle=false for ordered
 * content (alphabet/numbers in canonical order instead of random).
 */
CREATE OR REPLACE FUNCTION public.get_content_items(
  p_content_type TEXT,
  p_limit INT DEFAULT 200,
  p_shuffle BOOLEAN DEFAULT true
)
RETURNS SETOF public.content_items
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.content_items
  WHERE content_type = p_content_type
  ORDER BY CASE WHEN p_shuffle THEN random() ELSE 0 END, sort
  LIMIT GREATEST(LEAST(COALESCE(p_limit, 200), 1000), 1);
$$;
GRANT EXECUTE ON FUNCTION public.get_content_items(TEXT, INT, BOOLEAN) TO anon, authenticated;