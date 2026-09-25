/**
 * src/components/grammar/GrammarComparisonTable.tsx
 *
 * EN / NE / DE comparative bridge table (C1.10, C1.5).
 *
 * Renders a trilingual comparison (e.g. word order SVO/SOV/V2) as a table.
 * In Nur-DE mode (langMode === 'german') the English + Nepali helper columns
 * are hidden so the table reduces to the German column only — never crashes,
 * EN/NE simply aren't rendered.
 *
 * Data comes from the trilingual `ComparisonRow[]` in src/data/a1Path.ts;
 * this component is presentational only.
 */

import { useLang } from '../../hooks/useLang';
import type { ComparisonRow, LocalizedLabel } from '../../data/a1Path';

interface GrammarComparisonTableProps {
  title: LocalizedLabel;
  rows: ComparisonRow[];
}

export function GrammarComparisonTable({ title, rows }: GrammarComparisonTableProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  const showHelpers = !isDE; // hide EN/NE in Nur-DE mode

  return (
    <div className="mt-4 overflow-x-auto rounded-lg bg-white p-4 shadow-sm dark:bg-ink-900">
      <div className="mb-3 text-meta font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
        {isDE ? title.de : title.en}
      </div>
      <table className="w-full border-collapse text-body">
        <thead>
          <tr>
            {showHelpers && (
              <th className="pb-2 text-left text-meta font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">{isDE ? '' : 'EN'}</th>
            )}
            {showHelpers && (
              <th className="pb-2 text-left text-meta font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">{isDE ? '' : 'NE'}</th>
            )}
            <th className="pb-2 text-left text-meta font-semibold uppercase tracking-wider text-accent-600 dark:text-accent-300">DE</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            // Zebra striping instead of hard divider lines between rows.
            <tr key={i} className={i % 2 === 1 ? 'even:bg-ink-50 rounded-sm dark:bg-ink-800/40' : ''}>
              {showHelpers && <td className="rounded-l-lg py-2 pl-2 pr-3 text-ink-600 dark:text-ink-300">{row.language.en}</td>}
              {showHelpers && <td className="px-3 py-2 text-ink-600 dark:text-ink-300">{row.language.ne}</td>}
              <td className="px-3 py-2 text-ink-600 dark:text-ink-300">{row.order.de}</td>
              <td className={`py-2 pr-2 font-medium text-ink-900 dark:text-white ${!showHelpers ? 'pl-2' : ''}`}>{row.example.de}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Trilingual example sentences row (helpers hidden in Nur-DE) */}
      <div className="mt-3 space-y-1 text-meta text-ink-600 dark:text-ink-400">
        {rows.map((row) => (
          <div key={`ex-${row.language.de}`}>
            {showHelpers && <span className="mr-2 text-ink-500">{row.example.en}</span>}
            {showHelpers && <span className="mr-2 text-ink-500">{row.example.ne}</span>}
            <span className="font-medium text-ink-900 dark:text-ink-200">{row.example.de}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
