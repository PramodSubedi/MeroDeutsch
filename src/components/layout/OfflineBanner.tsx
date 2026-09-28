import { useLang } from '../../hooks/useLang';

interface OfflineBannerProps {
  /** The fixed rail owns the left shell, so the banner is pulled in with a MARGIN. */
  railInset: string;
  isOnline: boolean;
}

/** Offline notice — shown when navigator.onLine is false. */
export function OfflineBanner({ railInset, isOnline }: OfflineBannerProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  if (isOnline) return null;

  return (
    <div
      className={`border-b border-warning-200 bg-warning-50 px-4 py-2 text-center text-body font-medium text-warning-800 dark:border-warning-800/50 dark:bg-warning-950/40 dark:text-warning-200 ${railInset}`}
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true">📡</span>{' '}
      {isDE
        ? 'Du bist offline — gecachte Lektionen funktionieren weiter.'
        : 'You are offline — cached lessons still work.'}
    </div>
  );
}