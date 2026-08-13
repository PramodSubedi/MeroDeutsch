import { useState } from 'react';
import { alphabetData } from '../../data/sharedContent';
import { speakLetter } from '../../hooks/useSpeech';
import { useProgress } from '../../hooks/useProgress';
import { useReviewQueue } from '../../hooks/useReviewQueue';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useXp } from '../../hooks/useXp';
import type { AlphabetItem, LangMode } from '../../types';

function pickOptions(correct: AlphabetItem): AlphabetItem[] {
  const opts = [correct];
  while (opts.length < 4) {
    const r = alphabetData[Math.floor(Math.random() * alphabetData.length)];
    if (!opts.find((o) => o.id === r.id)) opts.push(r);
  }
  return opts.sort(() => Math.random() - 0.5);
}

export function AlphabetQuiz({ langMode }: { langMode: LangMode }) {
  const { progress, save, markPracticed } = useProgress();
  const { addWrongAnswer } = useReviewQueue();
  const { reportAnswer } = useXp();
  const [item, setItem] = useState(() => alphabetData[Math.floor(Math.random() * alphabetData.length)]);
  const [options, setOptions] = useState(() => pickOptions(item));
  const [sessionScore, setSessionScore] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [wrongId, setWrongId] = useState<string | null>(null);

  const next = () => {
    const n = alphabetData[Math.floor(Math.random() * alphabetData.length)];
    setItem(n);
    setOptions(pickOptions(n));
    setLocked(false);
    setFeedback('');
    setWrongId(null);
  };

  const check = (id: string) => {
    if (locked) return;
    setLocked(true);
    const total = sessionTotal + 1;
    setSessionTotal(total);
    const p = { ...progress, quizTotal: (progress.quizTotal || 0) + 1 };
    if (id === item.id) {
      setSessionScore((s) => s + 1);
      p.quizCorrect = (p.quizCorrect || 0) + 1;
      markPracticed(item.id);
      setFeedback('🎉 Richtig!');
      // +10 XP for a correct quiz answer (centralized award)
      reportAnswer({ correct: true, module: 'alphabet' });
    } else {
      setWrongId(id);
      setFeedback(`❌ ${item.gerPhonetic}`);
      // Add to review queue for wrong answers
      const wrongOption = options.find((o) => o.id === id);
      addWrongAnswer({
        moduleType: 'alphabet',
        itemKey: item.id,
        userAnswer: wrongOption?.gerPhonetic || id,
        correctAnswer: item.gerPhonetic,
      });
    }
    save(p);
    speakLetter(item.speak);
  };

  // Desktop keyboard shortcuts: Space = hear letter, 1-4 = pick option, Enter = next.
  useKeyboardShortcuts({
    onAudioPlay: () => speakLetter(item.speak),
    onSelectOption: (index) => {
      if (!locked && options[index]) check(options[index].id);
    },
    onNext: () => {
      if (locked) next();
    },
  });

  const pct = sessionTotal ? Math.round((sessionScore / sessionTotal) * 100) : 0;

  return (
    <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-5 text-center shadow dark:border-slate-700 dark:bg-slate-800">
      <h2 className="text-2xl font-bold">{langMode === 'german' ? 'Alphabet-Quiz' : 'Alphabet Quiz'}</h2>
      <p className="mb-3 text-sm text-slate-500">
        {langMode === 'german' ? 'Wie wird dieser Buchstabe ausgesprochen?' : 'How is this letter pronounced?'}
      </p>
      <div className="mb-4">
        <div className="mb-1 flex justify-between text-sm text-slate-600 dark:text-slate-400">
          <span>
            {langMode === 'german' ? 'Punkte' : 'Score'}: <b>{sessionScore}</b> / {sessionTotal}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="mb-4 text-7xl font-bold text-blue-600 dark:text-blue-400">
        {item.letter.split(' ')[0]}
      </div>
      <div className={`mb-4 grid grid-cols-2 gap-2 ${locked ? 'pointer-events-none opacity-50' : ''}`}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => check(o.id)}
            className={`min-h-[44px] rounded-xl border-2 px-4 py-3 text-sm font-medium transition ${
              locked && o.id === item.id
                ? 'border-green-500 bg-green-100'
                : locked && o.id === wrongId
                  ? 'border-red-500 bg-red-100'
                  : 'border-slate-200 hover:border-blue-500 dark:border-slate-600'
            }`}
          >
            <span className="block font-semibold">{o.gerPhonetic}</span>
            {langMode !== 'german' && (
              <div className="mt-1 text-left text-xs text-slate-500">
                <div>{o.engPhonetic}</div>
                <div>{o.nepPhonetic}</div>
              </div>
            )}
          </button>
        ))}
      </div>
      {feedback && (
        <div className={`mb-2 font-bold ${feedback.includes('Richtig') ? 'text-green-600' : 'text-red-600'}`}>
          {feedback}
        </div>
      )}
      <div className="flex justify-center gap-2">
        {locked && (
          <button type="button" onClick={next} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
            {langMode === 'german' ? 'Weiter →' : 'Next →'}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setSessionScore(0);
            setSessionTotal(0);
            next();
          }}
          className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold dark:bg-slate-600"
        >
          {langMode === 'german' ? 'Zurücksetzen' : 'Reset'}
        </button>
      </div>
    </div>
  );
}
