/**
 * src/pages/NumbersPage.tsx
 *
 * Numbers module driven by the shared Lesson Engine, in three real tabs:
 *  - "Lernliste"  -> range-scoped study cards with the composition rule
 *  - "Hören & Tippen" -> useExerciseSession + <ListenAndType> (digit OR word)
 *  - "Zahlen-Quiz"    -> useExerciseSession + <MultipleChoice> (digit prompt, word options)
 *
 * All three honour the range selector, and both quizzes draw finite
 * without-replacement decks of 10 per round; desktop keyboard shortcuts are
 * preserved for the MCQ (Space = hear, 1-4 = pick, Enter = next). XP/SRS
 * reporting is owned entirely by the engine sessions.
 *
 * Structure note: the MCQ used to render OUTSIDE the mode switch, so a
 * "Zahlen-Quiz" block appeared on top of the Learn List and the Listen & Type
 * tab simultaneously. It is now a real tab, and the range buttons were hoisted
 * out of SectionGrid so the quizzes can reach them.
 */

import { useEffect, useMemo, useState } from 'react';
import { List, Headphones, Keyboard } from 'lucide-react';
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
import { ExerciseRoundFooter } from '../components/exercises/ExerciseRoundFooter';
import { LoadingBlock, ContentPending } from '../components/common/LoadingBlock';
import { normalizeAnswer } from '../utils/answerNormalize';

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
  const [mode, setMode] = useState<'learn' | 'listen' | 'quiz'>('learn');
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

  // Range-scoped pool. Memoized because the quiz decks below consume it: the
  // range buttons used to be a NO-OP for both quizzes, which always drew from
  // the whole number table, so "0 – 12" + Listen & Type still asked about 137.
  //
  // Inlined rather than delegating to a `getItemsByRange` helper so the
  // dependency array is honest — a module-scope-looking helper would need to be
  // listed as a dep (and is recreated every render, so listing it is useless).
  const items = useMemo<NumberItem[]>(() => {
    if (range === '0-12') return numbersData.filter((item) => item.n <= 12);
    if (range === '13-19') return numbersData.filter((item) => item.n >= 13 && item.n <= 19);
    if (range === '20-99') return numbersData.filter((item) => item.n >= 20 && item.n <= 99);
    return numbersData.filter((item) => item.n >= 100);
  }, [range, numbersData]);

  const rule = numberRules[range];
  const title = isDE ? 'Deutsche Zahlen' : sharedTextDatabase.numbers.title;
  const description = isDE
    ? 'Lerne auf Deutsch zu zählen'
    : sharedTextDatabase.numbers.description;

  const modeTabs: Tab<'learn' | 'listen' | 'quiz'>[] = [
    { id: 'learn', label: isDE ? 'Lernliste' : 'Learn List', icon: List },
    { id: 'listen', label: isDE ? 'Hören & Tippen' : 'Listen & Type', icon: Headphones },
    { id: 'quiz', label: isDE ? 'Zahlen-Quiz' : 'Number Quiz', icon: Keyboard },
  ];

  // ---- Session A: Hören & Tippen (finite deck per round) ----
  const listenDeck = useMemo<NumberListenQuestion[]>(
    () =>
      pickNUnique({
        items,
        count: Math.min(DECK_SIZE, items.length),
        getKey: (x) => x.de,
      }).map((x) => ({
        key: x.de,
        correctAnswer: x.de,
        speakPrompt: x.de,
      })),
    // `runId` is a deliberate reshuffle trigger, not reactive data — it is read
    // only to invalidate this memo. See GreetingsPage/CalendarPage for the same
    // "New round" pattern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, runId]
  );

  const listenSession = useExerciseSession<NumberListenQuestion>({
    questions: listenDeck,
    module: 'numbers',
    // Accept either the digit form or the German word.
    matches: (input, q) => {
      const norm = normalizeAnswer(input);
      if (norm === normalizeAnswer(q.correctAnswer)) return true;
      const item = numbersData.find((x) => x.de === q.correctAnswer);
      return item !== undefined && norm === String(item.n);
    },
  });

  // ---- Session B: Zahlen-Quiz MCQ (finite deck per round) ----
  const mcqDeck = useMemo<NumberMcqQuestion[]>(
    () =>
      pickNUnique({
        items,
        count: Math.min(DECK_SIZE, items.length),
        getKey: (x) => x.de,
      }).map((q) => ({
        key: q.de,
        correctAnswer: q.de,
        n: q.n,
        speakPrompt: q.de,
        // Raw option pool; the engine shuffles once at mount.
        options: buildMcq({
          correctItem: q,
          // Distractors are drawn from the WHOLE table on purpose: pulling
          // them from the active range would make "20 – 99" ambiguous
          // (fünf vs. fünfundzwanzig are both plausible for a 2-digit prompt).
          allItems: numbersData,
          getKey: (x) => x.de,
          count: 4,
        }).map((o) => o.de),
      })),
    // `runId` is a deliberate reshuffle trigger — see the note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, numbersData, runId]
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
    return <LoadingBlock />;
  }

  // Pool empty (not seeded yet / offline before first fetch) — friendly state.
  if (numbersData.length === 0) {
    return (
      <div className={theme.page.container}>
        <h1 className={theme.page.heading}>{title}</h1>
        <ContentPending isDE={isDE} />
      </div>
    );
  }

  return (
    <div className={theme.page.container}>
      <h1 className={theme.page.heading}>{title}</h1>
      <p className={theme.page.description}>{description}</p>

      <TabGroup tabs={modeTabs} activeTab={mode} onTabChange={setMode} />

      {/* Range selector — applies to ALL three modes, not just the Learn List.
          It used to live inside SectionGrid's `controls`, which meant the two
          quiz decks (the ones that actually consume `items`) had no way to
          reach it. */}
      <div className="mb-4 flex flex-wrap gap-2">
        {ranges.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRange(r.id)}
            className={range === r.id ? theme.button.toggleActive : theme.button.toggleInactive}
          >
            {r.label}
          </button>
        ))}
      </div>

      {mode === 'learn' && (
        <SectionGrid
          title={title}
          description={description}
          hideHeader
        >
          {rule.title && (
            <div className={theme.panel.info}>
              <p className="font-semibold">{rule.title}</p>
              <p className="mt-1 text-body leading-relaxed">{rule.description}</p>
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
          {/* Round footer: next/finish + play again (shared component) */}
          <ExerciseRoundFooter
            session={listenSession}
            onPlayAgain={() => setRunId((r) => r + 1)}
            nextLabel={isDE ? 'Nächste Zahl →' : 'Next Number →'}
            showSummary={false}
          />
        </div>
      )}

      {/* Zahlen-Quiz — engine-driven MCQ, digit prompt with word options.
          This used to sit OUTSIDE the mode switch, so it rendered on top of
          the Learn List and the Listen & Type tab at the same time. */}
      {mode === 'quiz' && (
        <div className="mx-auto max-w-lg">
          <MultipleChoice
            session={mcqSession}
            columns={2}
            showSpeaker={false}
            renderPrompt={(q) => (
              <span className="text-5xl font-bold text-accent-600 dark:text-accent-400">{q.n}</span>
            )}
            hideFooter
          />
          <div className="mt-3 flex justify-between gap-2">
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
      )}
    </div>
  );
}