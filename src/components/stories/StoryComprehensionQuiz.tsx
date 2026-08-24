import { useMemo, useState } from 'react';
import { useLang } from '../../hooks/useLang';
import { useReviewQueue } from '../../hooks/useReviewQueue';
import { theme } from '../../config/theme';
import type { StoryComprehensionQuestion } from '../../types/curriculum';
import { CheckCircle, XCircle } from 'lucide-react';

/** Fisher-Yates shuffle (C9: options shuffled at question create, stable once locked). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface StoryComprehensionQuizProps {
  storyId: string;
  questions: StoryComprehensionQuestion[];
}

/**
 * Additive comprehension check rendered after a story reading view.
 * Mounts only when the story carries Kilo-sourced questions. Wrong answers go
 * to the REAL queue via useReviewQueue().addWrongAnswer() (moduleType: stories)
 * so they surface on the Dashboard SRS queue. No XP/toast side-effects — minimal
 * and intentionally non-blocking (C7).
 */
export function StoryComprehensionQuiz({ storyId, questions }: StoryComprehensionQuizProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { addWrongAnswer } = useReviewQueue();
  const label = (de: string, en: string) => (isDE ? de : en);

  // Shuffle each question's options once so answers never sit in a fixed slot.
  const shuffled = useMemo(
    () =>
      questions.map((q) => ({
        ...q,
        options: shuffle(q.options),
        itemKey: q.itemKey != null && q.itemKey.length > 0 ? q.itemKey : storyId + ':q:' + q.id,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions, storyId]
  );

  type Ans = { chosen: string; correct: string };
  const [answers, setAnswers] = useState<Record<string, Ans>>({});

  const answeredAll = shuffled.every((q) => answers[q.id] != null);
  const totalRight = shuffled.filter((q) => {
    const a = answers[q.id];
    return a != null && norm(a.chosen) === norm(a.correct);
  }).length;

  const pick = (qid: string, q: (typeof shuffled)[0], choice: string) => {
    if (answers[qid] != null) return;
    const isCorrect = norm(choice) === norm(q.correct);
    if (!isCorrect) {
      addWrongAnswer({
        moduleType: 'stories',
        itemKey: q.itemKey,
        userAnswer: choice,
        correctAnswer: q.correct,
      });
    }
    setAnswers((prev) => ({ ...prev, [qid]: { chosen: choice, correct: q.correct } }));
  };

  return (
    <div className={theme.panel.surface + ' mt-6'}>
      <h2 className={theme.section.title}>{label('Verständnisfragen', 'Comprehension Check')}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {answeredAll
          ? label(totalRight + ' von ' + shuffled.length + ' richtig.', totalRight + ' of ' + shuffled.length + ' correct.')
          : label('Wie gut hast du die Geschichte verstanden?', 'How well did you understand the story?')}
      </p>
      <div className="mt-4 space-y-4">
        {shuffled.map((q) => {
          const a = answers[q.id];
          const locked = a != null;
          return (
            <div key={q.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40">
              <p className="text-slate-800 dark:text-slate-200">{q.question}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {q.options.map((opt, i) => {
                  const picked = locked && norm(opt) === norm(a.chosen);
                  const right = locked && norm(opt) === norm(a.correct);
                  const base = 'text-left w-full rounded-lg border px-3 py-2 text-sm transition active:scale-95';
                  const variant = right
                    ? 'border-green-500 bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                    : picked
                      ? 'border-red-500 bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                      : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700';
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={locked}
                      onClick={() => pick(q.id, q, opt)}
                      className={base + ' ' + variant}
                    >
                      {opt}
                      {right && <CheckCircle className="ml-2 inline-block h-4 w-4 text-green-600" />}
                      {picked && !right && <XCircle className="ml-2 inline-block h-4 w-4 text-red-600" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}