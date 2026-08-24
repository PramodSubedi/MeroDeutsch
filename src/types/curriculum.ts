// Additional types for curriculum service
// Note: AlphabetItem, NumberItem, CalendarItem, GreetingItem, ArticleItem, SpellingWord, VocabEntry
// are defined in index.ts and re-exported from there
export interface RoleplayOption {
  text: string;
  ok: boolean;
  fb: string;
}

export interface RoleplayStep {
  npc: string;
  prompt: string;
  options: RoleplayOption[];
}

export interface RoleplayScenario {
  id: string;
  title: string;
  emoji: string;
  steps: RoleplayStep[];
}

export interface DictationWord {
  word: string;
}

/**
 * Dynamic sentence-building exercise (Supabase `sentences` table).
 * Fetched via the randomized `get_random_sentences` RPC — no local hardcoding.
 */
export interface SentenceExercise {
  id: string;
  phraseDe: string;
  /** Canonical German word order. */
  expected: string[];
  /** Decoy tiles that must be left in the tray. */
  distractors: string[];
  grammarFocus: string;
  tags: string[];
}

export interface GrammarDrill {
  prompt: string;
  options: string[];
  correct: string;
}

export interface GrammarItem {
  id: string;
  title: string;
  rows: [string, string][];
}

/** Pool of spelling words grouped by difficulty. */
export interface SpellingWordPool {
  easy: import('./index').SpellingWord[];
  medium: import('./index').SpellingWord[];
}

/** One German word with translations for story word tooltips. */
export interface StoryWord {
  de: string;
  ne: string;
  en: string;
}

/** One sentence inside a micro-story with word-level translations. */
export interface StorySentence {
  id: string;
  de: string;
  ne: string;
  en: string;
  words: StoryWord[];
}

/**
 * One A1 comprehension question attached to a micro-story.
 * Sourced by Kilo (questions column of content_items) — optional; absent => hidden.
 */
export interface StoryComprehensionQuestion {
  id: string;
  question: string;
  options: string[];
  correct: string;
  /** Stable key for the review queue; defaults to \:q:\. */
  itemKey?: string;
}

/** An A1 micro-story with interactive word-level translations. */
export interface MicroStory {
  id: string;
  title: string;
  titleNe: string;
  titleEn: string;
  level: 'A1';
  sentences: StorySentence[];
  /** Optional comprehension questions (Kilo-seeded). Absent => quiz hidden. */
  questions?: StoryComprehensionQuestion[];
}

/** Pronunciation tip for a specific letter (keyed by letter id). */
export interface PronunciationTip {
  letterId: string;
  en: string;
  ne: string;
}

// Re-export content types for convenience
export type { VocabularyEntity } from '../types/content';

/** Filter params for the leveled/topical vocab trainer (Phase 3). */
export interface VocabularyFilter {
  pos?: 'noun' | 'verb' | 'adjective' | 'phrase';
  level?: 'A1' | 'A2' | 'B1' | 'B2';
  category?: string;
  limit?: number;
}

export interface VocabularyFilterOptions {
  levels: string[];
  categories: string[];
}

export interface CurriculumService {
  getAlphabet(): Promise<import('./index').AlphabetItem[]>;
  getNumbers(): Promise<import('./index').NumberItem[]>;
  getCalendar(): Promise<import('./index').CalendarItem[]>;
  getGreetings(): Promise<import('./index').GreetingItem[]>;
  getArticles(): Promise<import('./index').ArticleItem[]>;
  getVocabulary(): Promise<import('./index').VocabEntry[]>;
  /** Filtered vocabulary rows from the live `vocabulary` table (RPC → filtered → Dexie). */
  getVocabularyFiltered(filters: VocabularyFilter): Promise<import('./index').VocabCard[]>;
  /**
   * Unit-themed vocabulary for checkpoint `vocab-translation` items (v0.2.0).
   * Tries each configured category in order, then an optional POS pass, and
   * ALWAYS tops up from the general A1 pool — a sparse/unknown category can
   * never starve a checkpoint deck.
   */
  getVocabularyByCategories(
    categories: string[],
    pos?: VocabularyFilter['pos'],
    limit?: number
  ): Promise<import('./index').VocabEntry[]>;
  /** Distinct level + category values for the trainer filter UI. */
  getVocabFilterOptions(): Promise<VocabularyFilterOptions>;
  getGrammarDrills(category: string): Promise<GrammarDrill[]>;
  getRoleplayScenarios(): Promise<RoleplayScenario[]>;
  getDictationWords(): Promise<DictationWord[]>;
  /** Micro-stories pool from the dynamic content table. */
  getStories(): Promise<MicroStory[]>;
  /** Spelling word pools (easy/medium) from the dynamic content table. */
  getSpelling(): Promise<{ easy: import('./index').SpellingWord[]; medium: import('./index').SpellingWord[] }>;
  /** Pronunciation tips keyed by letter id from the dynamic content table. */
  getPronunciationTips(): Promise<Record<string, PronunciationTip>>;
  /** Rapid-fire question pools per challenge type from the dynamic table. */
  getRapidFireSections(): Promise<Record<string, unknown[]>>;
  /**
   * Randomized sentence-building exercises from the dynamic pipeline
   * (Supabase `get_random_sentences` RPC with a Dexie offline cache).
   */
  getSentences(grammarFocus?: string, limit?: number): Promise<SentenceExercise[]>;
}