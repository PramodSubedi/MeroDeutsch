/**
 * Content types for the MeroDeutsch vocabulary database.
 *
 * Mirrors the `public.vocabulary` Supabase table (migration 004_vocabulary_expansion.sql)
 * and is used by `scripts/seedVocab.ts` to upsert batch vocabulary files.
 */
export type VocabPartOfSpeech = 'noun' | 'verb' | 'adjective' | 'phrase' | 'expression';

export interface VocabularyEntity {
  /** German word or lemma. */
  word: string;
  /** Definite article — only for nouns. */
  article?: 'der' | 'die' | 'das';
  part_of_speech: VocabPartOfSpeech;
  /** English translation. */
  translation_en: string;
  /** Nepali translation. */
  translation_np: string;
  /** Romanized Nepali for EN speakers learning phonetic pronunciation (optional, backfilled per cluster). */
  translation_ne_roman?: string;
  /** German example sentence. */
  example_de?: string;
  /** English example sentence. */
  example_en?: string;
  /** Nepali example sentence. */
  example_np?: string;
  /** Semantic grouping, e.g. "family", "food", "travel". */
  category?: string;
  /** CEFR-ish level, default "A1". */
  level?: string;
}