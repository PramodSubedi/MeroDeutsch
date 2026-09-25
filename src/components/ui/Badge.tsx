/**
 * src/components/ui/Badge.tsx
 *
 * Tonal pill. The app used to assign 8 unrelated hues to 8 module badges
 * (blue/purple/green/pink/yellow/indigo/teal/orange), which made the review
 * queue read as confetti and gave color no meaning. Now color encodes
 * CATEGORY only: neutral / accent (learning) / success (gate) / warning /
 * danger, plus an explicit `reward` tone for streak/XP flourishes.
 *
 * `icon` is a Lucide component — the app has ONE icon language; emoji are
 * not used as UI chrome.
 */
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'reward';

const TONE: Record<BadgeTone, string> = {
  neutral: 'border-ink-200 bg-ink-100 text-ink-700 dark:border-ink-800 dark:bg-ink-800 dark:text-ink-300',
  accent: 'border-accent-200 bg-accent-50 text-accent-700 dark:border-accent-900/60 dark:bg-accent-950/40 dark:text-accent-300',
  success: 'border-success-200 bg-success-50 text-success-800 dark:border-success-900/50 dark:bg-success-950/40 dark:text-success-300',
  warning: 'border-warning-200 bg-warning-50 text-warning-800 dark:border-warning-900/50 dark:bg-warning-950/40 dark:text-warning-200',
  danger: 'border-danger-200 bg-danger-50 text-danger-700 dark:border-danger-900/50 dark:bg-danger-950/40 dark:text-danger-300',
  reward: 'border-ink-200 bg-white text-ink-800 shadow-sm dark:border-ink-800 dark:bg-ink-900 dark:text-ink-100',
};

export interface BadgeProps {
  tone?: BadgeTone;
  icon?: LucideIcon;
  /** Dot instead of an icon — the most compact variant. */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', icon: Icon, dot = false, className = '', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-meta font-semibold ${TONE[tone]} ${className}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
}
