/**
 * src/components/path/PathModeToggle.tsx
 *
 * Guided ⇄ Self-guided switch for the A1 spine.
 *
 * WHY TWO MODES
 * -------------
 * The spine originally hard-coded one progression model: a module unlocks only
 * when the previous checkpoint is passed. That is right for a learner who does
 * not know where to start, and wrong for a learner who already speaks some
 * German or only needs the travel module — they must otherwise grind through
 * unrelated gates. Offering the choice lets each learner pick the model that
 * fits, instead of the product picking for them.
 *
 * WHAT IT DOES *NOT* DO
 * ---------------------
 * It changes ACCESS, never scoring. Checkpoints are still taken, still scored,
 * still stored, and still drive the "Mastered" badge in both modes. The >=80%
 * gate rule itself is untouched; self mode only stops enforcing it.
 *
 * LOSING NOTHING
 * --------------
 * `setPathMode` is forward-only: entering guided raises the unlock floor to
 * wherever the learner has actually reached, so modules they finished in self
 * mode can never be re-locked. The one-line summary under the control states
 * this explicitly, because "will I lose my progress?" is the obvious question
 * and the answer deserves to be visible rather than promised in a changelog.
 *
 * Native-input based (radio + label) rather than a button pair, so keyboard and
 * screen-reader users get the mode announced as a choice rather than as two
 * unrelated buttons.
 */
import { useId } from 'react';
import { useLang } from '../../hooks/useLang';
import { useA1Path } from '../../hooks/useA1Path';
import type { PathMode } from '../../data/a1Path';

const MODES: { id: PathMode; en: string; de: string }[] = [
  { id: 'guided', en: 'Guided', de: 'Geführt' },
  { id: 'self', en: 'Self-guided', de: 'Selbstgeführt' },
];

interface PathModeToggleProps {
  /** `compact` drops the explanatory line (for tight headers). */
  compact?: boolean;
}

export function PathModeToggle({ compact = false }: PathModeToggleProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { pathMode, setPathMode } = useA1Path();
  const groupId = useId();

  return (
    <div data-path-mode={pathMode}>
      <div
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
        // Only when the explanation is actually on screen — pointing at a
        // description that `compact` removed is worse than none.
        aria-describedby={compact ? undefined : `${groupId}-desc`}
        className="inline-flex rounded-md border border-ink-200 bg-white p-0.5 dark:border-ink-700 dark:bg-ink-900"
      >
        {/* The group's own name. It used to borrow the explanation paragraph's
            id, which meant `compact` (the /learn header) left the radiogroup
            pointing at an element that did not exist. */}
        <span id={`${groupId}-label`} className="sr-only">
          {isDE ? 'Lernmodus' : 'Learning mode'}
        </span>
        {MODES.map((mode) => {
          const active = pathMode === mode.id;
          return (
            <label
              key={mode.id}
              className={`inline-flex min-h-[40px] cursor-pointer items-center rounded-sm px-3 py-1.5 text-meta font-semibold transition focus-within:ring-2 focus-within:ring-accent-500 focus-within:outline-none ${
                active
                  ? 'bg-accent-600 text-white shadow-sm dark:bg-accent-700'
                  : 'text-ink-600 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-800'
              }`}
            >
              <input
                type="radio"
                name={`${groupId}-mode`}
                value={mode.id}
                checked={active}
                onChange={() => setPathMode(mode.id)}
                className="sr-only"
              />
              {isDE ? mode.de : mode.en}
            </label>
          );
        })}
      </div>

      {!compact && (
        <p id={`${groupId}-desc`} className="mt-2 max-w-prose text-meta text-ink-500 dark:text-ink-400">
          {pathMode === 'guided' ? (
            isDE
              ? 'Jede Lektion wird freigeschaltet, sobald du die vorherige Prüfung mit mindestens 80 % bestehst.'
              : 'Each lesson unlocks once you pass the previous checkpoint with 80% or more.'
          ) : (
            isDE
              ? 'Alle 15 Lektionen sind offen. Die Prüfungen zählen weiterhin, aber sie sperren nichts.'
              : 'All 15 lessons are open. Checkpoints still count, but they lock nothing.'
          )}
          <span className="mt-1 block text-ink-400 dark:text-ink-500">
            {isDE
              ? 'Ein Wechsel verliert nie deinen Fortschritt.'
              : 'Switching never loses your progress.'}
          </span>
        </p>
      )}
    </div>
  );
}
