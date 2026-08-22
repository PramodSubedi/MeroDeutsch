/**
 * src/components/grammar/HonorificsTable.tsx
 *
 * Du / Sie ↔ तिमी / तपाईं honorifics bridge (Unit 1, C1.10).
 * ≤3 rows. In Nur-DE mode the English + Nepali helper columns are hidden so
 * only the German pronoun forms + usage remain (never crashes).
 */

import { useLang } from '../../hooks/useLang';
import type { HonorificRow, LocalizedLabel } from '../../data/a1Path';

interface HonorificsTableProps {
  title: LocalizedLabel;
  rows: HonorificRow[];
}

export function HonorificsTable({ title, rows }: HonorificsTableProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const showHelpers = !isDE;

  return (
    <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {isDE ? title.de : title.en}
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {showHelpers && <th className="text-left font-semibold text-slate-600 dark:text-slate-300">English</th>}
            {showHelpers && <th className="text-left font-semibold text-slate-600 dark:text-slate-300">नेपाली</th>}
            <th className="text-left font-semibold text-blue-700 dark:text-blue-300">Deutsch</th>
            <th className="text-left font-semibold text-slate-600 dark:text-slate-300">Usage</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-slate-200 dark:border-slate-700">
              {showHelpers && <td className="py-1 text-slate-600 dark:text-slate-300">{row.pronoun.en}</td>}
              {showHelpers && <td className="py-1 text-slate-600 dark:text-slate-300">{row.pronoun.ne}</td>}
              <td className="py-1 font-medium text-slate-900 dark:text-white">{row.pronoun.de}</td>
              <td className="py-1 text-xs text-slate-500 dark:text-slate-400">
                {isDE ? row.usage.de : row.usage.en}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
