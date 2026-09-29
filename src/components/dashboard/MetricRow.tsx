/**
 * src/components/dashboard/MetricRow.tsx
 *
 * A hairline-divided row of secondary metrics: due reviews, streak, level/XP.
 *
 * WHY NOT `StatTile`
 * ------------------
 * `StatTile` is a CARD — its own bordered surface with padding and a hover
 * state. That is the right weight for Home, where these numbers are a "summary
 * teaser" among other content.
 *
 * On the Dashboard they are not the headline — the course position above them
 * is. Four equal-weight floating cards there made a secondary number compete
 * with the primary one, and (before `CoursePosition` replaced the two course
 * tiles) rendered the SAME fact as the ring strip in a different shape with a
 * different denominator.
 *
 * A single surface with hairline dividers instead of four cards fixes that
 * structurally: there is now one object on the page, so the eye reads the
 * course block first and this as a footnote. It is a different ROLE, not a
 * restyled card — Home keeps `StatTile` and this stays Dashboard-only, with the
 * numbers derived from the same hooks in both places.
 *
 * "SPARKLINES" — A REVERSAL, RECORDED HONESTLY
 * --------------------------------------------
 * An earlier version of this file carried a comment ruling sparklines out: "the
 * app has no cheap per-metric daily series (the activity log is coarse)". That
 * reasoning was wrong, and the cost of being wrong was a dashboard with no
 * visual data on its most-read row.
 *
 * `useActivityLog` returns a genuine `{date, count}[]` per-day series spanning
 * up to 120 days, and `useXp` exposes a real `xpProgress` 0..100 that this row
 * was not using at all. Both are stored facts, not estimates.
 *
 * What is still true, and now stated as a RULE rather than a blanket refusal:
 * a series is drawn only where one genuinely exists. `useStreak` knows only
 * current and longest streak, so the streak tile has no sparkline and is not
 * given a decorative one — a made-up trend next to a real number is worse than
 * no trend, because it looks equally trustworthy.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Sparkline, type SparkTone } from './Sparkline';

export interface Metric {
  /** Short uppercase label, e.g. "Reviews due". */
  label: string;
  /** The figure. Pre-formatted by the caller (locale-aware). */
  value: string;
  /** Optional qualifier under the figure. */
  detail?: string;
  icon: LucideIcon;
  /** Tints the icon chip and the visual. Follows the sitewide meaning mapping. */
  tone: 'accent' | 'success' | 'warning';
  /** Optional navigation — the whole cell becomes a link. */
  to?: string;
  /**
   * Optional real per-day series, oldest first. When present a sparkline is
   * drawn. ONLY pass data that exists — see the reversal note above.
   */
  spark?: number[];
  /**
   * Optional real progress 0..100, drawn as a radial gauge. Used for
   * `xpProgress`, which was previously computed and then discarded.
   */
  ring?: number;
}

const CHIP: Record<Metric['tone'], string> = {
  accent: 'bg-accent-50 text-accent-600 dark:bg-accent-950/60 dark:text-accent-300',
  success: 'bg-success-50 text-success-600 dark:bg-success-950/60 dark:text-success-300',
  warning: 'bg-warning-50 text-warning-600 dark:bg-warning-950/60 dark:text-warning-300',
};

/** Unfilled part of the radial gauge — a track, not a second data colour. */
const RING_TRACK: Record<Metric['tone'], string> = {
  accent: 'stroke-accent-100 dark:stroke-accent-950/60',
  success: 'stroke-success-100 dark:stroke-success-950/60',
  warning: 'stroke-warning-100 dark:stroke-warning-950/60',
};

/** Filled arc, matching the tile's tone so the tile reads as one object. */
const RING_FILL: Record<Metric['tone'], string> = {
  accent: 'stroke-accent-500',
  success: 'stroke-success-500',
  warning: 'stroke-warning-500',
};

const RING_R = 15;
const RING_C = 2 * Math.PI * RING_R;

/** Small radial gauge for a real 0..100 figure (currently `xpProgress`). */
function Gauge({ pct, tone }: { pct: number; tone: Metric['tone'] }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      className="shrink-0 -rotate-90"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="20" cy="20" r={RING_R} fill="none" strokeWidth="3.5" className={RING_TRACK[tone]} />
      <circle
        cx="20"
        cy="20"
        r={RING_R}
        fill="none"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={`${(clamped / 100) * RING_C} ${RING_C}`}
        className={RING_FILL[tone]}
      />
    </svg>
  );
}

export function MetricRow({ metrics, label }: { metrics: Metric[]; label: string }) {
  // Empty state is a real state: the Dashboard builds this list from queue and
  // streak state, and rendering an empty bordered strip would be a broken card.
  if (metrics.length === 0) return null;

  // DIVIDERS, EXPLICITLY, PER INDEX — the earlier `divide-y sm:divide-y-0
  // [&>*+*]:border-l` chain did not compose: the `*+*` variant re-added a
  // `border-t` at every breakpoint, so the horizontal hairlines never actually
  // disappeared on `sm`. Deciding the edge per cell from its index is boring,
  // is correct at every breakpoint, and needs no specificity to reason about.
  //
  // It has to track THREE column counts now (1 / 2 at `sm` / 3 at `lg`), which
  // is why this cannot be a `divide-*` utility. For each cell the rule is
  // uniform: a cell draws a top rule when it is NOT the first in its row, and
  // a left rule when it is NOT the first in its row. So the code states it that
  // way per breakpoint, and the later breakpoint cancels what the earlier one
  // added — `lg:border-t-0` / `lg:border-l-0` exist for that cancellation.
  // A grid draws a rule wherever two cells MEET: a TOP rule under every cell
  // that is not in the first row, and a LEFT rule beside every cell that is
  // not in the first column. Stated that way the index arithmetic is trivial
  // and cannot drift: row-start indices are 0, then 2 (2-up), then 3 (3-up).
  //
  // Cancelling the earlier breakpoint's rule is the whole difficulty, and
  // `sm:`-prefixed utilities still apply at `lg`, so each later breakpoint has
  // to say `-0` explicitly rather than merely omitting the rule.
  const HAIR = 'border-ink-150 dark:border-ink-850';
  const edge = (index: number, total: number) => {
    if (total < 2) return '';
    const p: string[] = [];
    // Stacked (phones): every cell after the first is its own row.
    if (index > 0) p.push(`border-t ${HAIR}`);
    // 2 columns from `sm`: rows begin at index 0 and 2. Only index 1 left the
    // first row, so only index 1 drops the stacked top rule.
    if (index === 1) p.push('sm:border-t-0');
    if (index % 2 !== 0) p.push(`sm:border-l sm:${HAIR}`);
    // 3 columns from `lg`: rows begin at 0, 3, 6. Index 1 and 2 are still in
    // the first row, so both drop the top rule `sm` was still giving them.
    if (index === 1 || index === 2) p.push('lg:border-t-0');
    if (index % 3 !== 0) p.push(`lg:border-l lg:${HAIR}`);
    else p.push('lg:border-l-0');
    return p.join(' ');
  };

  return (
    <section
      aria-label={label}
      className="mb-6 overflow-hidden rounded-lg border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900"
    >
      {/* 1 col on phones, 2 from `sm`, 3 only from `lg`. The previous
          `sm:grid-cols-3` put 3 tiles across a 640px tablet, leaving each cell
          ~197px — the icon, label, figure, detail and sparkline then truncated
          four different strings at once. Two columns hold ~300px, which fits;
          the third column is a luxury, not a requirement. */}
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          const body: ReactNode = (
            <>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${CHIP[metric.tone]}`} aria-hidden="true">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                {/* `truncate`, not `wrap`: at the 2-column breakpoint the label
                    "Reviews due" wrapped to two lines and made this tile taller
                    than its neighbour, so the row of figures stopped lining up.
                    One line with an ellipsis keeps every tile the same height. */}
                <span className="block truncate text-micro font-semibold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
                  {metric.label}
                </span>
                <span className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="font-mono text-section font-bold tabular-nums tracking-[-0.01em] text-ink-900 dark:text-white">
                    {metric.value}
                  </span>
                  {metric.detail && (
                    <span className="truncate text-meta text-ink-500 dark:text-ink-400">{metric.detail}</span>
                  )}
                </span>
              </span>
              {/* The visual is a sibling of the figure, not a background: a
                  ring reads as "how full", a sparkline as "which way". Both
                  are `aria-hidden` because the figure and label beside them
                  already carry the meaning in text. */}
              {typeof metric.ring === 'number' && (
                <Gauge pct={metric.ring} tone={metric.tone} />
              )}
              {!metric.ring && metric.spark && (
                <Sparkline data={metric.spark} tone={metric.tone as SparkTone} />
              )}
            </>
          );

          // `min-h-11` (44px) on the cell, not just padding: a bare padding
          // value can shrink below the touch-target floor on a short label.
          const cell = 'flex min-h-11 items-center gap-3 px-4 py-3.5 sm:px-5';
          return (
            <li key={metric.label} className={edge(index, metrics.length)}>
              {metric.to ? (
                <Link
                  to={metric.to}
                  className={`${cell} block transition-colors hover:bg-ink-25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500 dark:hover:bg-ink-850`}
                >
                  {body}
                </Link>
              ) : (
                <div className={cell}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
