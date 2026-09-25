import { theme } from '../../config/theme';

interface LoadingBlockProps {
  /** Localized label; defaults to a neutral English "Loading…". */
  label?: string;
  className?: string;
}

/**
 * Consistent loading placeholder for data-backed pages.
 *
 * Replaces the bare `Loading...` string that was duplicated across dictation,
 * greetings and glossary (each re-wrapping `theme.page.container` by hand).
 */
export function LoadingBlock({ label = 'Loading…', className = '' }: LoadingBlockProps) {
  return (
    <div className={`${theme.page.container} ${className}`}>
      <p
        className="mt-4 text-sm text-slate-500 dark:text-slate-400"
        role="status"
        aria-live="polite"
      >
        {label}
      </p>
    </div>
  );
}

/**
 * Shared "pool not seeded yet / offline" hint shown when a content pool comes
 * back empty. Previously the identical EN/NE sentence was copy-pasted across
 * dictation, greetings, calendar, numbers and DailyChallenge.
 */
export function ContentPending({ isDE, className = 'mt-4' }: { isDE: boolean; className?: string }) {
  return (
    <p className={`${className} text-sm text-slate-500 dark:text-slate-400`}>
      {isDE
        ? 'Inhalte werden noch geladen — verbinde dich einmal mit dem Internet.'
        : 'Content is still loading — connect to the internet once to populate it.'}
    </p>
  );
}
