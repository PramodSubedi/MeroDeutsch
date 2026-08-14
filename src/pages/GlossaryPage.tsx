import { useMemo, useState, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { curriculumService } from '../services';
import { microStories } from '../data/stories';
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
  const parentRef = useRef<HTMLDivElement>(null);
  
  // State for data from curriculumService
  const [alphabetData, setAlphabetData] = useState<AlphabetItem[]>([]);
  const [numbersData, setNumbersData] = useState<NumberItem[]>([]);
  const [calendarData, setCalendarData] = useState<CalendarItem[]>([]);
  const [greetingsData, setGreetingsData] = useState<GreetingItem[]>([]);
  const [articlesData, setArticlesData] = useState<ArticleItem[]>([]);
  const [vocabularyData, setVocabularyData] = useState<VocabEntry[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // Fetch data from curriculumService
  useEffect(() => {
    const loadData = async () => {
      const [alpha, nums, cal, greet, art, vocab] = await Promise.all([
        curriculumService.getAlphabet(),
        curriculumService.getNumbers(),
        curriculumService.getCalendar(),
        curriculumService.getGreetings(),
        curriculumService.getArticles(),
        curriculumService.getVocabulary(),
      ]);
      setAlphabetData(alpha);
      setNumbersData(nums);
      setCalendarData(cal);
      setGreetingsData(greet);
      setArticlesData(art);
      setVocabularyData(vocab);
      setDataLoaded(true);
    };
    loadData();
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
    vocabularyData.forEach((item) => {
      entries.push({ de: item.de, en: item.en, ne: item.ne, source: item.tags[0] ?? 'Vocabulary' });
    });

    // Stories - flatten all words from all stories
    microStories.forEach((story) => {
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
  }, [dataLoaded, alphabetData, numbersData, calendarData, greetingsData, articlesData, vocabularyData]);
  
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return glossary;
    return glossary.filter(
      (entry) =>
        entry.de.toLowerCase().includes(q) ||
        entry.en.toLowerCase().includes(q) ||
        entry.ne.toLowerCase().includes(q)
    );
  }, [glossary, query]);

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
                  <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-950 dark:hover:border-blue-500 mb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold text-slate-950 dark:text-white">{entry.de}</div>
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
                    <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
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