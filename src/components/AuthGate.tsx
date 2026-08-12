import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
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
  const signInBanner = isDE
    ? 'Melde dich an, um deinen Fortschritt zu speichern und deine Review-Liste freizuschalten.'
    : 'Sign in to save your progress and unlock your personalized review list.';

  return (
    <div className="space-y-6">
      {isAuthenticated ? (
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
      ) : (
        /* Centered in-flow banner — clearly in page flow, no collision with the sticky navbar */
        <div className="flex justify-center pt-2">
          <Link
            to="/auth"
            className="group inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-blue-200/70 bg-gradient-to-r from-blue-50 via-white to-blue-50 px-5 py-2.5 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-blue-100 transition duration-300 hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700 hover:shadow-md dark:border-blue-800/50 dark:from-blue-950/60 dark:via-slate-900/80 dark:to-blue-950/60 dark:text-slate-300 dark:ring-blue-900/40 dark:hover:border-blue-600 dark:hover:text-blue-300"
          >
            <span aria-hidden="true">✨</span>
            <span>{signInBanner}</span>
            <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>
      )}
      {children}
    </div>
  );
}