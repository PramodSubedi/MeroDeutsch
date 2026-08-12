import { useMemo, useState } from 'react';
import { alphabetData, numbersData, calendarData, greetingsData, articlesData } from '../data/sharedContent';
import { vocabularyData } from '../data/loadVocabulary';
import { speakWord } from '../hooks/useSpeech';
import { useLang } from '../hooks/useLang';
import { theme } from '../config/theme';

interface GlossaryEntry {
  de: string;
  en: string;
  ne: string;
  source: string;
}

function buildGlossary(): GlossaryEntry[] {
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

  return entries;
}

export function GlossaryPage() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const [query, setQuery] = useState('');

  const glossary = useMemo(buildGlossary, []);

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

  const title = isDE ? 'Glossar' : 'Glossary';
  const description = isDE
    ? 'Durchsuche alle A1-Begriffe der App.'
    : 'Search all A1 terms used across the app.';
  const placeholder = isDE ? 'Suchen…' : 'Search…';
  const noResults = isDE ? 'Keine Begriffe gefunden.' : 'No terms found.';

  return (
    <div className={theme.page.container}>
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <p className="text-sm italic text-slate-500">{noResults}</p>
        ) : (
          filtered.map((entry) => (
            <div
              key={`${entry.source}-${entry.de}`}
              className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-950 dark:hover:border-blue-500"
            >
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
                  onClick={() => speakWord(entry.de)}
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
          ))
        )}
      </div>
    </div>
  );
}