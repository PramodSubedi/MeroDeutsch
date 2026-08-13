import { type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { useLang } from '../hooks/useLang';

interface AuthGateProps {
  children: ReactNode;
}

/** Locale-aware number formatter shared by greeting + review queue counts. */
const numberFormatter = (locale: string) => new Intl.NumberFormat(locale);

export function AuthGate({ children }: AuthGateProps) {
  const { isAuthenticated, user } = useAuth();
  const { queue } = useReviewQueue();
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const locale = isDE ? 'de-DE' : 'en-US';
  const formatCount = numberFormatter(locale);
  const missedCount = queue.length;

  const greeting = isDE ? 'Hallo' : 'Welcome back';
  const missedLabel = isDE ? 'fehlende Einträge' : 'missed items';

  return (
    <div className="space-y-6">
      {isAuthenticated && (
        /* In-flow greeting — no action buttons; sign-out lives in the navbar dropdown */
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
            {greeting}, {user?.username} 👋
          </h2>
          {missedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-300">
              <span aria-hidden="true">⚠️</span>
              {formatCount.format(missedCount)} {missedLabel}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}