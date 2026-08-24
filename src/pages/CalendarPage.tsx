/**
 * src/pages/CalendarPage.tsx
 *
 * Unit 3 — Days, Months & Telling Time. Learn list (days / months / uhrzeit tabs)
 * + engine-driven Listen & Type quiz (`useExerciseSession` + `<ListenAndType>`).
 * The quiz draws a finite without-replacement deck of up to 10 unique items per
 * round; "Play again" reshuffles. XP/SRS reporting is owned by the Lesson Engine
 * session.
 *
 * The Uhrzeit (telling-time) tab is an additive, always-available drill backed by
 * src/data/uhrzeit.ts (local UI data, same role as a1Verbs.ts — NOT a DB seed), so
 * it stays usable even when the calendar dataset has not been seeded yet.
 */

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Sparkles, Calendar, CalendarDays, Clock } from 'lucide-react';
import { sharedTextDatabase } from '../data/sharedContent';
import { TIME_PHRASES, type UhrzeitItem } from '../data/uhrzeit';
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

/** Items that can feed the day/month/time pools (common: de/en/ne). */
type CalendarPool = CalendarItem | UhrzeitItem;

const DECK_SIZE = 10;

function normalize(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function CalendarPage() {
  usePageTitle('Calendar');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const [tab, setTab] = useState<'days' | 'months' | 'uhrzeit'>('days');
  const [mode, setMode] = useState<'learn' | 'quiz'>('learn');
  const [calendar, setCalendar] = useState<CalendarItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  /** Increments to reshuffle a fresh quiz deck. */
  const [runId, setRunId] = useState(0);

  // Reshuffle when the active drill changes.
  useEffect(() => {
    setRunId((r) => r + 1);
  }, [tab]);

  useEffect(() => {
    curriculumService
      .getCalendar()
      .then((data) => {
        setCalendar(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  // Pool depends on the selected tab. Days/months come from the curriculum
  // loader; the Uhrzeit pool is local client-side data so it is always ready.
  const pool = useMemo<CalendarPool[]>(() => {
    if (tab === 'days') return calendar.slice(0, 7);
    if (tab === 'months') return calendar.slice(7);
    return TIME_PHRASES;
  }, [calendar, tab]);

  // Friendly state only blocks days/months when calendar data is missing.
  const emptyDaysMonths =
    (tab === 'days' || tab === 'months') && calendar.length === 0;

  // Finite without-replacement deck per round (Lesson Engine contract).
  const deck = useMemo<CalendarQuestion[]>(
    () =>
      pickNUnique({
        items: pool,
        count: Math.min(DECK_SIZE, pool.length),
        getKey: (c) => c.de,
      }).map((c) => ({
        key: c.de,
        correctAnswer: c.de,
        speakPrompt: c.de,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pool, runId]
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

  const timeTitle = isDE ? 'Uhrzeit' : 'Telling Time';
  const timeDesc = isDE
    ? 'Wie spät ist es? — Zahlen, halb, Viertel.'
    : 'What time is it? — hours, half past, quarter.';

  if (!loaded) {
    return <div className={theme.page.container}>Loading...</div>;
  }

  if (emptyDaysMonths) {
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
          title={tab === 'uhrzeit' ? timeTitle : title}
          description={tab === 'uhrzeit' ? timeDesc : description}
          controls={
            <TabGroup
              tabs={[
                { id: 'days', label: isDE ? 'Wochentage' : 'Days of the Week', icon: Calendar },
                { id: 'months', label: isDE ? 'Monate' : 'Months', icon: CalendarDays },
                { id: 'uhrzeit', label: isDE ? 'Uhrzeit' : 'Telling Time', icon: Clock },
              ]}
              activeTab={tab}
              onTabChange={setTab}
            />
          }
        >
          {pool.map((item, index) => (
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
            placeholder={
              tab === 'uhrzeit'
                ? isDE
                  ? 'Tippe die Uhrzeit …'
                  : 'Type the time …'
                : isDE
                  ? 'Tippe das deutsche Wort…'
                  : 'Type the German word…'
            }
            hideFooter
          />
          {/* Round footer: next/finish + play again */}
          <div className="mt-3 flex justify-center gap-3">
            {session.locked && (
              <button type="button" onClick={session.next} className={theme.button.primary}>
                {session.index >= session.total - 1
                  ? isDE
                    ? 'Fertig'
                    : 'Finish'
                  : isDE
                    ? 'Weiter →'
                    : 'Next →'}
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