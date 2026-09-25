import { Link, useLocation } from 'react-router-dom';
import { useLang } from '../hooks/useLang';
import { ROUTE_LABELS } from '../config/routeLabels';
import { getModuleRoutes } from '../config/modules';

interface BreadcrumbItem {
  label: string;
  path: string;
}

/**
 * Routes that intentionally render NO breadcrumb trail:
 *  - `/`, `/home`          → top of the hierarchy (nothing to trail).
 *  - `/auth`               → standalone focus screen, no app-shell context.
 *  - `/learn`, `/practice` → the two converged hubs carry their own header.
 *  - `/privacy`, `/terms`  → legal pages render their own "Back to Home" link.
 *
 * Module routes are handled separately below: Layout swaps the breadcrumb for
 * <ModuleChrome /> there, so a breadcrumb would duplicate that back-link.
 */
const NO_BREADCRUMB = new Set([
  '/', '/home', '/auth', '/learn', '/practice', '/privacy', '/terms',
  // /email-builder renders its own contextual "← Learning path / Home" back-link
  // via PageHeading, which points somewhere more useful than the crumb's parent
  // ever could.
  '/email-builder',
]);

/**
 * Breadcrumb navigation component for hierarchical navigation.
 * Automatically generates breadcrumbs based on current route.
 * Provides accessible navigation with ARIA landmarks.
 */
export function Breadcrumb() {
  const { pathname } = useLocation();
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  // Route label mappings — single source of truth from routeLabels.ts
  const routeLabels: Record<string, { en: string; de: string }> = {};
  for (const [prefix, labels] of ROUTE_LABELS) routeLabels[prefix] = labels;

  // Module routes show <ModuleChrome /> instead (see Layout.tsx). Derived from
  // the module registry so this rule can never drift from the router config —
  // previously a second hand-maintained list lived here.
  const isModuleRoute = getModuleRoutes().includes(pathname);

  if (NO_BREADCRUMB.has(pathname) || isModuleRoute) {
    return null;
  }

  // Build breadcrumb trail
  const pathSegments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [
    // `/home` (not `/`) so the crumb lands on guest Home for guests instead of
    // bouncing them to the marketing landing via the root redirect.
    { label: isDE ? 'Start' : 'Home', path: '/home' },
  ];

  let currentPath = '';
  for (const segment of pathSegments) {
    currentPath += `/${segment}`;
    // Dynamic segments (e.g. /checkpoint/1) are already covered by their parent
    // crumb — pushing one here rendered a duplicate "Checkpoint / Checkpoint".
    if (/^\d+$/.test(segment)) continue;
    const routeInfo = routeLabels[currentPath];
    if (!routeInfo) continue;
    breadcrumbs.push({
      label: isDE ? routeInfo.de : routeInfo.en,
      path: currentPath,
    });
  }

  return (
    <nav
      aria-label={isDE ? 'Breadcrumb-Navigation' : 'Breadcrumb navigation'}
      className="mb-4"
    >
      <ol className="flex items-center gap-2 text-body text-ink-600 dark:text-ink-400">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <li key={crumb.path} className="flex items-center gap-2">
              {index > 0 && (
                <span className="text-ink-500 dark:text-ink-600" aria-hidden="true">
                  /
                </span>
              )}
              {isLast ? (
                <span
                  className="font-semibold text-ink-900 dark:text-ink-100"
                  aria-current="page"
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.path}
                  className="inline-flex min-h-[44px] items-center hover:text-accent-600 dark:hover:text-accent-400 transition-colors focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:outline-none focus-visible:ring-offset-2 rounded-sm px-1"
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
