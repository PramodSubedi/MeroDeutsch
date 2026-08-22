/**
 * src/pages/DictationPage.tsx
 *
 * Audio-to-text dictation driven by the shared Lesson Engine
 * (`useExerciseSession` + `<DictationInput>`). Draws a finite deck of 10
 * unique words per round; "Play again" reshuffles. The +50 XP dictation tier
 * and SRS miss-queueing are owned by the engine session (xpAmount config).
 */

import { useEffect, useMemo, useState } from 'react';
import { speakWord } from '../hooks/useSpeech';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { XP_REWARDS } from '../hooks/useXp';
import { theme } from '../config/theme';
import { curriculumService } from '../services';
import { pickNUnique } from '../utils/questionGenerator';
import {
  useExerciseSession,
  type ExerciseQuestion,
} from '../hooks/useExerciseSession';
import { DictationInput } from '../components/exercises/DictationInput';
import type { DictationWord } from '../types/curriculum';

/** Engine-compatible dictation question (audio prompt = the word itself). */
interface DictationQuestion extends ExerciseQuestion {}

const DECK_SIZE = 10;

function normalize(input: string): string {
  return input.trim().toLowerCase();
}

export function DictationPage() {
  usePageTitle('Dictation');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const [dictationWords, setDictationWords] = useState<DictationWord[]>([]);
  const [loaded, setLoaded] = useState(false);
  /** Increments to reshuffle a fresh deck. */
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    curriculumService
      .getDictationWords()
      .then((data) => {
        setDictationWords(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  // Finite without-replacement deck per round (Lesson Engine contract).
  const deck = useMemo<DictationQuestion[]>(
    () =>
      pickNUnique({
        items: dictationWords,
        count: Math.min(DECK_SIZE, dictationWords.length),
        getKey: (w) => w.word,
      }).map((w) => ({
        key: w.word,
        correctAnswer: w.word,
        speakPrompt: w.word,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dictationWords, runId]
  );

  const session = useExerciseSession<DictationQuestion>({
    questions: deck,
    module: 'dictation',
    xpAmount: XP_REWARDS.dictation, // +50 XP dictation tier
    matches: (input, q) => normalize(input) === normalize(q.correctAnswer),
  });

  const title = isDE ? 'Diktat' : 'Dictation';
  const subtitle = isDE
    ? 'Höre das Wort und tippe, was du gehört hast.'
    : 'Listen to the German word, then type what you heard.';

  if (!loaded) {
    // Loading guard — avoid blank flash while dictation words load.
    return <div className={theme.page.container}>Loading...</div>;
  }

  // Pool empty (not seeded yet / offline before first fetch) — friendly state.
  if (dictationWords.length === 0) {
    return (
      <div className={theme.page.container}>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h1>
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
      <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>

      <div className="mx-auto mt-6 max-w-xl">
        <DictationInput
          session={session}
          onPlayAudio={(q) => speakWord(q.correctAnswer)}
          hideFooter
        />
        {/* Round footer: next/finish + play again */}
        <div className="mt-3 flex justify-center gap-3">
          {session.locked && (
            <button type="button" onClick={session.next} className={theme.button.primary}>
              {session.index >= session.total - 1
                ? isDE ? 'Fertig' : 'Finish'
                : isDE ? 'Nächstes Wort →' : 'Next Word →'}
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
    </div>
  );
}