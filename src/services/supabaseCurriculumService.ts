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
  VocabularyFilter,
  VocabularyFilterOptions,
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
  translation_ne_roman?: string | null;
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
    translationNeRoman: row.translation_ne_roman ?? undefined,
    phonetics: { ipa: '', devanagari: '' },
    tags: row.category ? [row.category, row.part_of_speech] : [row.part_of_speech],
    examples: row.example_de
      ? [{ de: row.example_de, en: row.translation_en, np: row.translation_np ?? '' }]
      : [],
  };
}

/** Maps a rich VocabCard onto the legacy VocabEntry shape consumed by
 *  Pronunciation / Glossary / checkpoints / DailyChallenge / useDexieInit. */
function cardToLegacyEntry(c: VocabCard): VocabEntry {
  return {
    id: c.id,
    de: c.lemma,
    en: c.translation.en,
    ne: c.translation.np,
    tags: c.tags,
    level: 'A1',
    exampleDe: c.examples[0]?.de,
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
    // Single source of truth: read the live `vocabulary` table via the
    // filtered fetch (no filters = everything), then map to the legacy
    // VocabEntry shape. Upgrades ALL legacy consumers (Pronunciation,
    // Glossary, checkpoint vocab-translation, DailyChallenge, Dexie boot
    // seed) from the 7-entry vocab-item pool to the full ~1000-row table.
    // v0.2.0: cap raised 100 → 400 so Glossary/Pronunciation stop feeling
    // like a sample while keeping per-mount payload light.
    const cards = await this.getVocabularyFiltered({ limit: 400 });
    if (cards.length > 0) return cards.map(cardToLegacyEntry);
    // Offline fallback: cached vocab-item pool (legacy behavior).
    return this.fetchContentPool<VocabEntry>('vocab-item', true, () => this.localService.getVocabulary());
  }

  /** Raw `vocabulary` row shape used by the filtered trainer fetch. */
  private async fetchVocabRows(filters: VocabularyFilter): Promise<VocabCard[]> {
    try {
      if (!supabase) throw new Error('no client');
      const { data, error } = await supabase.rpc('get_random_vocabulary', {
        p_pos: filters.pos ?? null,
        p_tag: null,
        p_level: filters.level ?? null,
        p_category: filters.category ?? null,
        p_limit: filters.limit ?? 25,
      });
      if (error || !data || (data as unknown[]).length === 0) {
        // Fallback: table SELECT with the same filters (online — can still cache).
        let q = supabase
          .from('vocabulary')
          .select(
            'word, article, translation_en, translation_np, translation_ne_roman, example_de, part_of_speech, level, category'
          );
        if (filters.pos) q = q.eq('part_of_speech', filters.pos);
        if (filters.level) q = q.eq('level', filters.level);
        if (filters.category) q = q.eq('category', filters.category);
        const { data: fbData, error: fbError } = await q.limit(filters.limit ?? 25);
        if (fbError || !fbData || fbData.length === 0) {
          throw new Error('table fallback also empty');
        }
        const rows = fbData as (VocabRow & { part_of_speech: string; level?: string; category?: string })[];
        void this.cacheVocab(rows);
        return rows.map(rowToVocabCard);
      }
      const rows = (data as unknown) as (VocabRow & { part_of_speech: string; level?: string; category?: string })[];
      void this.cacheVocab(rows);
      return rows.map(rowToVocabCard);
    } catch (err) {
      console.warn('Supabase filtered vocab fetch failed, using Dexie cache:', err);
      // Dexie offline fallback: filter cached VocabCards locally.
      const db = openDb();
      if (!db) return [];
      try {
        let coll = db.vocab.toCollection();
        const cached = await coll.toArray();
        return cached.filter((c) => {
          if (filters.pos && c.partOfSpeech !== filters.pos) return false;
          if (filters.level && c.cefrLevel !== filters.level) return false;
          if (filters.category && !c.tags.includes(filters.category)) return false;
          return true;
        });
      } catch {
        return [];
      }
    }
  }

  async getVocabularyFiltered(filters: VocabularyFilter): Promise<VocabCard[]> {
    return this.fetchVocabRows(filters);
  }

  /**
   * Unit-themed vocabulary for checkpoint `vocab-translation` items (v0.2.0).
   *
   * Pass order (each pass dedupes into the same map):
   *  1. categories (+ pos when given) — one `.in('category', …)` SELECT online,
   *     Dexie tag-intersection offline.
   *  2. pos only — catches units themed by part of speech (e.g. U5 verbs)
   *     even when no category tags exist yet.
   *  3. A1 fill — tops up from `{ level: 'A1' }` so a sparse/unknown category
   *     can NEVER starve a checkpoint deck.
   */
  async getVocabularyByCategories(
    categories: string[],
    pos?: VocabularyFilter['pos'],
    limit = 60
  ): Promise<VocabEntry[]> {
    const cats = categories.filter(Boolean);
    const out = new Map<string, VocabCard>();

    const addCards = (cards: VocabCard[]) => {
      for (const c of cards) {
        if (out.size >= limit) return;
        out.set(c.id, c);
      }
    };

    // Pass 1: configured categories (online table SELECT with .in()).
    if (cats.length > 0) {
      try {
        if (supabase) {
          let q = supabase
            .from('vocabulary')
            .select(
              'word, article, translation_en, translation_np, translation_ne_roman, example_de, part_of_speech, level, category'
            )
            .in('category', cats)
            .limit(limit);
          if (pos) q = q.eq('part_of_speech', pos);
          const { data, error } = await q;
          if (!error && data && data.length > 0) {
            const rows = data as (VocabRow & { part_of_speech: string; level?: string; category?: string })[];
            void this.cacheVocab(rows);
            addCards(rows.map(rowToVocabCard));
          }
        }
      } catch (err) {
        console.warn('[curriculum] themed vocab fetch failed:', err);
      }
      // Offline fallback for pass 1: Dexie tag intersection.
      if (out.size === 0) {
        const db = openDb();
        if (db) {
          try {
            const cached = await db.vocab.toArray();
            addCards(
              cached.filter(
                (c) => (!pos || c.partOfSpeech === pos) && c.tags.some((t) => cats.includes(t))
              )
            );
          } catch {
            /* cache unavailable — A1 fill below still applies */
          }
        }
      }
    }

    // Pass 2: POS-only theming (e.g. U5 "want & can" → verbs).
    if (out.size < limit && pos) {
      try {
        addCards(await this.fetchVocabRows({ pos, level: 'A1', limit }));
      } catch {
        /* fall through to A1 fill */
      }
    }

    // Pass 3: A1 fill — guarantees a non-empty deck regardless of tag state.
    if (out.size < limit) {
      try {
        addCards(await this.fetchVocabRows({ level: 'A1', limit }));
      } catch {
        /* last resort: whatever passes 1–2 produced (possibly empty on a
           fully offline first run — same behavior as getVocabulary()) */
      }
    }

    return Array.from(out.values()).map(cardToLegacyEntry);
  }

  async getVocabFilterOptions(): Promise<VocabularyFilterOptions> {
    // Single source of truth: fetch a decent random sample, derive options
    // from the rows actually present so stale categories never show.
    try {
      const options: VocabularyFilterOptions = { levels: [], categories: [] };
      if (!supabase) return options;
      const { data, error } = await supabase
        .from('vocabulary')
        .select('level, category');
      if (error || !data) return options;
      const levels = new Set<string>();
      const categories = new Set<string>();
      for (const r of data) {
        if (r.level) levels.add(r.level);
        if (r.category) categories.add(r.category);
      }
      options.levels = Array.from(levels)
        .sort((a, b) => (a < b ? -1 : 1))
        .filter((l) => ['A1', 'A2', 'B1', 'B2'].includes(l));
      options.categories = Array.from(categories).sort((a, b) => (a < b ? -1 : 1));
      return options;
    } catch (err) {
      console.warn('Supabase vocab options fetch failed:', err);
      return { levels: [], categories: [] };
    }
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

  /**
   * Micro-stories rebuilt from the story-sentence pool.
   *
   * Each `content_items` row of type 'story-sentence' carries ONE sentence
   * wrapped as { storyId, title, titleNe, titleEn, level, sentence } — NOT a
   * complete MicroStory. Rows must be GROUPED by storyId here (same as
   * LocalCurriculumService.getStories), otherwise consumers crash on
   * `story.sentences.length` / `.forEach` (Stories + Glossary pages).
   */
  async getStories(): Promise<MicroStory[]> {
    interface StoryRowPayload {
      storyId?: string;
      title?: string;
      titleNe?: string;
      titleEn?: string;
      level?: 'A1';
      sentence?: MicroStory['sentences'][number];
    }
    const rows = await this.fetchContentPool<StoryRowPayload>('story-sentence', false, async () => {
      // Offline fallback: the local service already groups cached rows into
      // full stories — flatten them back to row payloads so the single
      // grouping path below handles both sources identically.
      const stories = await this.localService.getStories();
      return stories.flatMap((s) =>
        s.sentences.map((sentence) => ({
          storyId: s.id,
          title: s.title,
          titleNe: s.titleNe,
          titleEn: s.titleEn,
          level: s.level,
          sentence,
        }))
      );
    });

    const stories = new Map<string, MicroStory>();
    for (const row of rows) {
      // Defensive: skip malformed rows instead of crashing the page.
      if (!row?.storyId || !row.sentence || !row.title) continue;
      let story = stories.get(row.storyId);
      if (!story) {
        story = {
          id: row.storyId,
          title: row.title,
          titleNe: row.titleNe ?? '',
          titleEn: row.titleEn ?? '',
          level: row.level ?? 'A1',
          sentences: [],
        };
        stories.set(row.storyId, story);
      }
      story.sentences.push(row.sentence);
    }
    return Array.from(stories.values());
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