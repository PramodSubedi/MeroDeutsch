/**
 * src/components/path/ProgressRing.tsx
 *
 * The one progress indicator on the A1 roadmap: a Duolingo-style ring that
 * carries a lesson's completion percentage.
 *
 * WHY A RING AND NOT A BAR
 * A bar answers "how far along this list am I" but not "how far through THIS
 * lesson", and the roadmap is 15 lessons — each needs its own figure. A ring has
 * room for the lesson number in the middle and the percentage around it, so one
 * glyph answers both without a second line of text.
 *
 * WHY THIS REPLACED THE RIVER
 * The ring is state-bearing rather than decorative: the arc length IS the
 * completion %, and the colour IS the phase. That is a very different job from
 * the old pebbles/stones/weirs, which were illustration and carried state only
 * in adjacent text. A static, scannable, high-contrast mark was what the course
 * actually needed.
 *
 * GEOMETRY (viewBox 32, radius 13, 3px stroke)
 *   · TRACK  — the full circle, in the phase's "empty" tone.
 *   · ARC    — the completed share, rotated -90° so it starts at 12 o'clock and
 *              grows clockwise. dasharray carries the value; the arc is the
 *              only part that changes with progress.
 *   · DISC   — a smaller centre disc (r 8.5) so the number never collides with
 *              the arc, filled only for the two "behind you / you are here"
 *              phases. Hollow phases leave the canvas showing through, which is
 *              what makes an OPEN lesson read as open at a glance.
 * Sizing is done in CSS (the `size` prop) against a fixed viewBox, so the ring
 * is identical at 26px in a sidebar strip and 34px on the dashboard, and stays
 * crisp at 125%/150% zoom because the browser rasterises the vector.
 *
 * A11y: the number is `aria-hidden` decoration. The ring is a `role="img"` with
 * an `aria-label` when it stands alone, and pure decoration when a parent row
 * already carries the full sentence — so a screen reader hears "Lesson 4 of 15:
 * Family & Relationships — Locked, 60% complete" once, not three times.
 */
import type { A1UnitPhase } from '../../hooks/useA1Path';

/** Ring radius in viewBox units (32 - 2x3px stroke inset). */
const RING_R = 13;
/** Centre disc radius — leaves the ring clear of the number. */
const DISC_R = 8.5;
/** Circumference of the ring at RING_R; dasharray is a fraction of this. */
const CIRCUMFERENCE = 2 * Math.PI * RING_R;

interface RingTokens {
  /** Empty part of the ring. */
  track: string;
  /** Completed part of the ring. */
  bar: string;
  /** Centre disc fill. */
  disc: string;
  /** Number inside the ring. */
  text: string;
}

/**
 * Phase -> colour. Quiet Premium tokens only (ink / accent / success / warning);
 * the river + aqua families are gone with the trail they belonged to.
 *
 * `done` and `current` are FILLED because those are the two states whose number
 * must be readable at a glance across a 5-column roadmap; everything else is
 * hollow, so "open but not started" and "gated" stay visibly quieter than "here"
 * and "behind you". Dark mode only re-steps the fill one step deeper for
 * contrast — same hues, no new colours.
 */
const RING_TOKENS: Record<A1UnitPhase, RingTokens> = {
  done: {
    track: 'stroke-success-100 dark:stroke-success-900/60',
    bar: 'stroke-success-500',
    disc: 'fill-success-500 dark:fill-success-600',
    text: 'text-white',
  },
  current: {
    track: 'stroke-accent-100 dark:stroke-accent-900/60',
    bar: 'stroke-accent-500',
    disc: 'fill-accent-500 dark:fill-accent-600',
    text: 'text-white',
  },
  // SELF-GUIDED: open, untouched. Hollow, but accent-tinted — a mode where
  // nothing is locked must not paint everything grey.
  available: {
    track: 'stroke-accent-100 dark:stroke-accent-900/60',
    bar: 'stroke-accent-300',
    disc: 'fill-transparent',
    text: 'text-accent-700 dark:text-accent-300',
  },
  locked: {
    track: 'stroke-ink-200 dark:stroke-ink-800',
    bar: 'stroke-ink-300',
    disc: 'fill-transparent',
    text: 'text-ink-500 dark:text-ink-400',
  },
  optional: {
    track: 'stroke-warning-100 dark:stroke-warning-900/60',
    bar: 'stroke-warning-300',
    disc: 'fill-transparent',
    text: 'text-warning-700 dark:text-warning-300',
  },
};

export interface ProgressRingProps {
  /** Display phase — decides the colour family. */
  phase: A1UnitPhase;
  /** Completion, 0..100. Clamped and rounded. */
  pct: number;
  /** Centre content — normally the 1-based lesson number. */
  label: string;
  /** Diameter in px. The viewBox stays 32, so any size is a clean scale. */
  size?: number;
  /** Extra classes on the wrapper (spacing, hover feedback). */
  className?: string;
  /** Native tooltip. */
  title?: string;
  /** Accessible name when the ring stands on its own. */
  ariaLabel?: string;
  /** True when a parent element already names the whole row. */
  decorative?: boolean;
}

export function ProgressRing({
  phase,
  pct,
  label,
  size = 32,
  className = '',
  title,
  ariaLabel,
  decorative = false,
}: ProgressRingProps) {
  const tokens = RING_TOKENS[phase];
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const dash = (CIRCUMFERENCE * clamped) / 100;

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      title={title}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : ariaLabel}
      aria-hidden={decorative ? true : undefined}
    >
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <circle
          cx="16"
          cy="16"
          r={RING_R}
          fill="none"
          strokeWidth="3"
          className={tokens.track}
        />
        {/* transform, not a CSS rotation: the centre disc and the HTML number
            must stay upright while only the arc starts at 12 o'clock. */}
        <circle
          cx="16"
          cy="16"
          r={RING_R}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
          transform="rotate(-90 16 16)"
          className={tokens.bar}
        />
        <circle cx="16" cy="16" r={DISC_R} className={tokens.disc} />
      </svg>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 grid place-items-center font-bold leading-none ${tokens.text}`}
        style={{ fontSize: Math.max(9, Math.round(size * 0.34)) }}
      >
        {label}
      </span>
    </span>
  );
}

