import type {
  AlphabetItem,
  NumberItem,
  CalendarItem,
  GreetingItem,
  ArticleItem,
  VocabEntry,
  VocabCard,
  SpellingWord,
} from '../types';
import type {
  CurriculumService,
  GrammarDrill,
  RoleplayScenario,
  DictationWord,
  SentenceExercise,
  MicroStory,
  PronunciationTip,
} from '../types/curriculum';
import { supabase } from '../lib/supabase';
import { openDb, seedVocab, seedSentences, seedContentItems } from '../lib/db';
import type { SentenceRow } from '../lib/db';
import { LocalCurriculumService } from './localCurriculumService';

/** A row from the generic `content_items` pool table (migration 011). */
interface ContentItemRow {
  id: string;
  content_type: string;
  payload: unknown;
  sort: number;
}

/** Raw shape of a `vocabulary` row we care about for articles. */
interface VocabRow {
  word: string;
  article: string | null;
  translation_en: string;
  translation_np?: string | null;
  example_de?: string | null;
}

/** Raw shape of a `sentences` row returned by the RPC/table. */
interface SentencesRow {
  id: string;
  phrase_de: string;
  expected_array: unknown;
  distractors_array: unknown;
  grammar_focus: string;
  tags: string[] | null;
}

/** Maps a Supabase `vocabulary` row onto the ArticleItem shape. */
function rowToArticle(row: VocabRow): ArticleItem {
  return {
    art: (row.article || 'der') as 'der' | 'die' | 'das',
    noun: row.word,
    meaning: `${row.translation_en}${row.translation_np ? ` / ${row.translation_np}` : ''}`,
    sentence: row.example_de || undefined,
  };
}

/** Maps a `vocabulary` row onto the enriched VocabCard schema for the Dexie cache. */
function rowToVocabCard(row: VocabRow & { part_of_speech: string; level?: string; category?: string }): VocabCard {
  const art = (row.article || null) as VocabCard['article'];
  return {
    id: row.word,
    lemma: row.word,
    article: art,
    plural: null,
    partOfSpeech: row.part_of_speech as VocabCard['partOfSpeech'],
    cefrLevel: (row.level as VocabCard['cefrLevel']) ?? 'A1',
    translation: { en: row.translation_en, np: row.translation_np ?? '' },
    phonetics: { ipa: '', devanagari: '' },
    tags: row.category ? [row.category, row.part_of_speech] : [row.part_of_speech],
    examples: row.example_de
      ? [{ de: row.example_de, en: row.translation_en, np: row.translation_np ?? '' }]
      : [],
  };
}

/** Maps a `sentences` row onto the SentenceExercise shape. */
function rowToExercise(row: SentencesRow): SentenceExercise {
  return {
    id: row.id,
    phraseDe: row.phrase_de,
    expected: Array.isArray(row.expected_array) ? (row.expected_array as string[]) : [],
    distractors: Array.isArray(row.distractors_array) ? (row.distractors_array as string[]) : [],
    grammarFocus: row.grammar_focus ?? 'general',
    tags: row.tags ?? [],
  };
}

/**
 * Hybrid Supabase + Local Curriculum Service.
 *
 * ALL content pools are fetched from Supabase:
 *  - articles / sentences via the randomized RPC endpoints
 *    (get_random_vocabulary / get_random_sentences),
 *  - every other pool via the generic `get_content_items` RPC
 *    (migration 011 content_items table).
 *
 * Every successful online fetch is WRITTEN THROUGH to the Dexie cache so the
 * local service can serve the same data 100% offline afterwards. Fallback
 * chain per method: RPC → table SELECT → Dexie cache → empty.
 */
export class SupabaseCurriculumService implements CurriculumService {
  private localService = new LocalCurriculumService();

  /**
   * Fetch a generic content pool from the `content_items` table via the
   * `get_content_items` RPC (migration 011), write through to the Dexie
   * cache, and fall back to the local (cached) service on any error/empty.
   */
  private async fetchContentPool<T>(
    contentType: string,
    shuffle: boolean,
    fallback: () => Promise<T[]>
  ): Promise<T[]> {
    try {
      if (!supabase) return fallback();
      const { data, error } = await supabase.rpc('get_content_items', {
        p_content_type: contentType,
        p_limit: 500,
        p_shuffle: shuffle,
      });
      if (error || !data || (data as unknown[]).length === 0) {
        return fallback();
      }
      const rows = data as ContentItemRow[];
      // Write-through cache so offline mode keeps working after this fetch.
      void seedContentItems(
        contentType,
        rows.map((r) => ({ id: r.id, payload: r.payload, sort: r.sort }))
      );
      return rows.map((row) => row.payload as T);
    } catch (err) {
      console.warn(`[curriculum] ${contentType} fetch failed, using local cache:`, err);
      return fallback();
    }
  }

  async getAlphabet(): Promise<AlphabetItem[]> {
    return this.fetchContentPool<AlphabetItem>('alphabet-item', false, () => this.localService.getAlphabet());
  }

  async getNumbers(): Promise<NumberItem[]> {
    return this.fetchContentPool<NumberItem>('number-item', false, () => this.localService.getNumbers());
  }

  async getCalendar(): Promise<CalendarItem[]> {
    return this.fetchContentPool<CalendarItem>('calendar-item', false, () => this.localService.getCalendar());
  }

  async getGreetings(): Promise<GreetingItem[]> {
    return this.fetchContentPool<GreetingItem>('greeting-item', false, () => this.localService.getGreetings());
  }

  /** Write-through cache: persist vocabulary rows to Dexie for offline reuse. */
  private async cacheVocab(rows: (VocabRow & { part_of_speech: string; level?: string; category?: string })[]): Promise<void> {
    const db = openDb();
    if (!db) return;
    await seedVocab(rows.map(rowToVocabCard));
  }

  /** Write-through cache: persist sentence rows to Dexie for offline reuse. */
  private async cacheSentences(rows: SentencesRow[]): Promise<void> {
    const db = openDb();
    if (!db) return;
    const cached: SentenceRow[] = rows.map((s) => ({
      id: s.id,
      phraseDe: s.phrase_de,
      expectedArray: Array.isArray(s.expected_array) ? (s.expected_array as string[]) : [],
      distractorsArray: Array.isArray(s.distractors_array) ? (s.distractors_array as string[]) : [],
      grammarFocus: s.grammar_focus ?? 'general',
      tags: s.tags ?? [],
    }));
    await seedSentences(cached);
  }

  /**
   * Fetch articles (nouns with gender) from Supabase. Uses the randomized
   * get_random_vocabulary RPC (p_pos='noun'); on RPC error/empty, falls back
   * to a plain table SELECT; finally to the Dexie offline cache.
   */
  async getArticles(limit = 15): Promise<ArticleItem[]> {
    try {
      if (!supabase) return this.localService.getArticles();

      // Primary path: randomized RPC.
      const { data, error } = await supabase.rpc('get_random_vocabulary', {
        p_pos: 'noun',
        p_limit: limit,
      });

      if (error || !data || (data as unknown[]).length === 0) {
        // Fallback: full table SELECT (online — so we can still cache).
        const { data: fbData, error: fbError } = await supabase
          .from('vocabulary')
          .select('word, article, translation_en, translation_np, example_de, part_of_speech, level, category')
          .eq('part_of_speech', 'noun')
          .not('article', 'is', null);

        if (fbError || !fbData || fbData.length === 0) {
          throw new Error('table fallback also empty');
        }

        const rows = fbData as (VocabRow & { part_of_speech: string; level?: string; category?: string })[];
        void this.cacheVocab(rows);
        return rows.map(rowToArticle);
      }

      const rows = (data as unknown) as (VocabRow & { part_of_speech: string; level?: string; category?: string })[];
      void this.cacheVocab(rows);
      return rows.map(rowToArticle);
    } catch (err) {
      console.warn('Supabase article fetch failed, using local cache:', err);
      return this.localService.getArticles();
    }
  }

  /**
   * Fetch randomized sentence exercises from the dynamic pipeline.
   * RPC get_random_sentences(grammar_focus, limit) with table SELECT +
   * Dexie cache fallbacks.
   */
  async getSentences(grammarFocus?: string, limit = 8): Promise<SentenceExercise[]> {
    try {
      if (!supabase) return this.localService.getSentences(grammarFocus, limit);

      const { data, error } = await supabase.rpc('get_random_sentences', {
        p_grammar_focus: grammarFocus ?? null,
        p_limit: limit,
      });

      if (error || !data || (data as unknown[]).length === 0) {
        // Fallback: table SELECT filtered by grammar focus.
        let q = supabase.from('sentences').select('*');
        if (grammarFocus) q = q.eq('grammar_focus', grammarFocus);
        const { data: fbData, error: fbError } = await q.limit(limit);

        if (fbError || !fbData || fbData.length === 0) {
          throw new Error('table fallback also empty');
        }

        const rows = fbData as SentencesRow[];
        void this.cacheSentences(rows);
        return rows.map(rowToExercise);
      }

      const rows = data as SentencesRow[];
      void this.cacheSentences(rows);
      return rows.map(rowToExercise);
    } catch (err) {
      console.warn('Supabase sentence fetch failed, using local cache:', err);
      return this.localService.getSentences(grammarFocus, limit);
    }
  }

  async getVocabulary(): Promise<VocabEntry[]> {
    return this.fetchContentPool<VocabEntry>('vocab-item', true, () => this.localService.getVocabulary());
  }

  async getGrammarDrills(category: string): Promise<GrammarDrill[]> {
    const all = await this.fetchContentPool<GrammarDrill & { category?: string }>(
      'grammar-drill',
      true,
      () => this.localService.getGrammarDrills(category)
    );
    return category ? all.filter((d) => d.category === category) : all;
  }

  async getRoleplayScenarios(): Promise<RoleplayScenario[]> {
    return this.fetchContentPool<RoleplayScenario>('roleplay-scenario', true, () => this.localService.getRoleplayScenarios());
  }

  async getDictationWords(): Promise<DictationWord[]> {
    return this.fetchContentPool<DictationWord>('dictation-word', true, () => this.localService.getDictationWords());
  }

  /** Micro-stories rebuilt from the cached story-sentence pool. */
  async getStories(): Promise<MicroStory[]> {
    return this.fetchContentPool<MicroStory>('story-sentence', false, () => this.localService.getStories());
  }

  /** Spelling word pools (easy/medium) from the cached spelling-word pool. */
  async getSpelling(): Promise<{ easy: SpellingWord[]; medium: SpellingWord[] }> {
    interface SpellingPayload extends SpellingWord {
      difficulty?: 'easy' | 'medium';
    }
    const rows = await this.fetchContentPool<SpellingPayload>('spelling-word', false, async () => {
      const pool = await this.localService.getSpelling();
      return [...pool.easy, ...pool.medium];
    });
    return {
      easy: rows.filter((w) => w.difficulty === 'easy'),
      medium: rows.filter((w) => w.difficulty === 'medium'),
    };
  }

  /** Pronunciation tips keyed by letter id from the cached pool. */
  async getPronunciationTips(): Promise<Record<string, PronunciationTip>> {
    const rows = await this.fetchContentPool<PronunciationTip>('pronunciation-tip', false, () =>
      this.localService.getPronunciationTips().then((tips) => Object.values(tips))
    );
    const tips: Record<string, PronunciationTip> = {};
    for (const tip of rows) {
      tips[tip.letterId] = tip;
    }
    return tips;
  }

  /** Rapid-fire question pools per challenge type from the cached pool. */
  async getRapidFireSections(): Promise<Record<string, unknown[]>> {
    interface RapidPayload {
      id: string;
      type: string;
      [key: string]: unknown;
    }
    const rows = await this.fetchContentPool<RapidPayload>('rapidfire-question', false, async () => {
      const pools = await this.localService.getRapidFireSections();
      return Object.values(pools).flat() as RapidPayload[];
    });
    const pools: Record<string, unknown[]> = {};
    for (const q of rows) {
      (pools[q.type] ??= []).push(q);
    }
    return pools;
  }
}