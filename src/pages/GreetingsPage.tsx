import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Sparkles } from 'lucide-react';
import { sharedTextDatabase } from '../data/sharedContent';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { useXp } from '../hooks/useXp';
import { speakWord } from '../hooks/useSpeech';
import { StandardStudyCard } from '../components/StandardStudyCard';
import { SectionGrid } from '../components/SectionGrid';
import { TabGroup } from '../components/TabGroup';
import { theme } from '../config/theme';
import { curriculumService } from '../services';
import type { GreetingItem } from '../types';

function normalize(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function GreetingsPage() {
  usePageTitle('Greetings');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { addWrongAnswer } = useReviewQueue();
  const { reportAnswer } = useXp();
  const [mode, setMode] = useState<'learn' | 'quiz'>('learn');
  const [greetings, setGreetings] = useState<GreetingItem[]>([]);
  const [quizItem, setQuizItem] = useState<GreetingItem | null>(null);
  const [quizInput, setQuizInput] = useState('');
  const [quizStatus, setQuizStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [quizScore, setQuizScore] = useState(0);
  const [quizTotal, setQuizTotal] = useState(0);
  const quizInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    curriculumService.getGreetings().then(data => {
      setGreetings(data);
      if (data.length > 0) {
        setQuizItem(data[0]);
      }
    });
  }, []);

  const title = isDE ? 'Begrüßungen' : sharedTextDatabase.greetings.title;
  const description = isDE
    ? 'Lerne gängige deutsche Begrüßungen'
    : sharedTextDatabase.greetings.description;

  const nextQuiz = () => {
    if (greetings.length === 0) return;
    const pool = greetings.filter((item) => item.de !== quizItem?.de);
    const next = pool[Math.floor(Math.random() * pool.length)];
    setQuizItem(next);
    setQuizInput('');
    setQuizStatus('idle');
    speakWord(next.de);
    quizInputRef.current?.focus();
  };

  const checkQuiz = () => {
    if (!quizInput.trim() || !quizItem) return;
    setQuizTotal((t) => t + 1);
    const correct = normalize(quizInput) === normalize(quizItem.de);
    if (correct) {
      setQuizStatus('correct');
      setQuizScore((s) => s + 1);
      // +10 XP for a correct quiz answer
      reportAnswer({ correct: true, module: 'greetings' });
    } else {
      setQuizStatus('wrong');
      addWrongAnswer({
        moduleType: 'greetings',
        itemKey: quizItem.de,
        userAnswer: quizInput.trim(),
        correctAnswer: quizItem.de,
      });
    }
  };

  if (greetings.length === 0 || !quizItem) {
    return <div className={theme.page.container}>Loading...</div>;
  }

  return (
    <div className={theme.page.container}>
      <h1 className={theme.page.heading}>{title}</h1>
      <p className={theme.page.description}>{description}</p>

      <TabGroup
        tabs={[
          { id: 'learn', label: isDE ? 'Lernliste' : 'Learn List', icon: MessageCircle },
          { id: 'quiz', label: isDE ? 'Hören & Tippen' : 'Listen & Type', icon: Sparkles },
        ]}
        activeTab={mode}
        onTabChange={setMode}
      />

      {mode === 'learn' && (
        <SectionGrid
          title={title}
          description={description}
        >
          {greetings.map((item, index) => (
            <StandardStudyCard
              key={item.de}
              badge={index + 1}
              german={item.de}
              nepali={item.ne}
              english={item.en}
              langMode={langMode}
            />
          ))}
        </SectionGrid>
      )}

      {mode === 'quiz' && (
        <div className={`${theme.panel.surface} mx-auto max-w-lg text-center`}>
          <h3 className="mb-2 font-bold">{isDE ? 'Hören & Tippen' : 'Listen & Type'}</h3>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            {isDE
              ? 'Höre die Begrüßung und tippe sie.'
              : 'Hear the greeting and type it.'}
          </p>
          <div className="mb-3 flex items-center justify-center gap-3">
            <button type="button" onClick={() => speakWord(quizItem.de)} className={theme.button.primary}>
              🔊 {isDE ? 'Abspielen' : 'Play'}
            </button>
            <span className="text-sm text-slate-500">
              {isDE ? 'Punkte' : 'Score'}: <b>{quizScore}</b> / {quizTotal}
            </span>
          </div>
          <div className="mb-3 flex h-16 items-center justify-center rounded-2xl border border-dashed border-blue-300 bg-blue-50/60 text-lg font-semibold text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
            {quizStatus === 'idle' ? (
              <span className="text-sm font-medium text-blue-600/70 dark:text-blue-300/70">
                {isDE ? '🎧 Höre genau zu' : '🎧 Listen carefully'}
              </span>
            ) : quizStatus === 'correct' ? (
              <span className="text-green-600 dark:text-green-400">🎉 {isDE ? 'Richtig!' : 'Correct!'}</span>
            ) : (
              <span className="text-red-600 dark:text-red-400">
                ❌ {isDE ? `Richtig: ${quizItem.de}` : `Correct: ${quizItem.de}`}
              </span>
            )}
          </div>
          <input
            ref={quizInputRef}
            type="text"
            value={quizInput}
            onChange={(event) => {
              setQuizInput(event.target.value);
              if (quizStatus === 'correct' || quizStatus === 'wrong') setQuizStatus('idle');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                if (quizStatus === 'correct' || quizStatus === 'wrong') nextQuiz();
                else checkQuiz();
              }
            }}
            placeholder={isDE ? 'Tippe die Begrüßung…' : 'Type the greeting…'}
            className={theme.input}
            aria-label="Listen and type"
            disabled={quizStatus === 'correct'}
          />
          <div className="mt-4 flex justify-center gap-3">
            {quizStatus === 'correct' || quizStatus === 'wrong' ? (
              <button type="button" onClick={nextQuiz} className={theme.button.primary}>
                {isDE ? 'Weiter →' : 'Next →'}
              </button>
            ) : (
              <button type="button" onClick={checkQuiz} className={theme.button.primary}>
                {isDE ? 'Prüfen' : 'Check'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}