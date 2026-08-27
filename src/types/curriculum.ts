// Additional types for curriculum service
// Note: AlphabetItem, NumberItem, CalendarItem, GreetingItem, ArticleItem, SpellingWord, VocabEntry
// are defined in index.ts and re-exported from there
export interface RoleplayOption {
  text: string;
  ok: boolean;
  fb: string;
  /** Optional English translation (present on conversational roleplays). */
  en?: string;
  /** Optional Nepali translation in Devanagari. */
  ne?: string;
  /** Optional romanized Nepali. */
  neR?: string;
      /** Optional English translation (present on conversational roleplays). */
  en?: string;
  /** Optional Nepali translation in Devanagari. */
  ne?: string;
  /** Optional romanized Nepali. */
  neR?: string;
  /**
   * Optional immediate NPC reply to THIS specific choice (branching-lite).
   * When present, the NPC posts it right after the learner's bubble.
   */
  reaction?: string;
  /** Optional English rendering of the reaction line. */
  reactionEn?: string;
  /**
   * Optional target step index to route to after this choice.
   * Defaults to the next step (linear). Lets a choice jump to a different
   * continuation for real branching.
   */
  next?: number;
}

export interface RoleplayStep {
  /**
   * The exchange's leading line. Normally the NPC says it; when `from: 'me'`
   * the learner is the one who INITIATES and must produce this line.
   */
  npc: string;
  /** Optional English rendering of the NPC line. */
  npcEn?: string;
  /** 'npc' (default) = NPC speaks the line; 'me' = the learner initiates. */
  from?: 'npc' | 'me';
  prompt: string;
  options: RoleplayOption[];
  /** Optional grammar-focus label inherited from the target card. */
  grammarFocus?: string;
  /** Optional CEFR level inherited from the target card. */
  cefrLevel?: string;
}

export interface RoleplayScenario {
  id: string;
  title: string;
  emoji: string;
  /** Optional CEFR band (e.g. "A1-A2"), used for filter chips + badges. */
  level?: string;
  steps: RoleplayStep[];
  /** Optional NPC farewell shown after the last correct reply (before the completion state). */
  closing?: string;
  /**
   * True when the scenario is a role-swapped twin (learner plays the service
   * side and opens the dialogue). Used for the 🎭 badge + banner.
   */
  roleFlip?: boolean;
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
/** One telling-time phrase (de/en/ne) — `uhrzeit-item` content pool. */
export interface UhrzeitItem {
  de: string;
  en: string;
  ne: string;
}

/** Conversational sentence bank entry (`conversation-vocab` pool). */
export interface ConversationVocab {
  german_text: string;
  cefr_level: string;
  grammar_focus: string;
  context_situation: string;
  translations: { en: string; ne: string; ne_roman: string };
}

/** Quick-reply option inside a scenario definition step. */
export interface ConversationOptionSeed {
  ref?: string;
  t?: string;
  en?: string;
  ne?: string;
  neR?: string;
  ok?: boolean;
  fb?: string;
  reaction?: string;
  reactionEn?: string;
  next?: number;
}

/** One exchange step of a conversational variant. */
export interface ConversationStepSeed {
  n: string;
  nEn?: string;
  from?: 'npc' | 'me';
  p: string;
  opts: ConversationOptionSeed[];
}

/** One alternative dialogue for a scenario. */
export interface ConversationVariantSeed {
  id: string;
  name: string;
  steps: ConversationStepSeed[];
  /**
   * True when the learner plays the SERVICE side (waiter/clerk/…) and opens
   * the dialogue themselves (opening step uses `from: 'me'`). Surfaced on the
   * built `RoleplayScenario` so pages can badge role-swapped scenarios.
   */
  roleFlip?: boolean;
}

/** A conversational scenario definition (`conversation-def` pool). */
export interface ConversationScenarioSeed {
  sid: string;
  title: string;
  titleEn: string;
  emoji: string;
  ctx: string;
  band: string;
  closing?: string;
  /** Metadata: roles available (e.g. ['customer','staff']). Informational. */
  roleModes?: string[];
  variants: ConversationVariantSeed[];
}

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
/**
   * Randomized sentence-building exercises from the dynamic pipeline
   * (Supabase `get_random_sentences` RPC with a Dexie offline cache).
   */
  getSentences(grammarFocus?: string, limit?: number): Promise<SentenceExercise[]>;
  /** Telling-time phrases from the `uhrzeit-item` content pool. */
  getUhrzeit(): Promise<UhrzeitItem[]>;
  /** Conversational scenario definitions from the `conversation-def` pool. */
  getConversationDefs(): Promise<ConversationScenarioSeed[]>;
  /** Conversational sentence bank from the `conversation-vocab` pool. */
  getConversationVocab(): Promise<ConversationVocab[]>;
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