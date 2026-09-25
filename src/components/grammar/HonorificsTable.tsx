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
    <div className="mt-3 overflow-x-auto rounded-lg bg-white p-4 shadow-sm dark:bg-ink-900">
      <div className="mb-2 text-meta font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
        {isDE ? title.de : title.en}
      </div>
      <table className="w-full border-collapse text-body">
        <thead>
          <tr>
            {showHelpers && <th className="pb-2 text-left text-meta font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">English</th>}
            {showHelpers && <th className="pb-2 text-left text-meta font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">नेपाली</th>}
            <th className="pb-2 text-left text-meta font-semibold uppercase tracking-wider text-accent-600 dark:text-accent-300">Deutsch</th>
            <th className="pb-2 text-left text-meta font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">Usage</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            // Zebra striping instead of hard divider lines between rows.
            <tr key={i} className={i % 2 === 1 ? 'bg-ink-50 dark:bg-ink-800/40' : ''}>
              {showHelpers && <td className="rounded-l-lg py-2 pl-2 pr-3 text-ink-600 dark:text-ink-300">{row.pronoun.en}</td>}
              {showHelpers && <td className="px-3 py-2 text-ink-600 dark:text-ink-300">{row.pronoun.ne}</td>}
              <td className="px-3 py-2 font-medium text-ink-900 dark:text-white">{row.pronoun.de}</td>
              <td className="rounded-r-lg py-2 pr-2 text-meta text-ink-500 dark:text-ink-400">
                {isDE ? row.usage.de : row.usage.en}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
