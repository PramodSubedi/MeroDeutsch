/**
 * src/components/layout/UpdateToast.tsx
 *
 * "A new version is ready" offer.
 *
 * Deliberately NOT a modal. A deploy can land mid-checkpoint, and a modal would
 * either block the attempt or be swiped away unread. This is a fixed bar at the
 * same z-[60] layer as the global milestone toast, so it floats above the quiz
 * UI and above the bottom bar, but it never steals focus or input. The learner
 * keeps working and taps "Reload" at a natural pause — which is what a native
 * app does with an update.
 *
 * Placed near the BOTTOM rather than at the toast's usual top-centre position on
 * purpose. An update offer is not urgent, and the top-centre slot is where
 * milestone and level-up toasts appear; a deploy arriving at the same moment as a
 * level-up would otherwise put two competing bars in one place. `bottom-24`
 * clears the 64px bottom bar plus its safe-area inset.
 *
 * `role="status"` + `aria-live="polite"` announces it without cutting a screen
 * reader off mid-sentence. The whole bar is NOT a button: making the dismiss ×
 * clickable-by-accident would let a stray tap throw the update away, and the
 * staged build is still on disk either way, so nothing is lost.
 */
import { useLang } from '../../hooks/useLang';
import { useUpdatePrompt } from '../../hooks/useUpdatePrompt';

export function UpdateToast() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { hasUpdate, applyUpdate, dismissUpdate } = useUpdatePrompt();

  if (!hasUpdate) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-24 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-md border border-accent-200 bg-white px-4 py-3 shadow-lg sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 dark:border-accent-800 dark:bg-ink-900"
    >
      <span aria-hidden="true" className="shrink-0">✨</span>
      <span className="min-w-0 flex-1 font-medium text-ink-700 dark:text-ink-200">
        {isDE ? 'Eine neue Version ist bereit.' : 'A new version is ready.'}
      </span>
      <button
        type="button"
        onClick={applyUpdate}
        className="inline-flex min-h-11 shrink-0 items-center rounded-md bg-accent-600 px-4 py-2 font-semibold text-white transition hover:bg-accent-700 active:scale-95"
      >
        {isDE ? 'Neu laden' : 'Reload'}
      </button>
      <button
        type="button"
        onClick={dismissUpdate}
        className="inline-flex min-h-11 shrink-0 items-center rounded-md px-2 font-bold text-ink-400 transition hover:text-ink-600 dark:text-ink-500 dark:hover:text-ink-200"
        aria-label={isDE ? 'Schließen' : 'Dismiss'}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
