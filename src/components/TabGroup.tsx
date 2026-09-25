import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { theme } from '../config/theme';
import { useLang } from '../hooks/useLang';

/**
 * Unified TabGroup component for consistent tab navigation across the app.
 * Supports both local state and visual-only tabs with optional icons and badges.
 *
 * `variant="compact"` (used by module study pages) lays the tab buttons out as a
 * 2-column grid on mobile (so "Learn Cards" / "Quiz" / "Spelling" stay in a
 * single compact row above the fold) and switches to a normal flex row on `md`+`.
 * Touch targets are enforced at >= 44x44px.
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
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {/* Tab buttons */}
      <div
        role="group"
        aria-label={isDE ? 'Ansichten' : 'Views'}
        className={
          isCompact
            ? 'flex w-full gap-2 overflow-x-auto overscroll-x-contain pb-2 md:flex-wrap md:overflow-visible'
            : 'flex flex-wrap gap-2'
        }
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const buttonClass =
            (isActive ? theme.button.toggleActive : theme.button.toggleInactive) +
            (isCompact ? ' min-h-[44px] min-w-[44px] shrink-0 whitespace-nowrap md:w-auto' : '');

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={buttonClass}
              aria-pressed={isActive}
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
                        ? 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300'
                        : 'bg-ink-200 text-ink-600 dark:bg-ink-600 dark:text-ink-300'
                    } ${isCompact ? 'h-4 min-w-[16px] px-1 text-[10px]' : 'h-5 min-w-[20px] px-1.5 text-meta'} font-semibold`}
                  >
                    {tab.badge}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Optional divider and right controls.
          In compact mode the divider hides on mobile (rightControls wrap below the
          2-col grid) and reappears on sm+ where the tabs sit in a flex row. */}
      {rightControls && (
        <>
          <div
            className={`h-8 w-px bg-ink-200 dark:bg-ink-700 ${isCompact ? 'hidden sm:block' : ''}`}
            aria-hidden="true"
          />
          {rightControls}
        </>
      )}
    </div>
  );
}
