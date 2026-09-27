/**
 * src/admin/components/charts.tsx
 *
 * Shared chart primitives for the Analytics section.
 *
 * Every chart panel in the control centre goes through these so that four
 * separate pages cannot drift apart on grid colour, axis type or — most
 * importantly — on how an EMPTY chart is presented.
 *
 * ── WHY THE EMPTY STATE IS THE POINT ───────────────────────────────────────
 * The current dataset is sparse: 11 users, 2 with XP, every streak at 0. The
 * tempting move with sparse data is to pad a series so a chart looks populated,
 * or to hide the panel so the page looks tidy. Both are lies a reader would
 * believe. `ChartPanel` therefore renders whatever the data says, and says
 * plainly when there is nothing to draw.
 */
import type { ReactNode } from 'react';

/** Series colours, in token order. No one-off hexes. */
export const SERIES = ['#2563eb', '#059669', '#d97706', '#e11d48'] as const;
const GRID = '#dde2e9';

export const AXIS_PROPS = { stroke: GRID, fontSize: 11 };

export const TOOLTIP_PROPS = {
  contentStyle: {
    backgroundColor: '#ffffff',
    border: '1px solid #dde2e9',
    borderRadius: '0.5rem',
    fontSize: '0.8125rem',
  },
};

export const CHART_PANEL =
  'rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900';

/** Shown instead of a chart when there is genuinely nothing to plot. */
export function ChartEmpty({ what }: { what: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-ink-300 text-center dark:border-ink-700">
      <p className="px-4 text-meta text-ink-500 dark:text-ink-400">No {what} recorded yet.</p>
    </div>
  );
}

export function ChartPanel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className={CHART_PANEL}>
      <h2 className="text-section font-bold tracking-[-0.01em] text-ink-900 dark:text-ink-50">{title}</h2>
      {note ? <p className="mt-1 text-meta text-ink-500 dark:text-ink-400">{note}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * Horizontal bars for long category lists.
 *
 * `content_items` has 15 distinct types. Fifteen vertical columns with wrapped
 * tick labels is unreadable at any reasonable width, and a list is both denser
 * and sortable by magnitude — which is the actual question ("what does the app
 * lean on?").
 */
export function BarList({ points }: { points: { label: string; value: number }[] }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <ul className="space-y-1.5">
      {points.map((p) => (
        <li key={p.label} className="flex items-center gap-2">
          <code
            className="w-40 shrink-0 truncate text-micro text-ink-600 dark:text-ink-300"
            title={p.label}
          >
            {p.label}
          </code>
          <span
            className="h-2 rounded-full bg-accent-500"
            style={{ width: `${(p.value / max) * 100}%` }}
          />
          <span className="shrink-0 text-meta tabular-nums text-ink-700 dark:text-ink-200">
            {p.value}
          </span>
        </li>
      ))}
    </ul>
  );
}
