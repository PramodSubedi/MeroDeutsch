/**
 * src/components/ui/StatTile.tsx
 *
 * Shared stat tile used by BOTH HomeLayoutA (summary teaser) and
 * DashboardPage (full grid). Extracting it guarantees Home and Dashboard can
 * never silently drift on how a metric is computed or styled — the exact
 * drift that produced duplicate "Quiz"/"Overall Score" tiles.
 *
 * Color-to-meaning mapping is fixed sitewide:
 *   blue = progress/primary · emerald = success/accuracy · amber = attention
 *   violet = gamification (XP/level)
 */

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

export type StatTileColor = 'blue' | 'emerald' | 'amber' | 'violet';

const BAR_COLOR: Record<StatTileColor, string> = {
  blue: 'bg-blue-600',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  violet: 'bg-violet-500',
};

/** Icon-chip tint per color meaning (same family as BAR_COLOR). */
const CHIP_COLOR: Record<StatTileColor, string> = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300',
};

interface StatTileProps {
  label: string;
  value: string;
  subValue?: string;
  /** Optional progress bar fill percentage (0–100). Omit for count-only tiles. */
  progressPct?: number;
  /** Optional explanatory caption under the bar/value (Dashboard "Overall score"). */
  caption?: string;
  color?: StatTileColor;
  /** When set, the whole tile becomes a link (e.g. Review Queue → /dashboard). */
  to?: string;
  /** Optional icon rendered as a tinted chip (21st.dev "Progress Card" pattern).
   *  Omit for the original chrome — fully backward-compatible (Dashboard unaffected). */
  icon?: LucideIcon;
}

export function StatTile({ label, value, subValue, progressPct, caption, color = 'blue', to, icon: Icon }: StatTileProps) {
  const shell =
    'rounded-2xl bg-white p-4 shadow-sm sm:p-5 dark:bg-slate-900';
  const interactive = 'transition hover:shadow-md';

  const body = (
    <>
      {/* Fixed vertical rhythm shared by every metric card sitewide:
          label → mt-3 value row (font-bold) → mt-3 bar/caption. */}
      <div className="flex items-center gap-2.5">
        {Icon && (
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${CHIP_COLOR[color]}`}
            aria-hidden="true"
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          {label}
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="text-3xl font-bold leading-none text-slate-900 dark:text-white">{value}</span>
        {subValue && <span className="pb-0.5 text-sm font-medium text-slate-500 dark:text-slate-400">{subValue}</span>}
      </div>
      {typeof progressPct === 'number' && (
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          role="progressbar"
          aria-valuenow={Math.round(progressPct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        >
          {/* Animated fill — 21st.dev "Progress Card" pattern. framer-motion
              is an existing dependency; no new libraries introduced. */}
          <motion.div
            className={`h-full rounded-full ${BAR_COLOR[color]}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
        </div>
      )}
      {caption && (
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">{caption}</div>
      )}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={`${shell} ${interactive}`}>
        {body}
      </Link>
    );
  }
  return <div className={shell}>{body}</div>;
}