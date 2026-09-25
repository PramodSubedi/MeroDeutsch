/**
 * src/components/glossary/GlossaryFilterPanel.tsx
 *
 * Compact, collapsible filter panel for the Glossary page.
 * Reuses the collapse animation + localStorage pattern and the
 * UserMenu (dropdown click-outside-to-close) interaction.
 *
 * Design:
 * - Source filter chips remain visible (most frequently changed)
 * - Level/POS/Category live in a collapsible panel (default: collapsed)
 * - Active filter chips shown below with ✕ to remove
 * - Item counts displayed next to options
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, X, RotateCcw } from 'lucide-react';
import { theme } from '../../config/theme';

/** A filter option with display label and item count */
export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

interface GlossaryFilterPanelProps {
  /** Current filter values */
  levelFilter: string;
  posFilter: string;
  categoryFilter: string;
  /** Filter change handlers */
  onLevelChange: (value: string) => void;
  onPosChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  /** Reset all filters */
  onReset: () => void;
  /** Filter options with counts */
  levelOptions: FilterOption[];
  posOptions: FilterOption[];
  categoryOptions: FilterOption[];
  /** Localization */
  isDE: boolean;
}

/** Total item count (for "All" option) */
function getTotalCount(options: FilterOption[]): number {
  return options.reduce((sum, opt) => sum + opt.count, 0);
}

/** A removable filter chip */
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

/** A select dropdown with item counts */
function FilterSelect({
  label,
  value,
  options,
  onChange,
  isDE,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  isDE: boolean;
}) {
  const total = getTotalCount(options);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${theme.input} py-2 text-sm`}
      >
        <option value="all">
          {isDE ? 'Alle' : 'All'} ({total})
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label} ({opt.count})
          </option>
        ))}
            </select>
    </div>
  );
}

export function GlossaryFilterPanel({
  levelFilter,
  posFilter,
  categoryFilter,
  onLevelChange,
  onPosChange,
  onCategoryChange,
  onReset,
  levelOptions,
  posOptions,
  categoryOptions,
  isDE,
}: GlossaryFilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(() => {
    const stored = localStorage.getItem('glossaryFiltersExpanded');
    return stored !== null ? stored === 'true' : false;
  });

  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    const measure = () => setContentHeight(contentRef.current?.scrollHeight ?? 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    localStorage.setItem('glossaryFiltersExpanded', String(isExpanded));
  }, [isExpanded]);

  const hasActiveFilters = levelFilter !== 'all' || posFilter !== 'all' || categoryFilter !== 'all';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-expanded={isExpanded}
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {isDE ? 'Filter' : 'Filters'}
          {hasActiveFilters && (
            <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
              {[levelFilter !== 'all', posFilter !== 'all', categoryFilter !== 'all'].filter(Boolean).length}
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
          >
            <RotateCcw className="h-3 w-3" />
            {isDE ? 'Zurücksetzen' : 'Reset'}
          </button>
        )}
      </div>
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isExpanded ? (contentHeight > 0 ? `${contentHeight}px` : undefined) : '0px',
          opacity: isExpanded ? 1 : 0,
        }}
      >
        <div ref={contentRef} className="space-y-3 pb-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FilterSelect label={isDE ? 'Niveau' : 'Level'} value={levelFilter} options={levelOptions} onChange={onLevelChange} isDE={isDE} />
            <FilterSelect label={isDE ? 'Wortart' : 'Part of Speech'} value={posFilter} options={posOptions} onChange={onPosChange} isDE={isDE} />
            <FilterSelect label={isDE ? 'Kategorie' : 'Category'} value={categoryFilter} options={categoryOptions} onChange={onCategoryChange} isDE={isDE} />
          </div>
        </div>
      </div>
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {isDE ? 'Aktiv:' : 'Active:'}
          </span>
          {levelFilter !== 'all' && <FilterChip label={levelFilter} onRemove={() => onLevelChange('all')} />}
          {posFilter !== 'all' && <FilterChip label={posFilter} onRemove={() => onPosChange('all')} />}
          {categoryFilter !== 'all' && <FilterChip label={categoryFilter} onRemove={() => onCategoryChange('all')} />}
        </div>
      )}
    </div>
    );
}

