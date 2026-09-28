-- 20260930170000_vocabulary_audio_url.sql
--
-- Adds the bundled-recording path to `vocabulary` so the audio actually
-- survives the loaders.
--
-- WHY THIS COLUMN
-- ---------------
-- 813 MP3s ship under public/audio/anki/ (Goethe-Institut A1 deck, CC BY-SA 4.0,
-- Thorsten-Voice) and are referenced by three records: the generated
-- AUDIO_BY_LEMMA map, VocabCard.audioUrl, and VocabCard.examples[].audioUrl.
-- All three are produced by scripts/bundle-offline-seed.cjs into
-- public/data/enriched-vocab.json.
--
-- None of them reach the curriculum. `listening-gap` is a checkpoint source
-- whose builder draws from `vocabulary.filter(v => v.audioUrl)`, and it has
-- been permanently dead because the field had nowhere to live: the `vocabulary`
-- table had no column for it, so rowToVocabCard / cardToLegacyEntry had nothing
-- to map and the pool was always empty. See the post-mortem on
-- CheckpointSource in src/data/curriculum/schema.ts.
--
-- This migration is the SCHEMA half only. Populate it with:
--     npm run backfill-audio
-- which reads enriched-vocab.json and matches on lower(word) = lower(lemma).
--
-- Do NOT un-gate 'listening-gap' in schema.ts on the strength of this migration
-- alone. `npm run check:audio` prints per-tag audio coverage; a category with
-- no audio silently shortens a deck instead of failing, which is the exact
-- defect the UNUSABLE_CHECKPOINT_SOURCES deny-list exists to prevent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'vocabulary'
      AND column_name  = 'audio_url'
  ) THEN
    ALTER TABLE public.vocabulary
      ADD COLUMN audio_url TEXT;
  END IF;
END $$;

COMMENT ON COLUMN public.vocabulary.audio_url IS
  'Bundled TTS clip for this lemma, e.g. /audio/anki/tts-84886454796.mp3. '
  'NULL when no recording exists. Populated by npm run backfill-audio from '
  'public/data/enriched-vocab.json (Goethe-Institut A1 deck, CC BY-SA 4.0).';

-- Guard against a value that is not a bundled asset. A bare word, an absolute
-- URL, or a path outside /audio/anki/ would either 404 or hit the network, and
-- both fail silently at playback (the app falls back to synthesized speech).
-- CHECK rather than a FK/NOT NULL: NULL is the correct value for most rows.
DO $$
DECLARE
  bad TEXT;
BEGIN
  SELECT string_agg(DISTINCT audio_url, ', ') INTO bad
  FROM public.vocabulary
  WHERE audio_url IS NOT NULL
    AND audio_url NOT LIKE '/audio/anki/%';

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION
      'vocabulary.audio_url contains values outside /audio/anki/: %', bad;
  END IF;
  RAISE NOTICE 'OK - audio_url values all point at bundled assets';
END $$;

NOTIFY pgrst, 'reload schema';
