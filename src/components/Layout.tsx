import { Link, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { theme } from '../config/theme';
import { getModuleRoutes } from '../config/modules';
import { useDarkMode } from '../hooks/useDarkMode';
import { useLang } from '../hooks/useLang';
import { useTranslation } from '../hooks/useTranslation';
import { sharedTranslations } from '../data/sharedContent';
import { useAuth } from '../hooks/useAuth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useLastModule } from '../hooks/useLastModule';
import { useXp } from '../hooks/useXp';
import { BrandMark } from './BrandMark';
import { Footer } from './Footer';
import { ModuleChrome } from './learning/ModuleChrome';
import { BottomNav } from './BottomNav';
import { Breadcrumb } from './Breadcrumb';
import { UserMenu } from './UserMenu';
import { LevelUpModal } from './LevelUpModal';

/** Top nav + shell — branding/layout only; features live in pages/ */
export function Layout() {
  const { pathname } = useLocation();
  const { dark, toggle: toggleDark } = useDarkMode();
  const { langMode, toggle: toggleLang } = useLang();
  const { user } = useAuth();
  const { t } = useTranslation(langMode);
  const { isOnline } = useOnlineStatus();
  const { rememberModule } = useLastModule();
  const { rank, onLevelUp } = useXp();
  const [levelUpModalOpen, setLevelUpModalOpen] = useState(false);
  const [newLevel, setNewLevel] = useState(1);

  // Global level-up listener — any module that awards XP can trigger the modal.
  useEffect(() => {
    onLevelUp((lvl) => {
      setNewLevel(lvl);
      setLevelUpModalOpen(true);
    });
  }, [onLevelUp]);

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
      {/* Skip to main content link for keyboard navigation */}
      <a href="#main-content" className="skip-to-main">
        {langMode === 'german' ? 'Zum Hauptinhalt springen' : 'Skip to main content'}
      </a>
      
      <header className={theme.layout.header} role="banner">
        <div className={theme.layout.headerInner}>
          {/* Logo is a link → Home */}
          <BrandMark linked light className="text-lg" />
          <nav className={`${theme.layout.nav} hidden md:flex`}>
            {link('/', 'Home')}
            {user && link('/dashboard', 'Dashboard')}
            {user ? link('/learn', 'Learn') : link('/auth', 'Sign in')}
            <button
              type="button"
              onClick={toggleLang}
              className={theme.layout.toggleButton}
              aria-label={langMode === 'normal' ? 'Switch to German' : 'Switch to English'}
            >
              {langMode === 'normal'
                ? t(sharedTranslations.navigation.toggleGerman)
                : t(sharedTranslations.navigation.toggleNormal)}
            </button>
            <button
              type="button"
              onClick={toggleDark}
              className={theme.layout.themeButton}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? '☀️' : '🌙'}
            </button>
            {user && <UserMenu user={user} />}
          </nav>
          {/* Mobile-only controls — nav is hidden below md */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={toggleLang}
              className={theme.layout.toggleButton}
              aria-label={langMode === 'normal' ? 'Switch to German (DE)' : 'Switch to English (EN)'}
            >
              {langMode === 'normal' ? 'DE' : 'EN'}
            </button>
            <button
              type="button"
              onClick={toggleDark}
              className={theme.layout.themeButton}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? '☀️' : '🌙'}
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
        className={`${theme.layout.main} px-4 scroll-mt-24 pb-20 md:pb-8`}
        style={isModuleRoute ? { paddingTop: '2rem' } : undefined}
      >
        <Breadcrumb />
        {isModuleRoute && <ModuleChrome />}
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
