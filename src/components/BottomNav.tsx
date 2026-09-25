import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../hooks/useLang';
import { useReviewQueue } from '../hooks/useReviewQueue';
import {
  getPrimaryNav,
  isNavActive,
  navShortLabel,
  navTarget,
} from '../config/navigation';

/**
 * Primary navigation for every width below lg.
 *
 * This bar — not the drawer — owns the four primary destinations on small
 * screens, which is why the rail (lg+) and this bar can never disagree: both
 * read config/navigation.ts for labels, targets and active state. The drawer is
 * left to secondary destinations so the two surfaces stop competing.
 *
 * Breakpoint note: it used to stop at `md`, leaving tablet (md–lg) with a
 * header strip of duplicate links. The header is now utilities-only, so the bar
 * extends to `lg` and the rail takes over exactly where the bar stops.
 *
 * Guests get three tabs (Progress is auth-gated and the A1 spine is a
 * signed-in benefit — they get the Home module grid instead). Touch targets are
 * min 44px with safe-area padding.
 */
export function BottomNav() {
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();
  const { langMode } = useLang();
  const { dueQueue } = useReviewQueue();
  const isDE = langMode === 'german';
  const dueCount = dueQueue.length;

  const navItems = getPrimaryNav(isAuthenticated).map((item) => ({
    id: item.id,
    to: navTarget(item, isAuthenticated),
    label: navShortLabel(item, isAuthenticated, isDE),
    icon: item.icon,
    active: isNavActive(pathname, item, isAuthenticated),
    // Live due count straight from useReviewQueue — the same source the rail's
    // Progress badge and the Dashboard queue read. Never re-derived here.
    count: item.badge === 'due' ? dueCount : 0,
  }));

  return (
    <nav
      aria-label={isDE ? 'Hauptnavigation' : 'Main navigation'}
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-lg border border-ink-200 bg-white p-1.5 shadow-lg lg:hidden dark:border-ink-800 dark:bg-ink-900"
    >
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              to={item.to}
              aria-current={item.active ? 'location' : undefined}
              className="relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-sm px-1 py-1.5 transition-colors"
            >
              <span
                className={`flex h-8 w-10 items-center justify-center rounded-sm transition-colors ${
                  item.active
                    ? 'bg-accent-100 text-accent-700 dark:bg-accent-950/70 dark:text-accent-300'
                    : 'text-ink-500 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-white'
                }`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
              </span>
              <span
                className={`max-w-full truncate text-micro font-bold ${
                  item.active ? 'text-ink-950 dark:text-white' : 'text-ink-500 dark:text-ink-400'
                }`}
              >
                {item.label}
              </span>
              {item.count > 0 && (
                <span
                  className="absolute top-0 right-1/4 min-w-[18px] rounded-full bg-warning-100 px-1 py-px text-[10px] font-bold leading-tight text-warning-800 dark:bg-warning-900/50 dark:text-warning-200"
                  aria-label={`${item.count} due`}
                >
                  {item.count > 9 ? '9+' : item.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
