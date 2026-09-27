/**
 * src/admin/AdminLayout.tsx
 *
 * Control-center shell: sidebar nav, header, mobile drawer.
 *
 * DESIGN SYSTEM: every colour, radius and type step comes from the shared tokens
 * — `theme.*` (src/config/theme.ts) and the `@theme` block in src/index.css. No
 * one-off hexes and no new palette. This is an additive consumer of the Quiet
 * Premium system, not a variant of it.
 *
 * Z-INDEX (aligned with the learner app so the two never disagree):
 *   header / drawer   z-50  — same band as `theme.layout.header`
 *   drawer scrim      z-40  — beneath the header
 *   page content      default
 * The control center has no quiz surface, so there is no "toast above content"
 * requirement to satisfy here.
 */
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings as SettingsIcon,
  Shield,
  Sun,
  Type,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { theme } from '../config/theme';
import { useDarkMode } from '../hooks/useDarkMode';
import { useAdminAuth } from './hooks/useAdminAuth';
import { ModeSwitcher } from './components/ModeSwitcher';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Ships in a later phase; rendered disabled so the map is honest. */
  planned?: boolean;
}

/**
 * The full route map. `planned: true` renders a disabled "Soon" chip rather than
 * a dead link — a nav item that pretends to work is worse than one that says it
 * isn't ready.
 */
/**
 * The full route map. Every destination is live; `planned` now only ever marks
 * something genuinely unbuilt, and nothing in the app is in that state.
 */
const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/curriculum', label: 'Curriculum', icon: BookOpen },
  { to: '/vocabulary', label: 'Vocabulary', icon: Type },
  { to: '/analytics', label: 'Analytics', icon: Activity },
  { to: '/system', label: 'System', icon: SettingsIcon },
  // The QA simulator reaches into the learner app, so it is listed with the
  // real tools rather than deferred.
  { to: '/debug', label: 'QA simulator', icon: Wrench },
];

/** The host this build is served from, shown so an admin always knows which app they are in. */
function useAdminHost(): string {
  if (typeof window === 'undefined') return 'admin';
  return window.location.host;
}

export function AdminLayout() {
  const { profile, session, signOut } = useAdminAuth();
  const { dark, toggle } = useDarkMode();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const host = useAdminHost();

  // Close the drawer on navigation so a tapped link does not leave the scrim
  // covering the page it just navigated to.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const displayName = profile?.full_name || profile?.username || session?.user.email || 'Admin';

  const nav = (
    <nav className="flex flex-col gap-1 p-3" aria-label="Admin sections">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const classes = (active: boolean) =>
          [
            'flex min-h-[44px] items-center gap-3 rounded-md px-3 text-body font-medium transition',
            active
              ? 'bg-accent-50 text-accent-700 dark:bg-accent-950/50 dark:text-accent-300'
              : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-50',
            item.planned ? 'opacity-55' : '',
          ].join(' ');

        // Planned destinations stay real anchors so the URL is inspectable, but
        // they are aria-disabled and cannot be activated.
        if (item.planned) {
          return (
            <span key={item.to} aria-disabled="true" title="Not shipped yet" className={classes(false)}>
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="flex-1">{item.label}</span>
              <span className="text-micro font-semibold uppercase tracking-wide text-ink-400">Soon</span>
            </span>
          );
        }

        return (
          <NavLink key={item.to} to={item.to} end className={({ isActive }) => classes(isActive)}>
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="flex-1">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2 border-b border-ink-200 px-4 py-4 dark:border-ink-800">
      <Shield className="h-5 w-5 text-accent-600" aria-hidden="true" />
      <div className="min-w-0">
        <p className={theme.type.kicker}>Control center</p>
        <p className="truncate text-body font-bold text-ink-900 dark:text-ink-50">MeroDeutsch</p>
      </div>
    </div>
  );

  return (
    <div className="app-shell flex min-h-screen bg-ink-50 dark:bg-ink-950">
      {/* Desktop rail */}
      <aside className="hidden w-64 shrink-0 border-r border-ink-200 bg-white lg:block dark:border-ink-800 dark:bg-ink-900">
        <div className="sticky top-0">
          {brand}
          {nav}
        </div>
      </aside>

      {/* Mobile drawer — scrim sits under the header band, drawer over it */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink-950/50 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 w-72 border-r border-ink-200 bg-white transition-transform lg:hidden dark:border-ink-800 dark:bg-ink-900',
          drawerOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        aria-hidden={!drawerOpen}
      >
        <div className="border-b border-ink-200 dark:border-ink-800">{brand}</div>
        {nav}
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          className={`${theme.button.icon} m-3`}
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header: host indicator + account. Solid surface, hairline only. */}
        <header className={theme.layout.header}>
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className={theme.button.icon}
                aria-label="Open navigation"
                aria-expanded={drawerOpen}
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
              {/* Domain indicator: an admin must never confuse this origin with
                  the learner app they are also signed in to. */}
              <p className="min-w-0 truncate text-meta font-semibold text-ink-600 dark:text-ink-400">
                {host}
              </p>
            </div>

            {/* QA mode lives in the NAVBAR, not behind a page. Switching the
                identity the app is being reviewed as is something an admin does
                repeatedly while looking at something else, so it must be one
                click away from any screen. Hidden on small screens, where the
                drawer and the /debug page remain the route to it. */}
            <div className="hidden xl:block">
              <ModeSwitcher />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggle}
                className={theme.button.icon}
                aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {dark ? (
                  <Sun className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Moon className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
              <span className="hidden max-w-[16rem] truncate text-meta font-semibold text-ink-700 lg:inline dark:text-ink-300">
                {displayName}
              </span>
              <button type="button" onClick={() => void signOut()} className={theme.button.secondary}>
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6">
          <div className="mx-auto w-full max-w-content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
