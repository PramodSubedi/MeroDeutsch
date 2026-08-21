/**
 * types/rapidBlitz.ts
 *
 * Type definitions for the 6-challenge Rapid Blitz system.
 * Each challenge type is a different quiz format that rotates during a 60-second session.
 */

export type ChallengeType = 
  | 'vocabulary-translation'
  | 'audio-comprehension'
  | 'article-precision'
  | 'number-conversion'
  | 'verb-conjugation'
  | 'pronunciation-reading';

/**
 * Base challenge structure — common to all challenge types.
 */
export interface BaseChallenge {
  id: string;
  type: ChallengeType;
  timeLimit: number; // milliseconds for this challenge
}

/**
 * Vocabulary Translation Challenge
 * User must match English words to German equivalents.
 *
 * Example: "dog" → [ "Hund", "Katze", "Baum" ] → pick "Hund"
 */
export interface VocabularyTranslationChallenge extends BaseChallenge {
  type: 'vocabulary-translation';
  english: string;
  german: string;
  options: string[]; // 3-4 German word options
}

/**
 * Audio Comprehension Challenge
 * User listens to German audio and selects the matching word.
 *
 * Example: plays "Tisch" audio → [ "Fenster", "Tisch", "Stuhl" ] → pick "Tisch"
 */
export interface AudioComprehensionChallenge extends BaseChallenge {
  type: 'audio-comprehension';
  word: string;
  meaning: string;
  options: string[]; // 3-4 English meaning options
}

/**
 * Article Precision Challenge (der/die/das)
 * User rapidly selects the correct article for a noun.
 *
 * Example: "Tisch" → [ der, die, das ] → pick "der"
 */
export interface ArticlePrecisionChallenge extends BaseChallenge {
  type: 'article-precision';
  noun: string;
  article: 'der' | 'die' | 'das';
}

/**
 * Number Conversion Challenge
 * User converts between digits and German text.
 *
 * Example: "33" → "dreiunddreißig" OR "fünfundvierzig" → "45"
 */
export interface NumberConversionChallenge extends BaseChallenge {
  type: 'number-conversion';
  number: number;
  germanText: string;
  direction: 'digit-to-text' | 'text-to-digit';
  options: string[]; // German text or digit-string options
}

/**
 * Verb Conjugation Challenge
 * User matches subject pronoun to correct verb form.
 *
 * Example: "ich" + "sprechen" → [ spreche, sprichst, sprechen ] → pick "spreche"
 */
export interface VerbConjugationChallenge extends BaseChallenge {
  type: 'verb-conjugation';
  pronoun: string; // ich, du, er/sie/es, wir, ihr, sie/Sie
  verb: string; // infinitive
  conjugated: string; // correct answer
  options: string[]; // verb form options
}

/**
 * Pronunciation & Reading Challenge
 * User reads German text aloud or repeats after hearing it.
 *
 * Example: "Guten Morgen" → user speaks → evaluates pronunciation
 */
export interface PronunciationReadingChallenge extends BaseChallenge {
  type: 'pronunciation-reading';
  text: string;
  meaning: string;
  audio?: string; // reference audio URL for comparison
  options: string[]; // meaning options for unsupported-speech fallback
}

/**
 * Union of all challenge types.
 */
export type RapidBlitzChallenge =
  | VocabularyTranslationChallenge
  | AudioComprehensionChallenge
  | ArticlePrecisionChallenge
  | NumberConversionChallenge
  | VerbConjugationChallenge
  | PronunciationReadingChallenge;

/**
 * Challenge response (user's answer).
 */
export interface ChallengeResponse {
  challengeId: string;
  type: ChallengeType;
  selectedAnswer: string;
  isCorrect: boolean;
  timeSpent: number; // milliseconds
  xpEarned: number;
}

/**
 * Session state for multi-challenge Rapid Blitz.
 */
export interface RapidBlitzSessionState {
  status: 'idle' | 'playing' | 'finished';
  startTime: number;
  endTime?: number;
  currentChallengeIndex: number;
  challenges: RapidBlitzChallenge[];
  responses: ChallengeResponse[];
  totalScore: number;
  combo: number;
  multiplier: number;
}

/**
 * Session summary after completion.
 */
export interface RapidBlitzSessionSummary {
  totalScore: number;
  totalXP: number;
  accuracy: number; // percentage
  challengeStats: {
    type: ChallengeType;
    correct: number;
    total: number;
    accuracy: number;
  }[];
  missedWords: string[];
}
