import { Link, useLocation } from 'react-router-dom';
import { useLang } from '../hooks/useLang';
import { useAuth } from '../hooks/useAuth';
import { ROUTE_LABELS } from '../config/routeLabels';

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
  const { isAuthenticated } = useAuth();

  // Route label mappings — single source of truth from routeLabels.ts
  const routeLabels: Record<string, { en: string; de: string }> = {};
  for (const [prefix, labels] of ROUTE_LABELS) routeLabels[prefix] = labels;

  // Don't show breadcrumbs on homepage, auth, legal pages, or the hubs that
  // carry their own page context (Learn + Practice — converged shell).
  if (pathname === '/' || pathname === '/home' || pathname === '/auth' || pathname === '/privacy' || pathname === '/terms' || pathname === '/learn' || pathname === '/practice') {
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
    // Resolve labels for both static routes and parameterized ones (e.g.
    // /checkpoint/1 → label from `/checkpoint`). Numeric/dynamic segments
    // fall back to their base route label so /:id routes keep a readable crumb.
    const routeInfo =
      routeLabels[currentPath] ?? routeLabels[currentPath.replace(/\/\d+$/, '')];
    if (routeInfo) {
      // The path is a signed-in benefit — guests get a guest-safe crumb so a
      // breadcrumb never leaks a /learn / checkpoint / bonus link back.
      const guestOverride: Record<string, { en: string; de: string; path: string }> = {
        '/learn': { en: 'Lessons', de: 'Lektionen', path: '/home' },
        '/checkpoint': { en: 'Sign in', de: 'Anmelden', path: '/auth' },
        '/sentence-builder': { en: 'Practice', de: 'Übung', path: '/practice' },
      };
      const override = !isAuthenticated
        ? guestOverride[currentPath] ?? guestOverride[currentPath.replace(/\/\d+$/, '')]
        : undefined;
      breadcrumbs.push({
        label: isDE ? (override?.de ?? routeInfo.de) : (override?.en ?? routeInfo.en),
        path: override?.path ?? currentPath,
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
