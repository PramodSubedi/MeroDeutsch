import { Link, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { ArrowUpRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { theme } from '../config/theme';
import { Logo } from './common/Logo';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../hooks/useLang';
import { useReviewQueue } from '../hooks/useReviewQueue';
import {
  SECONDARY_NAV,
  getActiveSecondary,
  getPrimaryNav,
  isNavActive,
  navLabel,
  navTarget,
} from '../config/navigation';
import { LearnerWaypoint } from './path/LearnerWaypoint';

/** Guest-first split: /home is the app home (authed OR guest), /welcome is
    the marketing landing (no app shell). Home nav + brand link must point at
    /home so authenticated users never bounce through a redirect. */
const HOME_TO = '/home';

interface AppSidebarProps {
  /** True when the mobile drawer is open. */
  mobileOpen?: boolean;
  /** Closes the mobile drawer (desktop rail ignores this). */
  onClose?: () => void;
  /** Desktop rail collapsed to an icon-only strip. */
  collapsed?: boolean;
  /** Expands/collapses the DESKTOP rail. Layout supplies this on lg+; the
      mobile drawer intentionally has no toggle (it closes via its backdrop). */
  onToggleCollapsed?: () => void;
}

/** One rendered row in the rail. Labels + targets are already resolved by
    config/navigation.ts, so a row is display-only. */
interface RailRow {
  to: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  countBadge?: number;
}

// "Sidebar Light" (21st.dev) pattern: active route = elevated pill with a
// brand accent bar (left edge); idle = quiet ghost with a softened hover
// (half-strength fill, medium weight — semibold is reserved for the active row).
const activeClass = (active: boolean) =>
  'relative flex min-h-11 items-center gap-3 rounded-sm px-3 text-body font-semibold transition ' +
  (active
    ? 'bg-accent-100/80 text-accent-800 before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-accent-600 dark:bg-accent-950/60 dark:text-accent-200 dark:before:bg-accent-400'
    : 'text-ink-600 hover:bg-white hover:text-ink-950 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white');

function NavRow({ row, collapsed, onNavigate }: { row: RailRow; collapsed?: boolean; onNavigate?: () => void }) {
  const Icon = row.icon;
  const count = row.countBadge ?? 0;
  const linkClass = `${activeClass(row.active)} ${collapsed ? 'justify-center px-0' : ''}`;
  // Due-review badge: in-flow pill when expanded (label truncates, number
  // clamps to 99+); collapsed → anchored mini-pill at the row's top-right so
  // the icon stays perfectly centered (doesn't drift with the number).
  if (count <= 0) {
    return (
      <Link to={row.to} className={linkClass} onClick={onNavigate} aria-label={row.label} title={collapsed ? row.label : undefined} aria-current={row.active ? 'location' : undefined}>
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        {!collapsed && <span className="min-w-0 flex-1 truncate">{row.label}</span>}
      </Link>
    );
  }
  return (
    <Link to={row.to} className={linkClass} onClick={onNavigate} aria-label={row.label} title={collapsed ? row.label : undefined} aria-current={row.active ? 'location' : undefined}>
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate">{row.label}</span>
          <span
            className="shrink-0 rounded-full bg-warning-100 px-2 py-0.5 text-meta font-bold text-warning-800 dark:bg-warning-900/40 dark:text-warning-200"
            aria-label={`${count} due`}
            title={`${count} due`}
          >
            {count > 99 ? '99+' : count}
          </span>
        </>
      ) : (
        <span
          className="absolute -top-1 -right-1 rounded-full bg-warning-100 px-1 py-px text-[10px] font-bold leading-tight text-warning-800 ring-1 ring-white dark:bg-warning-900/40 dark:text-warning-200 dark:ring-ink-900"
          aria-label={`${count} due`}
          title={`${count} due`}
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}

/**
 * App-shell navigation rail / drawer.
 *
 * ONE place answers "where am I / what next?": a persistent LearnerWaypoint
 * (current A1 band + the exact next node) sits directly under the brand, above
 * four quiet destinations. That is the whole point of the redesign — the rail
 * is a wayfinder, not a catalog.
 *
 * Destinations come from config/navigation.ts (the single nav table), so the
 * rail, the bottom bar and the header context chip can never disagree about
 * labels, targets or which destination is active. Lesson and tool lists live on
 * the /learn spine and the /practice grid.
 *
 * Surfaces:
 *  - Desktop (lg+): permanent fixed rail, FULL height, z-30 (below header
 *    z-50 / toast z-60). The h-16 brand band matches the header row so rail +
 *    header read as one shell; the expand/collapse toggle is pinned to the
 *    rail's BOTTOM edge, with the rail it controls.
 *  - Mobile (<lg): full-screen drawer, z-[55] — above header and bottom nav
 *    (z-50), below the milestone toast (z-[60]). It carries SECONDARY
 *    destinations only: the primary four live in the bottom bar, so the two
 *    surfaces stop competing for the same job.
 *
 * Dashboard is guest-hidden; a live due-review badge rides the Progress row.
 * That badge reads `dueQueue` from useReviewQueue — the SAME single source used
 * by DashboardPage / DailySession / ContinueLearningPage (do not re-filter the
 * raw `queue` here; duplicated predicates drift).
 */
export function AppSidebar({
  mobileOpen = false,
  onClose,
  collapsed = false,
  onToggleCollapsed,
}: AppSidebarProps) {
  const { pathname } = useLocation();
  const { langMode } = useLang();
  const { isAuthenticated } = useAuth();
  const { dueQueue } = useReviewQueue();
  const isDE = langMode === 'german';
  const mobileDrawerRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    mobileDrawerRef.current?.querySelector<HTMLElement>('a[href], button:not([disabled])')?.focus();
    return () => restoreFocusRef.current?.focus();
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = mobileDrawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !mobileDrawerRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !mobileDrawerRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', trapFocus);
    return () => window.removeEventListener('keydown', trapFocus);
  }, [mobileOpen]);

  const dueCount = dueQueue.length;

  // Primary destinations (Today / Learn / Practice / Progress) — resolved from
  // the nav table, so the guest "Lessons" variant and the auth-gated Progress
  // row are handled by ONE place instead of branching per surface.
  const primaryRows: RailRow[] = getPrimaryNav(isAuthenticated).map((item) => ({
    to: navTarget(item, isAuthenticated),
    label: navLabel(item, isAuthenticated, isDE),
    icon: item.icon,
    active: isNavActive(pathname, item, isAuthenticated),
    countBadge: item.badge === 'due' ? dueCount : 0,
  }));

  const activeSecondary = getActiveSecondary(pathname);
  const secondaryRows: RailRow[] = SECONDARY_NAV.map((item) => ({
    to: item.to,
    label: isDE ? item.label.de : item.label.en,
    icon: item.icon,
    active: activeSecondary?.id === item.id,
  }));

  const renderRail = (collapsed: boolean, showCollapseToggle: boolean, variant: 'rail' | 'drawer', onNavigate?: () => void) => (
    <div className="flex h-full flex-col">
      {/* Brand band — h-16 matched to the sticky header row height, with a
          hairline bottom border: the rail top + header read as ONE connected
          system band (Converged Shell). The expand/collapse toggle is pinned
          to the rail's bottom edge (see sidebarToggleBar below); the mobile
          drawer always renders expanded. */}
      <div className="flex h-16 shrink-0 items-center border-b border-ink-200 px-3 dark:border-ink-800">
        {/* Single shell brand mark — same Logo as landing/auth (one brand rules) */}
        <Link
          to={HOME_TO}
          onClick={onClose}
          aria-label={isDE ? 'MeroDeutsch – Startseite' : 'MeroDeutsch – Home'}
          className="flex min-w-0 items-center rounded-sm px-2 py-2 transition hover:bg-white dark:hover:bg-ink-800"
        >
          <Logo size="sm" variant="on-light" showText={!collapsed} />
        </Link>
      </div>

      {/* Learner waypoint — the one thing that is always worth showing. The
          A1 spine is a signed-in benefit, so guests get the sign-in card
          below instead of a progress strip they cannot keep. */}
      {isAuthenticated && (
        <div className="px-3 pt-4">
          <LearnerWaypoint collapsed={collapsed} />
        </div>
      )}

      <nav
        aria-label={
          variant === 'rail'
            ? isDE ? 'Hauptnavigation' : 'Main navigation'
            : isDE ? 'Weitere Navigation' : 'More navigation'
        }
        className="flex flex-1 flex-col overflow-y-auto px-3 py-5"
      >
        {/* PRIMARY — desktop rail only. Below lg the bottom bar owns these, so
            repeating them in the drawer would be the same job done twice. */}
        {variant === 'rail' && (
          <div className="space-y-1">
            {primaryRows.map((row) => (
              <NavRow key={row.to} row={row} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        )}

        {/* SECONDARY — support + account. Pinned to the bottom of the rail so
            the four learning destinations stay the first thing the eye hits. */}
        <div className={`space-y-1 ${variant === 'rail' ? 'mt-auto pt-6' : 'mt-2'}`}>
          {!collapsed && (
            <div className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-500">
              {isDE ? 'Hilfe' : 'Support'}
            </div>
          )}
          {secondaryRows.map((row) => (
            <NavRow key={row.to} row={row} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>
      {!isAuthenticated && !collapsed && (
        <div className="mx-3 mb-3 rounded-sm border border-ink-200 bg-white p-3 dark:border-ink-800 dark:bg-ink-900">
          <p className="mb-2 text-meta font-medium text-ink-500 dark:text-ink-400">
            {isDE ? 'Fortschritt speichern' : 'Save your progress'}
          </p>
          <Link
            to="/auth"
            onClick={onNavigate}
            className="flex min-h-[44px] items-center justify-between rounded-md bg-accent-600 px-3 text-body font-bold text-white transition hover:bg-accent-700"
          >
            {isDE ? 'Anmelden' : 'Sign in'}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      )}
      {showCollapseToggle && onToggleCollapsed && (
        /* Pinned bottom bar — the expand/collapse control lives WITH the rail
            it toggles, so the header never shows a stranded orphan button.
            The mobile drawer passes showCollapseToggle=false (closes via its
            backdrop), so the toggle only appears on the desktop rail. */
        <div className={theme.layout.sidebarToggleBar}>
          {collapsed ? (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-expanded={false}
              aria-label={isDE ? 'Erweitern' : 'Expand sidebar'}
              title={isDE ? 'Erweitern' : 'Expand sidebar'}
              className="mx-auto flex min-h-[44px] w-11 items-center justify-center rounded-sm text-ink-500 transition hover:bg-white hover:text-ink-950 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none active:scale-95 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-white"
            >
              <ChevronsRight className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-expanded={true}
              aria-label={isDE ? 'Einklappen' : 'Collapse sidebar'}
              title={isDE ? 'Einklappen' : 'Collapse sidebar'}
              className="flex min-h-[44px] w-full items-center gap-3 rounded-sm px-3 text-body font-semibold text-ink-500 transition hover:bg-white hover:text-ink-950 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none active:scale-95 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-white"
            >
              <ChevronsLeft className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-left">{isDE ? 'Einklappen' : 'Collapse'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop: permanent fixed rail (z-30, below header z-50 / toast z-60).
          Full-height app shell — brand band + top-level nav are the single
          source of truth; the header insets to the content column on lg+. */}
      <aside
        className={`fixed bottom-0 left-0 top-0 z-30 hidden border-r border-ink-200 bg-ink-50 text-ink-900 lg:block dark:border-ink-800 dark:bg-ink-950 dark:text-ink-100 ${collapsed ? 'w-20' : 'w-64'}`}
      >
        {renderRail(collapsed, true, 'rail')}
      </aside>

      {/* Mobile: slide-in full-screen drawer (z-[55], above header/bottom-nav
          z-50, below milestone toast z-[60]); backdrop dims the page while open */}
      <div
        className={`lg:hidden fixed inset-0 z-[55] flex overflow-x-clip transition-opacity duration-200 ease-in-out ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none invisible opacity-0'
        }`}
        inert={!mobileOpen}
        onKeyDown={(event) => {
          if (mobileOpen && event.key === 'Escape') {
            event.preventDefault();
            onClose?.();
          }
        }}
      >
        <button
          type="button"
          tabIndex={-1}
          className={`flex-1 cursor-default border-0 p-0 transition-colors duration-200 ${mobileOpen ? 'bg-black/40' : 'bg-transparent'}`}
          onClick={onClose}
          aria-label={isDE ? 'Menü schliessen' : 'Close menu'}
        />
        <aside
          id="mobile-site-navigation"
          ref={mobileDrawerRef}
          role={mobileOpen ? 'dialog' : undefined}
          aria-modal={mobileOpen ? true : undefined}
          aria-label={isDE ? 'Seitennavigation' : 'Site navigation'}
          className={`relative h-full w-72 max-w-[85vw] overflow-y-auto border-l border-ink-200 bg-ink-50 text-ink-900 dark:border-ink-800 dark:bg-ink-950 dark:text-ink-100 ${mobileOpen ? 'block' : 'hidden'}`}
        >
          {renderRail(false, false, 'drawer', onClose)}
        </aside>
      </div>
    </>
  );
}