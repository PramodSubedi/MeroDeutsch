import { useMemo, useState, useEffect } from 'react';
import { curriculumService } from '../services';
import type { VocabEntry, AlphabetItem, NumberItem } from '../types';
import { speakWord } from '../hooks/useSpeech';
import { useLang } from '../hooks/useLang';
import { useAchievements } from '../hooks/useAchievements';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { useXp } from '../hooks/useXp';
import { getItem, setItem } from '../utils/safeStorage';
import { useAuth } from '../hooks/useAuth';
import { theme } from '../config/theme';
import { buildMcq } from '../utils/questionGenerator';
import { pickWordOfDay } from '../utils/wordOfDay';
import { ContentPending } from './common/LoadingBlock';

// Article mapping for common German nouns
const articleMap: Record<string, string> = {
  'Mutter': 'die', 'Vater': 'der', 'Bruder': 'der', 'Schwester': 'die',
  'Kind': 'das', 'Familie': 'die', 'Freund': 'der', 'Freundin': 'die',
  'Tag': 'der', 'Woche': 'die', 'Monat': 'der', 'Jahr': 'das',
  'Haus': 'das', 'Auto': 'das', 'Buch': 'das', 'Tisch': 'der',
  'Stuhl': 'der', 'Brot': 'das', 'Wasser': 'das', 'Kaffee': 'der',
  'Tee': 'der', 'Milch': 'die', 'Apfel': 'der', 'Banane': 'die',
  'Stadt': 'die', 'Land': 'das', 'Mensch': 'der', 'Mann': 'der', 'Frau': 'die',
};

function getGermanWithArticle(word: string): string {
  const article = articleMap[word];
  return article ? `${article} ${word}` : word;
}

const KEY = 'meroDeutschLastDailyChallenge';
type QA = { prompt: string; options: string[]; correct: string };
const daySeed = () => {
  const d = new Date();
  const s = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h << 5) - h + s.charCodeAt(i);
      return Math.abs(h);
};

// Seeded one-element picker (no replacement) used by the daily-challenge quiz.
const pick = <T,>(arr: T[], seed: number): T => arr[seed % arr.length];

function buildQuestions(
  seed: number,
  vocabularyData: VocabEntry[],
  alphabetData: AlphabetItem[],
  numbersData: NumberItem[]
): QA[] {
  const out: QA[] = [];

  // Empty-pool safe: skip a question type when its dynamic pool hasn't
  // loaded yet (e.g. content_items not seeded / offline first run).
  if (vocabularyData.length > 0) {
    const vw = pick(vocabularyData, seed);
    out.push({
      prompt: `What does "${vw.de}" mean?`,
      options: buildMcq({
        correctItem: vw,
        allItems: vocabularyData,
        getKey: (x) => x.id,
        count: 4,
        seed,
      }).map((x) => x.en),
      correct: vw.en,
    });
  }

  if (alphabetData.length > 0) {
    const al = pick(alphabetData, seed + 1);
    out.push({
      prompt: `How is "${al.letter.split(' ')[0]}" pronounced?`,
      options: buildMcq({
        correctItem: al,
        allItems: alphabetData,
        getKey: (x) => x.id,
        count: 4,
        seed: seed + 1,
      }).map((x) => x.gerPhonetic),
      correct: al.gerPhonetic,
    });
  }

  if (numbersData.length > 0) {
    const num = pick(numbersData, seed + 2);
    out.push({
      prompt: `Which German number is "${num.n}"?`,
      options: buildMcq({
        correctItem: num,
        allItems: numbersData,
        getKey: (x) => String(x.n),
        count: 4,
        seed: seed + 2,
      }).map((x) => x.de),
      correct: num.de,
    });
  }
  return out;
}

interface DailyChallengeProps {
  variant?: 'normal' | 'compact';
}

export function DailyChallenge({ variant = 'normal' }: DailyChallengeProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const isCompact = variant === 'compact';
  const { unlockBadge } = useAchievements();
  const { addWrongAnswer } = useReviewQueue();
  const { reportAnswer } = useXp();
  const { isAuthenticated } = useAuth();
  const seed = useMemo(daySeed, []);

  // State for data from curriculumService
  const [vocabularyData, setVocabularyData] = useState<VocabEntry[]>([]);
  const [alphabetData, setAlphabetData] = useState<AlphabetItem[]>([]);
  const [numbersData, setNumbersData] = useState<NumberItem[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Fetch data from curriculumService
  useEffect(() => {
    const loadData = async () => {
      const [vocabCards, alpha, nums] = await Promise.all([
                curriculumService.getVocabularyFiltered({ limit: 2000 }),
        curriculumService.getAlphabet(),
        curriculumService.getNumbers(),
      ]);
            // Map VocabCard[] to VocabEntry[] shape for compatibility with existing state.
      // Deduplicate by lemma and drop rows with no English gloss: the larger
      // full-pool deck can contain duplicates / incomplete rows that would
      // otherwise surface identical MCQ options or a blank "correct" answer.
      const seen = new Set<string>();
      const vocab: VocabEntry[] = [];
      for (const c of vocabCards) {
        const de = c.lemma ?? '';
        const en = c.translation?.en ?? '';
        const key = de.trim().toLowerCase();
        if (!key || !en.trim() || seen.has(key)) continue;
        seen.add(key);
        vocab.push({
          id: c.id,
          de,
          en,
          ne: c.translation?.np ?? '',
          tags: c.tags ?? [],
          level: 'A1',
        });
      }
      setVocabularyData(vocab);
      setAlphabetData(alpha);
      setNumbersData(nums);
      setDataLoaded(true);
    };
    loadData();
  }, []);

    // Empty-pool safe: wordOfDay stays null until the vocab pool has rows.
  // Uses the SAME deterministic selector as utils/wordOfDay so "Word of the Day"
  // is identical across surfaces. The pool is fetched via getVocabularyFiltered({ limit: 2000 })
  // (word-ordered `get_vocabulary_glossary`), so this is stable across refreshes.
  const wordOfDay = useMemo(
    () => (dataLoaded && vocabularyData.length > 0 ? pickWordOfDay(vocabularyData, (v) => v.id ?? v.de) : null),
    [vocabularyData, dataLoaded]
  );
  const questions = useMemo(() => dataLoaded ? buildQuestions(seed, vocabularyData, alphabetData, numbersData) : [],
    [seed, vocabularyData, alphabetData, numbersData, dataLoaded]);

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [started, setStarted] = useState(false);
  const done = getItem(KEY) === new Date().toDateString();
  const count = Object.keys(answers).length;
  const allOk = questions.every((q, i) => answers[i] === q.correct);
  const challengeComplete = done || count === questions.length;

  // Collapsible WOTD state
  const [isExpanded, setIsExpanded] = useState(() => !done);
  const [showTranslation, setShowTranslation] = useState(false);
  const expandTimer = useMemo(() => {
    if (done) return undefined;
    return setTimeout(() => setIsExpanded(false), 5500);
  }, [done]);

  useEffect(() => {
    return () => clearTimeout(expandTimer);
  }, [expandTimer]);

  const choose = (qi: number, opt: string) => {
    const isFirstSelection = answers[qi] === undefined;
    const next = { ...answers, [qi]: opt };
    setAnswers(next);
    // Wire to XP + review queue on first selection, consistent with sibling
    // quiz modules (AlphabetQuiz, Numbers, etc.).
    if (isFirstSelection) {
      const q = questions[qi];
      if (q) {
        if (opt === q.correct) {
          reportAnswer({ correct: true, module: 'daily-challenge' });
        } else {
          addWrongAnswer({
            moduleType: 'daily-challenge',
            itemKey: q.prompt,
            userAnswer: opt,
            correctAnswer: q.correct,
          });
        }
      }
    }
    // Collapse the panel after all questions are answered, regardless of correctness
    if (Object.keys(next).length === questions.length && !done) {
      if (questions.every((q, i) => next[i] === q.correct)) {
        setItem(KEY, new Date().toDateString());
        unlockBadge('daily_challenger');
      }
      setIsExpanded(false);
    }
  };

  if (!dataLoaded) {
    return (
      <div className={`${theme.panel.surface} mb-6`} role="status" aria-live="polite">
        Loading…
      </div>
    );
  }

  // Pool empty (not seeded yet / offline before first fetch) — friendly state,
  // never a crash and never an eternal spinner.
  if (!wordOfDay || questions.length === 0) {
    return (
      <div className={`${theme.panel.surface} mb-6`}>
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white mb-2">
          {isDE ? 'Wort des Tages' : 'Word of the Day'} 🗓️
        </h2>
        <ContentPending isDE={isDE} className="" />
      </div>
    );
  }

  return (
    <div className={`${isCompact ? 'rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-900 mb-4' : `${theme.panel.surface} mb-6`}`}>
      <div className={`${isCompact ? 'flex flex-row items-center justify-between gap-3' : 'mb-4 flex flex-wrap items-start gap-4'}`}>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={`${isCompact ? 'text-sm font-bold text-slate-800 dark:text-slate-200' : 'text-lg font-semibold text-slate-950 dark:text-white mb-2'}`}>
              {isDE ? 'Wort des Tages' : 'Word of the Day'} 🗓️
            </h2>
            {/* U6: persistent done-chip — visible even when collapsed, so a
                returning user immediately sees the challenge is finished. */}
            {challengeComplete && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                ✓ {isDE ? 'Heute erledigt' : 'Done for today'}
              </span>
            )}
            {isCompact && (
              <button
                type="button"
                onClick={() => speakWord(wordOfDay.de)}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 active:scale-95"
                aria-label={isDE ? 'Wort anhören' : 'Listen to word'}
              >
                🔊
              </button>
            )}
          </div>
          {/* German word prominently displayed with article if noun */}
          <div className={`${isCompact ? 'text-lg font-bold text-blue-600 dark:text-blue-400' : 'text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1'}`}>
            {getGermanWithArticle(wordOfDay.de)}
          </div>
          {/* Hide translations by default — reveal on click to prevent spoilers */}
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {showTranslation ? (
              <span className={isCompact ? 'text-xs font-medium' : ''}>{wordOfDay.en} • {wordOfDay.ne}</span>
            ) : (
              <button
                type="button"
                onClick={() => setShowTranslation(true)}
                className="inline-flex min-h-[44px] items-center text-xs font-medium text-slate-600 underline decoration-dotted underline-offset-2 transition hover:text-slate-800 active:scale-95 dark:text-slate-300 dark:hover:text-slate-100"
              >
                {isDE ? 'Bedeutung anzeigen' : 'Reveal meaning'}
              </button>
            )}
          </div>
        </div>
        {!isCompact && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => speakWord(wordOfDay.de)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-blue-50 hover:text-blue-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
              aria-label={isDE ? 'Wort anhören' : 'Listen to word'}
            >
              <span aria-hidden="true">🔊</span>
              {isDE ? 'Anhören' : 'Listen'}
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-blue-50 hover:text-blue-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
              aria-controls="wotd-content"
              aria-expanded={isExpanded}
            >
              <span aria-hidden="true">{isExpanded ? '🙈' : '👁️'}</span>
              {isExpanded ? (isDE ? 'Ausblenden' : 'Hide') : (isDE ? 'Einblenden' : 'Show')}
            </button>
          </div>
        )}
        {isCompact && (
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400"
          >
            {isExpanded ? (isDE ? 'Ausblenden' : 'Hide') : (isDE ? 'Einblenden' : 'Show')}
          </button>
        )}
      </div>

      {/* B. Daily Challenge complete state — collapse once done for today */}
      {isExpanded && (
        <>
          {challengeComplete ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
              <span aria-hidden="true">🎉</span>
              <span>{isDE ? 'Heute erledigt!' : 'Done for today!'}</span>
              {count === questions.length && !allOk && (
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {isDE ? `(${count}/${questions.length} beantwortet)` : `(${count}/${questions.length} answered)`}
                </span>
              )}
            </div>
          ) : (
            <div className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
              {isDE ? 'Herausforderung läuft' : 'In progress'} — {count}/{questions.length}
            </div>
          )}
        </>
      )}

      {!started && !challengeComplete ? (
        <button type="button" onClick={() => setStarted(true)} className={theme.button.primary}>
          {isDE ? 'Herausforderung starten' : 'Start challenge'}
        </button>
      ) : !challengeComplete ? (
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={q.prompt}>
              <div className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">{q.prompt}</div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {q.options.map((opt) => {
                  const chosen = answers[i] === opt;
                  const ok = q.correct === opt;
                  let cls = theme.button.pill;
                  if (chosen && ok) cls += ' border-green-500 bg-green-100 text-green-800';
                  else if (chosen && !ok) cls += ' border-red-500 bg-red-100 text-red-800';
                  return (
                    <button key={opt} type="button" className={cls} onClick={() => choose(i, opt)}>{opt}</button>
                  );
                })}
              </div>
            </div>
          ))}
          {count === questions.length && (
            <div className={`rounded-xl p-3 text-sm font-semibold ${allOk ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
              {allOk
                ? (isDE ? '🎉 Alle richtig! Badge freigeschaltet!' : '🎉 All correct! Badge unlocked!')
                : (isDE ? 'Nicht alle richtig — versuche es morgen!' : 'Not all correct — try again tomorrow!')}
            </div>
          )}
          {!isAuthenticated && !allOk && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
              💡 {isDE ? 'Melden Sie sich an, um Ihren Fortschritt zu speichern und Abzeichen zu sammeln!' : 'Sign in to save your progress and collect badges!'}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}