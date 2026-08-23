/**
 * src/pages/A1CheckpointPage.tsx
 *
 * A1 unit checkpoint quiz (10-15 items), driven by the shared Lesson Engine
 * (`useExerciseSession` + `<MultipleChoice>`). Locked rules (C/D):
 *  - 10-15 items drawn from the unit's real curriculumService loaders.
 *  - pickNUnique -> no repeats until the pool cycles (without replacement).
 *  - Options shuffled AT creation AND re-shuffled once at session mount;
 *    stable after the question locks (engine guarantee).
 *  - >=80% passes (advances unlockedUnitIndex, persists best score).
 *  - <80%: score shown, Retry (anytime, no cooldown), Back to map.
 *  - Misses queued via the REAL addWrongAnswer (moduleType 'a1-checkpoint')
 *    — routed through the engine's single integration point.
 *  - Correct answers award XP via reportAnswer (existing XpContext -> toast).
 *  - TTS safety (C6): "Hear" speaks ONLY the prompt before the question locks;
 *    the answer is spoken only AFTER the answer is locked (MultipleChoice).
 *  - Level-ups render as non-blocking toasts (Layout treats /checkpoint as a
 *    quiz route).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLang } from '../hooks/useLang';
import { useA1Path } from '../hooks/useA1Path';
import { curriculumService } from '../services';
import { CHECKPOINT_PASS_THRESHOLD, A1_UNITS, type CheckpointSource, type Article } from '../data/a1Path';
import { pickNUnique } from '../utils/questionGenerator';
import { shuffleArray } from '../utils/shuffleArray';
import { useExerciseSession, type ExerciseQuestion } from '../hooks/useExerciseSession';
import { MultipleChoice } from '../components/exercises/MultipleChoice';
import { theme } from '../config/theme';
import { GenderBadge } from '../components/ui/GenderBadge';
import type { AlphabetItem, ArticleItem, CalendarItem, GreetingItem, NumberItem, VocabEntry } from '../types';
import type { GrammarDrill } from '../types/curriculum';

/** Engine-compatible checkpoint question. */
interface CheckpointQuestion extends ExerciseQuestion {
  prompt: string;
  source: CheckpointSource;
  article?: Article; // only for article-precision rendering
}

interface LoadedData {
  greetings: GreetingItem[];
  numbers: NumberItem[];
  alphabet: AlphabetItem[];
  articles: ArticleItem[];
  calendar: CalendarItem[];
  vocabulary: VocabEntry[];
  grammar: Record<string, GrammarDrill[]>;
}

function buildOptions(correct: string, decoyPool: string[], count: number): string[] {
  const uniqueDecoys = Array.from(new Set(decoyPool.filter((d) => d !== correct)));
  const chosen = uniqueDecoys.slice(0, count - 1);
  return [correct, ...chosen]; // final shuffle happens once at session mount
}

function buildQuestions(
  specs: { type: CheckpointSource; count: number }[],
  data: LoadedData,
  unitIndex: number
): CheckpointQuestion[] {
  const out: CheckpointQuestion[] = [];
  const pick = <T,>(items: T[], count: number, getKey: (x: T) => string): T[] =>
    pickNUnique({ items, count: Math.min(count, items.length), getKey });

  for (const spec of specs) {
    switch (spec.type) {
      case 'greeting-translation':
        pick(data.greetings, spec.count, (g) => g.de).forEach((g) =>
          out.push({
            key: `greeting:${g.de}`,
            prompt: g.en,
            speakPrompt: g.en,
            speakAfter: g.de,
            options: buildOptions(g.de, data.greetings.map((x) => x.de), 4),
            correctAnswer: g.de,
            source: 'greeting-translation',
          })
        );
        break;
      case 'number-conversion':
        pick(data.numbers, spec.count, (n) => n.de).forEach((n) =>
          out.push({
            key: `number:${n.de}`,
            prompt: String(n.n),
            speakPrompt: String(n.n),
            speakAfter: n.de,
            options: buildOptions(n.de, data.numbers.map((x) => x.de), 4),
            correctAnswer: n.de,
            source: 'number-conversion',
          })
        );
        break;
      case 'alphabet-letter':
        pick(data.alphabet, spec.count, (a) => a.id).forEach((a) =>
          out.push({
            key: `letter:${a.id}`,
            prompt: a.letter,
            speakPrompt: a.speak, // letter name is the PROMPT, not the answer word
            speakAfter: a.speakWord,
            options: buildOptions(a.speakWord, data.alphabet.map((x) => x.speakWord), 4),
            correctAnswer: a.speakWord,
            source: 'alphabet-letter',
          })
        );
        break;
      case 'article-precision':
        pick(data.articles, spec.count, (a) => a.noun).forEach((a) =>
          out.push({
            key: `article:${a.noun}`,
            prompt: a.noun, // noun WITHOUT article -> TTS safe before lock (C6)
            speakPrompt: a.noun,
            speakAfter: `${a.art} ${a.noun}`,
            options: ['der', 'die', 'das'],
            correctAnswer: a.art,
            source: 'article-precision',
            article: a.art,
          })
        );
        break;
      case 'grammar-drill': {
        const drills = Object.values(data.grammar).flat();
        pick(drills, spec.count, (g) => g.prompt + g.correct).forEach((g, i) =>
          out.push({
            key: `grammar:${unitIndex}:${i}:${g.prompt}`,
            prompt: g.prompt,
            speakPrompt: g.prompt,
            speakAfter: g.correct,
            options: [...g.options],
            correctAnswer: g.correct,
            source: 'grammar-drill',
          })
        );
        break;
      }
      case 'calendar-translation':
        pick(data.calendar, spec.count, (c) => c.de).forEach((c) =>
          out.push({
            key: `calendar:${c.de}`,
            prompt: c.en,
            speakPrompt: c.en,
            speakAfter: c.de,
            options: buildOptions(c.de, data.calendar.map((x) => x.de), 4),
            correctAnswer: c.de,
            source: 'calendar-translation',
          })
        );
        break;
      case 'vocab-translation':
        pick(data.vocabulary, spec.count, (v) => v.id).forEach((v) =>
          out.push({
            key: `vocab:${v.id}`,
            prompt: v.en,
            speakPrompt: v.en,
            speakAfter: v.de,
            options: buildOptions(v.de, data.vocabulary.map((x) => x.de), 4),
            correctAnswer: v.de,
            source: 'vocab-translation',
          })
        );
        break;
      default:
        break;
    }
  }
  return shuffleArray(out); // interleave pools, shuffle deck order
}

export function A1CheckpointPage() {
  const { unitIndex: rawIndex } = useParams<{ unitIndex: string }>();
  const unitIndex = useMemo(() => {
    const parsed = parseInt(rawIndex ?? '0', 10);
    const safe = Number.isFinite(parsed) ? parsed : 0;
    return Math.max(0, Math.min(safe, A1_UNITS.length - 1));
  }, [rawIndex]);

  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { markCheckpointResult, isUnitUnlocked, isCheckpointComplete } = useA1Path();

  const unit = A1_UNITS[unitIndex];
  const unlocked = isUnitUnlocked(unitIndex);
  const alreadyPassed = isCheckpointComplete(unitIndex);

  const [phase, setPhase] = useState<'loading' | 'ready' | 'playing'>('loading');
  const [questions, setQuestions] = useState<CheckpointQuestion[]>([]);
  /** Increments on retry so the deck-build effect re-runs with a fresh draw. */
  const [runId, setRunId] = useState(0);

  // ---- Lesson Engine session (owns lock/score/reporting) ----
  const session = useExerciseSession<CheckpointQuestion>({
    questions,
    module: 'a1-checkpoint',
    getOptions: (q) => q.options,
  });
  const { index, answered, score, results } = session;

  // Guard so markCheckpointResult fires exactly once per run.
  const recordedRef = useRef(false);
  useEffect(() => {
    if (
      phase === 'playing' &&
      questions.length > 0 &&
      answered >= questions.length &&
      !recordedRef.current
    ) {
      recordedRef.current = true;
      markCheckpointResult(unitIndex, questions.length > 0 ? score / questions.length : 0);
    }
  }, [phase, answered, questions.length, score, unitIndex, markCheckpointResult]);

  useEffect(() => {
    if (!unlocked) {
      setPhase('ready');
      return;
    }
    let cancelled = false;
    const build = async () => {
      const specs = unit.checkpoint.specs;
      const needed = new Set(specs.map((s) => s.type));
      const grammarCategories = ['sein', 'haben', 'weakVerb', 'cases'];
      const data: LoadedData = {
        greetings: needed.has('greeting-translation') ? await curriculumService.getGreetings() : [],
        numbers: needed.has('number-conversion') ? await curriculumService.getNumbers() : [],
        alphabet: needed.has('alphabet-letter') ? await curriculumService.getAlphabet() : [],
        articles: needed.has('article-precision') ? await curriculumService.getArticles() : [],
        calendar: needed.has('calendar-translation') ? await curriculumService.getCalendar() : [],
        vocabulary: needed.has('vocab-translation') ? await curriculumService.getVocabulary() : [],
        grammar: needed.has('grammar-drill')
          ? (await Promise.all(grammarCategories.map((c) => curriculumService.getGrammarDrills(c)))).reduce(
              (acc, drills, i) => {
                acc[grammarCategories[i]!] = drills;
                return acc;
              },
              {} as Record<string, GrammarDrill[]>
            )
          : {},
      };
      const deck = buildQuestions(specs, data, unitIndex);
      if (!cancelled) {
        setQuestions(deck);
        setPhase('ready');
      }
    };
    void build();
    return () => {
      cancelled = true;
    };
  }, [unlocked, unitIndex, unit.checkpoint.specs, runId]);

  const startRun = useCallback(() => {
    recordedRef.current = false;
    setPhase('playing');
  }, []);

  const retry = useCallback(() => {
    setQuestions([]);
    setPhase('loading');
    setRunId((r) => r + 1); // fresh without-replacement draw
  }, []);

  const total = questions.length;
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  const passed = percent >= Math.round(CHECKPOINT_PASS_THRESHOLD * 100);
  const finished = phase === 'playing' && total > 0 && answered >= total;

  const missedItems = useMemo(
    () =>
      questions
        .map((q) => ({ q, correct: results[q.key] }))
        .filter((entry): entry is { q: CheckpointQuestion; correct: boolean } =>
          entry.correct === false
        ),
    [questions, results]
  );

  // ---- Locked (soft-lock) screen ----
  if (!unlocked) {
    const prereq = unitIndex - 1;
    return (
      <div className={theme.page.container}>
        <div className={theme.panel.surface}>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {isDE ? unit.title.de : unit.title.en}
          </h1>
          <div className="mt-4 text-center">
            <span className="text-4xl" aria-hidden="true">🔒</span>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              {isDE
                ? `Dieser Puffer ist gesperrt. Bestehe Puffer ${prereq + 1}, um diese Einheit freizuschalten.`
                : `This checkpoint is locked. Pass checkpoint ${prereq + 1} to unlock this unit.`}
            </p>
            <Link to="/learn" className={`${theme.button.primary} mt-4 inline-flex min-h-[44px]`}>
              {isDE ? 'Zurück zum Lernpfad' : 'Back to learning path'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---- Loading ----
  if (phase === 'loading' || (phase === 'ready' && questions.length === 0)) {
    return (
      <div className={theme.page.container}>
        <div className="text-center text-slate-500 dark:text-slate-400">
          {isDE ? 'Fragen werden geladen…' : 'Loading checkpoint questions…'}
        </div>
      </div>
    );
  }

  // ---- Ready / start ----
  if (phase === 'ready') {
    return (
      <div className={theme.page.container}>
        <div className={theme.panel.surface}>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {isDE ? unit.title.de : unit.title.en}
            <span className="ml-2 text-base font-medium text-slate-500 dark:text-slate-400">
              ({isDE ? unit.theme.de : unit.theme.en})
            </span>
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {isDE
              ? `${total} Aufgaben · brauche ${Math.round(CHECKPOINT_PASS_THRESHOLD * 100)}% zum Bestehen`
              : `${total} questions · need ${Math.round(CHECKPOINT_PASS_THRESHOLD * 100)}% to pass`}
          </p>
          {alreadyPassed && (
            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
              {isDE ? 'Bereits bestanden ✓' : 'Already passed ✓'}
            </p>
          )}
          {unitIndex === 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <GenderBadge article="der" />
              <GenderBadge article="die" />
              <GenderBadge article="das" />
              <GenderBadge article="plural" />
            </div>
          )}
          <button
            type="button"
            onClick={startRun}
            className={`${theme.button.primary} mt-6 w-full text-lg`}
          >
            {isDE ? 'Puffer starten' : 'Start checkpoint'}
          </button>
          <Link to="/learn" className={`${theme.button.secondary} mt-3 w-full text-center`}>
            {isDE ? 'Zurück zum Lernpfad' : 'Back to learning path'}
          </Link>
        </div>
      </div>
    );
  }

  // ---- Finished / result ----
  if (finished) {
    return (
      <div className={theme.page.container}>
        <div className={theme.panel.surface}>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {isDE ? unit.title.de : unit.title.en}
          </h1>
          <div
            className={`mt-4 text-center ${passed ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}
          >
            <div className="text-3xl font-bold">{percent}%</div>
            <p className="mt-1">
              {passed
                ? isDE
                  ? '✅ Puffer bestanden!'
                  : '✅ Checkpoint passed!'
                : isDE
                  ? '❌ Noch nicht bestanden — übe die Fehler.'
                  : '❌ Not passed — review your mistakes.'}
            </p>
          </div>

          {missedItems.length > 0 && (
            <div className="mt-4 space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isDE ? 'Fehleranalyse' : 'Mistakes to review'}
              </h2>
              {missedItems.map(({ q }) => (
                <div
                  key={q.key}
                  className="rounded-lg bg-red-50 p-3 text-xs dark:bg-red-950/30"
                >
                  <div className="font-medium text-slate-700 dark:text-slate-300">
                    {q.prompt} → {q.correctAnswer}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 grid gap-2">
            <button type="button" onClick={retry} className={`${theme.button.primary} w-full`}>
              {isDE ? 'Erneut versuchen' : 'Retry'}
            </button>
            <Link to="/learn" className={`${theme.button.secondary} w-full text-center`}>
              {isDE ? 'Zurück zum Lernpfad' : 'Back to map'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---- Playing (engine-driven) ----
  return (
    <div className={theme.page.container}>
      <MultipleChoice
        session={session}
        renderPrompt={(q) => (
          <>
            {q.prompt}
            {q.source === 'article-precision' && (
              <span className="ml-2 align-top">
                <GenderBadge article={q.article ?? 'der'} dot labeled={false} />
              </span>
            )}
          </>
        )}
        hideFooter
        hintReason={session.current?.source}
      />
      {/* Footer with Back + engine-driven Next/Finish */}
      <div className="mx-auto mt-3 flex max-w-3xl justify-between gap-2 px-1">
        <Link to="/learn" className={theme.button.secondary}>
          {isDE ? 'Zurück' : 'Back'}
        </Link>
        {session.locked && (
          <button type="button" onClick={session.next} className={theme.button.primary}>
            {index >= total - 1 ? (isDE ? 'Fertig' : 'Finish') : isDE ? 'Weiter' : 'Next'}
          </button>
        )}
      </div>
    </div>
  );
}