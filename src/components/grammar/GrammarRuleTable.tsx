/**
 * src/components/grammar/GrammarRuleTable.tsx
 *
 * Compact EN/DE grammar RULE table (um/am/im, der→den, nach/zu/in, Perfekt).
 *
 * Deliberately NARROWER than `GrammarComparisonTable`: that one is the trilingual
 * EN/NE/DE comparative bridge (C1.10) and is reused as-is. This one renders the
 * 15-module spec's per-module rule tables, which are EN/DE only — the Nepali
 * bridge for those lives in the module's `grammarNote`/comparative panel, so
 * adding an NE column here would imply a translation we have not written.
 *
 * Nur-DE safe (C1.5): in `langMode === 'german'` the "when to use it" helper
 * column is hidden and the table collapses to the German form + example. The
 * component never renders an empty table even with zero rows.
 *
 * Presentational only — data comes from `RuleRow[]` in src/data/a1Path.ts.
 */

import { useLang } from '../../hooks/useLang';
import type { LocalizedLabel, RuleRow } from '../../data/a1Path';

interface GrammarRuleTableProps {
  title: LocalizedLabel;
  rows: RuleRow[];
}

export function GrammarRuleTable({ title, rows }: GrammarRuleTableProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const showHelpers = !isDE;

  if (!rows.length) return null;

  return (
    <div className="mt-4 overflow-x-auto rounded-lg bg-white p-4 shadow-sm dark:bg-ink-900">
      <div className="mb-3 text-meta font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
        {isDE ? title.de : title.en}
      </div>
      <table className="w-full border-collapse text-body">
        <thead>
          <tr>
            <th className="pb-2 text-left text-meta font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
              {isDE ? 'Form' : 'Form'}
            </th>
            {showHelpers && (
              <th className="pb-2 text-left text-meta font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                {isDE ? '' : 'When to use it'}
              </th>
            )}
            <th className="pb-2 text-left text-meta font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
              {isDE ? 'Beispiel' : 'Example'}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label.en} className="border-t border-ink-200 dark:border-ink-800">
              <td className="py-2 pr-3 font-mono font-semibold text-accent-700 dark:text-accent-300">
                {isDE ? row.label.de : row.label.en}
              </td>
              {showHelpers && (
                <td className="py-2 pr-3 text-ink-600 dark:text-ink-300">
                  {isDE ? row.usage.de : row.usage.en}
                </td>
              )}
              <td className="py-2 text-ink-700 dark:text-ink-200">
                {isDE ? row.example.de : row.example.en}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
