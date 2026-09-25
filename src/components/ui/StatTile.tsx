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
import type { LucideIcon } from 'lucide-react';
import { Progress, type ProgressTone } from './Progress';

/**
 * Color-to-meaning mapping is fixed sitewide and now maps to the *restrained*
 * 5-token palette (ink/accent/success/warning/danger):
 *   accent  = progress / primary
 *   success = accuracy / mastery
 *   warning = needs attention
 *
 * The legacy `blue` / `emerald` / `amber` / `violet` names are still accepted so
 * the 8 existing call sites keep working, but they all collapse onto these
 * three tones — `violet` no longer smuggles a 5th hue back in.
 */
export type StatTileTone = ProgressTone;
export type StatTileColor = 'blue' | 'emerald' | 'amber' | 'violet' | StatTileTone;

const TONE_OF: Record<StatTileColor, ProgressTone> = {
  accent: 'accent',
  blue: 'accent',
  violet: 'accent',
  success: 'success',
  emerald: 'success',
  warning: 'warning',
  amber: 'warning',
};

/** Icon-chip tint, same tone family as the bar. */
const CHIP: Record<ProgressTone, string> = {
  accent: 'bg-accent-50 text-accent-600 dark:bg-accent-950/60 dark:text-accent-300',
  success: 'bg-success-50 text-success-600 dark:bg-success-950/60 dark:text-success-300',
  warning: 'bg-warning-50 text-warning-600 dark:bg-warning-950/60 dark:text-warning-300',
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
  /** Optional icon rendered as a tinted chip.
   *  Omit for the original chrome — fully backward-compatible. */
  icon?: LucideIcon;
}

export function StatTile({ label, value, subValue, progressPct, caption, color = 'accent', to, icon: Icon }: StatTileProps) {
  const tone = TONE_OF[color];
  const shell =
    'rounded-lg border border-ink-200 bg-white p-4 transition-colors duration-200 hover:border-ink-300 hover:bg-ink-25 sm:p-5 dark:border-ink-800 dark:bg-ink-900 dark:hover:border-ink-700';
  const interactive = 'hover:shadow-sm';

  const body = (
    <>
      {/* Fixed vertical rhythm shared by every metric card sitewide:
          label → mt-3 value row (font-bold) → mt-3 bar/caption. */}
      <div className="flex items-center gap-2.5">
        {Icon && (
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${CHIP[tone]}`}
            aria-hidden="true"
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="text-micro font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
          {label}
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="text-3xl font-bold leading-none tracking-[-0.02em] text-ink-900 dark:text-white">{value}</span>
        {subValue && <span className="pb-0.5 text-body font-medium text-ink-500 dark:text-ink-400">{subValue}</span>}
      </div>
      {typeof progressPct === 'number' && (
        <Progress value={progressPct} tone={tone} label={label} className="mt-3" />
      )}
      {caption && (
        <div className="mt-3 text-meta text-ink-500 dark:text-ink-400">{caption}</div>
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