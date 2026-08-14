import { useEffect, useMemo, useState } from 'react';
import { BookOpen, MessagesSquare, Sparkles } from 'lucide-react';
import { sharedTextDatabase } from '../data/sharedContent';
import { LetterCard } from '../components/alphabet/LetterCard';
import { LetterDetailModal } from '../components/alphabet/LetterDetailModal';
import { AlphabetQuiz } from '../components/alphabet/AlphabetQuiz';
import { SpellingPractice } from '../components/alphabet/SpellingPractice';
import { TabGroup, type Tab } from '../components/TabGroup';
import { speakLetter, speakWord, useSpeechSpeed } from '../hooks/useSpeech';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { useProgress } from '../hooks/useProgress';
import { theme } from '../config/theme';
import { curriculumService } from '../services';
import { type AlphabetItem } from '../types';
import { SEO } from '../components/common/SEO';

type Filter = 'all' | 'vowel' | 'consonant';
type Sub = 'learn' | 'quiz' | 'spelling';

export function AlphabetPage() {
  usePageTitle('Alphabet');
  const { langMode } = useLang();
  const { progress, markPracticed, reset } = useProgress();
  const { speed, setNextSpeed } = useSpeechSpeed();
  const [sub, setSub] = useState<Sub>('learn');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<AlphabetItem | null>(null);
  const [alphabet, setAlphabet] = useState<AlphabetItem[]>([]);

  useEffect(() => {
    curriculumService.getAlphabet().then(setAlphabet);
  }, []);

  const lotd = useMemo(() => {
    if (!alphabet.length) return null;
    const today = new Date().toDateString();
    let idx = 0;
    for (let i = 0; i < today.length; i++) idx += today.charCodeAt(i);
    return alphabet[idx % alphabet.length];
  }, [alphabet]);

  const isDE = langMode === 'german';
  const quizPct = progress.quizTotal
    ? Math.round((progress.quizCorrect / progress.quizTotal) * 100)
    : 0;
  const pageTitle = isDE ? 'Deutsches Alphabet' : sharedTextDatabase.alphabet.title;
  const pageDescription = isDE
    ? 'Lerne das deutsche Alphabet mit Aussprachen und Beispielen.'
    : sharedTextDatabase.alphabet.description;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return alphabet.filter((item) => {
      if (filter !== 'all' && item.type !== filter) return false;
      if (q && !item.letter.toLowerCase().includes(q) && !item.gerPhonetic.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [filter, search, alphabet]);

  const standard = filtered.filter((i) => i.category === 'standard');
  const special = filtered.filter((i) => i.category === 'special');

  const meaning = lotd?.exampleFull?.match(/\((.+)\)/)?.[1] || '';

  const tabs: Tab<Sub>[] = [
    { id: 'learn', label: isDE ? 'Karten lernen' : 'Learn Cards', icon: BookOpen },
    { id: 'quiz', label: 'Quiz', icon: Sparkles },
    { id: 'spelling', label: isDE ? 'Rechtschreibung' : 'Spelling', icon: MessagesSquare },
  ];

  return (
    <div className={theme.page.container}>
      <SEO
        title="German Alphabet | MeroDeutsch"
        description="Learn the German alphabet with interactive letter cards, pronunciation audio, and quizzes for Nepali and English speakers."
      />
      <div className={theme.section.surface}>
        <h1 className={theme.section.title}>{pageTitle}</h1>
        <p className={theme.section.description}>{pageDescription}</p>
      </div>
      {sub === 'learn' && lotd && (
        <div className="my-2 grid gap-3 md:grid-cols-2">
          <div className="flex items-stretch gap-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 p-3 text-white shadow">
            <div className="flex flex-1 items-center gap-3 min-w-0">
              <div className="text-4xl font-bold leading-none">{lotd.letter.split(' ')[0]}</div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider opacity-80">
                  {isDE ? 'Buchstabe des Tages' : 'Letter of the Day'}
                </div>
                <div className="truncate text-base font-bold">{lotd.gerPhonetic}</div>
                {!isDE && <div className="text-sm opacity-90">{lotd.nepPhonetic}</div>}
                <button
                  type="button"
                  className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-white/30"
                  onClick={() => speakLetter(lotd.speak)}
                >
                  <span aria-hidden="true">🔊</span>
                  {isDE ? 'Buchstabe' : 'Letter'}
                </button>
              </div>
            </div>
            <div className="w-px self-stretch bg-white/30" />
            <div className="flex flex-1 flex-col justify-center min-w-0">
              <div className="text-[10px] uppercase tracking-wider opacity-80">
                {isDE ? 'Wort des Tages' : 'Word of the Day'}
              </div>
              <div className="truncate text-base font-semibold">{lotd.example}</div>
              {!isDE && <div className="truncate text-xs opacity-80">{meaning}</div>}
              <button
                type="button"
                className="mt-1.5 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-white/30"
                onClick={() => speakWord(lotd.speakWord)}
              >
                <span aria-hidden="true">🔊</span>
                {isDE ? 'Wort' : 'Word'}
              </button>
            </div>
          </div>
          <div className={theme.panel.surface}>
            <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">
              {isDE ? 'Dein Fortschritt' : 'Your Progress'}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{progress.practiced.length}</div>
                <div className="text-[11px] text-slate-500">{isDE ? 'Buchstaben' : 'Letters'}</div>
              </div>
              <div>
                <div className="text-xl font-bold text-green-600">{quizPct}%</div>
                <div className="text-[11px] text-slate-500">Quiz</div>
              </div>
              <div>
                <div className="text-xl font-bold text-amber-600">{progress.spellCompleted || 0}</div>
                <div className="text-[11px] text-slate-500">{isDE ? 'Wörter' : 'Words'}</div>
              </div>
            </div>
            <button
              type="button"
              className={theme.button.secondary}
              onClick={() => {
                if (confirm(isDE ? 'Fortschritt zurücksetzen?' : 'Reset all progress?')) reset();
              }}
            >
              {isDE ? 'Fortschritt zurücksetzen' : 'Reset progress'}
            </button>
          </div>
        </div>
      )}

      <TabGroup
        variant="compact"
        tabs={tabs}
        activeTab={sub}
        onTabChange={setSub}
        rightControls={
          <button
            type="button"
            onClick={setNextSpeed}
            className={`${theme.button.secondary} inline-flex items-center gap-1.5`}
            aria-label="Speech speed"
          >
            ⏱ {speed === 'slow' ? (isDE ? 'Langsam' : 'Slow') : speed === 'normal' ? (isDE ? 'Normal' : 'Normal') : isDE ? 'Schnell' : 'Fast'}
          </button>
        }
      />

      {sub === 'learn' && (
        <>
          <div className="my-2 flex flex-col gap-3 md:flex-row md:justify-between">
            <input
              type="search"
              placeholder={isDE ? 'Buchstabe suchen…' : 'Search a letter…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={theme.input}
            />
            <div className="flex rounded-lg bg-slate-200 p-1 dark:bg-slate-700">
              {(['all', 'vowel', 'consonant'] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={filter === f ? theme.button.toggleActive : theme.button.toggleInactive}
                >
                  {f === 'all' ? (isDE ? 'Alle' : 'All') : f === 'vowel' ? (isDE ? 'Vokale' : 'Vowels') : isDE ? 'Konsonanten' : 'Consonants'}
                </button>
              ))}
            </div>
          </div>
          {standard.length > 0 && (
            <section className="my-2">
              <h2 className="mb-3 inline-block border-b-2 border-blue-500 pb-1 text-lg font-bold">
                {isDE ? 'Standard 26 Buchstaben' : 'Standard 26 Letters'}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {standard.map((item) => (
                  <LetterCard
                    key={item.id}
                    item={item}
                    practiced={progress.practiced.includes(item.id)}
                    langMode={langMode}
                    onPracticed={markPracticed}
                    onOpenDetail={setDetail}
                  />
                ))}
              </div>
            </section>
          )}
          {special.length > 0 && (
            <section className="my-2">
              <h2 className="mb-3 inline-block border-b-2 border-amber-500 pb-1 text-lg font-bold">
                {isDE ? 'Sonderzeichen' : 'Special Characters'}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {special.map((item) => (
                  <LetterCard
                    key={item.id}
                    item={item}
                    practiced={progress.practiced.includes(item.id)}
                    langMode={langMode}
                    onPracticed={markPracticed}
                    onOpenDetail={setDetail}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {sub === 'quiz' && <AlphabetQuiz langMode={langMode} />}
      {sub === 'spelling' && <SpellingPractice langMode={langMode} />}

      <LetterDetailModal item={detail} langMode={langMode} onClose={() => setDetail(null)} />
    </div>
  );
}
