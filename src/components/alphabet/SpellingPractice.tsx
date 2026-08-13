import { useEffect, useMemo, useRef, useState } from 'react';
import { alphabetData, spellingWords } from '../../data/sharedContent';
import { speakLetter, speakWord } from '../../hooks/useSpeech';
import { useProgress } from '../../hooks/useProgress';
import { useReviewQueue } from '../../hooks/useReviewQueue';
import { useXp } from '../../hooks/useXp';
import type { LangMode } from '../../types';

const MISSING_LETTER_FALLBACKS: Record<string, string> = {
  SCH: 'Sch',
  CH: 'Ce-Ha',
};

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
  const [word, setWord] = useState(() => spellingWords.easy[0]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState('');
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const start = (diff: 'easy' | 'medium' = difficulty) => {
    const pool = spellingWords[diff];
    setWord(pool[Math.floor(Math.random() * pool.length)]);
    setIdx(0);
    setDone(false);
    setFeedback('');
  };

  const target = word.letters[idx];
  const correct = alphabetData.find((d) => d.id === target);

  // Stable, memoized options — rebuilt only when the target letter changes, never on re-render.
  const options = useMemo(() => {
    if (!correct) return [];
    const opts = [correct];
    while (opts.length < 4) {
      const r = alphabetData[Math.floor(Math.random() * alphabetData.length)];
      if (r.category === 'standard' && !opts.find((o) => o.id === r.id)) opts.push(r);
    }
    return opts.sort(() => Math.random() - 0.5);
  }, [correct]);

  const check = (id: string) => {
    if (done) return;
    if (!correct) return;
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
        itemKey: target,
        userAnswer: id,
        correctAnswer: correct.gerPhonetic || correct.id,
      });
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => setFeedback(''), 800);
    }
  };

  return (
    <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-5 text-center shadow dark:border-slate-700 dark:bg-slate-800">
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
                ? 'rounded-lg border border-green-300 bg-green-100 px-3 py-1 text-sm font-semibold text-green-800'
                : 'rounded-lg border border-slate-300 bg-slate-100 px-3 py-1 text-sm font-semibold dark:border-slate-600 dark:bg-slate-700'
            }
          >
            {d === 'easy' ? (langMode === 'german' ? 'Leicht' : 'Easy') : langMode === 'german' ? 'Mittel' : 'Medium'}
          </button>
        ))}
      </div>
      <div className="mb-3 text-sm text-slate-600">
        {langMode === 'german' ? 'Richtig' : 'Correct'}: <b className="text-green-600">{score}</b>
      </div>

      {!correct ? (
        /* Crash guard — safe error state when the letter id is missing, no white screen */
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-700 dark:bg-amber-900/20">
          <div className="text-3xl" aria-hidden="true">⚠️</div>
          <p className="mt-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
            {langMode === 'german'
              ? `Für den Buchstaben "${target}" wurden keine Daten gefunden.`
              : `No data found for letter "${target}".`}
          </p>
          <button
            type="button"
            onClick={() => start()}
            className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            {langMode === 'german' ? 'Neues Wort' : 'New Word'}
          </button>
        </div>
      ) : (
        <>
          <div className="mb-2 text-xs uppercase text-slate-500">{langMode === 'german' ? 'Wort' : 'Spell this word'}</div>
          <div className="text-4xl font-bold tracking-widest text-blue-700 dark:text-blue-400">{word.word}</div>
          {langMode !== 'german' && <div className="mb-2 text-sm text-slate-500">{word.meaning}</div>}
          <button type="button" className="mb-4 text-xs text-blue-600" onClick={() => speakWord(word.word)}>
            🔊 {langMode === 'german' ? 'Wort' : 'Hear Word'}
          </button>
          <div className="mb-4 flex flex-wrap justify-center gap-1.5">
            {word.letters.map((l, i) => {
              const ph = alphabetData.find((d) => d.id === l)?.gerPhonetic || l;
              let cls = 'flex h-12 min-w-12 items-center justify-center rounded-lg text-sm font-bold';
              if (i < idx) cls += ' border-2 border-green-500 bg-green-100 text-green-800';
              else if (i === idx && !done) cls += ' border-2 border-blue-500 bg-blue-100 text-blue-800';
              else cls += ' border-2 border-dashed border-slate-300 text-slate-400 dark:border-slate-600';
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
                  className="rounded-xl border-2 border-slate-200 p-2.5 text-sm font-medium hover:border-green-500 dark:border-slate-600"
                >
                  <span className="block font-semibold">{resolvePhonetic(o.id, o.gerPhonetic)}</span>
                  {langMode !== 'german' && (
                    <div className="mt-1 text-xs text-slate-500">
                      <div>{o.engPhonetic}</div>
                      <div>{o.nepPhonetic}</div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
          {feedback && <div className="mb-2 font-bold text-green-600">{feedback}</div>}
          <div className="flex justify-center gap-2">
            {done && (
              <button type="button" onClick={() => start()} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white">
                {langMode === 'german' ? 'Nächstes Wort →' : 'Next Word →'}
              </button>
            )}
            <button type="button" onClick={() => start()} className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold dark:bg-slate-600">
              {langMode === 'german' ? 'Neues Wort' : 'New Word'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}