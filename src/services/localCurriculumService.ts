import type {
  AlphabetItem,
  NumberItem,
  CalendarItem,
  GreetingItem,
  ArticleItem,
  VocabEntry,
  VocabCard,
} from '../types';
import type {
  CurriculumService,
  GrammarDrill,
  RoleplayScenario,
  DictationWord,
  SentenceExercise,
  MicroStory,
  PronunciationTip,
  VocabularyFilter,
  VocabularyFilterOptions,
} from '../types/curriculum';
import { openDb, getCachedContent } from '../lib/db';

/**
 * Local-only curriculum service.
 *
 * Offline-first source of truth for ALL content types. It reads from the
 * Dexie caches that the Supabase service populates via write-through caching —
 * so the app remains fully usable offline after one online fetch. No bundled
 * static data: every pool returns [] until the first successful online fetch
 * has been cached.
 */
export class LocalCurriculumService implements CurriculumService {
  async getAlphabet(): Promise<AlphabetItem[]> {
    return getCachedContent<AlphabetItem>('alphabet-item');
  }

  async getNumbers(): Promise<NumberItem[]> {
    return getCachedContent<NumberItem>('number-item');
  }

  async getCalendar(): Promise<CalendarItem[]> {
    return getCachedContent<CalendarItem>('calendar-item');
  }

  async getGreetings(): Promise<GreetingItem[]> {
    return getCachedContent<GreetingItem>('greeting-item');
  }

  /** Articles (nouns with gender) served from the offline Dexie cache. */
  async getArticles(): Promise<ArticleItem[]> {
    const db = openDb();
    if (!db) return [];

    const rows = await db.vocab
      .where('partOfSpeech')
      .equals('noun')
      .and((v) => v.article !== null)
      .toArray();

    return rows.map((v) => ({
      art: v.article!,
      noun: v.lemma,
      meaning: `${v.translation.en}${v.translation.np ? ` / ${v.translation.np}` : ''}`,
      sentence: v.examples?.[0]?.de ?? undefined,
    }));
  }

  /** Filtered vocab cards from the offline Dexie cache (client-side filtering). */
  async getVocabularyFiltered(filters: VocabularyFilter): Promise<VocabCard[]> {
    const db = openDb();
    if (!db) return [];
    const cached = await db.vocab.toArray();
    return cached.filter((c) => {
      if (filters.pos && c.partOfSpeech !== filters.pos) return false;
      if (filters.level && c.cefrLevel !== filters.level) return false;
      if (filters.category && !c.tags.includes(filters.category)) return false;
      return true;
    });
  }

  /** Distinct level + category values from the offline Dexie cache. */
  async getVocabFilterOptions(): Promise<VocabularyFilterOptions> {
    const db = openDb();
    if (!db) return { levels: [], categories: [] };
    const cached = await db.vocab.toArray();
    const levels = new Set<string>();
    const categories = new Set<string>();
    for (const c of cached) {
      levels.add(c.cefrLevel);
      for (const t of c.tags) {
        // Skip POS tags — categories only.
        if (!['noun', 'verb', 'adjective', 'phrase', 'expression', 'adverb', 'preposition'].includes(t)) {
          categories.add(t);
        }
      }
    }
    return {
      levels: Array.from(levels).sort((a, b) => (a < b ? -1 : 1)),
      categories: Array.from(categories).sort((a, b) => (a < b ? -1 : 1)),
    };
  }

  /**
   * Dynamic sentence exercises served from the offline Dexie cache.
   * Returns a randomized subset (client-side shuffle of cached rows).
   */
  async getSentences(grammarFocus?: string, limit = 8): Promise<SentenceExercise[]> {
    const db = openDb();
    if (!db) return [];

    const rows = await (grammarFocus
      ? db.sentences.where('grammarFocus').equals(grammarFocus).toArray()
      : db.sentences.toArray());

    // Fisher-Yates on a copy (without-replacement selection, not a pool drain).
    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rows[i], rows[j]] = [rows[j], rows[i]];
    }
    const sliced = rows.slice(0, Math.max(0, limit));

    return sliced.map((s) => ({
      id: s.id,
      phraseDe: s.phraseDe,
      expected: s.expectedArray,
      distractors: s.distractorsArray,
      grammarFocus: s.grammarFocus,
      tags: s.tags,
    }));
  }

  async getVocabulary(): Promise<VocabEntry[]> {
    // Offline source of truth: the Dexie vocab cache (populated by the
    // Supabase service's write-through), mapped to the legacy VocabEntry
    // shape. Falls back to the tiny legacy vocab-item pool if empty.
    const cards = await this.getVocabularyFiltered({});
    if (cards.length > 0) {
      return cards.map((c) => ({
        id: c.id,
        de: c.lemma,
        en: c.translation.en,
        ne: c.translation.np,
        tags: c.tags,
        level: 'A1' as const,
        exampleDe: c.examples[0]?.de,
      }));
    }
    return getCachedContent<VocabEntry>('vocab-item');
  }

  async getGrammarDrills(category: string): Promise<GrammarDrill[]> {
    const all = await getCachedContent<GrammarDrill & { category?: string }>('grammar-drill');
    return category ? all.filter((d) => d.category === category) : all;
  }

  async getRoleplayScenarios(): Promise<RoleplayScenario[]> {
    return getCachedContent<RoleplayScenario>('roleplay-scenario');
  }

  async getDictationWords(): Promise<DictationWord[]> {
    return getCachedContent<DictationWord>('dictation-word');
  }

  /** Micro-stories rebuilt from cached story-sentence rows grouped by storyId. */
  async getStories(): Promise<MicroStory[]> {
    interface StoryRowPayload {
      storyId: string;
      title: string;
      titleNe: string;
      titleEn: string;
      level: 'A1';
      sentence: MicroStory['sentences'][number];
    }
    const rows = await getCachedContent<StoryRowPayload>('story-sentence');
    const stories = new Map<string, MicroStory>();
    for (const row of rows) {
      let story = stories.get(row.storyId);
      if (!story) {
        story = {
          id: row.storyId,
          title: row.title,
          titleNe: row.titleNe,
          titleEn: row.titleEn,
          level: row.level,
          sentences: [],
        };
        stories.set(row.storyId, story);
      }
      story.sentences.push(row.sentence);
    }
    return Array.from(stories.values());
  }

  /** Spelling word pools (easy/medium) from the cached spelling-word pool. */
  async getSpelling(): Promise<{ easy: import('../types').SpellingWord[]; medium: import('../types').SpellingWord[] }> {
    type SpellingPayload = import('../types').SpellingWord & { difficulty?: 'easy' | 'medium' };
    const rows = await getCachedContent<SpellingPayload>('spelling-word');
    return {
      easy: rows.filter((w) => w.difficulty === 'easy'),
      medium: rows.filter((w) => w.difficulty === 'medium'),
    };
  }

  /** Pronunciation tips keyed by letter id from the cached pool. */
  async getPronunciationTips(): Promise<Record<string, PronunciationTip>> {
    const rows = await getCachedContent<PronunciationTip>('pronunciation-tip');
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
    const rows = await getCachedContent<RapidPayload>('rapidfire-question');
    const pools: Record<string, unknown[]> = {};
    for (const q of rows) {
      (pools[q.type] ??= []).push(q);
    }
    return pools;
  }
}