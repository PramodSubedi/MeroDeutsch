-- Migration: 016_notebooklm_vocab.sql
--
-- Prepares the schema for the NotebookLM-generated German learning dictionary
-- import (scripts/importNotebookLm.ts, source staged in
-- scripts/data/notebooklm/). Additive only — no data is written here.
--
-- 1. Extends the part_of_speech CHECK with 'adverb': the dictionary
--    classifies 3 entries (Ja, Nein, Vielleicht) as adverbs. The app's
--    VocabCard.partOfSpeech union already includes 'adverb', and the
--    Glossary derives its part-of-speech filter chips from live data, so
--    'adverb' rows surface in the UI automatically. ('Interjection'
--    entries are mapped to the existing 'expression' value by the import
--    script, so no further CHECK change is needed.)
-- 2. Adds a nullable plural_form column so the dictionary's noun plural
--    metadata (noun_metadata.plural_form, e.g. Mann → 'Männer') survives
--    the relational round-trip and reaches the Dexie VocabCard cache
--    (rowToVocabCard previously hardcoded plural: null).
--
-- Naming note: inline column CHECKs from 004 are auto-named
-- <table>_<column>_check, so DROP ... IF EXISTS is safe whether or not the
-- original name matches (same pattern as 013_vocab_i18n_extras.sql).

ALTER TABLE public.vocabulary
  DROP CONSTRAINT IF EXISTS vocabulary_part_of_speech_check;

ALTER TABLE public.vocabulary
  ADD CONSTRAINT vocabulary_part_of_speech_check
  CHECK (part_of_speech IN ('noun', 'verb', 'adjective', 'phrase', 'expression', 'adverb'));

ALTER TABLE public.vocabulary
  ADD COLUMN IF NOT EXISTS plural_form VARCHAR(50);