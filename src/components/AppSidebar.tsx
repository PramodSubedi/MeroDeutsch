import { Link, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  BookA,
  BookOpen,
  ChevronsLeft,
  ChevronsRight,
  Home,
  LayoutDashboard,
  Library,
  Play,
  Send,
  Settings,
} from 'lucide-react';
import { theme } from '../config/theme';
import { Logo } from './common/Logo';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../hooks/useLang';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { A1PathProgress } from './path/A1PathProgress';
import { ANCHORS } from '../lib/anchors';

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

interface NavItem {
  to: string;
  labelEn: string;
  labelDe: string;
  icon: LucideIcon;
  authOnly?: boolean;
  countBadge?: number;
  /** Optional in-page anchor appended to `to` (e.g. '#learning-path'). */
  anchor?: string;
}

// "Sidebar Light" (21st.dev) pattern: active route = elevated pill with a
// brand accent bar (left edge); idle = quiet ghost with a softened hover
// (half-strength fill, medium weight — semibold is reserved for the active row).
const activeClass = (active: boolean) =>
  'relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium transition ' +
  (active
    ? 'bg-white font-semibold text-blue-700 shadow-sm ring-1 ring-slate-200 before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-blue-600 dark:bg-slate-800/70 dark:text-blue-300 dark:ring-slate-700/60 dark:before:bg-blue-400'
    : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white');

function NavRow({ item, active, isDE, collapsed }: { item: NavItem; active: boolean; isDE: boolean; collapsed?: boolean }) {
  const Icon = item.icon;
  const count = item.countBadge ?? 0;
  const linkClass = `${activeClass(active)} ${collapsed ? 'justify-center px-0' : ''}`;
  // Due-review badge: in-flow pill when expanded (label truncates, number
  // clamps to 99+); collapsed → anchored mini-pill at the row's top-right so
  // the icon stays perfectly centered (doesn't drift with the number).
  if (count <= 0) {
    return (
      <Link to={item.anchor ? `${item.to}${item.anchor}` : item.to} className={linkClass}>
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        {!collapsed && <span className="min-w-0 flex-1 truncate">{isDE ? item.labelDe : item.labelEn}</span>}
      </Link>
    );
  }
  return (
    <Link to={item.anchor ? `${item.to}${item.anchor}` : item.to} className={linkClass}>
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate">{isDE ? item.labelDe : item.labelEn}</span>
          <span
            className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
            aria-label={`${count} due`}
            title={`${count} due`}
          >
            {count > 99 ? '99+' : count}
          </span>
        </>
      ) : (
        <span
          className="absolute -top-1 -right-1 rounded-full bg-amber-100 px-1 py-px text-[10px] font-bold leading-tight text-amber-800 ring-1 ring-white dark:bg-amber-900/40 dark:text-amber-200 dark:ring-slate-900"
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
 * Project-wide navigation sidebar.
 * - Desktop: permanent fixed rail spanning the FULL height (top-0 = starts at
 *   the very top, same y as the sticky header). A h-16 brand band at the top
 *   matches the header row height and carries a hairline bottom border; the
 *   expand/collapse toggle is pinned to the rail's BOTTOM edge (below the
 *   nav) — it lives WITH the rail it controls, not stranded in the header.
 *   The header is inset to the content column (Layout applies lg:ml-64 /
 *   lg:ml-20 margins) and shares the SAME surface (bg-white / dark:bg-slate-900),
 *   so header + rail read as one continuous shell. Rail z-30 < header z-50.
 * - Mobile: full-screen drawer driven by `mobileOpen`; z-[55] covers the
 *   header (z-50) and bottom nav (z-50) while open, but stays below the
 *   milestone toast (z-[60]).
 * Top-level IA only (Home / Learn / Practice / Dashboard + Support links):
 * the lesson list lives in the /learn hub and the tool list in /practice —
 * the sidebar is a wayfinder, not a catalog. The A1 band at the bottom is a
 * compact progress strip, not a lesson list.
 * Dashboard is guest-hidden; a live due-review badge is shown on it. The
 * badge reads `dueQueue` from useReviewQueue — the SAME single source used
 * by DashboardPage / DailySession / ContinueLearningPage (do not re-filter
 * the raw `queue` here; duplicated predicates drift).
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

  const dueCount = dueQueue.length;

  // Path is a signed-in benefit (locked product rule): guests get a "Lessons"
  // shortcut to the module-card grid on /home instead of the /learn spine.
  const mainItems: NavItem[] = [
    { to: HOME_TO, labelEn: 'Home', labelDe: 'Startseite', icon: Home },
    isAuthenticated
      ? { to: '/learn', labelEn: 'Learn', labelDe: 'Lernen', icon: Play }
      : { to: HOME_TO, anchor: `#${ANCHORS.learningPath}`, labelEn: 'Lessons', labelDe: 'Lektionen', icon: BookA },
    { to: '/dashboard', labelEn: 'Dashboard', labelDe: 'Übersicht', icon: LayoutDashboard, authOnly: true, countBadge: dueCount },
    { to: '/practice', labelEn: 'Practice', labelDe: 'Übung', icon: Library },
  ];

  if (!isAuthenticated) {
    const idx = mainItems.findIndex((i) => i.to === '/dashboard');
    if (idx >= 0) {
      mainItems.splice(idx, 1, { to: '/auth', labelEn: 'Sign in', labelDe: 'Anmelden', icon: Play });
    }
  }

  const supportItems: NavItem[] = [
    { to: '/help', labelEn: 'Help', labelDe: 'Hilfe', icon: BookOpen },
    { to: '/settings', labelEn: 'Settings', labelDe: 'Einstellungen', icon: Settings },
    { to: '/feedback', labelEn: 'Send feedback', labelDe: 'Feedback senden', icon: Send },
  ];

  const isActive = (item: NavItem) => {
    if (item.anchor) return false; // shortcut rows never hold the active state
    const to = item.to;
    return to === HOME_TO ? pathname === HOME_TO || pathname === '/' : pathname === to || pathname.startsWith(to + '/');
  };

  const sections: { titleEn: string; titleDe: string; items: NavItem[] }[] = [
    { titleEn: 'Main', titleDe: 'Hauptmenü', items: mainItems },
    { titleEn: 'Support', titleDe: 'Unterstützung', items: supportItems },
  ];

  const renderRail = (collapsed: boolean, showCollapseToggle: boolean) => (
    <div className="flex h-full flex-col">
      {/* Brand band — h-16 matched to the sticky header row height, with a
          hairline bottom border: the rail top + header read as ONE connected
          system band (Converged Shell). The expand/collapse toggle is pinned
          to the rail's bottom edge (see sidebarToggleBar below); the mobile
          drawer always renders expanded. */}
      <div className="flex h-16 shrink-0 items-center border-b border-slate-200 px-2 dark:border-slate-800">
        {/* Single shell brand mark — same Logo as landing/auth (one brand rules) */}
        <Link
          to={HOME_TO}
          aria-label="MeroDeutsch – Home"
          className="flex min-w-0 items-center rounded-xl px-2 py-1.5 transition hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Logo size="sm" showText={!collapsed} />
        </Link>
      </div>
      <nav className="flex flex-1 flex-col overflow-y-auto p-3">
        {sections.map((section) => {
          const visible = section.items.filter((it) => !it.authOnly || isAuthenticated);
          if (visible.length === 0) return null;
          return (
            <div key={section.titleEn} className="mb-4">
              {!collapsed && (
                <div className="mb-1 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {isDE ? section.titleDe : section.titleEn}
                </div>
              )}
              <div className="space-y-1">
                {visible.map((item) => (
                  <NavRow key={item.to} item={item} active={isActive(item)} isDE={isDE} collapsed={collapsed} />
                ))}
              </div>
            </div>
          );
        })}
        {isAuthenticated && !collapsed && (
          <div className="mt-auto border-t border-slate-200 pt-3 dark:border-slate-800">
            <A1PathProgress compact />
            <Link
              to="/learn"
              className="mt-2 flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/30"
            >
              {isDE ? 'Zum Lernpfad →' : 'Go to path →'}
            </Link>
          </div>
        )}
      </nav>
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
              className="mx-auto flex min-h-[44px] w-11 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none active:scale-95 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
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
              className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none active:scale-95 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
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
        className={`fixed bottom-0 left-0 top-0 z-30 hidden border-r border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900 ${collapsed ? 'w-20' : 'w-64'}`}
      >
        {renderRail(collapsed, true)}
      </aside>

      {/* Mobile: slide-in full-screen drawer (z-[55], above header/bottom-nav
          z-50, below milestone toast z-[60]); backdrop dims the page while open */}
      <div
        className={`lg:hidden fixed inset-0 z-[55] flex transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        inert={!mobileOpen}
      >
        <div
          className={`flex-1 transition-colors duration-200 ${mobileOpen ? 'bg-black/40' : 'bg-transparent'}`}
          onClick={onClose}
          aria-label={isDE ? 'Menü schliessen' : 'Close menu'}
        />
        <aside className="relative h-full w-64 max-w-xs overflow-y-auto border-l border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
          {renderRail(false, false)}
        </aside>
      </div>
    </>
  );
}