import { useEffect, useRef, useState } from 'react';
import { speakWord } from '../hooks/useSpeech';
import { useLang } from '../hooks/useLang';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { theme } from '../config/theme';
import { curriculumService } from '../services';
import type { DictationWord } from '../types/curriculum';

function normalize(input: string): string {
  return input.trim().toLowerCase();
}

export function DictationPage() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { addWrongAnswer } = useReviewQueue();
  const [word, setWord] = useState<DictationWord | null>(null);
  const [dictationWords, setDictationWords] = useState<DictationWord[]>([]);
  const [attempt, setAttempt] = useState('');
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    curriculumService.getDictationWords().then(data => {
      setDictationWords(data);
      if (data.length > 0) {
        setWord(data[Math.floor(Math.random() * data.length)]);
      }
    });
  }, []);

  if (!word) return null;

  const play = () => speakWord(word.word);

  const next = () => {
    const pool = dictationWords.filter((item) => item.word !== word.word);
    setWord(pool[Math.floor(Math.random() * pool.length)]);
    setAttempt('');
    setStatus('idle');
    inputRef.current?.focus();
  };

  const check = () => {
    if (!attempt.trim()) return;
    setTotal((t) => t + 1);
    const correct = normalize(attempt) === normalize(word.word);
    if (correct) {
      setStatus('correct');
      setScore((s) => s + 1);
    } else {
      setStatus('wrong');
      addWrongAnswer({
        moduleType: 'dictation',
        itemKey: word.word,
        userAnswer: attempt.trim(),
        correctAnswer: word.word,
      });
    }
  };

  const title = isDE ? 'Diktat' : 'Dictation';
  const subtitle = isDE
    ? 'Höre das Wort und tippe, was du gehört hast.'
    : 'Listen to the German word, then type what you heard.';
  const placeholder = isDE ? 'Tippe das Wort…' : 'Type the word…';
  const hearAgain = isDE ? '🔊 Nochmal hören' : '🔊 Hear again';
  const checkLabel = isDE ? 'Prüfen' : 'Check';
  const nextWord = isDE ? 'Nächstes Wort →' : 'Next Word →';
  const scoreLabel = isDE ? 'Punkte' : 'Score';
  const correctMsg = isDE ? '🎉 Richtig!' : '🎉 Correct!';
  const wrongMsg = (correct: string) =>
    isDE ? `❌ Falsch. Richtig war: ${correct}` : `❌ Wrong. Correct: ${correct}`;

  return (
    <div className={theme.page.container}>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>

      <div className="mx-auto mt-6 max-w-xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-950">
        <div className="mb-4 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>{scoreLabel}: <b className="text-slate-900 dark:text-white">{score}</b> / {total}</span>
          <button type="button" onClick={play} className={theme.button.primary}>
            {isDE ? '🔊 Wort abspielen' : '🔊 Play word'}
          </button>
        </div>

        <div className="mb-4 flex h-20 items-center justify-center rounded-2xl border border-dashed border-blue-300 bg-blue-50/60 text-3xl font-bold text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
          {status === 'idle' ? (
            <span className="text-base font-medium text-blue-600/70 dark:text-blue-300">
              {isDE ? '🎧 Höre genau zu' : '🎧 Listen carefully'}
            </span>
          ) : status === 'correct' ? (
            <span className="text-green-600 dark:text-green-400">{correctMsg}</span>
          ) : (
            <span className="text-lg text-red-600 dark:text-red-400">{wrongMsg(word.word)}</span>
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={attempt}
          onChange={(event) => {
            setAttempt(event.target.value);
            if (status === 'correct' || status === 'wrong') setStatus('idle');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              if (status === 'correct' || status === 'wrong') next();
              else check();
            }
          }}
          placeholder={placeholder}
          className={theme.input}
          aria-label={placeholder}
          disabled={status === 'correct'}
        />

        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={play} className={theme.button.secondary}>
            {hearAgain}
          </button>
          {status === 'correct' || status === 'wrong' ? (
            <button type="button" onClick={next} className={theme.button.primary}>
              {nextWord}
            </button>
          ) : (
            <button type="button" onClick={check} className={theme.button.primary}>
              {checkLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
