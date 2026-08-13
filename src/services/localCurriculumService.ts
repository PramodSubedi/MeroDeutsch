import type { 
  AlphabetItem, 
  NumberItem, 
  CalendarItem, 
  GreetingItem, 
  ArticleItem, 
  VocabEntry
} from '../types';
import type { CurriculumService, GrammarDrill, RoleplayScenario, DictationWord } from '../types/curriculum';
import { alphabetData, numbersData, calendarData, greetingsData, articlesData } from '../data/sharedContent';
import { vocabularyData } from '../data/loadVocabulary';
import { DRILLS } from '../data/grammar';
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

  async getVocabulary(): Promise<VocabEntry[]> {
    return vocabularyData;
  }

  async getGrammarDrills(category: string): Promise<GrammarDrill[]> {
    return DRILLS[category] || [];
  }

  async getRoleplayScenarios(): Promise<RoleplayScenario[]> {
    return SCENARIOS;
  }

  async getDictationWords(): Promise<DictationWord[]> {
    return DICTATION_WORDS;
  }
}