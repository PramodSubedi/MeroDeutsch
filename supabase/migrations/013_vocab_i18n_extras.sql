-- Migration: 013_vocab_i18n_extras.sql
--
-- Phase 2 of the A1 translation-backfill plan (additive-only, no rewrite).
--
-- 1. Adds `translation_ne_roman` — romanized Nepali so English-speaking
--    learners can read pronunciation. Naming matches the existing
--    translation_en / translation_np pattern.
-- 2. Relaxes the `article` CHECK constraint so phrases, numbers, and
--    expressions (article IS NULL or '-') insert without failing.
--    The original inline CHECK from 004_vocabulary_expansion.sql only
--    allowed 'der'/'die'/'das' (NULL passed implicitly; '-' did not).
--
-- Existing UNIQUE(word, part_of_speech) from 004 already prevents duplicate
-- dictionary entries during future data automation — no change needed.

-- ────────────────────────────────────────────────────────────
-- 1. New column: romanized Nepali
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.vocabulary
  ADD COLUMN IF NOT EXISTS translation_ne_roman TEXT;

COMMENT ON COLUMN public.vocabulary.translation_ne_roman IS
  'Romanized Nepali for EN speakers learning phonetic pronunciation. Nullable — filled per-cluster by targeted backfill scripts.';

-- ────────────────────────────────────────────────────────────
-- 2. Relax article CHECK (allow NULL and '-' fallback)
-- ────────────────────────────────────────────────────────────
-- Inline column CHECKs are auto-named <table>_<column>_check by Postgres,
-- so DROP ... IF EXISTS is safe whether or not 004 ran with that name.
ALTER TABLE public.vocabulary
  DROP CONSTRAINT IF EXISTS vocabulary_article_check;

ALTER TABLE public.vocabulary
  ADD CONSTRAINT vocabulary_article_check
  CHECK (article IS NULL OR article IN ('der', 'die', 'das', '-'));