import { NavLink } from 'react-router-dom';
import { useLang } from '../../hooks/useLang';
import { getNavigationModules } from '../../config/modules';
import { theme } from '../../config/theme';

/**
 * Navigation component that renders pill links for all German language modules.
 * - Links derived from modules.ts registry (single source of truth)
 * - Active link styling via NavLink's isActive prop + theme.button tokens
 * - Dark mode support via theme.button.toggleActive / toggleInactive
 * - aria-label="Module navigation" for accessibility
 * - Horizontal scroll container for mobile views
 */
export function ModuleSwitcher() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const modules = getNavigationModules();

  return (
    <nav
      aria-label="Module navigation"
      className="overflow-x-auto whitespace-nowrap py-2"
    >
      {modules.map((module) => (
        <NavLink
          key={module.id}
          to={module.path}
          className={({ isActive }) =>
            isActive
              ? `${theme.button.toggleActive} mr-2 inline-block`
              : `${theme.button.toggleInactive} mr-2 inline-block`
          }
        >
          {isDE ? module.labelDE : module.label}
        </NavLink>
      ))}
    </nav>
  );
}
