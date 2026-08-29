import { useMemo, useState, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { curriculumService } from '../services';
import type { MicroStory } from '../types/curriculum';
import type { VocabEntry, AlphabetItem, NumberItem, CalendarItem, GreetingItem, ArticleItem } from '../types';
import { speakWord } from '../hooks/useSpeech';
import { useLang } from '../hooks/useLang';
import { triggerHaptic } from '../utils/haptic';
import { theme } from '../config/theme';
import { usePageTitle } from '../hooks/usePageTitle';
import { SEO } from '../components/common/SEO';

interface GlossaryEntry {
  de: string;
  en: string;
  ne: string;
  source: string;
}

export function GlossaryPage() {
  usePageTitle('Glossary');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const [query, setQuery] = useState('');
  // Source filter: 'all' or a specific source name
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  // Sort key: 'az' | 'za' | 'source'
  const [sortKey, setSortKey] = useState<string>('az');
  const parentRef = useRef<HTMLDivElement>(null);
  
  // State for data from curriculumService
  const [alphabetData, setAlphabetData] = useState<AlphabetItem[]>([]);
  const [numbersData, setNumbersData] = useState<NumberItem[]>([]);
  const [calendarData, setCalendarData] = useState<CalendarItem[]>([]);
  const [greetingsData, setGreetingsData] = useState<GreetingItem[]>([]);
  const [articlesData, setArticlesData] = useState<ArticleItem[]>([]);
  const [vocabularyData, setVocabularyData] = useState<VocabEntry[]>([]);
  const [storiesData, setStoriesData] = useState<MicroStory[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Fetch data from curriculumService
  useEffect(() => {
    const loadData = async () => {
      const [alpha, nums, cal, greet, art, vocab, stories] = await Promise.all([
        curriculumService.getAlphabet(),
        curriculumService.getNumbers(),
        curriculumService.getCalendar(),
        curriculumService.getGreetings(),
        curriculumService.getArticles(),
        curriculumService.getVocabularyFiltered({}),
        curriculumService.getStories(),
      ]);
      setAlphabetData(alpha);
      setNumbersData(nums);
      setCalendarData(cal);
      setGreetingsData(greet);
      setArticlesData(art);
      setVocabularyData(vocab as unknown as VocabEntry[]);
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

    // Articles
    articlesData.forEach((item) => {
      entries.push({ de: `${item.art} ${item.noun}`, en: item.meaning.split(' / ')[0] || item.noun, ne: item.meaning.split(' / ')[1] || '', source: 'Articles' });
    });

    // Curated A1 vocabulary
    const vocabCardData = vocabularyData as any[];
    vocabCardData.forEach((item) => {
      const entry = {
        de: item.lemma || item.de,
        en: item.translation?.en || item.en,
        ne: item.translation?.np || item.ne,
        source: item.tags[0] ?? 'Vocabulary',
      };
      entries.push(entry);
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
  }, [dataLoaded, alphabetData, numbersData, calendarData, greetingsData, articlesData, vocabularyData, storiesData]);
  
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
  }, [glossary, query, sourceFilter, sortKey]);

  // Virtualize rows for smooth scrolling with large datasets
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 140, // Estimated height of each card
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

      {/* Source filter chips + sort selector */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {['all', 'Alphabet', 'Numbers', 'Calendar', 'Greetings', 'Articles', 'Vocabulary', 'Stories'].map((src) => {
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
      </div>

      <div className="mt-4">
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
          className="mt-4 h-[calc(100vh-280px)] overflow-auto"
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
                      <div>
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
                        {!isDE && (
                          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            <div>{entry.en}</div>
                            <div className="text-slate-500 dark:text-slate-400">{entry.ne}</div>
                          </div>
                        )}
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
                    <div className="mt-3 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      {entry.source}
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