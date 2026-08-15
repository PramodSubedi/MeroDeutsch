-- Migration: 004_vocabulary_expansion.sql
--
-- Adds a multi-part-of-speech vocabulary table with translation support.
-- Data is seeded by scripts/seedVocab.ts (upsert on word + part_of_speech).

CREATE TABLE IF NOT EXISTS public.vocabulary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    word VARCHAR(100) NOT NULL,
    article VARCHAR(10) CHECK (article IN ('der', 'die', 'das')),
    part_of_speech VARCHAR(20) NOT NULL CHECK (part_of_speech IN ('noun', 'verb', 'adjective', 'phrase', 'expression')),
    translation_en VARCHAR(255) NOT NULL,
    translation_np VARCHAR(255) NOT NULL,
    example_de TEXT,
    example_en TEXT,
    example_np TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    level VARCHAR(10) NOT NULL DEFAULT 'A1',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(word, part_of_speech)
);

CREATE INDEX IF NOT EXISTS idx_vocab_level_category ON public.vocabulary(level, category);
ALTER TABLE public.vocabulary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for vocabulary" ON public.vocabulary FOR SELECT USING (true);