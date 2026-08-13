import { useCallback, useEffect, useRef, useState } from 'react';
import { speakWord } from '../hooks/useSpeech';
import { useLang } from '../hooks/useLang';
import { useReviewQueue } from '../hooks/useReviewQueue';
import type { NumberItem, NumberRange } from '../types';
import { Card } from '../components/Card';
import { SectionGrid } from '../components/SectionGrid';
import { theme } from '../config/theme';
import { sharedTextDatabase } from '../data/sharedContent';
import { curriculumService } from '../services';

const ranges: { id: NumberRange; label: string }[] = [
  { id: '0-12', label: '0 – 12' },
  { id: '13-19', label: '13 – 19' },
  { id: '20-99', label: '20 – 99' },
  { id: '100plus', label: '100+' },
];

const numberRules: Record<NumberRange, { title: string; description: string }> = {
  '0-12': { title: '', description: '' },
  '13-19': {
    title: 'Regel 13–19:',
    description: 'Einer + zehn. Beispiel: drei + zehn → dreizehn',
  },
  '20-99': {
    title: 'Regel 21–99:',
    description: 'Einer + und + Zehner. Beispiel: fünf + und + vierzig → fünfundvierzig',
  },
  '100plus': {
    title: 'Große Zahlen:',
    description: '100 = hundert · 1000 = tausend · 1 000 000 = eine Million',
  },
};

function normalize(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function NumbersPage() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { addWrongAnswer } = useReviewQueue();
  const [range, setRange] = useState<NumberRange>('0-12');
  const [mode, setMode] = useState<'learn' | 'listen'>('learn');
  const [numbersData, setNumbersData] = useState<NumberItem[]>([]);
  const [quiz, setQuiz] = useState<NumberItem | null>(null);
  const [opts, setOpts] = useState<NumberItem[]>([]);
  const [fb, setFb] = useState('');
  const [listenItem, setListenItem] = useState<NumberItem | null>(null);
  const [listenInput, setListenInput] = useState('');
  const [listenStatus, setListenStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [listenScore, setListenScore] = useState(0);
  const [listenTotal, setListenTotal] = useState(0);
  const listenInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    curriculumService.getNumbers().then(data => {
      setNumbersData(data);
      if (data.length > 0) {
        const initial = data[Math.min(1, data.length - 1)];
        setQuiz(initial);
        setListenItem(initial);
      }
    });
  }, []);

  const getItemsByRange = (range: NumberRange): NumberItem[] => {
    if (range === '0-12') return numbersData.filter((item) => item.n <= 12);
    if (range === '13-19') return numbersData.filter((item) => item.n >= 13 && item.n <= 19);
    if (range === '20-99') return numbersData.filter((item) => item.n >= 20 && item.n <= 99);
    return numbersData.filter((item) => item.n >= 100);
  };

  const items = getItemsByRange(range);
  const rule = numberRules[range];
  const title = isDE ? 'Deutsche Zahlen' : sharedTextDatabase.numbers.title;
  const description = isDE
    ? 'Lerne auf Deutsch zu zählen'
    : sharedTextDatabase.numbers.description;

  const nextQuiz = useCallback(() => {
    if (numbersData.length === 0) return;
    const pool = numbersData;
    const q = pool[Math.floor(Math.random() * pool.length)];
    const o = [q];
    while (o.length < 4) {
      const r = pool[Math.floor(Math.random() * pool.length)];
      if (!o.find((x) => x.de === r.de)) o.push(r);
    }
    setQuiz(q);
    setOpts(o.sort(() => Math.random() - 0.5));
    setFb('');
  }, [numbersData]);

  const nextQuizCallback = useCallback(() => {
    if (numbersData.length > 0) nextQuiz();
  }, [numbersData, nextQuiz]);

  useEffect(() => {
    nextQuizCallback();
  }, [nextQuizCallback]);

  const nextListen = () => {
    if (numbersData.length === 0) return;
    const pool = numbersData.filter((item) => item.n !== listenItem?.n);
    const next = pool[Math.floor(Math.random() * pool.length)];
    setListenItem(next);
    setListenInput('');
    setListenStatus('idle');
    speakWord(next.de);
    listenInputRef.current?.focus();
  };

  const checkListen = () => {
    if (!listenInput.trim() || !listenItem) return;
    setListenTotal((t) => t + 1);
    const correct =
      normalize(listenInput) === normalize(listenItem.de) ||
      normalize(listenInput) === String(listenItem.n);
    if (correct) {
      setListenStatus('correct');
      setListenScore((s) => s + 1);
    } else {
      setListenStatus('wrong');
      addWrongAnswer({
        moduleType: 'numbers',
        itemKey: listenItem.de,
        userAnswer: listenInput.trim(),
        correctAnswer: listenItem.de,
      });
    }
  };

  if (numbersData.length === 0 || !quiz || !listenItem) {
    return <div className={theme.page.container}>Loading...</div>;
  }

  return (
    <div className={theme.page.container}>
      <h1 className={theme.page.heading}>{title}</h1>
      <p className={theme.page.description}>{description}</p>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode('learn')}
          className={mode === 'learn' ? theme.button.toggleActive : theme.button.toggleInactive}
        >
          {isDE ? 'Lernliste' : 'Learn List'}
        </button>
        <button
          type="button"
          onClick={() => setMode('listen')}
          className={mode === 'listen' ? theme.button.toggleActive : theme.button.toggleInactive}
        >
          {isDE ? 'Hören & Tippen' : 'Listen & Type'}
        </button>
      </div>

      {mode === 'learn' && (
        <SectionGrid
          title={title}
          description={description}
          controls={
            ranges.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                className={range === r.id ? theme.button.toggleActive : theme.button.toggleInactive}
              >
                {r.label}
              </button>
            ))
          }
        >
          {rule.title && (
            <div className={theme.panel.info}>
              <p className="font-semibold">{rule.title}</p>
              <p className="mt-1 text-sm leading-relaxed">{rule.description}</p>
            </div>
          )}
          {items.map((item) => (
            <Card
              key={item.n + item.de}
              badge={item.n}
              title={item.de}
              lines={isDE ? [] : [item.engPh, item.nepPh]}
              footer={isDE ? undefined : `${item.en} · ${item.ne}`}
              note={item.note}
              onClick={() => speakWord(item.de)}
              onSpeak={() => speakWord(item.de)}
            />
          ))}
        </SectionGrid>
      )}

      {mode === 'listen' && (
        <div className={`${theme.panel.surface} mx-auto max-w-lg text-center`}>
          <h3 className="mb-2 font-bold">{isDE ? 'Hören & Tippen' : 'Listen & Type'}</h3>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            {isDE
              ? 'Höre die Zahl und tippe die Zahl oder das deutsche Wort.'
              : 'Hear the number, then type the digit or the German word.'}
          </p>
          <div className="mb-3 flex items-center justify-center gap-3">
            <button type="button" onClick={() => speakWord(listenItem.de)} className={theme.button.primary}>
              🔊 {isDE ? 'Abspielen' : 'Play'}
            </button>
            <span className="text-sm text-slate-500">
              {isDE ? 'Punkte' : 'Score'}: <b>{listenScore}</b> / {listenTotal}
            </span>
          </div>
          <div className="mb-3 flex h-16 items-center justify-center rounded-2xl border border-dashed border-blue-300 bg-blue-50/60 text-lg font-semibold text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
            {listenStatus === 'idle' ? (
              <span className="text-sm font-medium text-blue-600/70 dark:text-blue-300/70">
                {isDE ? '🎧 Höre genau zu' : '🎧 Listen carefully'}
              </span>
            ) : listenStatus === 'correct' ? (
              <span className="text-green-600 dark:text-green-400">🎉 {isDE ? 'Richtig!' : 'Correct!'}</span>
            ) : (
              <span className="text-red-600 dark:text-red-400">
                ❌ {isDE ? `Richtig: ${listenItem.de}` : `Correct: ${listenItem.de}`}
              </span>
            )}
          </div>
          <input
            ref={listenInputRef}
            type="text"
            value={listenInput}
            onChange={(event) => {
              setListenInput(event.target.value);
              if (listenStatus === 'correct' || listenStatus === 'wrong') setListenStatus('idle');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                if (listenStatus === 'correct' || listenStatus === 'wrong') nextListen();
                else checkListen();
              }
            }}
            placeholder={isDE ? 'Tippe Zahl oder Wort…' : 'Type digit or word…'}
            className={theme.input}
            aria-label="Listen and type"
            disabled={listenStatus === 'correct'}
          />
          <div className="mt-4 flex justify-center gap-3">
            {listenStatus === 'correct' || listenStatus === 'wrong' ? (
              <button type="button" onClick={nextListen} className={theme.button.primary}>
                {isDE ? 'Nächste Zahl →' : 'Next Number →'}
              </button>
            ) : (
              <button type="button" onClick={checkListen} className={theme.button.primary}>
                {isDE ? 'Prüfen' : 'Check'}
              </button>
            )}
          </div>
        </div>
      )}

      {mode === 'learn' && (
        <div className={`${theme.panel.surface} mx-auto max-w-lg text-center`}>
          <h3 className="mb-2 font-bold">{isDE ? 'Zahlen-Quiz' : 'Quick Number Quiz'}</h3>
          <div className="mb-3 text-5xl font-bold text-blue-600 dark:text-blue-400">{quiz.n}</div>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {(opts.length ? opts : [quiz]).map((o) => (
              <button
                key={o.de}
                type="button"
                className={theme.button.pill}
                onClick={() => {
                  if (o.de === quiz.de) {
                    setFb('🎉 Richtig!');
                  } else {
                    setFb(`❌ ${quiz.de}`);
                    addWrongAnswer({
                      moduleType: 'numbers',
                      itemKey: quiz.de,
                      userAnswer: o.de,
                      correctAnswer: quiz.de,
                    });
                  }
                  speakWord(quiz.de);
                }}
              >
                {o.de}
              </button>
            ))}
          </div>
          {fb && <div className="mb-2 font-bold text-green-600">{fb}</div>}
          <button type="button" onClick={nextQuiz} className={theme.button.primary}>
            {isDE ? 'Weiter' : 'Next'}
          </button>
        </div>
      )}
    </div>
  );
}