/**
 * src/components/exercises/ListenAndType.tsx
 *
 * Lesson Engine primitive — listen-and-type / exact-match text input driven
 * by a `useExerciseSession` session. Used by Greetings, Calendar, and the
 * Numbers listen mode.
 *
 * The AUDIO IS THE PROMPT: playing the German word before the answer locks is
 * TTS-safe (C2.6) because the word itself is what the learner must transcribe.
 * The written answer is only revealed after lock.
 *
 * Matching is delegated to the session's optional `matches` comparator so
 * trim/case/punctuation normalization lives in ONE place (the page config).
 */

import { useEffect, useState } from 'react';
import { useLang } from '../../hooks/useLang';
import { theme } from '../../config/theme';
import type { ExerciseQuestion, ExerciseSession } from '../../hooks/useExerciseSession';

interface ListenAndTypeProps<Q extends ExerciseQuestion> {
  /** Session created by the page via useExerciseSession(). */
  session: ExerciseSession<Q>;
  /** Play the prompt audio (e.g. speakGerman of the target word). */
  onPlayPrompt?: (question: Q) => void;
  /** Input placeholder. */
  placeholder?: string;
  /** Extra accepted answers shown in the post-lock correction line. */
  renderCorrection?: (question: Q) => string;
  /** Hide the built-in Next footer (page renders its own). */
  hideFooter?: boolean;
}

export function ListenAndType<Q extends ExerciseQuestion>({
  session,
  onPlayPrompt,
  placeholder,
  renderCorrection,
  hideFooter = false,
}: ListenAndTypeProps<Q>) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { current, index, total, locked, isCorrect, score, select, next } = session;

  const [value, setValue] = useState('');

  // Clear the input whenever the deck advances to a new question.
  useEffect(() => {
    if (!locked) setValue('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  if (!current) return null;

  const check = () => {
    if (locked || value.trim().length === 0) return;
    select(value);
  };

  return (
    <div className={theme.panel.surface}>
      {/* Progress header */}
      <div className="mb-4 flex items-center justify-between text-body text-ink-500 dark:text-ink-400">
        <span>
          {isDE ? 'Frage' : 'Question'} {index + 1} / {total}
        </span>
        <span>
          {isDE ? 'Punkte' : 'Score'}: <b className="text-ink-900 dark:text-white">{score}</b>
        </span>
      </div>

      {/* Audio prompt — safe pre-lock: the audio IS the question */}
      <div className="mb-4 flex justify-center gap-3">
        {onPlayPrompt && (
          <button
            type="button"
            onClick={() => onPlayPrompt(current)}
            className={theme.button.primary}
            aria-label={isDE ? 'Anhören' : 'Listen'}
          >
            🔊 {isDE ? 'Anhören' : 'Listen'}
          </button>
        )}
      </div>

      {/* Typed answer */}
      <input
        type="text"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          // Note: phase reset is owned by session.next(); typing while locked
          // is ignored because the input disables below.
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            if (locked) next();
            else check();
          }
        }}
        placeholder={placeholder ?? (isDE ? 'Auf Deutsch tippen…' : 'Type in German…')}
        aria-label={isDE ? 'Antwort eingeben' : 'Type your answer'}
        disabled={locked}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        className={`${theme.input} text-center text-lg`}
      />

      {/* Check / Next controls */}
      {!hideFooter && (
        <div className="mt-4 flex justify-center gap-3">
          {!locked && (
            <button
              type="button"
              onClick={check}
              disabled={value.trim().length === 0}
              className={theme.button.secondary}
            >
              {isDE ? 'Prüfen' : 'Check'}
            </button>
          )}
          {locked && (
            <button type="button" onClick={next} className={theme.button.primary}>
              {index >= total - 1 ? (isDE ? 'Fertig' : 'Finish') : isDE ? 'Weiter →' : 'Next →'}
            </button>
          )}
        </div>
      )}

      {/* Post-lock feedback — reveals the written answer ONLY after lock */}
      {locked && (
        <div
          className={`mt-4 rounded-md p-3 text-center text-body font-semibold ${
            isCorrect
              ? 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300'
              : 'bg-danger-50 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300'
          }`}
        >
          {isCorrect
            ? isDE
              ? '🎉 Richtig!'
              : '🎉 Correct!'
            : `${isDE ? '❌ Falsch. Richtig war:' : '❌ Wrong. Correct:'} ${
                renderCorrection ? renderCorrection(current) : current.correctAnswer
              }`}
        </div>
      )}
    </div>
  );
}
