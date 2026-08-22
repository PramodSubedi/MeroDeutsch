import { Link } from 'react-router-dom';
import { useLang } from '../../hooks/useLang';
import { useAuth } from '../../hooks/useAuth';

interface HomeCommandStripProps {
  streakCount: number;
  reviewCount: number;
}

/**
 * Command strip under the header: welcome + missed items + streak in one row.
 * Wraps gracefully on mobile.
 */
export function HomeCommandStrip({ streakCount, reviewCount }: HomeCommandStripProps) {
  const { langMode } = useLang();
  const { isAuthenticated, user } = useAuth();
  const isDE = langMode === 'german';

  const firstName = user?.username ?? '';
  const greeting = isAuthenticated && firstName
    ? (isDE ? `Willkommen, ${firstName}` : `Welcome, ${firstName}`)
    : (isDE ? 'Willkommen' : 'Welcome');

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm dark:bg-slate-900">
      <span className="text-sm font-semibold text-slate-900 dark:text-white">{greeting} 👋</span>

      {/* "All clear" badge: emerald-800 on emerald-50 ≈ 7:1 contrast (≥ 4.5:1 WCAG AA). */}
      {reviewCount > 0 ? (
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60"
        >
          <span aria-hidden="true">📝</span>
          <span>
            {isDE ? `${reviewCount} fehlende Antworten` : `${reviewCount} missed`}
          </span>
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          <span aria-hidden="true">✅</span>
          <span>{isDE ? 'Revier frei!' : 'All clear!'}</span>
        </span>
      )}

      {streakCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
          <span>🔥</span>
          <span>{isDE ? `${streakCount} Tage` : `${streakCount} day streak`}</span>
        </span>
      )}
    </div>
  );
}