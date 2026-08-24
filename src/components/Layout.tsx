import { Link, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Moon, Sun, Volume2, VolumeX } from 'lucide-react';
import { theme } from '../config/theme';
import { getModuleRoutes } from '../config/modules';
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
  const [pendingLevelUp, setPendingLevelUp] = useState<number | null>(null);
  const [dailySessionActive, setDailySessionActiveState] = useState(false);

  const isDE = langMode === 'german';

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
    pathname.includes('/sentence-builder');

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
    const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
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
      
      <header className={theme.layout.header} role="banner">
        <div className={theme.layout.headerInner}>
          {/* Logo is a link → Home */}
          <Link to="/" aria-label="MeroDeutsch – Home" className="inline-flex h-9 items-center transition duration-200 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none focus-visible:ring-offset-2 rounded-lg">
            <Logo size="sm" variant="navbar" />
          </Link>
          <nav className={`${theme.layout.nav} hidden md:flex`}>
            {link('/', 'Home')}
            {user && link('/dashboard', 'Dashboard')}
            {user ? link('/learn', 'Learn') : link('/auth', 'Sign in')}
            {/* Two-state language switch — highlighted side = CURRENT mode */}
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
          </nav>
          {/* Mobile-only controls — nav is hidden below md */}
          <div className="flex items-center gap-2 md:hidden">
            {/* Two-state language switch (mobile) — highlighted side = CURRENT mode */}
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
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/40 dark:text-amber-200">
          <span aria-hidden="true">📡</span>{' '}
          {langMode === 'german'
            ? 'Du bist offline — gecachte Lektionen funktionieren weiter.'
            : 'You are offline — cached lessons still work.'}
        </div>
      )}
      <main
        id="main-content"
        role="main"
        className={`${theme.layout.main} px-4 scroll-mt-24 pb-20 md:pb-8 ${isModuleRoute ? 'pt-8' : ''}`}
      >
        {pathname !== '/auth' && <Breadcrumb />}
        {isModuleRoute && <ModuleChrome />}
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
