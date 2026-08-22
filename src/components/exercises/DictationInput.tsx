/**
 * src/components/exercises/DictationInput.tsx
 *
 * Lesson Engine primitive — audio-to-text dictation workflow driven by a
 * `useExerciseSession` session. Used by DictationPage (+50 XP tier).
 *
 * TTS safety (C2.6): the spoken word IS the prompt, so pre-lock playback is
 * safe. The written answer is revealed only after lock.
 *
 * The audio auto-plays when each new word appears (replayable via the button);
 * matching is delegated to the session's `matches` comparator so normalization
 * stays in one place.
 */

import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../hooks/useLang';
import { theme } from '../../config/theme';
import type { ExerciseQuestion, ExerciseSession } from '../../hooks/useExerciseSession';

interface DictationInputProps<Q extends ExerciseQuestion> {
  /** Session created by the page via useExerciseSession(). */
  session: ExerciseSession<Q>;
  /** Play the target-word audio (the prompt). */
  onPlayAudio: (question: Q) => void;
  /** Auto-play the audio whenever a new word appears. Default true. */
  autoPlay?: boolean;
  placeholder?: string;
  /** Hide the built-in Next footer (page renders its own). */
  hideFooter?: boolean;
}

export function DictationInput<Q extends ExerciseQuestion>({
  session,
  onPlayAudio,
  autoPlay = true,
  placeholder,
  hideFooter = false,
}: DictationInputProps<Q>) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { current, index, total, locked, isCorrect, score, select, next } = session;

  const [value, setValue] = useState('');
  const lastAutoKeyRef = useRef<string | null>(null);

  // Clear the input per word and auto-play the prompt audio.
  useEffect(() => {
    if (!current) return;
    if (!locked) setValue('');
    if (autoPlay && !locked && lastAutoKeyRef.current !== current.key) {
      lastAutoKeyRef.current = current.key;
      onPlayAudio(current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, locked]);

  if (!current) return null;

  const check = () => {
    if (locked || value.trim().length === 0) return;
    select(value);
  };

  return (
    <div className={theme.panel.surface}>
      {/* Progress header */}
      <div className="mb-4 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>
          {isDE ? 'Wort' : 'Word'} {index + 1} / {total}
        </span>
        <span>
          {isDE ? 'Punkte' : 'Score'}:{' '}
          <b className="text-slate-900 dark:text-white">{score}</b> / {total}
        </span>
      </div>

      {/* Audio replay — the word is the prompt, safe pre-lock */}
      <div className="mb-4 flex justify-center gap-3">
        <button
          type="button"
          onClick={() => onPlayAudio(current)}
          className={theme.button.primary}
          aria-label={isDE ? 'Wort anhören' : 'Play the word'}
        >
          🔊 {isDE ? 'Anhören' : 'Listen'}
        </button>
      </div>

      {/* Typed transcription */}
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            if (locked) next();
            else check();
          }
        }}
        placeholder={placeholder ?? (isDE ? 'Was du hörst, hier tippen…' : 'Type what you hear…')}
        aria-label={isDE ? 'Diktat eingeben' : 'Type the dictation'}
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
              {index >= total - 1 ? (isDE ? 'Fertig' : 'Finish') : isDE ? 'Nächstes Wort →' : 'Next Word →'}
            </button>
          )}
        </div>
      )}

      {/* Post-lock feedback — reveals the written word ONLY after lock */}
      {locked && (
        <div
          className={`mt-4 rounded-xl p-3 text-center text-sm font-semibold ${
            isCorrect
              ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
          }`}
        >
          {isCorrect
            ? isDE
              ? '🎉 Richtig!'
              : '🎉 Correct!'
            : `${isDE ? '❌ Falsch. Richtig war:' : '❌ Wrong. Correct:'} ${current.correctAnswer}`}
        </div>
      )}
    </div>
  );
}