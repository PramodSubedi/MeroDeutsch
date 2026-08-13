import { Outlet, useLocation } from 'react-router-dom';
import { useLang } from '../hooks/useLang';
import { useDarkMode } from '../hooks/useDarkMode';
import { AuthGate } from './AuthGate';
import { BrandMark } from './BrandMark';
import { ThemeToggle } from './ThemeToggle';
import { InstalledPrompt } from './InstalledPrompt';
import { ModuleChrome } from '../components/learning/ModuleChrome';

export function Layout() {
  const { langMode } = useLang();
  const location = useLocation();

  const moduleRoutes = ['/alphabet', '/numbers', '/calendar', '/articles', '/greetings'];
  const isModuleRoute = moduleRoutes.includes(location.pathname);

  return (
    <div className="min-h-screen bg-background p-4">
      <header className="bg-blue-600 text-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <BrandMark linked={true} />
          <nav className="flex items-center gap-4">
            <Link
              to="/"
              className="hover:opacity-90 transition duration-200"
              aria-label="MeroDeutsch Home"
            >
              {langMode === 'german' ? 'Zurück zur Startseite' : 'Back to Home'}
            </Link>
            <ThemeToggle />
            <InstalledPrompt />
          </nav>
        </div>
      </header>

      <main className={theme.layout.main} style={isModuleRoute ? { paddingTop: '2rem' } : undefined}>
        {isModuleRoute && <ModuleChrome />}
        <Outlet />
      </main>
    </div>
  );
}