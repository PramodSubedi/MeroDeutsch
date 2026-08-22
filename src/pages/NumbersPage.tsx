/**
 * src/pages/NumbersPage.tsx
 *
 * Numbers module driven by the shared Lesson Engine:
 *  - "Hören & Tippen"  -> useExerciseSession + <ListenAndType> (accepts digit OR word)
 *  - "Zahlen-Quiz"     -> useExerciseSession + <MultipleChoice> (digit prompt, word options)
 * Both draw finite without-replacement decks of 10 per round; desktop keyboard
 * shortcuts are preserved for the MCQ (Space = hear, 1-4 = pick, Enter = next).
 * XP/SRS reporting is owned entirely by the engine sessions.
 */

import { useEffect, useMemo, useState } from 'react';
import { List, Headphones } from 'lucide-react';
import { speakWord } from '../hooks/useSpeech';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import type { NumberItem, NumberRange } from '../types';
import { Card } from '../components/Card';
import { SectionGrid } from '../components/SectionGrid';
import { TabGroup, type Tab } from '../components/TabGroup';
import { theme } from '../config/theme';
import { sharedTextDatabase } from '../data/sharedContent';
import { curriculumService } from '../services';
import { buildMcq, pickNUnique } from '../utils/questionGenerator';
import {
  useExerciseSession,
  type ExerciseQuestion,
} from '../hooks/useExerciseSession';
import { ListenAndType } from '../components/exercises/ListenAndType';
import { MultipleChoice } from '../components/exercises/MultipleChoice';

const ranges: { id: NumberRange; label: string }[] = [
  { id: '0-12', label: '0 – 12' },
  { id: '13-19', label: '13 – 19' },
  { id: '20-99', label: '20 – 99' },
  { id: '100plus', label: '100+' },
];

const numberRules: Record<NumberRange, { title: string; description: string }> = {
  '0-12': { title: '', description: '' },
  '13-19': {
    title: 'Regel 13–19:',
    description: 'Einer + zehn. Beispiel: drei + zehn → dreizehn',
  },
  '20-99': {
    title: 'Regel 21–99:',
    description: 'Einer + und + Zehner. Beispiel: fünf + und + vierzig → fünfundvierzig',
  },
  '100plus': {
    title: 'Große Zahlen:',
    description: '100 = hundert · 1000 = tausend · 1 000 000 = eine Million',
  },
};

function normalize(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Engine question for the listen-and-type mode. */
interface NumberListenQuestion extends ExerciseQuestion {}

/** Engine question for the MCQ mode (options are German words). */
interface NumberMcqQuestion extends ExerciseQuestion {
  n: number;
}

const DECK_SIZE = 10;

export function NumbersPage() {
  usePageTitle('Numbers');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const [range, setRange] = useState<NumberRange>('0-12');
  const [mode, setMode] = useState<'learn' | 'listen'>('learn');
  const [numbersData, setNumbersData] = useState<NumberItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  /** Increments to reshuffle fresh decks. */
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    curriculumService
      .getNumbers()
      .then((data) => {
        setNumbersData(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const getItemsByRange = (r: NumberRange): NumberItem[] => {
    if (r === '0-12') return numbersData.filter((item) => item.n <= 12);
    if (r === '13-19') return numbersData.filter((item) => item.n >= 13 && item.n <= 19);
    if (r === '20-99') return numbersData.filter((item) => item.n >= 20 && item.n <= 99);
    return numbersData.filter((item) => item.n >= 100);
  };

  const items = getItemsByRange(range);
  const rule = numberRules[range];
  const title = isDE ? 'Deutsche Zahlen' : sharedTextDatabase.numbers.title;
  const description = isDE
    ? 'Lerne auf Deutsch zu zählen'
    : sharedTextDatabase.numbers.description;

  const modeTabs: Tab<'learn' | 'listen'>[] = [
    { id: 'learn', label: isDE ? 'Lernliste' : 'Learn List', icon: List },
    { id: 'listen', label: isDE ? 'Hören & Tippen' : 'Listen & Type', icon: Headphones },
  ];

  // ---- Session A: Hören & Tippen (finite deck per round) ----
  const listenDeck = useMemo<NumberListenQuestion[]>(
    () =>
      pickNUnique({
        items: numbersData,
        count: Math.min(DECK_SIZE, numbersData.length),
        getKey: (x) => x.de,
      }).map((x) => ({
        key: x.de,
        correctAnswer: x.de,
        speakPrompt: x.de,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [numbersData, runId]
  );

  const listenSession = useExerciseSession<NumberListenQuestion>({
    questions: listenDeck,
    module: 'numbers',
    // Accept either the digit form or the German word.
    matches: (input, q) => {
      const norm = normalize(input);
      if (norm === normalize(q.correctAnswer)) return true;
      const item = numbersData.find((x) => x.de === q.correctAnswer);
      return item !== undefined && norm === String(item.n);
    },
  });

  // ---- Session B: Zahlen-Quiz MCQ (finite deck per round) ----
  const mcqDeck = useMemo<NumberMcqQuestion[]>(
    () =>
      pickNUnique({
        items: numbersData,
        count: Math.min(DECK_SIZE, numbersData.length),
        getKey: (x) => x.de,
      }).map((q) => ({
        key: q.de,
        correctAnswer: q.de,
        n: q.n,
        speakPrompt: q.de,
        // Raw option pool; the engine shuffles once at mount.
        options: buildMcq({
          correctItem: q,
          allItems: numbersData,
          getKey: (x) => x.de,
          count: 4,
        }).map((o) => o.de),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [numbersData, runId]
  );

  const mcqSession = useExerciseSession<NumberMcqQuestion>({
    questions: mcqDeck,
    module: 'numbers',
    getOptions: (q) => q.options,
  });

  // Desktop keyboard shortcuts: Space = hear number, 1-4 = pick option, Enter = next.
  useKeyboardShortcuts({
    onAudioPlay: () => {
      const q = mcqSession.current;
      if (q) speakWord(q.correctAnswer);
    },
    onSelectOption: (index) => {
      const q = mcqSession.current;
      if (!q || mcqSession.locked) return;
      const opts = mcqSession.optionsFor(q);
      if (opts[index]) mcqSession.select(opts[index]);
    },
    onNext: () => {
      if (mcqSession.locked) mcqSession.next();
    },
  });

  if (!loaded) {
    return <div className={theme.page.container}>Loading...</div>;
  }

  // Pool empty (not seeded yet / offline before first fetch) — friendly state.
  if (numbersData.length === 0) {
    return (
      <div className={theme.page.container}>
        <h1 className={theme.page.heading}>{title}</h1>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          {isDE
            ? 'Inhalte werden noch geladen — verbinde dich einmal mit dem Internet.'
            : 'Content is still loading — connect to the internet once to populate it.'}
        </p>
      </div>
    );
  }

  return (
    <div className={theme.page.container}>
      <h1 className={theme.page.heading}>{title}</h1>
      <p className={theme.page.description}>{description}</p>

      <TabGroup tabs={modeTabs} activeTab={mode} onTabChange={setMode} />

      {mode === 'learn' && (
        <SectionGrid
          title={title}
          description={description}
          hideHeader
          controls={
            ranges.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                className={range === r.id ? theme.button.toggleActive : theme.button.toggleInactive}
              >
                {r.label}
              </button>
            ))
          }
        >
          {rule.title && (
            <div className={theme.panel.info}>
              <p className="font-semibold">{rule.title}</p>
              <p className="mt-1 text-sm leading-relaxed">{rule.description}</p>
            </div>
          )}
          {items.map((item) => (
            <Card
              key={item.n + item.de}
              badge={item.n}
              title={item.de}
              lines={isDE ? [] : [item.engPh, item.nepPh]}
              footer={isDE ? undefined : `${item.en} · ${item.ne}`}
              note={item.note}
              onClick={() => speakWord(item.de)}
              onSpeak={() => speakWord(item.de)}
            />
          ))}
        </SectionGrid>
      )}

      {mode === 'listen' && (
        <div className="mx-auto max-w-lg">
          <ListenAndType
            session={listenSession}
            onPlayPrompt={(q) => speakWord(q.correctAnswer)}
            placeholder={isDE ? 'Tippe Zahl oder Wort…' : 'Type digit or word…'}
            hideFooter
          />
          {/* Round footer: next/finish + play again */}
          <div className="mt-3 flex justify-center gap-3">
            {listenSession.locked && (
              <button type="button" onClick={listenSession.next} className={theme.button.primary}>
                {listenSession.index >= listenSession.total - 1
                  ? isDE ? 'Fertig' : 'Finish'
                  : isDE ? 'Nächste Zahl →' : 'Next Number →'}
              </button>
            )}
            {!listenSession.locked && listenSession.answered > 0 && listenSession.index >= listenSession.total && (
              <button
                type="button"
                onClick={() => setRunId((r) => r + 1)}
                className={theme.button.secondary}
              >
                {isDE ? 'Neue Runde 🔄' : 'Play again 🔄'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Zahlen-Quiz — engine-driven MCQ */}
      <MultipleChoice
        session={mcqSession}
        columns={2}
        showSpeaker={false}
        renderPrompt={(q) => (
          <span className="text-5xl font-bold text-blue-600 dark:text-blue-400">{q.n}</span>
        )}
        hideFooter
      />
      <div className="mx-auto mt-3 flex max-w-lg justify-between gap-2">
        <button type="button" onClick={() => setRunId((r) => r + 1)} className={theme.button.secondary}>
          {isDE ? 'Neue Runde 🔄' : 'New round 🔄'}
        </button>
        {mcqSession.locked && (
          <button type="button" onClick={mcqSession.next} className={theme.button.primary}>
            {mcqSession.index >= mcqSession.total - 1
              ? isDE ? 'Fertig' : 'Finish'
              : isDE ? 'Weiter' : 'Next'}
          </button>
        )}
      </div>
    </div>
  );
}