import type { 
  AlphabetItem, 
  NumberItem, 
  CalendarItem, 
  GreetingItem, 
  ArticleItem, 
  VocabEntry
} from '../types';
import type { CurriculumService, GrammarDrill, RoleplayScenario, DictationWord } from '../types/curriculum';
import type { VocabularyEntity } from '../types/content';
import { supabase } from '../lib/supabase';
import { LocalCurriculumService } from './localCurriculumService';

/**
 * Hybrid Supabase + Local Curriculum Service
 *
 * Attempts to fetch dynamic content from Supabase (vocabulary, articles),
 * falls back to local JSON data if Supabase is unavailable or offline.
 * Static content (alphabet, numbers, etc.) always comes from local data.
 */
export class SupabaseCurriculumService implements CurriculumService {
  private localService = new LocalCurriculumService();

  async getAlphabet(): Promise<AlphabetItem[]> {
    return this.localService.getAlphabet();
  }

  async getNumbers(): Promise<NumberItem[]> {
    return this.localService.getNumbers();
  }

  async getCalendar(): Promise<CalendarItem[]> {
    return this.localService.getCalendar();
  }

  async getGreetings(): Promise<GreetingItem[]> {
    return this.localService.getGreetings();
  }

  /**
   * Fetch articles (nouns with gender) from Supabase.
   * Falls back to local data if Supabase unavailable or returns no results.
   */
  async getArticles(): Promise<ArticleItem[]> {
    try {
      if (!supabase) {
        return this.localService.getArticles();
      }

      const { data, error } = await supabase
        .from('vocabulary')
        .select('word, article, translation_en, translation_np, example_de, level')
        .eq('part_of_speech', 'noun')
        .eq('level', 'A1')
        .not('article', 'is', null);

      if (error) {
        console.warn('Supabase article fetch failed, using local data:', error);
        return this.localService.getArticles();
      }

      if (!data || data.length === 0) {
        console.warn('No articles found in Supabase, using local data');
        return this.localService.getArticles();
      }

      // Map Supabase response to ArticleItem format
      const articles: ArticleItem[] = data.map((row) => ({
        art: row.article as 'der' | 'die' | 'das',
        noun: row.word,
        meaning: row.translation_en,
        sentence: row.example_de || undefined,
      }));

      return articles;
    } catch (err) {
      console.warn('Error fetching articles from Supabase:', err);
      return this.localService.getArticles();
    }
  }

  /**
   * Fetch vocabulary (all words) from Supabase.
   * Falls back to local data if unavailable.
   */
  async getVocabulary(): Promise<VocabEntry[]> {
    try {
      if (!supabase) {
        return this.localService.getVocabulary();
      }

      const { data, error } = await supabase
        .from('vocabulary')
        .select('*')
        .eq('level', 'A1');

      if (error) {
        console.warn('Supabase vocabulary fetch failed, using local data:', error);
        return this.localService.getVocabulary();
      }

      if (!data || data.length === 0) {
        console.warn('No vocabulary found in Supabase, using local data');
        return this.localService.getVocabulary();
      }

      // Map Supabase VocabularyEntity to VocabEntry format
      const vocab: VocabEntry[] = data.map((row: VocabularyEntity) => ({
        id: row.word, // Use word as unique ID
        de: row.word,
        en: row.translation_en,
        ne: row.translation_np,
        tags: row.category ? [row.category, row.part_of_speech] : [row.part_of_speech],
        level: 'A1',
        exampleDe: row.example_de || undefined,
      }));

      return vocab;
    } catch (err) {
      console.warn('Error fetching vocabulary from Supabase:', err);
      return this.localService.getVocabulary();
    }
  }

  async getGrammarDrills(category: string): Promise<GrammarDrill[]> {
    return this.localService.getGrammarDrills(category);
  }

  async getRoleplayScenarios(): Promise<RoleplayScenario[]> {
    return this.localService.getRoleplayScenarios();
  }

  async getDictationWords(): Promise<DictationWord[]> {
    return this.localService.getDictationWords();
  }
}
