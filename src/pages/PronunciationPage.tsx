import { useCallback, useMemo, useState, useEffect } from 'react';
import { speakWord } from '../hooks/useSpeech';
import { useLang } from '../hooks/useLang';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { useSpeechRecognition, isSpeechRecognitionSupported } from '../hooks/useSpeechRecognition';
import { theme } from '../config/theme';
import { curriculumService } from '../services';

function normalizeForCompare(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics (ä→a, ö→o, ü→u)
    .replace(/ß/g, 'ss');
}

export function PronunciationPage() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { addWrongAnswer } = useReviewQueue();
  const [word, setWord] = useState<any>(null);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [result, setResult] = useState<null | 'correct' | 'partial' | 'wrong'>(null);

  useEffect(() => {
    curriculumService.getVocabulary().then(vocab => {
      if (vocab && vocab.length > 0) {
        setWord(vocab[Math.floor(Math.random() * vocab.length)]);
      }
    });
  }, []);

  const supported = useMemo(isSpeechRecognitionSupported, []);
  const supportsNative = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const handleResult = useCallback(
    (transcript: string) => {
      if (!word) return;
      const target = normalizeForCompare(word.de);
      const spoken = normalizeForCompare(transcript);
      setTotal((t) => t + 1);
      const isMatch = spoken === target;
      if (isMatch) {
        setResult('correct');
        setScore((s) => s + 1);
      } else {
        // Loosely check: does the spoken transcript contain a word close to target?
        const wordMatch = spoken.length > 3 && word.de.split(' ').some((part: string) => spoken.includes(normalizeForCompare(part)));
        if (wordMatch) {
          setResult('partial');
        } else {
          setResult('wrong');
          addWrongAnswer({
            moduleType: 'pronunciation',
            itemKey: word.de,
            userAnswer: transcript,
            correctAnswer: word.de,
          });
        }
      }
    },
    [addWrongAnswer, word]
  );

  const { listening, status, start } = useSpeechRecognition({
    lang: 'de-DE',
    onResult: (transcript) => {
      handleResult(transcript);
    },
  });

  if (!supportsNative) {
    return (
      <div className={theme.page.container}>
        <h1 className="text-2xl font-bold">{isDE ? 'Aussprache' : 'Pronunciation'}</h1>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          {isDE ? 'Dein Browser unterstützt keine Sprachsynthese.' : 'Your browser does not support speech synthesis.'}
        </div>
      </div>
    );
  }

  const next = () => {
    curriculumService.getVocabulary().then(vocab => {
      const pool = vocab.filter((item: any) => item.id !== word?.id);
      setWord(pool[Math.floor(Math.random() * pool.length)]);
      setResult(null);
    });
  };

  if (!word) {
    return <div className={theme.page.container}>Loading...</div>;
  }

  return (
    <div className={theme.page.container}>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{isDE ? 'Aussprache-Übung' : 'Pronunciation Practice'}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {isDE
          ? 'Sprich das Wort — die App vergleicht deine Antwort.'
          : 'Speak the word — the app compares your answer.'}
      </p>

      {!supported && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          {isDE
            ? 'Spracherkennung nicht unterstützt — Tipp-Übung ist verfügbar.'
            : 'Speech recognition not supported — typing practice is available.'}
        </div>
      )}

      <div className={`${theme.panel.surface} mx-auto mt-6 max-w-xl`}>
        <div className="mb-2 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>{isDE ? 'Punkte' : 'Score'}: <b className="text-slate-900 dark:text-white">{score}</b> / {total}</span>
          <span>{status}</span>
        </div>

        <div className="mb-4 rounded-2xl border border-dashed border-blue-300 bg-blue-50/60 p-4 text-center dark:border-blue-700 dark:bg-blue-950/40">
          <div className="text-3xl font-bold text-slate-900 dark:text-white">{word.de}</div>
          <div className="mt-1 text-sm text-blue-600 dark:text-blue-300">{isDE ? '' : word.en}</div>
          <button type="button" onClick={() => speakWord(word.de)} className={`${theme.button.primary} mt-3`}>
            🔊 {isDE ? 'Wort hören' : 'Hear word'}
          </button>
        </div>

        {!supported ? (
          // Typing fallback
          <div>
            <input
              type="text"
              placeholder={isDE ? 'Tippe das Wort…' : 'Type the word…'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                  handleResult((e.target as HTMLInputElement).value);
                }
              }}
              className={theme.input}
            />
            <div className="mt-4 flex justify-center">
              {result === 'correct' || result === 'partial' || result === 'wrong' ? (
                <button type="button" onClick={next} className={theme.button.primary}>
                  {isDE ? 'Nächstes Wort →' : 'Next Word →'}
                </button>
              ) : (
                <button type="button" className={theme.button.secondary} onClick={() => {}}>
                  {isDE ? 'Prüfen' : 'Check'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" onClick={start} disabled={listening} className={`${theme.button.primary} disabled:opacity-50`}>
              🎤 {listening ? (isDE ? 'Höre zu…' : 'Listening…') : isDE ? 'Sprechen' : 'Speak'}
            </button>
            {result && (
              <button type="button" onClick={next} className={theme.button.primary}>
                {isDE ? 'Nächstes Wort →' : 'Next Word →'}
              </button>
            )}
          </div>
        )}

        {result && (
          <div className={`mt-4 rounded-xl p-3 text-center text-sm font-semibold ${
            result === 'correct'
              ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              : result === 'partial'
              ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
              : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
          }`}>
            {result === 'correct' && (isDE ? '🎉 Sehr gut!' : '🎉 Excellent!')}
            {result === 'partial' && (isDE ? `👍 Fast! Richtig: ${word.de}` : `👍 Almost! Correct: ${word.de}`)}
            {result === 'wrong' && (isDE ? `❌ Richtig: ${word.de}` : `❌ Correct: ${word.de}`)}
          </div>
        )}
      </div>
    </div>
  );
}