/**
 * src/pages/GreetingsPage.tsx
 *
 * Unit 1 — Greetings. Learn list + engine-driven Listen & Type quiz
 * (`useExerciseSession` + `<ListenAndType>`). The quiz draws a finite deck of
 * 10 unique greetings per round (without replacement via pickNUnique); a fresh
 * round reshuffles on "Play again". XP/SRS reporting is owned entirely by the
 * Lesson Engine session.
 */

import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Sparkles, Shuffle } from 'lucide-react';
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
import { MatchPairs, type MatchPair } from '../components/exercises/MatchPairs';
import type { GreetingItem } from '../types';

/** Engine-compatible greeting question (audio prompt = the word itself). */
interface GreetingQuestion extends ExerciseQuestion {}

const DECK_SIZE = 10;

function normalize(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function GreetingsPage() {
  usePageTitle('Greetings');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const [mode, setMode] = useState<'learn' | 'quiz' | 'match'>('learn');
  const [greetings, setGreetings] = useState<GreetingItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  /** Increments to reshuffle a fresh quiz deck. */
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    curriculumService
      .getGreetings()
      .then((data) => {
        setGreetings(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  // Finite without-replacement deck per round (Lesson Engine contract).
  const deck = useMemo<GreetingQuestion[]>(
    () =>
      pickNUnique({ items: greetings, count: Math.min(DECK_SIZE, greetings.length), getKey: (g) => g.de }).map(
        (g) => ({
          key: g.de,
          correctAnswer: g.de,
          speakPrompt: g.de,
        })
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [greetings, runId]
  );

  const session = useExerciseSession<GreetingQuestion>({
    questions: deck,
    module: 'greetings',
    matches: (input, q) => normalize(input) === normalize(q.correctAnswer),
  });

  // Unit 1 split-screen matching: first 6 greetings as DE↔EN pairs.
  const matchPairs = useMemo<MatchPair[]>(
    () =>
      greetings.slice(0, 6).map((g) => ({
        id: g.de,
        de: g.de,
        en: g.en,
      })),
    [greetings]
  );

  const title = isDE ? 'Begrüßungen' : sharedTextDatabase.greetings.title;
  const description = isDE
    ? 'Lerne gängige deutsche Begrüßungen'
    : sharedTextDatabase.greetings.description;

  if (!loaded) {
    return <div className={theme.page.container}>Loading...</div>;
  }

  // Pool empty (not seeded yet / offline before first fetch) — friendly state.
  if (greetings.length === 0) {
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
          { id: 'learn', label: isDE ? 'Lernliste' : 'Learn List', icon: MessageCircle },
          { id: 'quiz', label: isDE ? 'Hören & Tippen' : 'Listen & Type', icon: Sparkles },
          { id: 'match', label: isDE ? 'Paare' : 'Match', icon: Shuffle },
        ]}
        activeTab={mode}
        onTabChange={setMode}
      />

      {mode === 'learn' && (
        <SectionGrid
          title={title}
          description={description}
          hideHeader
        >
          {greetings.map((item, index) => (
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
            placeholder={isDE ? 'Tippe die Begrüßung…' : 'Type the greeting…'}
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

      {/* Unit 1 matching mechanic (Lesson Engine MatchPairs primitive). */}
      {mode === 'match' && matchPairs.length > 0 && (
        <div className="mx-auto max-w-lg">
          <MatchPairs pairs={matchPairs} module="greetings" />
        </div>
      )}
    </div>
  );
}
