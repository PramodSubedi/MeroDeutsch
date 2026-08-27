import { useState, useEffect, useRef } from 'react';
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

  // Measure the real content height so the expand animation never clips
  // wrapping rows (the old `modules.length * 48` formula assumed one row per
  // module while the actual layout is a wrapping horizontal flex).
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    const measure = () => setContentHeight(contentRef.current?.scrollHeight ?? 0);
    measure();
    // Re-measure when the label visibility changes across the sm breakpoint.
    const mq = window.matchMedia('(min-width: 640px)');
    mq.addEventListener('change', measure);
    return () => mq.removeEventListener('change', measure);
  }, []);

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
        className="mb-2 inline-flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 transition-all duration-200 hover:bg-slate-100/60 dark:text-white dark:hover:bg-slate-800/60"
        aria-expanded={isExpanded}
        aria-controls={`${storageKey}-content`}
      >
        <GroupIcon className="h-4.5 w-4.5 shrink-0" strokeWidth={2} aria-hidden="true" />
        <span className="flex-1 text-left">{groupTitle}</span>
        <span className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
          {modules.length}
        </span>
        <ChevronIcon className="h-4.5 w-4.5 shrink-0 transition-transform duration-200" strokeWidth={2} aria-hidden="true" />
      </button>

      {/* Module Links */}
      <div
        id={`${storageKey}-content`}
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          // Measured height only — never a modules.length * 48 heuristic.
          // `undefined` while unmeasured (first paint) = no max-height clamp,
          // so the expand animation never clips a wrapping row.
          maxHeight: isExpanded ? (contentHeight > 0 ? `${contentHeight}px` : undefined) : '0px',
          opacity: isExpanded ? 1 : 0,
        }}
      >
        <div ref={contentRef} className="inline-flex flex-wrap gap-1">
          {modules.map((module) => {
            const Icon = module.icon;
            const label = isDE ? module.labelDE : module.label;

            return (
              <NavLink
                key={module.id}
                to={module.path}
                className={({ isActive }) =>
                  isActive
                    ? `${theme.button.toggleActive} inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold`
                    : `${theme.button.toggleInactive} inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold`
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
