/**
 * src/components/exercises/ArticleSelector.tsx
 *
 * Lesson Engine primitive — der/die/das article selection driven by a
 * `useExerciseSession` session. Used by ArticlesPage and Unit 2 checkpoints.
 *
 * TTS safety (C2.6): pre-lock 🔊 speaks the BARE NOUN only; the full
 * "article + noun" phrase (`speakAfter`) is offered AFTER the answer locks.
 *
 * Colors come exclusively from theme.gender tokens (.clinerules C2.8) —
 * no one-off hexes here.
 */

import { useLang } from '../../hooks/useLang';
import { speakText } from '../../hooks/useSpeech';
import { theme } from '../../config/theme';
import { GenderBadge } from '../ui/GenderBadge';
import type { ExerciseSession } from '../../hooks/useExerciseSession';
import type { Article } from '../../data/a1Path';

/** Map an article to its theme.gender token key ('die' -> 'dieF'). */
function genderKey(art: Article): 'der' | 'dieF' | 'das' {
  return art === 'die' ? 'dieF' : art;
}

/** Question shape for article exercises. */
export interface ArticleQuestion {
  key: string;
  /** 'der' | 'die' | 'das' */
  correctAnswer: Article;
  /** The bare noun shown to the learner (no article). */
  noun: string;
  speakPrompt?: string;
  speakAfter?: string;
}

export function ArticleSelector({
  session,
}: {
  session: ExerciseSession<ArticleQuestion>;
}) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { current, index, total, locked, selected, isCorrect, score, optionsFor } = session;

  if (!current) return null;

  // Options are ['der','die','das'] shuffled at mount by the engine.
  const options = optionsFor(current);

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

      {/* Bare noun + gender dot revealed ONLY after lock */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="break-words text-2xl font-bold text-ink-900 dark:text-white">
            {current.noun}
          </span>
          {locked && (
            <GenderBadge article={current.correctAnswer} dot labeled={false} />
          )}
        </div>
        {/* Pre-lock speaker: bare noun ONLY (never the answer) */}
        {!locked && current.speakPrompt && (
          <button
            type="button"
            onClick={() => speakText(current.speakPrompt!, 0.9)}
            className={theme.button.icon}
            aria-label={isDE ? 'Aussprache des Nomens' : 'Hear the noun'}
            title={isDE ? 'Nomen (nicht der Artikel)' : 'Noun only — not the article'}
          >
            🔊
          </button>
        )}
      </div>

      {/* Article choice buttons — colors from theme.gender tokens */}
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const art = opt as Article;
          const chosen = locked && selected === opt;
          const isAnswer = opt === current.correctAnswer;

          let cls =
            'min-h-[48px] rounded-md px-4 py-3 text-body font-bold transition active:scale-95 disabled:opacity-70 ';
          if (locked && isAnswer) {
            cls += `${theme.gender[genderKey(art)].bg} text-white shadow-sm`;
          } else if (chosen) {
            cls += 'bg-danger-100 text-danger-900 dark:bg-danger-950/30 dark:text-danger-300';
          } else {
            cls +=
              'border border-ink-200 bg-white text-ink-800 shadow-sm hover:bg-ink-50 dark:bg-ink-800 dark:border-ink-800 dark:text-ink-200';
          }

          return (
            <button
              key={opt}
              type="button"
              disabled={locked}
              onClick={() => session.select(opt)}
              className={cls}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {/* Post-lock feedback + full phrase audio */}
      {locked && (
        <div className="mt-4 rounded-md bg-ink-50 p-3 text-body dark:bg-ink-800/60">
          {isCorrect
            ? isDE
              ? '🎉 Richtig!'
              : '🎉 Correct!'
            : `${isDE ? '✅ Richtig:' : '✅ Correct:'} ${current.correctAnswer} ${current.noun}`}
          {current.speakAfter && (
            <button
              type="button"
              onClick={() => speakText(current.speakAfter!, 0.85)}
              className={`${theme.button.icon} mt-2`}
              aria-label={isDE ? 'Phrase anhören' : 'Hear the phrase'}
            >
              🔊 {isDE ? 'Phrase' : 'Phrase'}
            </button>
          )}
        </div>
      )}

      {/* Footer navigation */}
      <div className="mt-6 flex justify-end">
        {locked && (
          <button type="button" onClick={session.next} className={theme.button.primary}>
            {index >= total - 1 ? (isDE ? 'Fertig' : 'Finish') : isDE ? 'Weiter' : 'Next'}
          </button>
        )}
      </div>
    </div>
  );
}