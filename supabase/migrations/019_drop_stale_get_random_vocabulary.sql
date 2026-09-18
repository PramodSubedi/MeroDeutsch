-- Migration: 019_drop_stale_get_random_vocabulary.sql
--
-- Problem
-- -------
-- `get_random_vocabulary` became AMBIGUOUS in the live DB. Migration 010/014
-- created the 3-arg overload (p_pos, p_tag, p_limit). Migration 015 changed
-- the signature to 5 args (p_pos, p_tag, p_level, p_category, p_limit), but
-- PostgreSQL `CREATE OR REPLACE FUNCTION` with a *different* argument list
-- creates a NEW overload instead of replacing the old one.
--
-- The app's randomized-articles call (`SupabaseCurriculumService.getArticles`,
-- e.g. `rpc('get_random_vocabulary', { p_pos: 'noun', p_limit })`) then fails
-- with:
--
--   Could not choose the best candidate function between:
--     public.get_random_vocabulary(p_pos => text, p_tag => text, p_limit ...
--     public.get_random_vocabulary(p_pos => text, p_tag => text, p_level => text,
--                                  p_category => text, p_limit ...
--
-- and silently degrades to a plain table SELECT fallback.
--
-- Fix
-- ----
-- Drop the stale 3-arg overload. The 5-arg version (re-issued in 018) supports
-- every caller:
--   - getArticles()            -> named subset p_pos, p_limit (defaults fill rest)
--   - getVocabularyFiltered()  -> p_pos, p_tag, p_level, p_category, p_limit
--   - scripts/seedCurriculum   -> p_pos, p_limit
--   - scripts/auditCategoryTags-> all five params
--
-- Safe to re-run (IF EXISTS). Idempotent.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_random_vocabulary(TEXT, TEXT, INT);

-- Force PostgREST to reload its schema cache so the fix takes effect
-- immediately instead of waiting for the next periodic reload.
NOTIFY pgrst, 'reload schema';