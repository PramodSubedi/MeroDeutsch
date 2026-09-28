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
import { BAR_SAFE_AREA_PADDING, MOBILE_BAR_HEIGHT_CLASS } from '../config/mobileShell';

/** Map of route paths to their lazy import functions for preloading */
const routePreloadMap: Record<string, () => Promise<any>> = {
  '/learn': () => import('../pages/CefrLevelIndexPage'),
  '/dashboard': () => import('../pages/DashboardPage'),
  '/practice': () => import('../pages/PracticeHubPage'),
};

/** Preload a route's chunk on hover/focus */
function preloadRoute(path: string) {
  const loader = routePreloadMap[path];
  if (loader) loader();
}

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
 *
 * WHY IT IS EDGE-TO-EDGE, NOT A FLOATING PILL
 * It used to be `inset-x-3 … rounded-lg shadow-lg` — a pill inset 12px from
 * each edge, hovering over a gap below the content. That is a 2019-era idiom:
 * it cost 24px of horizontal room, needed a drop shadow to separate itself
 * from the page, and read as an overlay floating on top of the content rather
 * than as part of the shell. The current platform idiom is a full-width bar
 * flush to the bottom edge, split from the content by a single hairline.
 *
 * It stays SOLID and carries no backdrop-blur. The "no glass navbar" decision
 * in .clinerules Part B is a real design direction, not a constraint to route
 * around — and as a full-bleed surface it genuinely needs the safe-area inset
 * that only `viewport-fit=cover` makes live (see index.html).
 *
 * Both this bar's height and `<main>`'s matching bottom padding derive from
 * config/mobileShell.ts. That shared constant is what stops the two from
 * drifting apart, which is how 10px of every page came to sit permanently
 * underneath the bar.
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
      className={`fixed inset-x-0 bottom-0 z-50 border-t border-ink-200 bg-white lg:hidden dark:border-ink-800 dark:bg-ink-950 ${MOBILE_BAR_HEIGHT_CLASS} ${BAR_SAFE_AREA_PADDING}`}
    >
      <div className="flex h-16 items-stretch justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              to={item.to}
              aria-current={item.active ? 'location' : undefined}
              onMouseEnter={() => preloadRoute(item.to)}
              onFocus={() => preloadRoute(item.to)}
              className="relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-1.5 transition-colors"
            >
              <span
                className={`flex h-7 w-11 items-center justify-center rounded-md transition-colors ${
                  item.active
                    ? 'bg-accent-100 text-accent-700 dark:bg-accent-950/70 dark:text-accent-300'
                    : 'text-ink-500 dark:text-ink-400'
                }`}
              >
                <Icon className="h-[19px] w-[19px]" strokeWidth={2.2} aria-hidden="true" />
              </span>
              <span
                className={`max-w-full truncate text-micro font-bold ${
                  item.active ? 'text-accent-700 dark:text-accent-300' : 'text-ink-500 dark:text-ink-400'
                }`}
              >
                {item.label}
              </span>
              {item.count > 0 && (
                <span
                  className="absolute top-0.5 right-1/4 min-w-[18px] rounded-full bg-warning-100 px-1 py-px text-[10px] font-bold leading-tight text-warning-800 dark:bg-warning-900/50 dark:text-warning-200"
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
