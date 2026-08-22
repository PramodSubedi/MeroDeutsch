/**
 * src/components/exercises/MultipleChoice.tsx
 *
 * Lesson Engine primitive — standard multiple-choice quiz UI driven by a
 * `useExerciseSession` session object. Used by Numbers, Grammar, Roleplay,
 * and the A1 Checkpoints.
 *
 * TTS safety (C2.6): the 🔊 button speaks `speakPrompt` BEFORE lock; the
 * answer audio (`speakAfter`) is only offered AFTER the answer is locked.
 *
 * Design tokens: theme.* classes, ≥44px targets, active:scale-95, light/dark.
 */

import type { ReactNode } from 'react';
import { useLang } from '../../hooks/useLang';
import { speakText } from '../../hooks/useSpeech';
import { theme } from '../../config/theme';
import type { ExerciseQuestion, ExerciseSession } from '../../hooks/useExerciseSession';

interface MultipleChoiceProps<Q extends ExerciseQuestion> {
  /** Session created by the page via useExerciseSession(). */
  session: ExerciseSession<Q>;
  /** Custom prompt renderer (defaults to plain text). */
  renderPrompt?: (question: Q) => ReactNode;
  /** Render the 🔊 prompt/answer buttons when the question carries speech. */
  showSpeaker?: boolean;
  /** Option grid columns on sm+ screens. Default 2. */
  columns?: 1 | 2;
  /** Hide the built-in Next/Finish footer (page renders its own). */
  hideFooter?: boolean;
}

export function MultipleChoice<Q extends ExerciseQuestion>({
  session,
  renderPrompt,
  showSpeaker = true,
  columns = 2,
  hideFooter = false,
}: MultipleChoiceProps<Q>) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { current, index, total, locked, selected, isCorrect, score, optionsFor } = session;

  if (!current) return null;

  const options = optionsFor(current);
  const gridCols = columns === 1 ? 'grid-cols-1' : 'grid gap-2 sm:grid-cols-2';

  return (
    <div className={theme.panel.surface}>
      {/* Progress header */}
      <div className="mb-4 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>
          {isDE ? 'Frage' : 'Question'} {index + 1} / {total}
        </span>
        <span>
          {isDE ? 'Punkte' : 'Score'}: {score}
        </span>
      </div>

      {/* Prompt + optional pre-lock speaker */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0 break-words text-2xl font-bold text-slate-900 dark:text-white">
          {renderPrompt ? renderPrompt(current) : <PromptText question={current} />}
        </div>
        {showSpeaker && current.speakPrompt && !locked && (
          <button
            type="button"
            onClick={() => speakText(current.speakPrompt!, 0.9)}
            className={theme.button.icon}
            aria-label={isDE ? 'Aussprache des Prompts' : 'Hear the prompt'}
            title={isDE ? 'Prompt (nicht die Antwort)' : 'Prompt only — not the answer'}
          >
            🔊
          </button>
        )}
      </div>

      {/* Options */}
      <div className={gridCols}>
        {options.map((opt) => {
          const chosen = locked && selected === opt;
          const isAnswer = opt === current.correctAnswer;
          const bg =
            locked && isAnswer
              ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
              : chosen
                ? 'bg-red-100 text-red-900 dark:bg-red-950/30 dark:text-red-300'
                : 'bg-white text-slate-800 shadow-sm hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200';
          return (
            <button
              key={opt}
              type="button"
              disabled={locked}
              onClick={() => session.select(opt)}
              className={`min-h-[44px] rounded-xl px-4 py-3 text-left text-sm font-semibold transition active:scale-95 disabled:opacity-70 ${bg}`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {/* Post-lock feedback + answer speaker */}
      {locked && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
          {isCorrect
            ? isDE
              ? '🎉 Richtig!'
              : '🎉 Correct!'
            : `${isDE ? '✅ Richtig:' : '✅ Correct:'} ${current.correctAnswer}`}
          {showSpeaker && current.speakAfter && (
            <button
              type="button"
              onClick={() => speakText(current.speakAfter!, 0.85)}
              className={`${theme.button.icon} mt-2`}
              aria-label={isDE ? 'Antwort anhören' : 'Hear the answer'}
            >
              🔊 {isDE ? 'Antwort' : 'Answer'}
            </button>
          )}
        </div>
      )}

      {/* Footer navigation */}
      {!hideFooter && (
        <div className="mt-6 flex justify-end">
          {locked && (
            <button type="button" onClick={session.next} className={theme.button.primary}>
              {index >= total - 1 ? (isDE ? 'Fertig' : 'Finish') : isDE ? 'Weiter' : 'Next'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Fallback plain-text prompt renderer. */
function PromptText<Q extends ExerciseQuestion>({ question }: { question: Q }) {
  const raw = question as unknown as { prompt?: string };
  return <>{raw.prompt ?? ''}</>;
}