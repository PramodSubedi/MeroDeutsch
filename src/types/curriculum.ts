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

// Re-export content types for convenience
export type { VocabularyEntity } from '../types/content';

export interface CurriculumService {
  getAlphabet(): Promise<import('./index').AlphabetItem[]>;
  getNumbers(): Promise<import('./index').NumberItem[]>;
  getCalendar(): Promise<import('./index').CalendarItem[]>;
  getGreetings(): Promise<import('./index').GreetingItem[]>;
  getArticles(): Promise<import('./index').ArticleItem[]>;
  getVocabulary(): Promise<import('./index').VocabEntry[]>;
  getGrammarDrills(category: string): Promise<GrammarDrill[]>;
  getRoleplayScenarios(): Promise<RoleplayScenario[]>;
  getDictationWords(): Promise<DictationWord[]>;
  
  // Available but currently unused methods:
  // getSpellingWords(): Promise<import('./index').SpellingWord[]>;
  // getGrammarConjugations(): Promise<Record<string, GrammarItem>>;
}
