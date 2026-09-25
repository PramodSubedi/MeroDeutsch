/**
 * src/components/glossary/GlossaryFilterPanel.tsx
 *
 * Compact, collapsible filter panel for the Glossary page.
 * Reuses the collapse animation + localStorage pattern and the
 * UserMenu (dropdown click-outside-to-close) interaction.
 *
 * Design:
 * - Source, level, POS, and topic filters live in one collapsible panel
 * - Active filter chips shown below with ✕ to remove
 * - Item counts displayed next to options
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, X, RotateCcw } from 'lucide-react';
import { theme } from '../../config/theme';
import { topicalTagLabel } from '../../utils/vocabTags';

/** A filter option with display label and item count */
export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

interface GlossaryFilterPanelProps {
  /** Current filter values */
  sourceFilter: string;
  levelFilter: string;
  posFilter: string;
  categoryFilter: string;
  /** Filter change handlers */
  onSourceChange: (value: string) => void;
  onLevelChange: (value: string) => void;
  onPosChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  /** Reset all filters */
  onReset: () => void;
  /** Filter options with counts */
  sourceOptions: FilterOption[];
  levelOptions: FilterOption[];
  posOptions: FilterOption[];
  categoryOptions: FilterOption[];
  /** Localization */
  isDE: boolean;
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
  const allCount = options.find((option) => option.value === 'all')?.count ?? 0;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${theme.input} py-2 text-sm`}
      >
        <option value="all">
          {isDE ? 'Alle' : 'All'} ({allCount})
        </option>
        {options.filter((opt) => opt.value !== 'all').map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label} ({opt.count})
          </option>
        ))}
            </select>
    </div>
  );
}

export function GlossaryFilterPanel({
  sourceFilter,
  levelFilter,
  posFilter,
  categoryFilter,
  onSourceChange,
  onLevelChange,
  onPosChange,
  onCategoryChange,
  onReset,
  sourceOptions,
  levelOptions,
  posOptions,
  categoryOptions,
  isDE,
}: GlossaryFilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(() => {
    const stored = localStorage.getItem('glossaryFiltersExpandedV2');
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
    localStorage.setItem('glossaryFiltersExpandedV2', String(isExpanded));
  }, [isExpanded]);

  const hasActiveFilters = sourceFilter !== 'all' || levelFilter !== 'all' || posFilter !== 'all' || categoryFilter !== 'all';

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
              {[sourceFilter !== 'all', levelFilter !== 'all', posFilter !== 'all', categoryFilter !== 'all'].filter(Boolean).length}
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FilterSelect label={isDE ? 'Quelle' : 'Source'} value={sourceFilter} options={sourceOptions} onChange={onSourceChange} isDE={isDE} />
            <FilterSelect label={isDE ? 'Niveau' : 'Level'} value={levelFilter} options={levelOptions} onChange={onLevelChange} isDE={isDE} />
            <FilterSelect label={isDE ? 'Wortart' : 'Part of Speech'} value={posFilter} options={posOptions} onChange={onPosChange} isDE={isDE} />
            <FilterSelect label={isDE ? 'Thema' : 'Topic'} value={categoryFilter} options={categoryOptions} onChange={onCategoryChange} isDE={isDE} />
          </div>
        </div>
      </div>
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
                    {sourceFilter !== 'all' && (
                      <FilterChip
                        label={sourceOptions.find((option) => option.value === sourceFilter)?.label ?? sourceFilter}
                        onRemove={() => onSourceChange('all')}
                      />
                    )}
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {isDE ? 'Aktiv:' : 'Active:'}
          </span>
          {levelFilter !== 'all' && <FilterChip label={levelFilter} onRemove={() => onLevelChange('all')} />}
          {posFilter !== 'all' && <FilterChip label={posFilter} onRemove={() => onPosChange('all')} />}
          {categoryFilter !== 'all' && (
            <FilterChip
              label={categoryOptions.find((option) => option.value === categoryFilter)?.label ?? topicalTagLabel(categoryFilter, isDE)}
              onRemove={() => onCategoryChange('all')}
            />
          )}
        </div>
      )}
    </div>
    );
}

