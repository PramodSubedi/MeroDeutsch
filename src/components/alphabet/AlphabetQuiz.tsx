import { useEffect, useRef, useState } from 'react';
import { speakLetter } from '../../hooks/useSpeech';
import { useProgress } from '../../hooks/useProgress';
import { useReviewQueue } from '../../hooks/useReviewQueue';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useXp } from '../../hooks/useXp';
import { curriculumService } from '../../services';
import { drawWithoutReplacement } from '../../utils/questionGenerator';
import type { AlphabetItem, LangMode } from '../../types';

/** Fisher-Yates shuffle — stable, unbiased. */
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickOptions(correct: AlphabetItem, pool: AlphabetItem[]): AlphabetItem[] {
  const opts = [correct];
  while (opts.length < 4 && opts.length < pool.length) {
    const r = pool[Math.floor(Math.random() * pool.length)];
    if (!opts.find((o) => o.id === r.id)) opts.push(r);
  }
  return shuffle(opts);
}

export function AlphabetQuiz({ langMode }: { langMode: LangMode }) {
  const { progress, save, markPracticed } = useProgress();
  const { addWrongAnswer } = useReviewQueue();
  const { reportAnswer } = useXp();

  // Dynamic data pool — fetched via the service layer (no static import).
  const [pool, setPool] = useState<AlphabetItem[]>([]);
  // Track shown letter ids so the same prompt isn't repeated until the whole
  // alphabet pool has been cycled (sample without replacement).
  const usedIdsRef = useRef<Set<string>>(new Set());
  const [item, setItem] = useState<AlphabetItem | null>(null);
  // Stable options — only rebuilt in `next()`, never on re-render.
  const [options, setOptions] = useState<AlphabetItem[]>([]);
  const [sessionScore, setSessionScore] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [wrongId, setWrongId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    curriculumService
      .getAlphabet()
      .then((data) => {
        if (cancelled || data.length === 0) return;
        setPool(data);
        const first = drawWithoutReplacement(data, usedIdsRef.current, (a) => a.id);
        if (first) {
          setItem(first);
          setOptions(pickOptions(first, data));
        }
      })
      .catch(() => {
        /* pool stays empty -> friendly loading/empty state */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const next = () => {
    const n = drawWithoutReplacement(pool, usedIdsRef.current, (a) => a.id);
    if (!n) return;
    setItem(n);
    setOptions(pickOptions(n, pool));
    setLocked(false);
    setFeedback('');
    setWrongId(null);
  };

  const check = (id: string) => {
    if (locked || !item) return;
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
    onAudioPlay: () => {
      if (item) speakLetter(item.speak);
    },
    onSelectOption: (index) => {
      if (!locked && options[index]) check(options[index].id);
    },
    onNext: () => {
      if (locked) next();
    },
  });

  const pct = sessionTotal ? Math.round((sessionScore / sessionTotal) * 100) : 0;

  if (!item) {
    return (
      <div className="mx-auto max-w-xl rounded-md border border-ink-200 bg-white p-5 text-center shadow-sm dark:bg-ink-900 dark:border-ink-800">
        <p className="text-body text-ink-500">
          {langMode === 'german' ? 'Quiz wird geladen…' : 'Loading quiz…'}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl rounded-md bg-white p-5 text-center shadow-sm dark:bg-ink-900">
      <h2 className="text-2xl font-bold">{langMode === 'german' ? 'Alphabet-Quiz' : 'Alphabet Quiz'}</h2>
      <p className="mb-3 text-body text-ink-500">
        {langMode === 'german' ? 'Wie wird dieser Buchstabe ausgesprochen?' : 'How is this letter pronounced?'}
      </p>
      <div className="mb-4">
        <div className="mb-1 flex justify-between text-body text-ink-600 dark:text-ink-400">
          <span>
            {langMode === 'german' ? 'Punkte' : 'Score'}: <b>{sessionScore}</b> / {sessionTotal}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-700">
          <div className="h-2 rounded-full bg-accent-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="mb-4 text-7xl font-bold text-accent-600 dark:text-accent-400">
        {item.letter.split(' ')[0]}
      </div>
      <div className={`mb-4 grid grid-cols-2 gap-2 ${locked ? 'pointer-events-none opacity-50' : ''}`}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => check(o.id)}
            className={`min-h-[44px] rounded-md border-2 px-4 py-3 text-body font-medium transition-colors ${
              locked && o.id === item.id
                ? 'border-success-500 bg-success-100'
                : locked && o.id === wrongId
                  ? 'border-danger-500 bg-danger-100'
                  : 'border-ink-200 hover:border-accent-500 dark:border-ink-600'
            }`}
          >
            <span className="block font-semibold">{o.gerPhonetic}</span>
            {langMode !== 'german' && (
              <div className="mt-1 text-left text-meta text-ink-500">
                <div>{o.engPhonetic}</div>
                <div>{o.nepPhonetic}</div>
              </div>
            )}
          </button>
        ))}
      </div>
      {feedback && (
        <div className={`mb-2 font-bold ${feedback.includes('Richtig') ? 'text-success-600' : 'text-danger-600'}`}>
          {feedback}
        </div>
      )}
      <div className="flex justify-center gap-2">
        {locked && (
          <button type="button" onClick={next} className="rounded-sm bg-accent-600 px-4 py-2 text-body font-semibold text-white">
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
          className="rounded-sm bg-ink-200 px-4 py-2 text-body font-semibold dark:bg-ink-600"
        >
          {langMode === 'german' ? 'Zurücksetzen' : 'Reset'}
        </button>
      </div>
    </div>
  );
}