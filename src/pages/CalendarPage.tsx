/**
 * src/pages/CalendarPage.tsx
 *
 * Unit 3 — Days & Months. Learn list (days/months tabs) + engine-driven
 * Listen & Type quiz (`useExerciseSession` + `<ListenAndType>`). The quiz
 * draws a finite deck of 10 unique items per round; "Play again" reshuffles.
 * XP/SRS reporting is owned entirely by the Lesson Engine session.
 */

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Sparkles, Calendar, CalendarDays } from 'lucide-react';
import { sharedTextDatabase } from '../data/sharedContent';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { speakWord } from '../hooks/useSpeech';
import { StandardStudyCard } from '../components/StandardStudyCard';
import { SectionGrid } from '../components/SectionGrid';
import { TabGroup } from '../components/TabGroup';
import { theme } from '../config/theme';
import { curriculumService } from '../services';
import { pickNUnique } from '../utils/questionGenerator';
import {
  useExerciseSession,
  type ExerciseQuestion,
} from '../hooks/useExerciseSession';
import { ListenAndType } from '../components/exercises/ListenAndType';
import type { CalendarItem } from '../types';

/** Engine-compatible calendar question (audio prompt = the word itself). */
interface CalendarQuestion extends ExerciseQuestion {}

const DECK_SIZE = 10;

function normalize(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function CalendarPage() {
  usePageTitle('Calendar');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const [tab, setTab] = useState<'days' | 'months'>('days');
  const [mode, setMode] = useState<'learn' | 'quiz'>('learn');
  const [calendar, setCalendar] = useState<CalendarItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  /** Increments to reshuffle a fresh quiz deck. */
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    curriculumService
      .getCalendar()
      .then((data) => {
        setCalendar(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const data = tab === 'days' ? calendar.slice(0, 7) : calendar.slice(7);

  // Finite without-replacement deck per round (Lesson Engine contract).
  const deck = useMemo<CalendarQuestion[]>(
    () =>
      pickNUnique({ items: calendar, count: Math.min(DECK_SIZE, calendar.length), getKey: (c) => c.de }).map(
        (c) => ({
          key: c.de,
          correctAnswer: c.de,
          speakPrompt: c.de,
        })
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calendar, runId]
  );

  const session = useExerciseSession<CalendarQuestion>({
    questions: deck,
    module: 'calendar',
    matches: (input, q) => normalize(input) === normalize(q.correctAnswer),
  });

  const title = isDE ? 'Tage & Monate' : sharedTextDatabase.calendar.title;
  const description = isDE
    ? 'Lerne die Wochentage und Monate'
    : sharedTextDatabase.calendar.description;

  if (!loaded) {
    return <div className={theme.page.container}>Loading...</div>;
  }

  // Pool empty (not seeded yet / offline before first fetch) — friendly state.
  if (calendar.length === 0) {
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

      <TabGroup
        tabs={[
          { id: 'learn', label: isDE ? 'Lernliste' : 'Learn List', icon: BookOpen },
          { id: 'quiz', label: isDE ? 'Hören & Tippen' : 'Listen & Type', icon: Sparkles },
        ]}
        activeTab={mode}
        onTabChange={setMode}
      />

      {mode === 'learn' && (
        <SectionGrid
          title={title}
          description={description}
          controls={
            <TabGroup
              tabs={[
                { id: 'days', label: isDE ? 'Wochentage' : 'Days of the Week', icon: Calendar },
                { id: 'months', label: isDE ? 'Monate' : 'Months', icon: CalendarDays },
              ]}
              activeTab={tab}
              onTabChange={setTab}
            />
          }
        >
          {data.map((item, index) => (
            <StandardStudyCard
              key={item.de}
              badge={index + 1}
              german={item.de}
              nepali={item.ne}
              english={item.en}
              langMode={langMode}
            />
          ))}
        </SectionGrid>
      )}

      {mode === 'quiz' && (
        <div className="mx-auto max-w-lg">
          <ListenAndType
            session={session}
            onPlayPrompt={(q) => speakWord(q.correctAnswer)}
            placeholder={isDE ? 'Tippe das deutsche Wort…' : 'Type the German word…'}
            hideFooter
          />
          {/* Round footer: next/finish + play again */}
          <div className="mt-3 flex justify-center gap-3">
            {session.locked && (
              <button type="button" onClick={session.next} className={theme.button.primary}>
                {session.index >= session.total - 1
                  ? isDE ? 'Fertig' : 'Finish'
                  : isDE ? 'Weiter →' : 'Next →'}
              </button>
            )}
            {!session.locked && session.answered > 0 && session.index >= session.total && (
              <button
                type="button"
                onClick={() => setRunId((r) => r + 1)}
                className={theme.button.secondary}
              >
                {isDE ? 'Neue Runde 🔄' : 'Play again 🔄'}
              </button>
            )}
          </div>
          {session.index >= session.total && session.total > 0 && (
            <p className="mt-3 text-center text-sm font-semibold text-slate-600 dark:text-slate-300">
              {isDE
                ? `Runde beendet — ${session.score}/${session.total} richtig.`
                : `Round complete — ${session.score}/${session.total} correct.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}