import { Link, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Menu, Moon, Sun, Volume2, VolumeX } from 'lucide-react';
import { theme } from '../config/theme';
import { getModuleRoutes } from '../config/modules';
import { contextLabelFor } from '../config/routeLabels';
import { useDarkMode } from '../hooks/useDarkMode';
import { useLang } from '../hooks/useLang';
import { useAuth } from '../hooks/useAuth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useLastModule } from '../hooks/useLastModule';
import { useXp } from '../hooks/useXp';
import { isAudioEnabled, setAudioEnabled } from '../utils/audioService';
import { Logo } from './common/Logo';
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

/** Top nav + shell — branding/layout only; features live in pages/ */



export function Layout() {
  const { pathname } = useLocation();
  const { dark, toggle: toggleDark } = useDarkMode();
  const { langMode } = useLang();
  const { user } = useAuth();
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
  const contextLabel = contextLabelFor(pathname, isDE);

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

  const link = (to: string, label: string) => {
    const active = to === '/home' ? pathname === '/home' || pathname === '/' : pathname.startsWith(to);
    return (
      <Link to={to} className={active ? theme.layout.navLinkActive : theme.layout.navLink}>
        {label}
      </Link>
    );
  };

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
          className="fixed top-20 left-1/2 z-[60] -translate-x-1/2 flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-lg animate-in fade-in slide-in-from-top-4 duration-300 dark:bg-white dark:text-slate-900"
        >
          <span>{toast.icon} {toast.message}</span>
          <button type="button" onClick={dismissToast} className="text-white/70 hover:text-white dark:text-slate-500 dark:hover:text-slate-900 font-bold" aria-label="Dismiss">
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
        className={`${theme.layout.header} ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}
        role="banner"
      >
        <div className={theme.layout.headerInner}>
          {/* Desktop context chip (lg+): the rail owns top-level nav AND its
              own expand/collapse control (pinned to the rail's bottom edge),
              so the header only shows "where you are" — nothing stranded. */}
          <div className="hidden items-center gap-2 lg:flex">
            <span className={theme.layout.contextChip}>{contextLabel}</span>
          </div>

          {/* Brand — header keeps the logo below lg (mobile/tablet); on lg+
              the rail owns the brand band, so it is hidden here. */}
          <Link to="/home" aria-label="MeroDeutsch – Home" className="inline-flex h-9 items-center transition duration-200 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none focus-visible:ring-offset-2 rounded-lg lg:hidden">
            <Logo size="sm" variant="navbar" />
          </Link>

          {/* Top-level nav links — md through lg only (rail owns nav on lg+) */}
          <nav className={`${theme.layout.nav} hidden md:flex lg:hidden`}>
            {link('/home', 'Home')}
            {user && link('/dashboard', 'Dashboard')}
            {user ? link('/learn', 'Learn') : link('/auth', 'Sign in')}
          </nav>

          {/* Global utilities — every breakpoint: menu (mobile) + language + theme + audio + user */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className={`${theme.layout.themeButton} md:hidden`}
              aria-label={isDE ? 'Menü öffnen' : 'Open menu'}
            >
              <Menu className="h-5 w-5" />
            </button>
            <LanguageToggle />
            <button
              type="button"
              onClick={toggleDark}
              className={theme.layout.themeButton}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !audioEnabled;
                setAudioEnabled(next);
                setAudioEnabledState(next);
              }}
              className={theme.layout.themeButton}
              aria-label={audioEnabled ? 'Mute audio' : 'Unmute audio'}
            >
              {audioEnabled ? <Volume2 className="h-5 w-5" aria-hidden="true" /> : <VolumeX className="h-5 w-5" aria-hidden="true" />}
            </button>
            {user && <UserMenu user={user} />}
          </div>
        </div>
      </header>
      {!isOnline && (
        <div className={`border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/40 dark:text-amber-200 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
          <span aria-hidden="true">📡</span>{' '}
          {langMode === 'german'
            ? 'Du bist offline — gecachte Lektionen funktionieren weiter.'
            : 'You are offline — cached lessons still work.'}
        </div>
      )}
      <main
        id="main-content"
        role="main"
        className={`scroll-mt-24 pb-20 md:pb-8 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} ${isModuleRoute ? 'pt-8' : ''}`}
      >
        {/* Centered content column — same max-w/px as headerInner so the page
            text shares one axis with the header (no ~72px skew). The rail
            inset is the MARGIN on <main>; this wrapper only centers. */}
        <div className={theme.layout.main}>
          {/* Module routes render <ModuleChrome /> (back link + switcher) — the
              breadcrumb would duplicate that navigation context (UI-clutter fix). */}
          {pathname !== '/auth' && !isModuleRoute && <Breadcrumb />}
          {isModuleRoute && <ModuleChrome />}
          <Outlet />
        </div>
      </main>
      {/* Footer rides the content column with the header + main (ml inset) */}
      <Footer className={sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} />
      <BottomNav />
    </div>
  );
}
