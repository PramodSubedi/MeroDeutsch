import { NavLink } from 'react-router-dom';
import { useLang } from '../../hooks/useLang';

const MODULES = [
  { key: 'alphabet', icon: '🔤' as const, path: '/alphabet' },
  { key: 'numbers', icon: '🔢' as const, path: '/numbers' },
  { key: 'calendar', icon: '📅' as const, path: '/calendar' },
  { key: 'articles', icon: '📖' as const, path: '/articles' },
  { key: 'greetings', icon: '👋' as const, path: '/greetings' },
];

/**
 * Horizontal, scrollable module switcher pill bar.
 * Highlights the active module via NavLink `isActive`.
 * Mounted by ModuleChrome inside Layout for module routes.
 */
export function ModuleSwitcher() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  const labelMap: Record<string, { de: string; en: string }> = {
    alphabet: { de: 'Alphabet', en: 'Alphabet' },
    numbers: { de: 'Zahlen', en: 'Numbers' },
    calendar: { de: 'Kalender', en: 'Calendar' },
    articles: { de: 'Artikel', en: 'Articles' },
    greetings: { de: 'Grüße', en: 'Greetings' },
  };

  return (
    <nav aria-label="A1 modules" className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
      {MODULES.map((m) => {
        const lbl = labelMap[m.key];
        const label = isDE ? lbl.de : lbl.en;
        return (
          <NavLink
            key={m.key}
            to={m.path}
            className={({ isActive }) =>
              isActive
                ? 'flex-shrink-0 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white'
                : 'flex-shrink-0 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900'
            }
          >
            {m.icon} {label}
          </NavLink>
        );
      })}
      <NavLink
        to="/learn"
        className="flex-shrink-0 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-500 hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      >
        {isDE ? 'Lern-Hub' : 'Learning Hub'}
      </NavLink>
    </nav>
  );
}
