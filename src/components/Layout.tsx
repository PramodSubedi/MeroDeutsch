import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { theme } from '../config/theme';
import { useDarkMode } from '../hooks/useDarkMode';
import { useLang } from '../hooks/useLang';
import { useTranslation } from '../hooks/useTranslation';
import { sharedTranslations } from '../data/sharedContent';
import { useAuth } from '../hooks/useAuth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useLastModule } from '../hooks/useLastModule';
import { BrandMark } from './BrandMark';
import { Footer } from './Footer';
import { ModuleChrome } from './learning/ModuleChrome';

/** Top nav + shell — branding/layout only; features live in pages/ */
export function Layout() {
  const { pathname } = useLocation();
  const { dark, toggle: toggleDark } = useDarkMode();
  const { langMode, toggle: toggleLang } = useLang();
  const { user, logout } = useAuth();
  const { t } = useTranslation(langMode);
  const { isOnline } = useOnlineStatus();
  const { rememberModule } = useLastModule();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  // Module routes that should show the chrome navigation bar
  const moduleRoutes = ['/alphabet', '/numbers', '/calendar', '/articles', '/greetings'];
  const isModuleRoute = moduleRoutes.includes(pathname);

  // Track last opened module for "Continue learning" on Home.
  useEffect(() => {
    rememberModule(pathname);
  }, [pathname, rememberModule]);

  const handleSignOut = () => {
    setProfileOpen(false);
    logout();
    navigate('/');
  };

  const link = (to: string, label: string) => {
    const active = pathname === to || (to !== '/' && pathname.startsWith(to));
    return (
      <Link to={to} className={active ? theme.layout.navLinkActive : theme.layout.navLink}>
        {label}
      </Link>
    );
  };

  return (
    <div className={theme.layout.app}>
      <header className={`${theme.layout.header} z-50`}>
        <div className={theme.layout.headerInner}>
          {/* Logo is a link → Home */}
          <BrandMark linked light className="text-lg" />
          <nav className={theme.layout.nav}>
            {link('/', 'Home')}
            {user ? link('/dashboard', 'Dashboard') : link('/auth', 'Sign in')}
            <button type="button" onClick={toggleLang} className={theme.layout.toggleButton}>
              {langMode === 'normal'
                ? t(sharedTranslations.navigation.toggleGerman)
                : t(sharedTranslations.navigation.toggleNormal)}
            </button>
            <button type="button" onClick={toggleDark} className={theme.layout.themeButton}>
              {dark ? '☀️' : '🌙'}
            </button>
            {user && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen((value) => !value)}
                  className={`${theme.layout.navLink} inline-flex items-center gap-2`}
                >
                  {user.username}
                  <span className="text-xs">▾</span>
                </button>
                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 z-50 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-slate-900/5 dark:border-slate-700 dark:bg-slate-900">
                    <Link
                      to="/dashboard"
                      className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                      onClick={() => setProfileOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="mt-1 w-full rounded-xl bg-red-500 px-3 py-2 text-sm text-white hover:bg-red-600"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>
      </header>
      {!isOnline && (
        <div className="sticky top-0 z-40 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/40 dark:text-amber-200">
          <span aria-hidden="true">📡</span>{' '}
          {langMode === 'german'
            ? 'Du bist offline — gecachte Lektionen funktionieren weiter.'
            : 'You are offline — cached lessons still work.'}
        </div>
      )}
      <main
        className={theme.layout.main}
        style={isModuleRoute ? { paddingTop: '2rem' } : undefined}
      >
        {isModuleRoute && <ModuleChrome />}
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
