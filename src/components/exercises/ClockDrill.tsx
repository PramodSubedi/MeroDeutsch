/**
 * src/components/exercises/ClockDrill.tsx
 *
 * Lesson Engine primitive — dual time-telling drill (NotebookLM workbook
 * mechanic) for the Calendar "Uhr" tab:
 *
 *   - 'gesprochen' mode: analog clock → pick the casual German phrase
 *     ("Es ist zehn vor zehn", "Es ist halb eins"…)
 *   - 'offiziell' mode: digital 24h face → pick the official phrase
 *     ("Es ist dreiundzwanzig Uhr fünfzig")
 *
 * The trap explainer highlights that German AND Nepali count toward the NEXT
 * hour (halb eins = साढे बाह्र = 12:30) while English says "half past twelve"
 * — EN/NE lines are hidden in Nur-DE mode (C1.5).
 *
 * TTS safety (C2.6): the clock face/digital label is the visual prompt — no
 * pre-lock audio. The correct phrase is revealed in text after lock.
 *
 * Data/generators come from src/data/uhrzeit.ts (same module as the phrase
 * pool). XP + SRS run through the shared Lesson Engine session.
 */

import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { theme } from '../../config/theme';
import { shuffleArray } from '../../utils/shuffleArray';
import {
  CLOCK_MINUTES,
  digitalTimeLabel,
  officialTimeWords,
  spokenTimeWords,
} from '../../data/uhrzeit';
import {
  useExerciseSession,
  type ExerciseQuestion,
} from '../../hooks/useExerciseSession';
import { MultipleChoice } from './MultipleChoice';

interface ClockQuestion extends ExerciseQuestion {
  hour: number; // 0-23
  minute: number; // multiple of 5
}

type ClockMode = 'gesprochen' | 'offiziell';

const DECK_SIZE = 8;

/** Build N distinct (hour, minute) study times for the current mode. */
function buildTimes(mode: ClockMode, count: number): { hour: number; minute: number }[] {
  const hours =
    mode === 'offiziell'
      ? [0, 7, 8, 9, 11, 13, 15, 17, 19, 21, 22, 23]
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const candidates: { hour: number; minute: number }[] = [];
  for (const h of hours) {
    for (const m of CLOCK_MINUTES) candidates.push({ hour: h, minute: m });
  }
  return shuffleArray(candidates).slice(0, count);
}

export function ClockDrill() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const [mode, setMode] = useState<ClockMode>('gesprochen');
  const [runId, setRunId] = useState(0);

  // Phrase pool per run; each time's phrase also seeds the MC distractors.
  const deck = useMemo<ClockQuestion[]>(() => {
    const times = buildTimes(mode, DECK_SIZE);
    const phraseFor = (t: { hour: number; minute: number }) =>
      mode === 'offiziell'
        ? officialTimeWords(t.hour, t.minute)
        : spokenTimeWords(t.hour, t.minute);
    const allPhrases = times.map(phraseFor);
    return times.map((t) => {
      const correct = phraseFor(t);
      const distractors = allPhrases.filter((p) => p !== correct);
      const options = [correct, ...shuffleArray(distractors).slice(0, 3)];
      return {
        key: `clock-${mode}-${t.hour}-${t.minute}`,
        prompt: '', // prompt is rendered (clock face / digital) via renderPrompt
        correctAnswer: correct,
        options,
        hour: t.hour,
        minute: t.minute,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, runId]);

  const session = useExerciseSession<ClockQuestion>({
    questions: deck,
    module: 'calendar',
    xpAmount: 10,
  });

  const finished = session.index >= session.total && session.total > 0;

  const restart = () => {
    setRunId((r) => r + 1);
    session.reset();
  };

  return (
    <div className="space-y-4">
      {/* Register toggle: spoken (12h) vs official (24h) */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => { setMode('gesprochen'); restart(); }}
          className={mode === 'gesprochen' ? theme.button.toggleActive : theme.button.toggleInactive}
        >
          {isDE ? 'Gesprochen (12 Std.)' : 'Spoken (12h)'}
        </button>
        <button
          type="button"
          onClick={() => { setMode('offiziell'); restart(); }}
          className={mode === 'offiziell' ? theme.button.toggleActive : theme.button.toggleInactive}
        >
          {isDE ? 'Offiziell (24 Std.)' : 'Official (24h)'}
        </button>
      </div>

      {/* Trap explainer — DE row always; EN/NE bridge hidden in Nur DE (C1.5). */}
      <div className={theme.panel.accent}>
        <div className="text-sm font-semibold text-blue-700 dark:text-blue-300">
          {isDE
            ? 'Achtung: „halb eins" = 12:30 — die Hälfte AUF die nächste Stunde!'
            : 'Watch out: "halb eins" = 12:30 — half way TO the next hour!'}
        </div>
        <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
          Es ist halb eins <span className="text-slate-400">=</span> 12:30
        </div>
        {!isDE && (
          <>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              🇳🇵 Nepali agrees with German: साढे बाह्र = 12:30 (English "half past twelve" is the odd one out!)
            </div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              सवा तीन = Viertel nach drei (3:15) · पौने चार = Viertel vor vier (3:45)
            </div>
          </>
        )}
      </div>

      {!finished && (
        <MultipleChoice<ClockQuestion>
          session={session}
          showSpeaker={false}
          columns={1}
          renderPrompt={(q) => <ClockPrompt question={q} mode={mode} />}
        />
      )}

      {/* Round complete footer */}
      {finished && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-center text-sm font-semibold text-slate-600 dark:text-slate-300">
            {isDE
              ? `Runde beendet — ${session.score}/${session.total} richtig.`
              : `Round complete — ${session.score}/${session.total} correct.`}
          </p>
          <button
            type="button"
            onClick={restart}
            className={`${theme.button.secondary} inline-flex min-h-[44px] items-center gap-1.5`}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {isDE ? 'Neue Runde 🔄' : 'Play again 🔄'}
          </button>
        </div>
      )}
    </div>
  );
}

/** Visual prompt: analog clock face (spoken) or digital 24h label (official). */
function ClockPrompt({ question, mode }: { question: ClockQuestion; mode: ClockMode }) {
  if (mode === 'offiziell') {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="rounded-2xl bg-slate-900 px-6 py-3 font-mono text-4xl font-bold tracking-widest text-emerald-300 dark:bg-slate-950">
          {digitalTimeLabel(question.hour, question.minute)}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Offizielle Zeit (24 Stunden) · आधिकारिक समय
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <AnalogClock hour24={question.hour} minute={question.minute} />
      <div className="text-xs text-slate-500 dark:text-slate-400">
        Wie spät ist es? · कति बज्यो?
      </div>
    </div>
  );
}

/** Minimal SVG analog clock — hour/minute hands from a 24h time. */
function AnalogClock({ hour24, minute }: { hour24: number; minute: number }) {
  const h12 = hour24 % 12;
  const hourAngle = h12 * 30 + minute * 0.5;
  const minuteAngle = minute * 6;
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180;
    return {
      x1: 50 + 40 * Math.sin(a),
      y1: 50 - 40 * Math.cos(a),
      x2: 50 + 45 * Math.sin(a),
      y2: 50 - 45 * Math.cos(a),
      major: i % 3 === 0,
    };
  });
  return (
    <svg
      viewBox="0 0 100 100"
      className="h-44 w-44"
      role="img"
      aria-label={`Clock showing ${hour24}:${minute}`}
    >
      <circle
        cx="50"
        cy="50"
        r="48"
        strokeWidth="2"
        className="fill-white stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-600"
      />
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          strokeWidth={t.major ? 2.5 : 1}
          className="stroke-slate-400 dark:stroke-slate-500"
        />
      ))}
      <line
        x1="50"
        y1="50"
        x2={50 + 22 * Math.sin((hourAngle * Math.PI) / 180)}
        y2={50 - 22 * Math.cos((hourAngle * Math.PI) / 180)}
        strokeWidth="5"
        strokeLinecap="round"
        className="stroke-blue-600 dark:stroke-blue-400"
      />
      <line
        x1="50"
        y1="50"
        x2={50 + 34 * Math.sin((minuteAngle * Math.PI) / 180)}
        y2={50 - 34 * Math.cos((minuteAngle * Math.PI) / 180)}
        strokeWidth="3"
        strokeLinecap="round"
        className="stroke-slate-700 dark:stroke-slate-300"
      />
      <circle cx="50" cy="50" r="3" className="fill-slate-700 dark:fill-slate-300" />
    </svg>
  );
}