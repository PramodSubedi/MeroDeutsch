import { useEffect, useMemo, useRef, useState } from 'react';
import { speakLetter, speakWord } from '../../hooks/useSpeech';
import { useProgress } from '../../hooks/useProgress';
import { useReviewQueue } from '../../hooks/useReviewQueue';
import { useXp } from '../../hooks/useXp';
import { curriculumService } from '../../services';
import type { AlphabetItem, LangMode, SpellingWord } from '../../types';

const MISSING_LETTER_FALLBACKS: Record<string, string> = {
  SCH: 'Sch',
  CH: 'Ce-Ha',
};

/** Fisher-Yates shuffle — stable, unbiased. */
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function resolvePhonetic(id: string, gerPhonetic?: string): string {
  if (gerPhonetic) return gerPhonetic;
  if (MISSING_LETTER_FALLBACKS[id]) return MISSING_LETTER_FALLBACKS[id];
  return id;
}

export function SpellingPractice({ langMode }: { langMode: LangMode }) {
  const { progress, save } = useProgress();
  const { addWrongAnswer } = useReviewQueue();
  const { reportAnswer } = useXp();
  const [difficulty, setDifficulty] = useState<'easy' | 'medium'>('easy');

  // Dynamic data pools — fetched via the service layer (no static imports).
  const [alphabetData, setAlphabetData] = useState<AlphabetItem[]>([]);
  const [spellingWords, setSpellingWords] = useState<Record<'easy' | 'medium', SpellingWord[]>>({ easy: [], medium: [] });
  const [word, setWord] = useState<SpellingWord | null>(null);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState('');
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [alphabet, spelling] = await Promise.all([
          curriculumService.getAlphabet(),
          curriculumService.getSpelling(),
        ]);
        if (cancelled) return;
        setAlphabetData(alphabet);
        setSpellingWords(spelling);
        // Seed the first word once pools arrive.
        const pool = spelling.easy;
        if (pool.length > 0 && !word) {
          setWord(pool[Math.floor(Math.random() * pool.length)]);
        }
      } catch {
        /* pools stay empty -> friendly empty state */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const start = (diff: 'easy' | 'medium' = difficulty) => {
    const pool = spellingWords[diff];
    if (pool.length === 0) return;
    setWord(pool[Math.floor(Math.random() * pool.length)]);
    setIdx(0);
    setDone(false);
    setFeedback('');
  };

  const target = word?.letters[idx];
  const correct = target ? alphabetData.find((d) => d.id === target) : undefined;

  // Stable, memoized options — rebuilt only when the target letter changes, never on re-render.
  const options = useMemo(() => {
    if (!correct || alphabetData.length === 0) return [];
    const opts = [correct];
    while (opts.length < 4 && opts.length < alphabetData.length) {
      const r = alphabetData[Math.floor(Math.random() * alphabetData.length)];
      if (r.category === 'standard' && !opts.find((o) => o.id === r.id)) opts.push(r);
    }
    return shuffle(opts);
  }, [correct, alphabetData]);

  const check = (id: string) => {
    if (done || !word || !correct) return;
    if (id === target) {
      const next = idx + 1;
      if (next >= word.letters.length) {
        setDone(true);
        setIdx(next);
        setScore((s) => s + 1);
        save({ ...progress, spellCompleted: (progress.spellCompleted || 0) + 1 });
        setFeedback('🎉 Perfekt!');
        speakWord(word.word);
        // +25 XP for completing a spelling drill (centralized award)
        reportAnswer({ correct: true, module: 'spelling', amount: 25 });
      } else {
        setIdx(next);
        const prev = alphabetData.find((d) => d.id === word.letters[idx]);
        if (prev) speakLetter(prev.speak);
      }
    } else {
      setFeedback('❌');
      // Add to review queue for wrong answers
      addWrongAnswer({
        moduleType: 'spelling',
        itemKey: target ?? '',
        userAnswer: id,
        correctAnswer: correct.gerPhonetic || correct.id,
      });
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => setFeedback(''), 800);
    }
  };

  if (!word) {
    return (
      <div className="mx-auto max-w-xl rounded-md border border-ink-200 bg-white p-5 text-center shadow-sm dark:bg-ink-900 dark:border-ink-800">
        <h2 className="text-2xl font-bold">{langMode === 'german' ? 'Rechtschreibung' : 'Spelling Practice'}</h2>
        <p className="mt-3 text-body text-ink-500">
          {langMode === 'german' ? 'Wörter werden geladen…' : 'Loading words…'}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl rounded-md border border-ink-200 bg-white p-5 text-center shadow-sm dark:bg-ink-900 dark:border-ink-800">
      <h2 className="text-2xl font-bold">{langMode === 'german' ? 'Rechtschreibung' : 'Spelling Practice'}</h2>
      <div className="mb-3 mt-2 flex justify-center gap-2">
        {(['easy', 'medium'] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              setDifficulty(d);
              setScore(0);
              start(d);
            }}
            className={
              difficulty === d
                ? 'rounded-sm border border-success-300 bg-success-100 px-3 py-1 text-body font-semibold text-success-800'
                : 'rounded-sm border border-ink-300 bg-ink-100 px-3 py-1 text-body font-semibold dark:border-ink-600 dark:bg-ink-700'
            }
          >
            {d === 'easy' ? (langMode === 'german' ? 'Leicht' : 'Easy') : langMode === 'german' ? 'Mittel' : 'Medium'}
          </button>
        ))}
      </div>
      <div className="mb-3 text-body text-ink-600">
        {langMode === 'german' ? 'Richtig' : 'Correct'}: <b className="text-success-600">{score}</b>
      </div>

      {!correct ? (
        /* Crash guard — safe error state when the letter id is missing, no white screen */
        <div className="mb-4 rounded-md border border-warning-200 bg-warning-50 p-6 text-center dark:border-warning-700 dark:bg-warning-900/20">
          <div className="text-3xl" aria-hidden="true">⚠️</div>
          <p className="mt-2 text-body font-semibold text-warning-800 dark:text-warning-300">
            {langMode === 'german'
              ? `Für den Buchstaben "${target}" wurden keine Daten gefunden.`
              : `No data found for letter "${target}".`}
          </p>
          <button
            type="button"
            onClick={() => start()}
            className="mt-4 rounded-sm bg-warning-600 px-4 py-2 text-body font-semibold text-white hover:bg-warning-700"
          >
            {langMode === 'german' ? 'Neues Wort' : 'New Word'}
          </button>
        </div>
      ) : (
        <>
          <div className="mb-2 text-meta uppercase text-ink-500">{langMode === 'german' ? 'Wort' : 'Spell this word'}</div>
          <div className="text-4xl font-bold tracking-widest text-accent-700 dark:text-accent-400">{word.word}</div>
          {langMode !== 'german' && <div className="mb-2 text-body text-ink-500">{word.meaning}</div>}
          <button type="button" className="mb-4 text-meta text-accent-600" onClick={() => speakWord(word.word)}>
            🔊 {langMode === 'german' ? 'Wort' : 'Hear Word'}
          </button>
          <div className="mb-4 flex flex-wrap justify-center gap-1.5">
            {word.letters.map((l, i) => {
              const ph = alphabetData.find((d) => d.id === l)?.gerPhonetic || l;
              let cls = 'flex h-12 min-w-12 items-center justify-center rounded-sm text-body font-bold';
              if (i < idx) cls += ' border-2 border-success-500 bg-success-100 text-success-800';
              else if (i === idx && !done) cls += ' border-2 border-accent-500 bg-accent-100 text-accent-800';
              else cls += ' border-2 border-dashed border-ink-300 text-ink-500 dark:border-ink-600';
              return (
                <div key={i} className={cls}>
                  {i < idx ? ph : i === idx && !done ? l : '?'}
                </div>
              );
            })}
          </div>
          {!done && (
            <div className="mb-3 grid grid-cols-2 gap-2">
              {options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => check(o.id)}
                  className="rounded-md border-2 border-ink-200 p-2.5 text-body font-medium transition-colors hover:border-success-500 dark:border-ink-600"
                >
                  <span className="block font-semibold">{resolvePhonetic(o.id, o.gerPhonetic)}</span>
                  {langMode !== 'german' && (
                    <div className="mt-1 text-meta text-ink-500">
                      <div>{o.engPhonetic}</div>
                      <div>{o.nepPhonetic}</div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
          {feedback && <div className="mb-2 font-bold text-success-600">{feedback}</div>}
          <div className="flex justify-center gap-2">
            {done && (
              <button type="button" onClick={() => start()} className="rounded-sm bg-success-600 px-4 py-2 text-body font-semibold text-white">
                {langMode === 'german' ? 'Nächstes Wort →' : 'Next Word →'}
              </button>
            )}
            <button type="button" onClick={() => start()} className="rounded-sm bg-ink-200 px-4 py-2 text-body font-semibold dark:bg-ink-600">
              {langMode === 'german' ? 'Neues Wort' : 'New Word'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}