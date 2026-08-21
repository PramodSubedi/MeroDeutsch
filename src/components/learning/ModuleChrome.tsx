import { Link } from 'react-router-dom';
import { useLang } from '../../hooks/useLang';
import { ModuleSwitcher } from './ModuleSwitcher';

/**
 * Shared module navigation chrome for A1 learning module routes.
 *
 * Renders a "Back → Learning Hub" link alongside the ModuleSwitcher pill bar.
 * Mounted by Layout.tsx above <Outlet /> for module routes so that ArticlesPage
 * (a protected file) receives module navigation without being edited.
 */
export function ModuleChrome() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  return (
    // Single wrapped row: back link sits inline with the switcher pills so it
    // never floats as an orphan on wide screens.
    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
      <Link
        to="/learn"
        className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
      >
        ← {isDE ? 'Zurück zum Lern-Hub' : 'Back to Learning Hub'}
      </Link>
      <ModuleSwitcher />
    </div>
  );
}