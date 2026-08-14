import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react';
import { theme } from '../config/theme';
import type { Module } from '../config/modules';

interface CollapsibleModuleGroupProps {
  title: string;
  titleDE: string;
  icon: LucideIcon;
  modules: Module[];
  defaultExpanded?: boolean;
  storageKey: string;
  isDE: boolean;
}

/**
 * Collapsible navigation group component for organizing modules.
 * Features:
 * - Expandable/collapsible with smooth animation
 * - Persists state to localStorage
 * - Lucide SVG icons for group header and chevron
 * - Badge showing module count
 * - Responsive design with proper touch targets
 */
export function CollapsibleModuleGroup({
  title,
  titleDE,
  icon: GroupIcon,
  modules,
  defaultExpanded = true,
  storageKey,
  isDE,
}: CollapsibleModuleGroupProps) {
  const [isExpanded, setIsExpanded] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    return stored !== null ? stored === 'true' : defaultExpanded;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, String(isExpanded));
  }, [isExpanded, storageKey]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const ChevronIcon = isExpanded ? ChevronUp : ChevronDown;
  const groupTitle = isDE ? titleDE : title;

  return (
    <div className="inline-block">
      {/* Group Header */}
      <button
        type="button"
        onClick={toggleExpanded}
        className="mb-2 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-expanded={isExpanded}
        aria-controls={`${storageKey}-content`}
      >
        <GroupIcon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        <span>{groupTitle}</span>
        <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          {modules.length}
        </span>
        <ChevronIcon className="h-4 w-4 transition-transform" strokeWidth={2} aria-hidden="true" />
      </button>

      {/* Module Links */}
      <div
        id={`${storageKey}-content`}
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isExpanded ? `${modules.length * 48}px` : '0px',
          opacity: isExpanded ? 1 : 0,
        }}
      >
        <div className="inline-flex flex-wrap gap-2">
          {modules.map((module) => {
            const Icon = module.icon;
            const label = isDE ? module.labelDE : module.label;

            return (
              <NavLink
                key={module.id}
                to={module.path}
                className={({ isActive }) =>
                  isActive
                    ? `${theme.button.toggleActive} inline-flex items-center gap-1.5`
                    : `${theme.button.toggleInactive} inline-flex items-center gap-1.5`
                }
                title={label}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </div>
  );
}
