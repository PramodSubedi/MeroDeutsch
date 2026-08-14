export type LangMode = 'normal' | 'german';

export type LetterType = 'vowel' | 'consonant';
export type LetterCategory = 'standard' | 'special';

export interface AlphabetItem {
  id: string;
  letter: string;
  gerPhonetic: string;
  engPhonetic: string;
  nepPhonetic: string;
  type: LetterType;
  category: LetterCategory;
  example: string;
  exampleFull: string;
  speak: string;
  speakWord: string;
}

export interface NumberItem {
  n: number;
  de: string;
  engPh: string;
  nepPh: string;
  en: string;
  ne: string;
  note?: string;
}

export type NumberRange = '0-12' | '13-19' | '20-99' | '100plus';

export interface CalendarItem {
  de: string;
  engPh: string;
  nepPh: string;
  en: string;
  ne: string;
}

export interface SpellingWord {
  word: string;
  meaning: string;
  letters: string[];
}

export interface ArticleItem {
  noun: string;
  art: 'der' | 'die' | 'das';
  meaning: string;
  sentence?: string;
}

export interface GreetingItem {
  de: string;
  engPh: string;
  nepPh: string;
  en: string;
  ne: string;
}

export interface Progress {
  practiced: string[];
  quizCorrect: number;
  quizTotal: number;
  spellCompleted: number;
}

export interface AuthUser {
  userId: string;
  username: string;
  avatarUrl?: string;
}

export interface WrongAnswerItem {
  id: string;
  moduleType: string;
  itemKey: string;
  userAnswer: string;
  correctAnswer: string;
  errorCount: number;
  timestamp: string;
  /** SRS fields (lightweight SM-2 style) */
  ease?: number;
  intervalDays?: number;
  repetitions?: number;
  dueAt?: string;
  lastResult?: 'correct' | 'wrong';
  /** Leitner 5-Box SRS System */
  boxLevel?: number; // 1-5, representing mastery level
}

export interface Badge {
  id: string;
  label: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  requirement: string;
}

export interface UnlockedBadge {
  id: string;
  unlockedAt: string;
}

export interface UserAchievements {
  badges: UnlockedBadge[]; // unlocked badge records with timestamps
}

export interface UserXP {
  totalXp: number;
  level: number;
  rank: string;
  xpToNextLevel: number;
  xpForNextLevel: number;
  xpProgress: number;
}

export interface XPReward {
  amount: number;
  source: string;
  timestamp: string;
}

export interface VocabEntry {
  id: string;
  de: string;
  en: string;
  ne: string;
  tags: string[];
  level: 'A1';
  exampleDe?: string;
  audioId?: string;
}

/**
 * Enriched, type-safe German vocabulary card (Phase 1 schema).
 * Lives in IndexedDB `vocab` table and is shared with scripts/enrich-cards.ts.
 * `lemma`/article/plural enrich the legacy `VocabEntry` so old UI keeps working.
 */
export interface VocabCard {
  id: string;
  lemma: string;
  article: 'der' | 'die' | 'das' | null;
  plural: string | null;
  partOfSpeech: 'noun' | 'verb' | 'adjective' | 'adverb' | 'preposition' | 'phrase' | string;
  cefrLevel: 'A1' | 'A2' | 'B1';
  translation: { en: string; np: string };
  phonetics: { ipa: string; devanagari: string };
  tags: string[];
  examples: { de: string; en: string; np: string }[];
}

/**
 * Per-user spaced-repetition state stored in IndexedDB `userProgress` table.
 * Replaces the legacy `WrongAnswerItem` review queue with a Leitner 5-Box model.
 */
export interface UserProgress {
  /** Unique row id: `${userId}:${originalId|itemKey}` (deterministic so re-runs upsert, not duplicate). */
  id: string;
  /** Owning user id (or 'guest') so the table is multi-user safe. */
  userId: string;
  /** References `VocabCard.id` (or a module item key for legacy rows). */
  cardId: string;
  moduleType: string;
  /** Leitner box 1–5 (5 = mastered). */
  box: number;
  dueAt: string;
  intervalDays: number;
  lapses: number;
  lastReviewedAt: string;
  ease?: number;
  repetitions?: number;
  lastResult?: 'correct' | 'wrong';
  userAnswer?: string;
  correctAnswer?: string;
  updatedAt?: string;
}

/** Result returned by {@link migrateLocalStorageToDexie}. */
export interface MigrationResult {
  migrated: number;
  skipped: number;
  alreadyMigrated: boolean;
  message?: string;
}
