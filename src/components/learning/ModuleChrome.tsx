import { Link } from 'react-router-dom';
import { useLang } from '../../hooks/useLang';
import { useAuth } from '../../hooks/useAuth';

/**
 * Shared module navigation chrome for A1 learning module routes.
 *
 * Renders a "Back → Learning Hub" link only. The ModuleSwitcher pill rail was
 * removed because the AppSidebar now handles cross-module navigation; keeping
 * both duplicated the same links directly under the header.
 * Mounted by Layout.tsx above <Outlet /> for module routes so that ArticlesPage
 * (a protected file) receives module navigation without being edited.
 */
export function ModuleChrome() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { isAuthenticated } = useAuth();

  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
      <Link
        to={isAuthenticated ? '/learn' : '/home'}
        className="inline-flex shrink-0 items-center gap-1 text-meta font-semibold text-accent-600 hover:text-accent-800 dark:text-accent-300 dark:hover:text-accent-200"
      >
        ← {isDE
          ? (isAuthenticated ? 'Zurück zum Lernpfad' : 'Zurück zur Startseite')
          : (isAuthenticated ? 'Back to learning path' : 'Back to Home')}
      </Link>
    </div>
  );
}