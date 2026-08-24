/**
 * src/pages/VocabTrainerPage.tsx
 *
 * Leveled / topical vocabulary trainer drawing from the FULL live
 * `vocabulary` table (~1000 rows) via curriculumService.getVocabularyFiltered()
 * (RPC get_random_vocabulary with level/category params, migration 015).
 *
 * Drill modes:
 *   - Flashcards: tap to flip DE → EN + Nepali (Devanagari + romanized).
 *     Reuses the FlipCard interaction model (real <button>, aria-pressed,
 *     no focus side-effects). TTS speaks the German word on reveal.
 *   - Quiz: German → English MCQ. Options shuffled at question create,
 *     without-replacement session pool (pickNUnique).
 *
 * Integration:
 *   - Wrong answers → addWrongAnswer({ moduleType: 'vocab-trainer' }) → SRS queue.
 *   - Correct quiz answers → reportAnswer XP.
 *   - Nur-DE mode hides EN/NE helper lines (C1.5) but stays playable.
 */
import { useCallback, useEffect, useState } from 'react';
import { Layers, ListChecks, Volume2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { theme } from '../config/theme';
import { usePageTitle } from '../hooks/usePageTitle';
import { useLang } from '../hooks/useLang';
import { useXp } from '../hooks/useXp';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { speakWord } from '../hooks/useSpeech';
import { curriculumService } from '../services';
import { pickNUnique } from '../utils/questionGenerator';
import type { VocabCard } from '../types';
import type { VocabularyFilterOptions } from '../types/curriculum';

type TrainerMode = 'flashcards' | 'quiz';
type PosFilter = '' | 'noun' | 'verb' | 'adjective' | 'phrase';

/** Gender color token lookup (theme.ts locked tokens — no one-off hexes). */
function genderToken(article: string | null): { text: string; label: string } {
  if (article === 'der') return { text: theme.gender.der.text, label: 'der' };
  if (article === 'die') return { text: theme.gender.dieF.text, label: 'die' };
  if (article === 'das') return { text: theme.gender.das.text, label: 'das' };
  return { text: '', label: '' };
}

const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const;
const POS_OPTIONS: { value: PosFilter; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'noun', label: 'Nouns' },
  { value: 'verb', label: 'Verbs' },
  { value: 'adjective', label: 'Adjectives' },
  { value: 'phrase', label: 'Phrases' },
];

interface McqQuestion {
  card: VocabCard;
  options: string[];
  correctIndex: number;
}

export function VocabTrainerPage() {
  usePageTitle('Vocab Trainer');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { reportAnswer } = useXp();
  const { addWrongAnswer } = useReviewQueue();

  // ── Filters ────────────────────────────────────────────────────────────
  const [level, setLevel] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [pos, setPos] = useState<PosFilter>('');
  const [options, setOptions] = useState<VocabularyFilterOptions>({ levels: [], categories: [] });

  useEffect(() => {
    let cancelled = false;
    curriculumService.getVocabFilterOptions().then((opts) => {
      if (!cancelled) setOptions(opts);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Session state ──────────────────────────────────────────────────────
  const [mode, setMode] = useState<TrainerMode>('flashcards');
  const [loading, setLoading] = useState(false);
  const [pool, setPool] = useState<VocabCard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [finished, setFinished] = useState(false);

  const current = pool[index] ?? null;

  /** Build one MCQ question: correct answer + 3 distractors from the pool. */
  const buildQuestion = useCallback(
    (card: VocabCard, all: VocabCard[]): McqQuestion => {
      const distractorPool = all.filter((c) => c.id !== card.id && c.translation.en !== card.translation.en);
      const distractors = pickNUnique({
        items: distractorPool.map((c) => c.translation.en),
        count: 3,
      });
      const opts = [...distractors, card.translation.en];
      // Shuffle at question create; stable afterwards (locked rule C2.9).
      for (let i = opts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [opts[i], opts[j]] = [opts[j], opts[i]];
      }
      return { card, options: opts, correctIndex: opts.indexOf(card.translation.en) };
    },
    []
  );

  const [question, setQuestion] = useState<McqQuestion | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  /** Start a session with the current filters. */
  const startSession = useCallback(async () => {
    setLoading(true);
    setFinished(false);
    setScore({ correct: 0, total: 0 });
    setFlipped(false);
    setSelected(null);
    try {
      const cards = await curriculumService.getVocabularyFiltered({
        pos: pos || undefined,
        level: level ? (level as VocabCard['cefrLevel']) : undefined,
        category: category || undefined,
        limit: 20,
      });
      setPool(cards);
      setIndex(0);
      if (mode === 'quiz' && cards.length > 0) {
        setQuestion(buildQuestion(cards[0], cards));
      } else {
        setQuestion(null);
      }
    } finally {
      setLoading(false);
    }
  }, [pos, level, category, mode, buildQuestion]);

  /** Advance to the next card/question or finish the session. */
  const advance = useCallback(
    (wasCorrect?: boolean) => {
      if (wasCorrect !== undefined) {
        setScore((s) => ({ correct: s.correct + (wasCorrect ? 1 : 0), total: s.total + 1 }));
      }
      const next = index + 1;
      if (next >= pool.length) {
        setFinished(true);
        return;
      }
      setIndex(next);
      setFlipped(false);
      setSelected(null);
      if (mode === 'quiz') {
        setQuestion(buildQuestion(pool[next], pool));
      }
    },
    [index, pool, mode, buildQuestion]
  );

  const handleQuizAnswer = useCallback(
    (choiceIdx: number) => {
      if (!question || selected !== null) return;
      setSelected(choiceIdx);
      const correct = choiceIdx === question.correctIndex;
      reportAnswer({ correct, module: 'vocab-trainer' });
      if (!correct) {
        addWrongAnswer({
          moduleType: 'vocab-trainer',
          itemKey: `${question.card.id}|${question.card.partOfSpeech}`,
          userAnswer: question.options[choiceIdx],
          correctAnswer: question.card.translation.en,
        });
      }
      // Brief feedback pause so the user sees right/wrong before advancing.
      setTimeout(() => advance(correct), 900);
    },
    [question, selected, reportAnswer, addWrongAnswer, advance]
  );

  const handleFlip = useCallback(() => {
    const next = !flipped;
    setFlipped(next);
    if (next && current) speakWord(current.lemma);
  }, [flipped, current]);

  const reset = useCallback(() => {
    setPool([]);
    setIndex(0);
    setFinished(false);
    setFlipped(false);
    setSelected(null);
    setQuestion(null);
  }, []);

  const hasFilters = Boolean(level || category || pos);
  const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;

  // ── Render helpers ─────────────────────────────────────────────────────
  const chip = (active: boolean) =>
    `min-h-[44px] rounded-full px-4 py-2 text-sm font-semibold transition active:scale-95 ${
      active
        ? 'bg-blue-600 text-white shadow-sm'
        : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
    }`;

  const articleBadge = current?.article ? genderToken(current.article) : null;

  return (
    <div className={theme.page.container}>
      <h1 className={theme.page.heading}>Vocab Trainer</h1>
      <p className={theme.page.description}>
        {isDE
          ? 'Wortschatz nach Niveau und Thema üben.'
          : 'Practice vocabulary by level and topic — drawn live from the full word pool.'}
      </p>

      {/* ── Filter bar ─────────────────────────────────────────────── */}
      <div className={`${theme.panel.surface} space-y-3`}>
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {isDE ? 'Niveau' : 'Level'}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(!level)} onClick={() => setLevel('')}>
              All
            </button>
            {(options.levels.length > 0 ? options.levels : [...LEVELS]).map((lv) => (
              <button key={lv} type="button" className={chip(level === lv)} onClick={() => setLevel(lv)}>
                {lv}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {isDE ? 'Wortart' : 'Word type'}
          </div>
          <div className="flex flex-wrap gap-2">
            {POS_OPTIONS.map((p) => (
              <button key={p.value} type="button" className={chip(pos === p.value)} onClick={() => setPos(p.value)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {options.categories.length > 0 && (
          <div>
            <label
              htmlFor="vt-category"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400"
            >
              {isDE ? 'Thema' : 'Topic'}
            </label>
            <select
              id="vt-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-slate-200 bg-white p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">{isDE ? 'Alle Themen' : 'All topics'}</option>
              {options.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Mode toggle */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {(
            [
              { value: 'flashcards', label: isDE ? 'Karteikarten' : 'Flashcards', icon: Layers },
              { value: 'quiz', label: isDE ? 'Quiz' : 'Quiz', icon: ListChecks },
            ] as { value: TrainerMode; label: string; icon: LucideIcon }[]
          ).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                reset();
              }}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition active:scale-95 ${
                mode === value
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          ))}

          <button
            type="button"
            onClick={startSession}
            disabled={loading}
            className={`${theme.button.primary} min-h-[44px] ml-auto`}
          >
            {loading ? '…' : finished || pool.length > 0 ? (isDE ? 'Neu starten' : 'Restart') : isDE ? 'Starten' : 'Start'}
          </button>
        </div>
      </div>

      {/* ── Empty state ────────────────────────────────────────────── */}
      {!loading && pool.length === 0 && !finished && (
        <div className={`${theme.panel.muted} mt-4 text-center text-sm text-slate-500 dark:text-slate-400`}>
          {isDE
            ? 'Wähle Filter und tippe auf Starten, um eine Übungssitzung zu beginnen.'
            : 'Pick your filters and hit Start to begin a practice session.'}
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────── */}
      {loading && (
        <div className={`${theme.panel.muted} mt-4 animate-pulse text-center text-sm text-slate-500`}>
          {isDE ? 'Lade Wörter…' : 'Loading words…'}
        </div>
      )}

      {/* ── Session summary ────────────────────────────────────────── */}
      {finished && (
        <div className={`${theme.panel.accent} mt-4 text-center`}>
          <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">{pct}%</div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {score.correct}/{score.total}{' '}
            {isDE ? 'richtig' : 'correct'} · {mode === 'flashcards' ? (isDE ? 'Karteikarten' : 'Flashcards') : 'Quiz'}
          </p>
          <button type="button" onClick={reset} className={`${theme.button.secondary} mt-4 min-h-[44px]`}>
            {isDE ? 'Zurück zu den Filtern' : 'Back to filters'}
          </button>
        </div>
      )}

      {/* ── Flashcard drill ────────────────────────────────────────── */}
      {mode === 'flashcards' && current && !finished && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>
              {index + 1} / {pool.length}
            </span>
            <span className="uppercase tracking-wider">{current.cefrLevel}</span>
          </div>

          <button
            type="button"
            onClick={handleFlip}
            aria-pressed={flipped}
            aria-label={flipped ? 'Show German word' : 'Reveal translation'}
            className="relative block w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm transition-all duration-300 hover:shadow-md active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900"
            style={{ minHeight: 220 }}
          >
            {!flipped ? (
              <span className="block">
                {articleBadge && (
                  <span className={`mr-2 align-middle text-lg font-bold ${articleBadge.text}`}>
                    {articleBadge.label}
                  </span>
                )}
                <span className="align-middle text-3xl font-bold text-slate-900 dark:text-white">{current.lemma}</span>
                <span className="mt-3 block text-xs uppercase tracking-wider text-slate-400">
                  {current.partOfSpeech} · {isDE ? 'Tippen zum Umdrehen' : 'Tap to reveal'}
                </span>
              </span>
            ) : (
              <span className="block">
                <span className="block text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {current.translation.en}
                </span>
                {!isDE && current.translation.np && (
                  <span className="mt-3 block text-xl font-semibold text-slate-800 dark:text-slate-100">
                    {current.translation.np}
                  </span>
                )}
                {!isDE && current.translationNeRoman && (
                  <span className="mt-1 block text-sm italic text-slate-500 dark:text-slate-400">
                    ({current.translationNeRoman})
                  </span>
                )}
                {current.examples[0]?.de && (
                  <span className="mt-4 block border-t border-slate-100 pt-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
                    {current.examples[0].de}
                  </span>
                )}
              </span>
            )}
          </button>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => current && speakWord(current.lemma)}
              className={`${theme.button.icon} min-h-[44px]`}
              aria-label={`Speak ${current.lemma}`}
            >
              <Volume2 className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => advance()} className={`${theme.button.primary} min-h-[44px] flex-1`}>
              {isDE ? 'Weiter' : 'Next'} →
            </button>
          </div>
        </div>
      )}

      {/* ── Quiz drill ─────────────────────────────────────────────── */}
      {mode === 'quiz' && question && !finished && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>
              {index + 1} / {pool.length}
            </span>
            <span>
              {score.correct}/{score.total}
            </span>
          </div>

          <div className={`${theme.panel.surface} text-center`}>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {isDE ? 'Was bedeutet dieses Wort?' : 'What does this mean?'}
            </div>
            <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{question.card.lemma}</div>
            <div className="mt-1 text-xs uppercase tracking-wider text-slate-400">{question.card.partOfSpeech}</div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {question.options.map((opt, i) => {
              const isCorrect = i === question.correctIndex;
              const isPicked = i === selected;
              const revealed = selected !== null;
              return (
                <button
                  key={`${question.card.id}-${i}`}
                  type="button"
                  onClick={() => handleQuizAnswer(i)}
                  disabled={revealed}
                  className={`min-h-[56px] rounded-2xl border-2 p-4 text-left text-base font-semibold transition active:scale-95 ${
                    revealed && isCorrect
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                      : revealed && isPicked
                        ? 'border-red-500 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Offline hint when a filtered session comes back empty */}
      {!loading && hasFilters && pool.length === 0 && !finished && (
        <p className="mt-3 text-center text-xs text-slate-400">
          {isDE
            ? 'Keine Treffer — versuche andere Filter (offline? Cache füllt sich beim ersten Online-Besuch).'
            : 'No matches — try different filters (offline? the cache fills on your first online visit).'}
        </p>
      )}
    </div>
  );
}