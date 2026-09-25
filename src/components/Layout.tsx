import { Link, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Menu, Volume2, VolumeX } from 'lucide-react';
import { theme } from '../config/theme';
import { getModuleRoutes } from '../config/modules';
import { navSectionFor } from '../config/navigation';
import { railSpecFor } from '../config/moduleRail';
import { contextLabelFor } from '../config/routeLabels';
import { ContextPanel } from './ContextPanel';
import { useLang } from '../hooks/useLang';
import { useAuth } from '../hooks/useAuth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useLastModule } from '../hooks/useLastModule';
import { useXp } from '../hooks/useXp';
import { isAudioEnabled, setAudioEnabled } from '../utils/audioService';
import { Logo } from './common/Logo';
import { ThemeToggle } from './common/ThemeToggle';
import { Footer } from './Footer';
import { ModuleChrome } from './learning/ModuleChrome';
import { BottomNav } from './BottomNav';
import { AppSidebar } from './AppSidebar';
import { Breadcrumb } from './Breadcrumb';
import { UserMenu } from './UserMenu';
import { LanguageToggle } from './LanguageToggle';
import { LevelUpModal } from './LevelUpModal';
import { useMilestoneToast } from '../hooks/useMilestoneToast';
import { A1PathVisitTracker } from './path/A1PathVisitTracker';
import { subscribeDailySessionActive } from '../lib/dailySessionSignal';

/**
 * App shell: context bar + content column.
 *
 * The header is a UTILITY bar, not a second navigation system. Destinations
 * live in the rail (lg+) and the bottom bar (<lg); this header only answers
 * "where am I?" (the context chip) and offers the global utilities. It used to
 * also render a fourth copy of the top-level links for md–lg widths, which is
 * exactly the duplication the nav redesign removes — the bottom bar now
 * extends to `lg` so tablet keeps primary navigation without them.
 */

export function Layout() {
  const { pathname } = useLocation();
  const { langMode } = useLang();
  const { user, isAuthenticated } = useAuth();
  const { isOnline } = useOnlineStatus();
  const { rememberModule } = useLastModule();
  const { rank, onLevelUp } = useXp();
  const [levelUpModalOpen, setLevelUpModalOpen] = useState(false);
  const [newLevel, setNewLevel] = useState(1);
  const [audioEnabled, setAudioEnabledState] = useState(isAudioEnabled);
  const { toast, showToast, dismissToast } = useMilestoneToast();
  const [dailySessionActive, setDailySessionActiveState] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingLevelUp, setPendingLevelUp] = useState<number | null>(null);
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [sidebarOpen]);

  // Desktop sidebar collapsed state (persisted per device).
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('meroDeutschSidebarCollapsed') === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('meroDeutschSidebarCollapsed', sidebarCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  const isDE = langMode === 'german';
  // "Where am I?" comes from the nav table, so the header chip and the
  // rail/bottom-bar active rows can never name the same section differently.
  const { label: contextGroup, icon: ContextIcon } = navSectionFor(pathname, isAuthenticated, isDE);
  // Which exact page, from the route label table (the single label source the
  // breadcrumb and practice cards already read).
  const contextPage = contextLabelFor(pathname, isDE);

  // U6: the daily review session runs on Home/Learn — not a "quiz route" by
  // pathname. Subscribe to the module signal so level-ups mid-batch render as
  // non-blocking toasts, never the full-screen modal.
  useEffect(() => subscribeDailySessionActive(setDailySessionActiveState), []);

  // Check if current route is a quiz, blitz, or active training session (Phase D: TTS/Modal safety)
    const isActiveQuizRoute =
    dailySessionActive || // Daily review batch active (U6)
    pathname.includes('/rapid-fire') ||
    pathname.includes('/rapid-blitz') ||
    pathname.startsWith('/checkpoint') || // A1 unit checkpoint = active quiz
    pathname.endsWith('/quiz') ||
    pathname.includes('/dictation') ||
    pathname.includes('/pronunciation') ||
    pathname.includes('/sentence-builder') ||
    // Per-module training/quiz surfaces (C2.7: level-ups here toast, never modal)
    pathname === '/articles' ||
    pathname === '/vocab-trainer' ||
    pathname === '/numbers' ||
    pathname === '/calendar' ||
    pathname === '/alphabet' ||
    pathname === '/greetings' ||
    pathname === '/article-sprint';

  // Global level-up listener — any module that awards XP can trigger the modal.
  useEffect(() => {
    onLevelUp((lvl) => {
      setNewLevel(lvl);
      if (isActiveQuizRoute) {
        // Delay full-screen blocking modal; show non-blocking toast instead (Phase D)
        setPendingLevelUp(lvl);
        showToast({
          message: isDE ? `Level ${lvl} erreicht! ⭐` : `Level ${lvl} reached! ⭐`,
          icon: '⭐',
        });
      } else {
        setLevelUpModalOpen(true);
      }
    });
  }, [onLevelUp, isActiveQuizRoute, isDE, showToast]);

  // Flush pending level-up modal when returning to a non-quiz page (Phase D)
  useEffect(() => {
    if (!isActiveQuizRoute && pendingLevelUp !== null) {
      setNewLevel(pendingLevelUp);
      setLevelUpModalOpen(true);
      setPendingLevelUp(null);
    }
  }, [pathname, isActiveQuizRoute, pendingLevelUp]);

  // Module routes that should show the chrome navigation bar (from registry)
  const moduleRoutes = getModuleRoutes();
  const isModuleRoute = moduleRoutes.includes(pathname);

  // Track last opened module for "Continue learning" on Home.
  useEffect(() => {
    rememberModule(pathname);
  }, [pathname, rememberModule]);

  // ── Shell geometry ──────────────────────────────────────────────────────
  // The fixed rail owns the left edge, so every content-layer sibling
  // (header / offline banner / main / footer) must be pulled in by the SAME
  // inset. This used to be duplicated as a literal `lg:ml-20|lg:ml-64` in four
  // separate places; one constant is the single source of truth now.
  const railInset = sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64';

  // The rail is EXCEPTIONAL: only routes registered in config/moduleRail.ts get
  // one (today: /learn only). Every other route renders the single-column
  // layout, so nothing can accidentally reserve 288px of dead space. The SPEC
  // is the layout switch, never the pathname.
  const railSpec = railSpecFor(pathname);

  return (
    <div className={theme.layout.app}>
      {/* Global level-up celebration — mounted once, fires from any module */}
      <LevelUpModal
        isOpen={levelUpModalOpen}
        level={newLevel}
        rank={rank}
        onClose={() => setLevelUpModalOpen(false)}
      />

      {/* Global non-blocking milestone/level-up toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 left-1/2 z-[60] -translate-x-1/2 flex items-center gap-3 rounded-md bg-ink-900 px-4 py-3 text-body font-bold text-white shadow-lg animate-in fade-in slide-in-from-top-4 duration-300 dark:bg-white dark:text-ink-900"
        >
          <span>{toast.icon} {toast.message}</span>
          <button type="button" onClick={dismissToast} className="text-white/70 hover:text-white dark:text-ink-500 dark:hover:text-ink-900 font-bold" aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {/* A1 path visit tracking (lesson-complete rule A) — renders nothing */}
      <A1PathVisitTracker />

      {/* Skip to main content link for keyboard navigation */}
      <a href="#main-content" className="skip-to-main">
        {langMode === 'german' ? 'Zum Hauptinhalt springen' : 'Skip to main content'}
      </a>
      <AppSidebar
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
      />
      {/* Header rides the content column: the fixed rail owns the left shell,
          so the sticky header is pulled in with a MARGIN (lg:ml-*) — left/right
          offsets don't move sticky elements on a vertical-scroll page. */}
      <header
        className={`${theme.layout.header} ${railInset}`}
        role="banner"
      >
        <div className={theme.layout.headerInner}>
          {/* Desktop context chip (lg+): the rail owns top-level nav AND its
              own expand/collapse control (pinned to the rail's bottom edge),
              so the header only shows "where you are" — nothing stranded. */}
          <div className="hidden min-w-0 items-center gap-3 lg:flex">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-accent-50 text-accent-700 dark:bg-accent-950/60 dark:text-accent-300">
              <ContextIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              {/* Editorial chip: the SECTION is the kicker, the PAGE is the
                  value. Previously the kicker was a hardcoded "WORKSPACE"
                  and the value repeated the section — so the chip could never
                  tell you WHICH page you were on, only which section. */}
              <span className={`${theme.type.kicker} block`}>{contextGroup}</span>
              <span className={`${theme.type.section} block truncate`}>{contextPage}</span>
            </span>
          </div>

          {/* Brand — header keeps the logo below lg (mobile/tablet); on lg+
              the rail owns the brand band, so it is hidden here. */}
           <Link to="/home" aria-label={isDE ? 'MeroDeutsch – Startseite' : 'MeroDeutsch – Home'} className="inline-flex h-9 items-center transition duration-200 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none focus-visible:ring-offset-2 rounded-sm lg:hidden">
            <Logo size="sm" variant="navbar" showText={false} />
          </Link>

          {/* Section context — shown on every width, right-aligned next to the
              utilities. This is the header's only job; destinations live in the
              rail (lg+) and the bottom bar (<lg). */}
          <div className="min-w-0 flex-1 lg:hidden">
            <span className="block truncate text-meta font-bold text-ink-600 dark:text-ink-300">{contextGroup}</span>
          </div>

          {/* Global utilities — every breakpoint: menu (mobile/tablet) + language + theme + audio + user */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className={`${theme.layout.themeButton} lg:hidden`}
              aria-expanded={sidebarOpen}
              aria-controls="mobile-site-navigation"
              aria-label={isDE ? 'Menü öffnen' : 'Open menu'}
            >
              <Menu className="h-5 w-5" />
            </button>
            <LanguageToggle />
            <ThemeToggle />
            <button
              type="button"
              onClick={() => {
                const next = !audioEnabled;
                setAudioEnabled(next);
                setAudioEnabledState(next);
              }}
              className={theme.layout.themeButton}
              aria-label={audioEnabled ? (isDE ? 'Ton ausschalten' : 'Mute audio') : (isDE ? 'Ton einschalten' : 'Unmute audio')}
            >
              {audioEnabled ? <Volume2 className="h-5 w-5" aria-hidden="true" /> : <VolumeX className="h-5 w-5" aria-hidden="true" />}
            </button>
            {user && <UserMenu user={user} />}
          </div>
        </div>
      </header>
      {!isOnline && (
        <div className={`border-b border-warning-200 bg-warning-50 px-4 py-2 text-center text-body font-medium text-warning-800 dark:border-warning-800/50 dark:bg-warning-950/40 dark:text-warning-200 ${railInset}`}>
          <span aria-hidden="true">📡</span>{' '}
          {langMode === 'german'
            ? 'Du bist offline — gecachte Lektionen funktionieren weiter.'
            : 'You are offline — cached lessons still work.'}
        </div>
      )}
      <main
        id="main-content"
        role="main"
        className={`scroll-mt-24 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8 ${railInset} ${isModuleRoute ? 'pt-4' : ''}`}
      >
        {/* Page content, shared by both layout branches. Extracted so the rail
            and no-rail branches can never drift apart. */}
        {(() => {
          const page = (
            <>
              {/* Module routes render <ModuleChrome /> (back link + switcher) — the
                  breadcrumb would duplicate that navigation context (UI-clutter fix). */}
              {pathname !== '/auth' && !isModuleRoute && <Breadcrumb />}
              {isModuleRoute && <ModuleChrome />}
              <Outlet />
            </>
          );
          // Both columns ride the SAME max-w-7xl wrapper so the rail sits on
          // the page's right edge instead of floating in the gutter. Below xl
          // the rail is `hidden` and the content column goes full width again.
          return railSpec ? (
            <div className={`${theme.layout.main} flex gap-8`}>
              <div className="min-w-0 flex-1">{page}</div>
              <ContextPanel spec={railSpec} />
            </div>
          ) : (
            <div className={theme.layout.main}>{page}</div>
          );
        })()}
      </main>
      {/* Footer rides the content column with the header + main (ml inset) */}
      <Footer className={railInset} />
      <BottomNav />
    </div>
  );
}
