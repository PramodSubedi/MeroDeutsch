/**
 * src/admin/components/KpiCard.tsx
 *
 * One headline figure. Surfaces carry structure (a hairline border and a
 * `surface` fill), never a shadow — the Quiet Premium rule that elevation is
 * reserved for things that actually float.
 */
import type { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string;
  /** One short line of provenance: where the number comes from. */
  hint?: string;
  icon?: LucideIcon;
  /** Renders a muted em dash instead of a fake 0 while loading. */
  loading?: boolean;
  /** Attention states reuse the existing status hues, never a new one. */
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}

const VALUE_TONE = {
  neutral: 'text-ink-900 dark:text-ink-50',
  good: 'text-success-600 dark:text-success-500',
  warn: 'text-warning-600 dark:text-warning-500',
  bad: 'text-danger-600 dark:text-danger-500',
} as const;

export function KpiCard({ label, value, hint, icon: Icon, loading = false, tone = 'neutral' }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
      <div className="flex items-start justify-between gap-2">
        <p className="text-micro font-extrabold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
          {label}
        </p>
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" /> : null}
      </div>
      <p className={`mt-2 text-display font-extrabold tracking-[-0.03em] ${VALUE_TONE[tone]}`}>
        {loading ? '—' : value}
      </p>
      {hint ? <p className="mt-1 text-meta text-ink-500 dark:text-ink-400">{hint}</p> : null}
    </div>
  );
}
