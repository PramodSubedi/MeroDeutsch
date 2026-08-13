import type { 
  AlphabetItem, 
  NumberItem, 
  CalendarItem, 
  GreetingItem, 
  ArticleItem, 
  SpellingWord,
  VocabEntry
} from '../types';
import type { CurriculumService, GrammarDrill, GrammarItem, RoleplayScenario, DictationWord } from '../types/curriculum';
import { alphabetData, numbersData, calendarData, greetingsData, articlesData } from '../data/sharedContent';
import { spellingWords } from '../data/spelling';
import { vocabularyData } from '../data/loadVocabulary';
import { DRILLS, CONJUGATIONS } from '../data/grammar';
import { SCENARIOS } from '../data/roleplay';
import { DICTATION_WORDS } from '../data/dictation';

export class LocalCurriculumService implements CurriculumService {
  async getAlphabet(): Promise<AlphabetItem[]> {
    return alphabetData;
  }

  async getNumbers(): Promise<NumberItem[]> {
    return numbersData;
  }

  async getCalendar(): Promise<CalendarItem[]> {
    return calendarData;
  }

  async getGreetings(): Promise<GreetingItem[]> {
    return greetingsData;
  }

  async getArticles(): Promise<ArticleItem[]> {
    return articlesData;
  }

  async getSpellingWords(): Promise<SpellingWord[]> {
    return Object.values(spellingWords).flat();
  }

  async getVocabulary(): Promise<VocabEntry[]> {
    return vocabularyData;
  }

  async getGrammarDrills(category: string): Promise<GrammarDrill[]> {
    return DRILLS[category] || [];
  }

  async getGrammarConjugations(): Promise<Record<string, GrammarItem>> {
    // Mapping the data to fit the interface if necessary
    return CONJUGATIONS as unknown as Record<string, GrammarItem>;
  }

  async getRoleplayScenarios(): Promise<RoleplayScenario[]> {
    return SCENARIOS;
  }

  async getDictationWords(): Promise<DictationWord[]> {
    return DICTATION_WORDS;
  }
}