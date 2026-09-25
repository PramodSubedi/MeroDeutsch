/**
 * src/components/ui/Progress.tsx
 *
 * One progress bar. Bar COLOR encodes meaning (accent = progress,
 * success = accuracy/mastery, warning = needs attention) rather than being
 * decorative — the same mapping StatTile already documents, now shared.
 */
import { motion } from 'framer-motion';

export type ProgressTone = 'accent' | 'success' | 'warning';

const FILL: Record<ProgressTone, string> = {
  accent: 'bg-accent-600',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
};

export interface ProgressProps {
  /** 0–100. Values are clamped here so callers can't overflow the track. */
  value: number;
  tone?: ProgressTone;
  label: string;
  className?: string;
  /** Disable the grow-in animation (reduced motion, SSR, dense lists). */
  animate?: boolean;
}

export function Progress({ value, tone = 'accent', label, className = '', animate = true }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      className={`h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800 ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      {animate ? (
        <motion.div
          className={`h-full rounded-full ${FILL[tone]}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      ) : (
        <div className={`h-full rounded-full ${FILL[tone]}`} style={{ width: `${pct}%` }} />
      )}
    </div>
  );
}
