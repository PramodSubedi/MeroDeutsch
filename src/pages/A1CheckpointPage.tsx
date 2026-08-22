/**
 * src/pages/A1CheckpointPage.tsx
 *
 * A1 unit checkpoint quiz (10-15 items), additive. Locked rules (C/D):
 *  - 10-15 items drawn from the unit's real curriculumService loaders.
 *  - pickNUnique -> no repeats until the pool cycles (without replacement).
 *  - Options shuffled AT creation; stable after the question locks.
 *  - >=80% passes (advances unlockedUnitIndex, persists best score).
 *  - <80%: score shown, Retry (anytime, no cooldown), Back to map.
 *  - Misses queued via the REAL addWrongAnswer (moduleType 'a1-checkpoint').
 *  - Correct answers award XP via reportAnswer (existing XpContext -> toast).
 *  - TTS safety (C6): "Hear" speaks ONLY the prompt before the question locks;
 *    the answer is spoken only AFTER the answer is locked.
 *  - Level-ups render as non-blocking toasts (Layout treats /checkpoint as a
 *    quiz route).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useLang } from '../hooks/useLang';
import { useA1Path } from '../hooks/useA1Path';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { useXp } from '../hooks/useXp';
import { speakText } from '../hooks/useSpeech';
import { curriculumService } from '../services';
import { CHECKPOINT_PASS_THRESHOLD, A1_UNITS, type CheckpointSource, type Article } from '../data/a1Path';
import { pickNUnique } from '../utils/questionGenerator';
import { shuffleArray } from '../utils/shuffleArray';
import type { AlphabetItem, ArticleItem, CalendarItem, GreetingItem, NumberItem, VocabEntry } from '../types';
import type { GrammarDrill } from '../types/curriculum';
import { theme } from '../config/theme';
import { GenderBadge } from '../components/ui/GenderBadge';

export interface CheckpointQuestion {
  key: string;
  prompt: string;
  /** TTS-safe prompt text (never the answer) — spoken before the question locks. */
  speakPrompt: string;
  /** What to speak after the answer is locked (the full answer). */
  speakAfter: string;
  options: string[];
  correctAnswer: string;
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
  return shuffleArray([correct, ...chosen]);
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
            options: buildOptions(a.art, ['der', 'die', 'das'], 3),
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
            options: shuffleArray([...g.options]),
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
  const navigate = useNavigate();
  const { addWrongAnswer } = useReviewQueue();
  const { reportAnswer } = useXp();
  const { markCheckpointResult, isUnitUnlocked, isCheckpointComplete } = useA1Path();

  const unit = A1_UNITS[unitIndex];
  const unlocked = isUnitUnlocked(unitIndex);
  const alreadyPassed = isCheckpointComplete(unitIndex);

  const [phase, setPhase] = useState<'loading' | 'ready' | 'playing' | 'finished'>('loading');
  const [questions, setQuestions] = useState<CheckpointQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [score, setScore] = useState(0);
  /** Increments on retry so the deck-build effect re-runs with a fresh draw. */
  const [runId, setRunId] = useState(0);

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

  const finish = useCallback(() => {
    const total = questions.length;
    const fraction = total > 0 ? score / total : 0;
    markCheckpointResult(unitIndex, fraction);
    setPhase('finished');
  }, [questions, score, unitIndex, markCheckpointResult]);

  useEffect(() => {
    if (phase === 'playing' && idx >= questions.length && questions.length > 0) {
      finish();
    }
  }, [phase, idx, questions, finish]);

  const handleAnswer = useCallback(
    (q: CheckpointQuestion, choice: string) => {
      if (selected !== null) return;
      const correct = choice === q.correctAnswer;
      setSelected(choice);
      setAnswers((prev) => ({ ...prev, [idx]: choice }));
      if (correct) {
        setScore((s) => s + 1);
        reportAnswer({ correct: true, module: 'a1-checkpoint' });
      } else {
        addWrongAnswer({
          moduleType: 'a1-checkpoint',
          itemKey: q.key,
          userAnswer: choice,
          correctAnswer: q.correctAnswer,
        });
      }
    },
    [selected, idx, reportAnswer, addWrongAnswer]
  );

  const next = useCallback(() => {
    setSelected(null);
    setIdx((i) => i + 1);
  }, []);

  const total = questions.length;
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  const passed = percent >= Math.round(CHECKPOINT_PASS_THRESHOLD * 100);

  const missedItems = Object.entries(answers)
    .map(([k, v]) => {
      const q = questions[Number(k)];
      return q && v !== q.correctAnswer ? { i: Number(k), q, userAnswer: v } : null;
    })
    .filter(Boolean) as { i: number; q: CheckpointQuestion; userAnswer: string }[];

  const onStart = () => setPhase('playing');
  const current = questions[idx];

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
            onClick={onStart}
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
  if (phase === 'finished') {
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
              {missedItems.map(({ q, userAnswer }) => (
                <div
                  key={q.key}
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs dark:border-red-900/50 dark:bg-red-950/30"
                >
                  <div className="font-medium text-slate-700 dark:text-slate-300">
                    {q.prompt} → {q.correctAnswer}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">
                    {isDE ? 'Deine Antwort' : 'Your answer'}: {userAnswer}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 grid gap-2">
            <button
              type="button"
              onClick={() => {
                setPhase('loading');
                setIdx(0);
                setSelected(null);
                setAnswers({});
                setScore(0);
                setQuestions([]);
                setRunId((r) => r + 1); // fresh without-replacement draw
              }}
              className={`${theme.button.primary} w-full`}
            >
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

  // ---- Playing ----
  if (!current) {
    return null;
  }
  const locked = selected !== null;
  const isCorrect = locked && selected === current.correctAnswer;

  return (
    <div className={theme.page.container}>
      <div className={theme.panel.surface}>
        <div className="mb-4 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>
            {isDE ? 'Frage' : 'Question'} {idx + 1} / {total}
          </span>
          <span>
            {isDE ? 'Punkte' : 'Score'}: {score}
          </span>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isDE ? 'Stimme' : 'Prompt'}
            </div>
            <div className="mt-1 break-words text-2xl font-bold text-slate-900 dark:text-white">
              {current.prompt}
              {current.source === 'article-precision' && (
                <span className="ml-2 align-top">
                  <GenderBadge article={current.article ?? 'der'} dot labeled={false} />
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => speakText(current.speakPrompt, 0.9)}
            className={theme.button.icon}
            aria-label={isDE ? 'Aussprache des Prompts' : 'Hear the prompt'}
            title={isDE ? 'Prompt (nicht die Antwort)' : 'Prompt only — not the answer'}
          >
            🔊
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {current.options.map((opt) => {
            const chosen = locked && selected === opt;
            const isAnswer = opt === current.correctAnswer;
            const bg =
              locked && isAnswer
                ? 'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                : chosen
                  ? 'border-red-300 bg-red-100 text-red-900 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300'
                  : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
            return (
              <button
                key={opt}
                type="button"
                disabled={locked}
                onClick={() => handleAnswer(current, opt)}
                className={`min-h-[44px] rounded-xl border px-4 py-3 text-left text-sm font-semibold transition active:scale-95 disabled:opacity-70 ${bg}`}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {locked && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
            {isCorrect
              ? isDE
                ? '🎉 Richtig!'
                : '🎉 Correct!'
              : isDE
                ? '✅ Richtig: '
                : '✅ Correct: '}
            {locked && !isCorrect ? current.correctAnswer : null}
            <button
              type="button"
              onClick={() => speakText(current.speakAfter, 0.85)}
              className={theme.button.icon + ' mt-2'}
              aria-label={isDE ? 'Antwort anhören' : 'Hear the answer'}
            >
              🔊 {isDE ? 'Antwort' : 'Answer'}
            </button>
          </div>
        )}

        <div className="mt-6 flex justify-between gap-2">
          <button type="button" onClick={() => navigate('/learn')} className={theme.button.secondary}>
            {isDE ? 'Zurück' : 'Back'}
          </button>
          {locked && idx < total - 1 && (
            <button type="button" onClick={next} className={theme.button.primary}>
              {isDE ? 'Weiter' : 'Next'}
            </button>
          )}
          {locked && idx === total - 1 && (
            <button type="button" onClick={finish} className={theme.button.primary}>
              {isDE ? 'Fertig' : 'Finish'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
