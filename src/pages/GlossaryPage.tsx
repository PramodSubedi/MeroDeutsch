import { useMemo, useState, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { curriculumService } from '../services';
import type { MicroStory } from '../types/curriculum';
import type { VocabCard, AlphabetItem, NumberItem, CalendarItem, GreetingItem, VocabStatusValue } from '../types';
import { speakWord } from '../hooks/useSpeech';
import { useLang } from '../hooks/useLang';
import { triggerHaptic } from '../utils/haptic';
import { theme } from '../config/theme';
import { getTopicalTags, topicalTagLabel } from '../utils/vocabTags';
import { usePageTitle } from '../hooks/usePageTitle';
import { SEO } from '../components/common/SEO';
import { GlossaryFilterPanel, type FilterOption } from '../components/glossary/GlossaryFilterPanel';
import { rankedSearch, normalizeTerm } from '../utils/searchScore';
import { useVocabularyStatus } from '../hooks/useVocabularyStatus';

interface GlossaryEntry {
  de: string;
  en: string;
  ne: string;
  source: string;
  pos?: string;
  level?: string;
  plural?: string;
  exampleDe?: string;
  exampleEn?: string;
  categories?: string[];
  neRoman?: string;
  /** VocabCard.id when this entry maps to a vocabulary card (status lookup). */
  wordId?: string;
}

function levelBadge(level?: string): string {
  switch (level) {
    case 'A1': return 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300';
    case 'A2': return 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300';
    case 'B1': return 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300';
    case 'B2': return 'bg-danger-100 text-danger-700 dark:bg-danger-900/40 dark:text-danger-300';
    default: return '';
  }
}

/** Tailwind classes per VocabStatusValue (Glossary/Vocab Trainer badges). */
function vocabStatusBadge(status: VocabStatusValue | undefined): string {
  switch (status) {
    case 'new':
      return 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400';
    case 'learning':
      return 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300';
    case 'known':
      return 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300';
    case 'mastered':
      return 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300';
    default:
      return 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400';
  }
}

/** Human label per status (German-friendly when isDE). */
function vocabStatusLabel(status: VocabStatusValue | undefined, isDE: boolean): string {
  switch (status) {
    case 'new':
      return isDE ? 'Neu' : 'New';
    case 'learning':
      return isDE ? 'Lernt' : 'Learning';
    case 'known':
      return isDE ? 'Bekannt' : 'Known';
    case 'mastered':
      return isDE ? 'Gemeistert' : 'Mastered';
    default:
      return isDE ? 'Neu' : 'New';
  }
}

/**
 * Highlight the active search query (accent/case-insensitive) inside `text`.
 * Renders <mark> spans around the first normalized match. Non-matching text
 * passes through unchanged (cheap to call on every row).
 *
 * Handles German umlauts/ß: the search value "fur"/"strasse" still highlights
 * the original "für"/"Straße" by walking normalized→original index mapping.
 */
function HighlightText({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const normQuery = normalizeTerm(q);
  if (!normQuery) return <>{text}</>;

  // Build normalized text aligned 1:1 with original chars (low = lowercase).
  const normParts: { char: string; low: string }[] = [];
  for (const ch of text) {
    const low = ch.toLowerCase();
    const noAccent = low
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ß/g, 'ss');
    normParts.push({ char: ch, low: noAccent });
  }
  const normText = normParts.map((p) => p.low).join('');

  const start = normText.indexOf(normQuery);
  if (start === -1) return <>{text}</>;

  // Map normalized start/end back to original char indices, handling the
  // ß→"ss" length expansion (norm units equal original index here except ß
  // maps to a single original char for 2 norm units).
  let origStart = 0;
  let normPos = 0;
  while (normPos < start) {
    normPos += normParts[origStart].low.length;
    origStart++;
  }
  let origEnd = origStart;
  let cursor = 0;
  while (cursor < normQuery.length && origEnd < normParts.length) {
    cursor += normParts[origEnd].low.length;
    origEnd++;
  }
  if (cursor !== normQuery.length) return <>{text}</>;

  const before = text.slice(0, origStart);
  const match = text.slice(origStart, origEnd);
  // Safety: mid-ß index alignment can split a ß→"ss" pair; fall back to no
  // highlight when the extracted run does not normalize to the query.
  if (normalizeTerm(match) !== normQuery) return <>{text}</>;
  const after = text.slice(origEnd);
  return (
    <>
      {before}
      <mark className="rounded-sm bg-accent-100 px-0.5 text-accent-800 dark:bg-accent-900/50 dark:text-accent-200">
        {match}
      </mark>
      {after}
    </>
  );
}

export function GlossaryPage() {
  usePageTitle('Glossary');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const [query, setQuery] = useState('');
  // Source filter: 'all' or a specific source name
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  // Part-of-speech filter ('all' or a POS tag); applies to entries carrying a POS
  // (Vocabulary + Articles)
  const [posFilter, setPosFilter] = useState<string>('all');
  // Sort key: 'az' | 'za' | 'source'
  const [sortKey, setSortKey] = useState<string>('az');
  // Level filter: 'all' or A1/A2/B1/B2
  const [levelFilter, setLevelFilter] = useState<string>('all');
  // Category filter: 'all' or a category slug
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const parentRef = useRef<HTMLDivElement>(null);
  
  // State for data from curriculumService
  const [alphabetData, setAlphabetData] = useState<AlphabetItem[]>([]);
  const [numbersData, setNumbersData] = useState<NumberItem[]>([]);
  const [calendarData, setCalendarData] = useState<CalendarItem[]>([]);
  const [greetingsData, setGreetingsData] = useState<GreetingItem[]>([]);
  const [vocabularyData, setVocabularyData] = useState<VocabCard[]>([]);
  const [storiesData, setStoriesData] = useState<MicroStory[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadData, setReloadData] = useState(0);

  // Per-word learning status (reactive Dexie live query, current user).
  const { statsByWord } = useVocabularyStatus();

  // Fetch data from curriculumService. Articles are derived from the same vocab
  // pool below (nouns with der/die/das) — the quiz RPC caps at a small deck,
  // which would otherwise starve the glossary's Articles source.
  useEffect(() => {
    let cancelled = false;
    setDataLoaded(false);
    setLoadFailed(false);
    const loadData = async () => {
      const [alpha, nums, cal, greet, vocab, stories] = await Promise.all([
        curriculumService.getAlphabet(),
        curriculumService.getNumbers(),
        curriculumService.getCalendar(),
        curriculumService.getGreetings(),
        // 2000 = full pool (the live table holds ~1060 rows). Any limit > 100
        // routes the service onto the deterministic full-pool fetch, bypassing
        // the quiz RPC's hard 100-row random-sample cap.
        curriculumService.getVocabularyFiltered({ limit: 2000 }),
        curriculumService.getStories(),
      ]);
      if (cancelled) return;
      setAlphabetData(alpha);
      setNumbersData(nums);
      setCalendarData(cal);
      setGreetingsData(greet);
      setVocabularyData(vocab);
      setStoriesData(stories);
      setDataLoaded(true);
    };
    loadData().catch(() => {
      if (!cancelled) {
        setLoadFailed(true);
        setDataLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, [reloadData]);
  
  const glossary = useMemo(() => {
    if (!dataLoaded) return [];
    
    const entries: GlossaryEntry[] = [];

    // Alphabet examples
    alphabetData.forEach((item) => {
      const match = item.exampleFull.match(/^([^(]+)\(([^/]+)\/([^)]+)\)/);
      if (match) {
        entries.push({
          de: match[1].trim(),
          en: match[2].trim(),
          ne: match[3].trim(),
          source: 'Alphabet',
        });
      }
    });

    // Numbers
    numbersData.forEach((item) => {
      entries.push({ de: item.de, en: item.en, ne: item.ne, source: 'Numbers' });
    });

    // Calendar
    calendarData.forEach((item) => {
      entries.push({ de: item.de, en: item.en, ne: item.ne, source: 'Calendar' });
    });

    // Greetings
    greetingsData.forEach((item) => {
      entries.push({ de: item.de, en: item.en, ne: item.ne, source: 'Greetings' });
    });

    // Articles — nouns with a definite article, derived from the same vocab pool
    // (vs. getArticles(), whose RPC deck is capped at ~15 for the quiz page).
    // Richer too: carries plural, example, CEFR level, and topical category.
    vocabularyData.forEach((card) => {
      if (
        card.partOfSpeech === 'noun' &&
        (card.article === 'der' || card.article === 'die' || card.article === 'das')
      ) {
        const artTags = card.tags ?? [];
        const artCategories = getTopicalTags(artTags);
        entries.push({
          de: `${card.article} ${card.lemma}`,
          en: card.translation.en,
          ne: card.translation.np,
          neRoman: card.translationNeRoman,
          source: 'Articles',
          pos: 'noun',
          level: card.cefrLevel,
          plural: card.plural ?? undefined,
          exampleDe: card.examples?.[0]?.de,
          exampleEn: card.examples?.[0]?.en,
          categories: artCategories,
          wordId: card.id,
        });
      }
    });

    // Curated A1 vocabulary (VocabCard[] from getVocabularyFiltered)
    vocabularyData.forEach((card) => {
      // Keep every valid theme so multi-topic words remain filterable.
      const posTag = card.partOfSpeech;
      const categories = getTopicalTags(card.tags);
      entries.push({
        de: card.lemma,
        en: card.translation.en,
        ne: card.translation.np,
        neRoman: card.translationNeRoman,
        source: 'Vocabulary',
        pos: posTag,
        level: card.cefrLevel,
        plural: card.plural ?? undefined,
        exampleDe: card.examples?.[0]?.de,
        exampleEn: card.examples?.[0]?.en,
        categories,
        wordId: card.id,
      });
    });

    // Stories - flatten all words from all stories (dynamic pool)
    storiesData.forEach((story) => {
      story.sentences.forEach((sentence) => {
        sentence.words.forEach((word) => {
          // Avoid duplicates by checking if word already exists
          const exists = entries.some(
            (e) => e.de.toLowerCase() === word.de.toLowerCase() && e.source === 'Stories'
          );
          if (!exists && word.de.trim()) {
            entries.push({
              de: word.de,
              en: word.en,
              ne: word.ne,
              source: 'Stories',
            });
          }
        });
      });
    });

    // Cross-source dedupe. Two cases:
    //  - Both entries carry a VocabCard wordId (Articles "der Hund" + Vocabulary
    //    "Hund") → they are COMPLEMENTARY views of the same noun; keep both so
    //    the gender-colored article display and the Articles source filter stay
    //    intact.
    //  - A metadata-poor duplicate (Alphabet / Stories line without wordId) vs
    //    the same lemma from Vocabulary/Articles → keep the RICHER wordId entry.
    const bestByKey = new Map<string, GlossaryEntry>();
    for (const entry of entries) {
      // Fold the leading article away so "der Hund" and "Hund" collide.
      const key = normalizeTerm(entry.de).replace(/^(der|die|das)\s+/, '');
      const existing = bestByKey.get(key);
      if (!existing) {
        bestByKey.set(key, entry);
        continue;
      }
      const existingHasCard = Boolean(existing.wordId);
      const entryHasCard = Boolean(entry.wordId);
      if (existingHasCard && entryHasCard) {
        continue; // complementary views — keep both (first one already stored)
      }
      if (entryHasCard && !existingHasCard) {
        bestByKey.set(key, entry); // upgrade to the card-backed entry
      }
      // If neither has a card (e.g. Alphabet vs Stories), keep the first.
    }
    return Array.from(bestByKey.values());
  }, [dataLoaded, alphabetData, numbersData, calendarData, greetingsData, vocabularyData, storiesData]);

  // Derived filter options — data-driven so chips always match real entries
  // (kills the dead 'Vocabulary' chip class of bug forever).
  const sourceOptions = useMemo(() => {
    const distinct = new Set(glossary.map((e) => e.source));
    return ['all', ...Array.from(distinct).sort((a, b) => a.localeCompare(b))];
  }, [glossary]);

  // Filter options with counts for the compact filter panel.
  // Declared BEFORE `filtered` — that memo's callback resolves the 'other'
  // category bucket against these options on every render.
  const filterOptions = useMemo(() => {
    const levelCounts: Record<string, number> = {};
    const posCounts: Record<string, number> = {};
    const categoryWords: Record<string, Set<string>> = {};

    glossary.forEach((entry) => {
      if (entry.level) {
        levelCounts[entry.level] = (levelCounts[entry.level] || 0) + 1;
      }
      if (entry.pos) {
        posCounts[entry.pos] = (posCounts[entry.pos] || 0) + 1;
      }
      for (const category of entry.categories ?? []) {
        const key = entry.wordId ?? `${entry.source}:${normalizeTerm(entry.de)}`;
        (categoryWords[category] ??= new Set()).add(key);
      }
    });

    const MIN_COUNT = 3;

    const levelOpts: FilterOption[] = Object.entries(levelCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, count]) => ({ value, label: value, count }));

    const posOpts: FilterOption[] = Object.entries(posCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, count]) => ({ value, label: value, count }));

    const mainCategories: FilterOption[] = [];
    let otherCount = 0;
    Object.entries(categoryWords)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([value, words]) => {
        const count = words.size;
        if (count >= MIN_COUNT) {
          mainCategories.push({ value, label: topicalTagLabel(value, isDE), count });
        } else {
          otherCount += count;
        }
      });

    const categoryOpts: FilterOption[] = [...mainCategories];
    if (otherCount > 0) {
      categoryOpts.push({ value: 'other', label: isDE ? 'Weitere Themen' : 'Other topics', count: otherCount });
    }
    const uncategorizedCount = new Set(
      glossary.filter((entry) => entry.wordId && !entry.categories?.length).map((entry) => entry.wordId)
    ).size;
    if (uncategorizedCount > 0) {
      categoryOpts.push({ value: 'uncategorized', label: isDE ? 'Ohne Thema' : 'No topic', count: uncategorizedCount });
    }

    return { levelOpts, posOpts, categoryOpts };
  }, [glossary, isDE]);

  const filtered = useMemo(() => {
    // Smart search: ranked fuzzy match over German / English / Nepali fields.
    // Empty query passes everything through (score 0) so filters/sort still act
    // on the full pool.
    const searchMatches = rankedSearch({
      query,
      items: glossary,
      fields: [
        { label: 'de', get: (e) => e.de, weight: 3 },
        { label: 'en', get: (e) => e.en, weight: 2 },
        { label: 'ne', get: (e) => e.ne, weight: 1 },
        { label: 'neRoman', get: (e) => e.neRoman ?? '', weight: 1 },
      ],
    });
    // Carry score through the filter pipeline so a non-empty query keeps the
    // relevance ranking at the end (A–Z would defeat smart search otherwise).
    let items = searchMatches.map((m) => ({ entry: m.item, score: m.score }));
    // Source filter
    if (sourceFilter !== 'all') {
      items = items.filter(({ entry }) => entry.source === sourceFilter);
    }
    // Part-of-speech filter — entries that carry a POS (Vocabulary + Articles);
    // other sources (Alphabet/Numbers/Calendar/Greetings/Stories) have none.
    if (posFilter !== 'all') {
      items = items.filter(({ entry }) => entry.pos === posFilter);
    }
    // Level filter
    if (levelFilter !== 'all') {
      items = items.filter(({ entry }) => entry.level === levelFilter);
    }
    // Category filter — maps the generated 'other' bucket back to the small
    // categories it aggregates (entries whose category has < MIN_COUNT items).
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'uncategorized') {
        items = items.filter(({ entry }) => Boolean(entry.wordId) && !entry.categories?.length);
      } else if (categoryFilter === 'other') {
        const mainCatValues = new Set(
          filterOptions.categoryOpts
            .filter((o) => o.value !== 'other' && o.value !== 'uncategorized' && o.value !== 'all')
            .map((o) => o.value)
        );
        items = items.filter(
          ({ entry }) => (entry.categories ?? []).some((category) => !mainCatValues.has(category))
        );
      } else {
        items = items.filter(({ entry }) => entry.categories?.includes(categoryFilter));
      }
    }
    // Sort — relevance when searching; the chosen key otherwise.
    const searching = query.trim().length > 0;
    items = [...items].sort((a, b) => {
      if (searching) return b.score - a.score;
      const x = a.entry;
      const y = b.entry;
      switch (sortKey) {
        case 'za':
          return y.de.localeCompare(x.de);
        case 'source':
          return x.source.localeCompare(y.source) || x.de.localeCompare(y.de);
        case 'az':
        default:
          return x.de.localeCompare(y.de);
      }
    });
    return items.map((m) => m.entry);
  }, [glossary, query, sourceFilter, sortKey, posFilter, levelFilter, categoryFilter, filterOptions]);

  // Virtualize rows for smooth scrolling with large datasets
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180,
    measureElement: (element) => element.getBoundingClientRect().height,
    overscan: 5, // Render 5 extra items above/below viewport
  });

  const title = isDE ? 'Glossar' : 'Glossary';
  const description = isDE
    ? 'Durchsuche alle A1-Begriffe der App.'
    : 'Search all A1 terms used across the app.';
  const placeholder = isDE ? 'Suchen…' : 'Search…';
  const noResults = isDE ? 'Keine Begriffe gefunden.' : 'No terms found.';

  const handleSpeak = (word: string) => {
    triggerHaptic('light');
    speakWord(word);
  };

  const handleResetFilters = () => {
    setLevelFilter('all');
    setPosFilter('all');
    setCategoryFilter('all');
    setSourceFilter('all');
  };

  if (!dataLoaded) {
    return (
      <div className={theme.page.container}>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-950 dark:text-white">{title}</h1>
        <p className="mt-1 text-body text-ink-500 dark:text-ink-400">{description}</p>
        <p
          className="mt-4 text-body text-ink-500 dark:text-ink-400"
          role="status"
          aria-live="polite"
        >
          Loading…
        </p>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className={theme.page.container}>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-950 dark:text-white">{title}</h1>
        <p role="alert" className="mt-4 text-body text-warning-700 dark:text-warning-300">
          {isDE ? 'Glossardaten konnten nicht geladen werden.' : 'Glossary data could not be loaded.'}
        </p>
        <button type="button" onClick={() => setReloadData((attempt) => attempt + 1)} className={`${theme.button.secondary} mt-4`}>
          {isDE ? 'Erneut versuchen' : 'Retry'}
        </button>
      </div>
    );
  }

  return (
    <div className={theme.page.container}>
      <SEO
        title="German Glossary | MeroDeutsch"
        description="Search all A1 German vocabulary including alphabet, numbers, calendar, greetings, articles, and curated word lists."
      />
      <h1 className="text-2xl font-semibold tracking-tight text-ink-950 dark:text-white">{title}</h1>
      <p className="mt-1 text-body text-ink-500 dark:text-ink-400">{description}</p>

      {/* Gender legend */}
      <div className="mt-3 flex items-center gap-3 text-meta text-ink-500 dark:text-ink-400">
        <span className="font-semibold uppercase tracking-wider">{isDE ? 'Artikel' : 'Articles'}:</span>
        <span className={theme.gender.der.text}>der</span>
        <span className={theme.gender.dieF.text}>die</span>
        <span className={theme.gender.das.text}>das</span>
        <span className={theme.gender.diePl.text}>pl.</span>
      </div>

      {/* Learning-status legend (vocab-status tracking is opt-in per word) */}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-500 dark:text-ink-400">
        <span className="font-semibold uppercase tracking-wider">
          {isDE ? 'Status' : 'Status'}:
        </span>
        {(['new', 'learning', 'known', 'mastered'] as const).map((s) => (
          <span key={s} className={`rounded-full px-2 py-0.5 font-bold uppercase tracking-wider ${vocabStatusBadge(s)}`}>
            {vocabStatusLabel(s, isDE)}
          </span>
        ))}
      </div>

            {/* Compact toolbar: source and content filters are tucked into one panel. */}
            <div className="mt-3 flex items-center justify-end gap-2">
        <div className="flex items-center gap-2">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="rounded-sm border border-ink-200 bg-white px-3 py-1.5 text-body text-ink-900 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100"
            aria-label={isDE ? 'Sortieren nach' : 'Sort by'}
          >
            <option value="az">{isDE ? 'A–Z' : 'A–Z'}</option>
            <option value="za">{isDE ? 'Z–A' : 'Z–A'}</option>
            <option value="source">{isDE ? 'Nach Quelle' : 'By source'}</option>
          </select>
          <GlossaryFilterPanel
            sourceFilter={sourceFilter}
            levelFilter={levelFilter}
            posFilter={posFilter}
            categoryFilter={categoryFilter}
            onSourceChange={setSourceFilter}
            onLevelChange={setLevelFilter}
            onPosChange={setPosFilter}
            onCategoryChange={setCategoryFilter}
            onReset={handleResetFilters}
            sourceOptions={sourceOptions.map((src) => ({
              value: src,
              label: src === 'all' ? (isDE ? 'Alle Quellen' : 'All sources') : src,
              count: src === 'all' ? glossary.length : glossary.filter((entry) => entry.source === src).length,
            }))}
            levelOptions={[
              { value: 'all', label: isDE ? 'Alle Niveaus' : 'All levels', count: glossary.length },
              ...filterOptions.levelOpts,
            ]}
            posOptions={[
              { value: 'all', label: isDE ? 'Alle Wortarten' : 'All types', count: glossary.filter((e) => e.source === 'Vocabulary').length },
              ...filterOptions.posOpts,
            ]}
            categoryOptions={[
              { value: 'all', label: isDE ? 'Alle Themen' : 'All topics', count: glossary.filter((e) => e.categories?.length).length },
              ...filterOptions.categoryOpts,
            ]}
            isDE={isDE}
          />
        </div>
      </div>

      <div className="mt-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className={theme.input}
          aria-label={placeholder}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="mt-4 text-body italic text-ink-500">{noResults}</p>
      ) : (
        <div
          ref={parentRef}
          className="mt-4 h-[70dvh] min-h-[280px] max-h-[760px] overflow-auto"
          style={{ contain: 'strict' }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const entry = filtered[virtualRow.index];
              const lvlClass = levelBadge(entry.level);
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="rounded-lg border border-ink-200 bg-white p-5 shadow-sm transition duration-300 hover:shadow-md dark:bg-ink-900 dark:border-ink-800 mb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {/* Gender-colored article prefix (der=blue, die=red, das=green). */}
                        <div className="text-lg font-semibold text-ink-950 dark:text-white">
                          {(() => {
                            const m = entry.de.match(/^(der|die|das)\s+(.+)$/i);
                            if (!m) {
                              return <HighlightText text={entry.de} query={query} />;
                            }
                            const key = m[1].toLowerCase() === 'die' ? 'dieF' : m[1].toLowerCase();
                            const token = theme.gender[key as keyof typeof theme.gender];
                            return (
                              <>
                                <span className={token.text}>{m[1]} </span>
                                <HighlightText text={m[2]} query={query} />
                              </>
                            );
                          })()}
                        </div>
                        {/* Plural form (nouns only) */}
                        {entry.plural && entry.plural !== '-' && !isDE && (
                          <div className="mt-0.5 text-meta text-ink-500 dark:text-ink-500">
                            pl. {entry.plural}
                          </div>
                        )}
                        {/* Translations */}
                        {!isDE && (
                          <div className="mt-1 text-body text-ink-600 dark:text-ink-300">
                            <div><HighlightText text={entry.en} query={query} /></div>
                            <div className="text-ink-500 dark:text-ink-400">
                              <HighlightText text={entry.ne} query={query} />
                            </div>
                            {entry.neRoman && (
                              <div className="text-meta italic text-ink-500 dark:text-ink-500">{entry.neRoman}</div>
                            )}
                          </div>
                        )}
                        {/* Example sentence */}
                        {entry.exampleDe && (
                          <div className="mt-2 text-body italic text-ink-500 dark:text-ink-400">
                            {entry.exampleDe}
                            {entry.exampleEn && !isDE && (
                              <span className="block text-meta not-italic text-ink-500 dark:text-ink-500">
                                {entry.exampleEn}
                              </span>
                            )}
                          </div>
                        )}
                        {/* Meta badges */}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-meta font-semibold uppercase tracking-wider text-accent-600 dark:text-accent-400">
                            {entry.source}
                          </span>
                          {lvlClass && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${lvlClass}`}>
                              {entry.level}
                            </span>
                          )}
                          {entry.pos && entry.source === 'Vocabulary' && (
                            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-600 dark:bg-ink-800 dark:text-ink-400">
                              {entry.pos}
                            </span>
                          )}
                          {entry.categories?.map((category) => (
                            <span key={category} className="rounded-full bg-warning-50 px-2 py-0.5 text-[10px] font-semibold text-warning-700 dark:bg-warning-950/40 dark:text-warning-300">
                              {topicalTagLabel(category, isDE)}
                            </span>
                          ))}
                          {entry.wordId && (
                            <span
                              title={isDE ? 'Lernstatus' : 'Learning status'}
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${vocabStatusBadge(statsByWord[entry.wordId]?.status)}`}
                            >
                              {vocabStatusLabel(statsByWord[entry.wordId]?.status, isDE)}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSpeak(entry.de)}
                        className={theme.button.icon}
                        aria-label={`Speak ${entry.de}`}
                      >
                        🔊
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}