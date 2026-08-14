import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { theme } from '../config/theme';

/**
 * Unified TabGroup component for consistent tab navigation across the app.
 * Supports both local state and visual-only tabs with optional icons and badges.
 */

export interface Tab<T extends string = string> {
  id: T;
  label: string;
  icon?: LucideIcon;
  badge?: string | number;
}

interface TabGroupProps<T extends string = string> {
  tabs: Tab<T>[];
  activeTab: T;
  onTabChange: (tabId: T) => void;
  rightControls?: ReactNode;
  variant?: 'default' | 'compact';
  className?: string;
}

export function TabGroup<T extends string = string>({
  tabs,
  activeTab,
  onTabChange,
  rightControls,
  variant = 'default',
  className = '',
}: TabGroupProps<T>) {
  const isCompact = variant === 'compact';

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {/* Tab buttons */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={
                isActive
                  ? theme.button.toggleActive
                  : theme.button.toggleInactive
              }
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="flex items-center gap-1.5">
                {Icon && (
                  <Icon
                    className={isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'}
                    aria-hidden="true"
                  />
                )}
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`ml-1 inline-flex items-center justify-center rounded-full ${
                      isActive
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300'
                    } ${isCompact ? 'h-4 min-w-[16px] px-1 text-[10px]' : 'h-5 min-w-[20px] px-1.5 text-xs'} font-semibold`}
                  >
                    {tab.badge}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Optional divider and right controls */}
      {rightControls && (
        <>
          <div
            className="h-8 w-px bg-slate-200 dark:bg-slate-700"
            aria-hidden="true"
          />
          {rightControls}
        </>
      )}
    </div>
  );
}
