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
import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  Bot,
  LayoutDashboard,
  ScrollText,
  ShieldAlert,
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
import { SearchPalette } from './components/SearchPalette';
import { ReadBoundary } from './components/ReadBoundary';
import { fetchAuditLog } from './data/auditLog';
import { fetchContentItems, fetchUnitDocs } from './data/contentItems';
import { fetchUsersIndex } from './data/users';
import { fetchVocabulary } from './data/vocabulary';
import type { SearchIndexInput } from './data/search';
import { NAV_ITEMS, SEARCH_SOURCES } from './data/search';

/**
 * Icons live here, keyed by route, not in `data/search.ts`.
 *
 * The route table itself is shared with the palette — it was duplicated, and the
 * copy in `search.ts` was missing `/debug` entirely, so the QA simulator could
 * not be found by searching for it. The ICONS are React components and belong in
 * the component that renders them; keeping them out of `search.ts` also keeps
 * that module importable by a pure check suite with no DOM.
 *
 * The `planned` flag is gone. Every destination in this table is a live route,
 * and nothing in the app was in the "Soon" state — so the flag was a code path
 * that no input could ever reach, guarded by a comment describing a condition
 * that had not been true for several phases.
 */
const NAV_ICONS: Readonly<Record<string, LucideIcon>> = {
  '/': LayoutDashboard,
  '/users': Users,
  '/curriculum': BookOpen,
  '/vocabulary': Type,
  '/chatbot': Bot,
  '/integrity': ShieldAlert,
  '/audit-log': ScrollText,
  '/analytics': Activity,
  '/system': SettingsIcon,
  '/debug': Wrench,
};

/** The host this build is served from, shown so an admin always knows which app they are in. */
function useAdminHost(): string {
  if (typeof window === 'undefined') return 'admin';
  return window.location.host;
}

export { NAV_ITEMS };

/**
 * ── REMOVED: `startCurriculumResolution()` on mount ──────────────────────────
 * This called the learner app's curriculum resolver, with a comment explaining
 * that it "makes `curriculum_source` real". On the ADMIN origin it does nothing
 * observable: the control centre's own read model (`data/curriculum.ts`) imports
 * `RESOLVED_PATH` directly as a module constant, and nothing in `src/admin`
 * calls `getActivePath()`. It set module state that nothing read.
 *
 * It read as load-bearing, which is the real cost — a reader would reasonably
 * conclude that removing it would serve the bundle to learners. The flag is
 * genuinely inert until the LEARNER app boots, and `src/main.tsx` is where that
 * happens, via `runBootGate()`.
 */
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

  // ── THE PALETTE INDEX ───────────────────────────────────────────────────────
  //
  // This used to rebuild on EVERY route change (`useEffect(refreshIndex,
  // [location.pathname])`), which is twelve queries — users alone is six —
  // fired again every time an admin clicked a nav item. It also threw away the
  // `errors` array that all five loaders already return, so an RLS regression
  // that emptied one group produced a palette that quietly stopped finding
  // users, with nothing anywhere saying so.
  //
  // Now: build once at mount, and rebuild only when the palette is actually
  // opened and the index is older than a minute. Same freshness for the one
  // moment it is read, a fraction of the cost everywhere else.
  const [searchIndex, setSearchIndex] = useState<SearchIndexInput>({});
  const [indexErrors, setIndexErrors] = useState<string[]>([]);
  const builtAt = useRef(0);
  const building = useRef(0);

  const refreshIndex = useCallback(async () => {
    // A run id, so a slow response from a superseded refresh cannot overwrite a
    // newer one. Without it, opening the palette twice quickly races and the
    // slower first response wins.
    const run = building.current + 1;
    building.current = run;

    const results = await Promise.allSettled([
      fetchUsersIndex(),
      fetchVocabulary(),
      fetchAuditLog(200),
      fetchContentItems(),
      fetchUnitDocs(),
    ]);
    if (building.current !== run) return;

    const [users, vocab, audit, content, units] = results.map((r) =>
      r.status === 'fulfilled' ? r.value : null,
    ) as [
      Awaited<ReturnType<typeof fetchUsersIndex>> | null,
      Awaited<ReturnType<typeof fetchVocabulary>> | null,
      Awaited<ReturnType<typeof fetchAuditLog>> | null,
      Awaited<ReturnType<typeof fetchContentItems>> | null,
      Awaited<ReturnType<typeof fetchUnitDocs>> | null,
    ];

    // Surfaced rather than swallowed. A palette missing a group should say which.
    setIndexErrors(
      results.flatMap((r, i) =>
        r.status === 'rejected'
          ? [`${SEARCH_SOURCES[i]}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`]
          : [],
      ),
    );

    setSearchIndex({
      // `.catch(() => ({ rows: [] }))` used to make a rejected read look identical
      // to an empty table, so a failure and a genuinely empty group rendered
      // the same silent absence.
      users: users?.rows,
      vocabulary: vocab?.rows,
      audit: audit?.entries,
      content: content?.rows,
      unitDocs: units?.docs,
    });    builtAt.current = Date.now();
  }, []);

  useEffect(() => {
    void refreshIndex();
  }, [refreshIndex]);

  const openPalette = useCallback(() => {
    if (Date.now() - builtAt.current > 60_000) void refreshIndex();
  }, [refreshIndex]);

  const displayName = profile?.full_name || profile?.username || session?.user.email || 'Admin';

  const nav = (
    <nav className="flex flex-col gap-1 p-3" aria-label="Admin sections">
      {NAV_ITEMS.map((item) => {
        const Icon = NAV_ICONS[item.to];
        const classes = (active: boolean) =>
          [
            'flex min-h-[44px] items-center gap-3 rounded-md px-3 text-body font-medium transition',
            active
              ? 'bg-accent-50 text-accent-700 dark:bg-accent-950/50 dark:text-accent-300'
              : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-50',
          ].join(' ');

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
            {/* A panel that throws costs you that panel, not the shell.
                A rejected read in a `useEffect` unmounts the whole React tree by
                default, which is how one missing database function once turned
                the entire control centre into a blank page. */}
            <ReadBoundary label="This page">
              <Outlet />
            </ReadBoundary>
          </div>
        </main>
      </div>

      <SearchPalette index={searchIndex} onOpen={openPalette} errors={indexErrors} />
    </div>
  );
}
