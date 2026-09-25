/**
 * src/components/exercises/ExerciseRoundFooter.tsx
 *
 * Shared "end of a finite deck" footer for engine-driven drills
 * (`useExerciseSession`): Finish/Next + Play-again + the round-complete summary.
 *
 * Replaces four byte-identical copies that lived inline in the greetings,
 * dictation, calendar and numbers pages.
 */

import { theme } from '../../config/theme';
import { useLang } from '../../hooks/useLang';

/** The subset of ExerciseSession this footer needs (structural typing). */
interface RoundSessionView {
  locked: boolean;
  answered: number;
  index: number;
  total: number;
  score: number;
  next: () => void;
}

interface ExerciseRoundFooterProps {
  session: RoundSessionView;
  /** Start a fresh deck (reshuffles the round). */
  onPlayAgain?: () => void;
  /** Override the "Next" label, e.g. "Next Number →". */
  nextLabel?: string;
  /** Hide the "Play again" button (parent renders its own control). */
  showPlayAgain?: boolean;
  /** Render the "Round complete — x/y correct" summary line. */
  showSummary?: boolean;
  className?: string;
}

export function ExerciseRoundFooter({
  session,
  onPlayAgain,
  nextLabel,
  showPlayAgain = true,
  showSummary = true,
  className = '',
}: ExerciseRoundFooterProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  const finished = session.total > 0 && session.index >= session.total;
  const isLastItem = session.index >= session.total - 1;
  const canPlayAgain =
    showPlayAgain && !session.locked && session.answered > 0 && finished && Boolean(onPlayAgain);

  return (
    <div className={className}>
      <div className="mt-3 flex justify-center gap-3">
        {session.locked && (
          <button type="button" onClick={session.next} className={theme.button.primary}>
            {isLastItem
              ? isDE
                ? 'Fertig'
                : 'Finish'
              : nextLabel ?? (isDE ? 'Weiter →' : 'Next →')}
          </button>
        )}
        {canPlayAgain && (
          <button type="button" onClick={onPlayAgain} className={theme.button.secondary}>
            {isDE ? 'Neue Runde 🔄' : 'Play again 🔄'}
          </button>
        )}
      </div>
      {showSummary && finished && (
        <p className="mt-3 text-center text-body font-semibold text-ink-600 dark:text-ink-300">
          {isDE
            ? `Runde beendet — ${session.score}/${session.total} richtig.`
            : `Round complete — ${session.score}/${session.total} correct.`}
        </p>
      )}
    </div>
  );
}
