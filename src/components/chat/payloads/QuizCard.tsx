/**
 * src/components/chat/payloads/QuizCard.tsx
 *
 * The live question. Tapping an option or typing an answer calls `onAnswer`;
 * the PARENT records it against the real SRS queue and XP, so this component
 * holds no scoring logic at all — it only renders and reports the keystroke.
 *
 * THE THREE SAFETY RULES THIS CARD ENFORCES
 * ----------------------------------------
 *  1. The "listen" button speaks `speakPrompt` — the PROMPT. The correct
 *     answer is not reachable from anything speakable (.clinerules C2.6/C6).
 *  2. Options are rendered in the exact order the deck shuffled them at build
 *     time and are never re-sorted, so a locked question cannot reshuffle
 *     under the learner's finger (.clinerules C2.9).
 *  3. After answering, the options disable — there is no second, better-guessed
 *     attempt that would quietly inflate the score.
 */

import { useState } from 'react';
import { Volume2 } from 'lucide-react';

import { speakText } from '../../../hooks/useSpeech';
import type { ChatPayload } from '../../../types/chatbot';

export type QuizPayload = Extract<ChatPayload, { kind: 'quiz' }>;

export interface QuizCardProps {
  payload: QuizPayload;
  isDE: boolean;
  onAnswer: (given: string) => void;
}

export function QuizCard({ payload, isDE, onAnswer }: QuizCardProps) {
  const { question, index, total } = payload;
  const [typed, setTyped] = useState('');
  const [locked, setLocked] = useState(false);

  const commit = (given: string) => {
    if (locked || !given.trim()) return;
    setLocked(true);
    onAnswer(given.trim());
  };

  return (
    <div className="rounded-md border border-accent-200 bg-accent-50/60 p-3 dark:border-accent-800 dark:bg-accent-950/30">
      <div className="flex items-center justify-between gap-2">
        <span className="text-micro uppercase tracking-wider text-accent-700 dark:text-accent-300">
          {isDE ? 'Frage' : 'Question'} {index + 1}/{total}
        </span>
        {question.source === 'weak_item' && (
          <span className="text-micro uppercase tracking-wider text-ink-500 dark:text-ink-400">
            {isDE ? 'Wiederholung' : 'From your mistakes'}
          </span>
        )}
      </div>

      <div className="mt-1.5 flex items-start gap-2">
        <p className="flex-1 text-body font-semibold text-ink-900 dark:text-ink-100">
          {question.prompt}
        </p>
        <button
          type="button"
          onClick={() => speakText(question.speakPrompt)}
          aria-label={isDE ? 'Frage vorlesen' : 'Hear the question'}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-accent-700 transition hover:bg-accent-200/50 active:scale-95 dark:text-accent-300 dark:hover:bg-accent-900/40"
        >
          <Volume2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {question.mode === 'choice' && question.options.length > 0 ? (
        <div className="mt-2.5 space-y-1.5">
          {question.options.map((option) => (
            <button
              key={option}
              type="button"
              disabled={locked}
              onClick={() => commit(option)}
              className="flex min-h-[44px] w-full items-center justify-center rounded-md border border-ink-200 bg-white px-3 py-2 text-body text-ink-800 transition hover:border-accent-400 active:scale-[0.98] disabled:opacity-60 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
            >
              {option}
            </button>
          ))}
        </div>
      ) : (
        <form
          className="mt-2.5 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            commit(typed);
          }}
        >
          <input
            value={typed}
            disabled={locked}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={isDE ? 'Deine Antwort …' : 'Your answer …'}
            aria-label={isDE ? 'Deine Antwort' : 'Your answer'}
            autoComplete="off"
            className="min-h-[44px] flex-1 rounded-md border border-ink-200 bg-white px-3 py-2 text-body text-ink-900 placeholder:text-ink-400 focus-visible:border-accent-500 focus-visible:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100"
          />
          <button
            type="submit"
            disabled={locked || !typed.trim()}
            className="inline-flex min-h-[44px] items-center rounded-md bg-accent-600 px-4 py-2 text-body font-semibold text-white transition hover:bg-accent-700 active:scale-[0.98] disabled:opacity-40"
          >
            {isDE ? 'Prüfen' : 'Check'}
          </button>
        </form>
      )}
    </div>
  );
}
