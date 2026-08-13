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
