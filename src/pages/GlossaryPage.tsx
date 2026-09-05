import { useMemo, useState, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { curriculumService } from '../services';
import type { MicroStory } from '../types/curriculum';
import type { VocabCard, AlphabetItem, NumberItem, CalendarItem, GreetingItem } from '../types';
import { speakWord } from '../hooks/useSpeech';
import { useLang } from '../hooks/useLang';
import { triggerHaptic } from '../utils/haptic';
import { theme } from '../config/theme';
import { usePageTitle } from '../hooks/usePageTitle';
import { SEO } from '../components/common/SEO';
import { GlossaryFilterPanel, type FilterOption } from '../components/glossary/GlossaryFilterPanel';

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
  category?: string;
  neRoman?: string;
}

function levelBadge(level?: string): string {
  switch (level) {
    case 'A1': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'A2': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    case 'B1': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    case 'B2': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    default: return '';
  }
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

  // Fetch data from curriculumService. Articles are derived from the same vocab
  // pool below (nouns with der/die/das) — the quiz RPC caps at a small deck,
  // which would otherwise starve the glossary's Articles source.
  useEffect(() => {
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
      setAlphabetData(alpha);
      setNumbersData(nums);
      setCalendarData(cal);
      setGreetingsData(greet);
      setVocabularyData(vocab);
      setStoriesData(stories);
      setDataLoaded(true);
    };
    loadData().catch(() => setDataLoaded(true));
  }, []);
  
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
        const artExcluded = new Set([
          'noun', 'verb', 'adjective', 'phrase', 'adverb', 'expression', 'preposition',
          'general', 'A1', 'A2', 'B1', 'B2',
        ]);
        const artCategory = artTags.find((t) => !artExcluded.has(t));
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
          category: artCategory,
        });
      }
    });

    // Curated A1 vocabulary (VocabCard[] from getVocabularyFiltered)
    vocabularyData.forEach((card) => {
      const tagList: string[] = card.tags ?? [];
      // Category is the first tag that is neither a POS tag nor a CEFR level
      // tag (see rowToVocabCard — tags are [category?, partOfSpeech, A1?]).
      const posTag = card.partOfSpeech;
      const excludedTags = new Set([
        'noun', 'verb', 'adjective', 'phrase', 'adverb', 'expression', 'preposition',
        'general', 'A1', 'A2', 'B1', 'B2',
      ]);
      const categoryTag = tagList.find((t) => !excludedTags.has(t));
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
        category: categoryTag,
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

    return entries;
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
    const categoryCounts: Record<string, number> = {};

    glossary.forEach((entry) => {
      if (entry.level) {
        levelCounts[entry.level] = (levelCounts[entry.level] || 0) + 1;
      }
      if (entry.pos) {
        posCounts[entry.pos] = (posCounts[entry.pos] || 0) + 1;
      }
      if (entry.category) {
        categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
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
    Object.entries(categoryCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([value, count]) => {
        if (count >= MIN_COUNT) {
          mainCategories.push({ value, label: value, count });
        } else {
          otherCount += count;
        }
      });

    const categoryOpts: FilterOption[] = [...mainCategories];
    if (otherCount > 0) {
      categoryOpts.push({ value: 'other', label: isDE ? 'Sonstige' : 'Other', count: otherCount });
    }

    return { levelOpts, posOpts, categoryOpts };
  }, [glossary, isDE]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = glossary.filter(
      (entry) =>
        (entry.de.toLowerCase().includes(q) ||
          entry.en.toLowerCase().includes(q) ||
          entry.ne.toLowerCase().includes(q))
    );
    // Source filter
    if (sourceFilter !== 'all') {
      items = items.filter((entry) => entry.source === sourceFilter);
    }
    // Part-of-speech filter — entries that carry a POS (Vocabulary + Articles);
    // other sources (Alphabet/Numbers/Calendar/Greetings/Stories) have none.
    if (posFilter !== 'all') {
      items = items.filter((entry) => entry.pos === posFilter);
    }
    // Level filter
    if (levelFilter !== 'all') {
      items = items.filter((entry) => entry.level === levelFilter);
    }
    // Category filter — maps the generated 'other' bucket back to the small
    // categories it aggregates (entries whose category has < MIN_COUNT items).
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'other') {
        const mainCatValues = new Set(
          filterOptions.categoryOpts
            .filter((o) => o.value !== 'other' && o.value !== 'all')
            .map((o) => o.value)
        );
        items = items.filter(
          (entry) => entry.category !== undefined && !mainCatValues.has(entry.category)
        );
      } else {
        items = items.filter((entry) => entry.category === categoryFilter);
      }
    }
    // Sort
    items = [...items].sort((a, b) => {
      switch (sortKey) {
        case 'za':
          return b.de.localeCompare(a.de);
        case 'source':
          return a.source.localeCompare(b.source) || a.de.localeCompare(b.de);
        case 'az':
        default:
          return a.de.localeCompare(b.de);
      }
    });
    return items;
  }, [glossary, query, sourceFilter, sortKey, posFilter, levelFilter, categoryFilter, filterOptions]);

  // Virtualize rows for smooth scrolling with large datasets
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180, // Estimated height of each card (increased for plural/example/badges)
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
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        <div className="mt-4">Loading...</div>
      </div>
    );
  }

  return (
    <div className={theme.page.container}>
      <SEO
        title="German Glossary | MeroDeutsch"
        description="Search all A1 German vocabulary including alphabet, numbers, calendar, greetings, articles, and curated word lists."
      />
      <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>

      {/* Gender legend */}
      <div className="mt-3 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-semibold uppercase tracking-wider">{isDE ? 'Artikel' : 'Articles'}:</span>
        <span className={theme.gender.der.text}>der</span>
        <span className={theme.gender.dieF.text}>die</span>
        <span className={theme.gender.das.text}>das</span>
        <span className={theme.gender.diePl.text}>pl.</span>
      </div>

            {/* Compact filter bar: source chips + sort + filter toggle */}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {sourceOptions.map((src) => {
            const active = sourceFilter === src;
            const label = src === 'all' ? (isDE ? 'Alle' : 'All') : src;
            return (
              <button
                key={src}
                type="button"
                onClick={() => setSourceFilter(src)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition active:scale-95 ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            aria-label={isDE ? 'Sortieren nach' : 'Sort by'}
          >
            <option value="az">{isDE ? 'A–Z' : 'A–Z'}</option>
            <option value="za">{isDE ? 'Z–A' : 'Z–A'}</option>
            <option value="source">{isDE ? 'Nach Quelle' : 'By source'}</option>
          </select>
          <GlossaryFilterPanel
            levelFilter={levelFilter}
            posFilter={posFilter}
            categoryFilter={categoryFilter}
            onLevelChange={setLevelFilter}
            onPosChange={setPosFilter}
            onCategoryChange={setCategoryFilter}
            onReset={handleResetFilters}
            levelOptions={[
              { value: 'all', label: isDE ? 'Alle Niveaus' : 'All levels', count: glossary.length },
              ...filterOptions.levelOpts,
            ]}
            posOptions={[
              { value: 'all', label: isDE ? 'Alle Wortarten' : 'All types', count: glossary.filter((e) => e.source === 'Vocabulary').length },
              ...filterOptions.posOpts,
            ]}
            categoryOptions={[
              { value: 'all', label: isDE ? 'Alle Kategorien' : 'All categories', count: glossary.filter((e) => e.category).length },
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
        <p className="mt-4 text-sm italic text-slate-500">{noResults}</p>
      ) : (
        <div
          ref={parentRef}
          className="mt-4 h-[calc(100vh-340px)] overflow-auto"
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
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="rounded-2xl bg-white p-5 shadow-sm transition duration-300 hover:shadow-md dark:bg-slate-900 mb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {/* Gender-colored article prefix (der=blue, die=red, das=green). */}
                        <div className="text-lg font-semibold text-slate-950 dark:text-white">
                          {(() => {
                            const m = entry.de.match(/^(der|die|das)\s+(.+)$/i);
                            if (!m) return entry.de;
                            const key = m[1].toLowerCase() === 'die' ? 'dieF' : m[1].toLowerCase();
                            const token = theme.gender[key as keyof typeof theme.gender];
                            return (
                              <>
                                <span className={token.text}>{m[1]} </span>
                                {m[2]}
                              </>
                            );
                          })()}
                        </div>
                        {/* Plural form (nouns only) */}
                        {entry.plural && entry.plural !== '-' && !isDE && (
                          <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                            pl. {entry.plural}
                          </div>
                        )}
                        {/* Translations */}
                        {!isDE && (
                          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            <div>{entry.en}</div>
                            <div className="text-slate-500 dark:text-slate-400">{entry.ne}</div>
                            {entry.neRoman && (
                              <div className="text-xs italic text-slate-400 dark:text-slate-500">{entry.neRoman}</div>
                            )}
                          </div>
                        )}
                        {/* Example sentence */}
                        {entry.exampleDe && (
                          <div className="mt-2 text-sm italic text-slate-500 dark:text-slate-400">
                            {entry.exampleDe}
                            {entry.exampleEn && !isDE && (
                              <span className="block text-xs not-italic text-slate-400 dark:text-slate-500">
                                {entry.exampleEn}
                              </span>
                            )}
                          </div>
                        )}
                        {/* Meta badges */}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                            {entry.source}
                          </span>
                          {lvlClass && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${lvlClass}`}>
                              {entry.level}
                            </span>
                          )}
                          {entry.pos && entry.source === 'Vocabulary' && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              {entry.pos}
                            </span>
                          )}
                          {entry.category && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                              {entry.category}
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