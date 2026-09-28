import { useLang } from '../../hooks/useLang';

interface LevelUpToastProps {
  /** Toast message to display */
  message: string;
  /** Icon to display */
  icon: string;
  /** Callback when dismissed */
  onDismiss: () => void;
}

/** Non-blocking milestone/level-up toast. */
export function LevelUpToast({ message, icon, onDismiss }: LevelUpToastProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-20 left-1/2 z-[60] -translate-x-1/2 flex items-center gap-3 rounded-md bg-ink-900 px-4 py-3 text-body font-bold text-white shadow-lg animate-in fade-in slide-in-from-top-4 duration-300 dark:bg-white dark:text-ink-900"
    >
      <span>{icon} {message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-white/70 hover:text-white dark:text-ink-500 dark:hover:text-ink-900 font-bold"
        aria-label={isDE ? 'Schließen' : 'Dismiss'}
      >
        ×
      </button>
    </div>
  );
}