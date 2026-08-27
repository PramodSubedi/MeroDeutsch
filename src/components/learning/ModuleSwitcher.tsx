import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GraduationCap, Wrench, ChevronDown, Check, type LucideIcon } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { getNavigationModules, type Module } from '../../config/modules';

/**
 * Module picker — a single compact control that surfaces the current module
 * and opens a grouped popover to switch between siblings.
 *
 * Replaces the old two-group collapsible pill bar: instead of 13 small pills
 * spread across two expand/collapse sections, the active module is now the
 * clear focal point, and the full list lives in a clean dropdown grouped by
 * "A1 Learning" and "Practice Tools".
 */
export function ModuleSwitcher() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const modules = getNavigationModules();
  const navigate = useNavigate();
  const location = useLocation();

  const learningModules = modules.filter((m) => m.category === 'learning');
  const practiceModules = modules.filter((m) => m.category === 'practice');

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resolve the module for the current route: prefer an exact path match, then
  // a nested-route prefix match, falling back to the first module.
  const activeModule =
    modules.find((m) => location.pathname === m.path) ??
    modules.find((m) => location.pathname.startsWith(`${m.path}/`)) ??
    modules[0];

  const ActiveIcon = activeModule.icon;
  const activeLabel = isDE ? activeModule.labelDE : activeModule.label;
  const activeCategoryLabel =
    activeModule.category === 'learning'
      ? isDE
        ? 'A1-Lernen'
        : 'A1 Learning'
      : isDE
        ? 'Übungswerkzeuge'
        : 'Practice Tools';

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const renderGroup = (groupTitle: string, GroupIcon: LucideIcon, groupModules: Module[]) => (
    <div className="p-1">
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
        <GroupIcon className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
        {groupTitle}
      </div>
      <div className="mt-0.5 flex flex-col">
        {groupModules.map((module) => {
          const Icon = module.icon;
          const label = isDE ? module.labelDE : module.label;
          const isActive = module.id === activeModule.id;
          return (
            <button
              key={module.id}
              type="button"
              role="menuitem"
              onClick={() => go(module.path)}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              <span className="flex-1 text-left">{label}</span>
              {isActive && <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <nav aria-label="Module navigation" ref={containerRef} className="relative">
      {/* Trigger — shows the current module as the focal point */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="group inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 text-left shadow-card transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
          <ActiveIcon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            {activeCategoryLabel}
          </span>
          <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
            {activeLabel}
          </span>
        </span>
        <ChevronDown
          className={`ml-1 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      {/* Popover — full module list grouped by category */}
      {open && (
        <div
          role="menu"
          aria-label="Switch module"
          className="absolute left-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] origin-top-left overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-elevated dark:border-slate-800 dark:bg-slate-900"
        >
          {renderGroup(isDE ? 'A1-Lernen' : 'A1 Learning', GraduationCap, learningModules)}
          <div className="mx-2 my-1 h-px bg-slate-100 dark:bg-slate-800" />
          {renderGroup(isDE ? 'Übungswerkzeuge' : 'Practice Tools', Wrench, practiceModules)}
        </div>
      )}
    </nav>
  );
}
