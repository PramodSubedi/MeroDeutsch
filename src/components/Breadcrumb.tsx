import { Link, useLocation } from 'react-router-dom';
import { useLang } from '../hooks/useLang';

interface BreadcrumbItem {
  label: string;
  path: string;
}

/**
 * Breadcrumb navigation component for hierarchical navigation.
 * Automatically generates breadcrumbs based on current route.
 * Provides accessible navigation with ARIA landmarks.
 */
export function Breadcrumb() {
  const { pathname } = useLocation();
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  // Route label mappings
  const routeLabels: Record<string, { en: string; de: string }> = {
    '/': { en: 'Home', de: 'Start' },
    '/learn': { en: 'Learn', de: 'Lernen' },
    '/practice': { en: 'Practice Hub', de: 'Übungswerkzeuge' },
    '/dashboard': { en: 'Dashboard', de: 'Dashboard' },
    '/alphabet': { en: 'Alphabet', de: 'Alphabet' },
    '/numbers': { en: 'Numbers', de: 'Zahlen' },
    '/calendar': { en: 'Calendar', de: 'Kalender' },
    '/articles': { en: 'Articles', de: 'Artikel' },
    '/greetings': { en: 'Greetings', de: 'Begrüßungen' },
    '/glossary': { en: 'Glossary', de: 'Glossar' },
    '/dictation': { en: 'Dictation', de: 'Diktat' },
    '/grammar': { en: 'Grammar', de: 'Grammatik' },
    '/pronunciation': { en: 'Pronunciation', de: 'Aussprache' },
    '/roleplay': { en: 'Role-play', de: 'Rollenspiel' },
    '/auth': { en: 'Sign in', de: 'Anmelden' },
  };

  // Don't show breadcrumbs on homepage, auth, or pure legal pages
  if (pathname === '/' || pathname === '/auth' || pathname === '/privacy' || pathname === '/terms') {
    return null;
  }

  // Build breadcrumb trail
  const pathSegments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [
    { label: isDE ? 'Start' : 'Home', path: '/' },
  ];

  let currentPath = '';
  for (const segment of pathSegments) {
    currentPath += `/${segment}`;
    const routeInfo = routeLabels[currentPath];
    if (routeInfo) {
      breadcrumbs.push({
        label: isDE ? routeInfo.de : routeInfo.en,
        path: currentPath,
      });
    }
  }

  return (
    <nav
      aria-label={isDE ? 'Breadcrumb-Navigation' : 'Breadcrumb navigation'}
      className="mb-4"
    >
      <ol className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <li key={crumb.path} className="flex items-center gap-2">
              {index > 0 && (
                <span className="text-slate-400 dark:text-slate-600" aria-hidden="true">
                  /
                </span>
              )}
              {isLast ? (
                <span
                  className="font-semibold text-slate-900 dark:text-slate-100"
                  aria-current="page"
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.path}
                  className="inline-flex min-h-[44px] items-center hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none focus-visible:ring-offset-2 rounded px-1"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
