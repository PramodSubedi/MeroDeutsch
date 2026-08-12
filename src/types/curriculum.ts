import type { 
  AlphabetItem, 
  NumberItem, 
  CalendarItem, 
  GreetingItem, 
  ArticleItem, 
  SpellingWord 
} from './index';

export type { 
  AlphabetItem, 
  NumberItem, 
  CalendarItem, 
  GreetingItem, 
  ArticleItem, 
  SpellingWord 
};

// Removed duplicate exports here as they are handled above



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

export interface CurriculumService {
  getAlphabet(): Promise<AlphabetItem[]>;
  getNumbers(): Promise<NumberItem[]>;
  getCalendar(): Promise<CalendarItem[]>;
  getGreetings(): Promise<GreetingItem[]>;
  getArticles(): Promise<ArticleItem[]>;
  getSpellingWords(): Promise<SpellingWord[]>;
  getVocabulary(): Promise<any[]>; // vocabularyData
  getGrammarDrills(category: string): Promise<GrammarDrill[]>;
  getGrammarConjugations(): Promise<Record<string, GrammarItem>>;
  getRoleplayScenarios(): Promise<RoleplayScenario[]>;
  getDictationWords(): Promise<DictationWord[]>;
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
