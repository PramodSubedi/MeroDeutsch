/**
 * src/components/ui/GenderBadge.tsx
 *
 * Small colored badge for German article genders, using ONLY the global
 * theme tokens from `src/config/theme.ts` (locked decision C1.8 — no one-off
 * hexes in components). Used on the Unit 2 spine card, checkpoint articles,
 * glossaries, review rows, and Blitz when an article is shown.
 */

import type { Article } from '../../data/a1Path';
import { genderTokenFor } from '../../config/theme';

interface GenderBadgeProps {
  article: Article | 'plural';
  /** Show the long label (Masculine / Feminine / Neuter / Plural). Defaults true. */
  labeled?: boolean;
  /** Compact dot form (used in tight lists). Defaults false. */
  dot?: boolean;
  className?: string;
}

const GENDER_LABEL: Record<Article, string> = {
  der: 'der',
  die: 'die',
  das: 'das',
};

export function GenderBadge({ article, labeled = true, dot = false, className }: GenderBadgeProps) {
  const t = genderTokenFor(article);
  if (dot) {
    return (
      <span
        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${t.bg} ${className ?? ''}`}
        aria-label={article}
        aria-hidden={!labeled}
      />
    );
  }

  const labelText =
    article === 'plural' ? 'pl.' : GENDER_LABEL[article as Article];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-meta font-bold ${t.bg} text-white ${className ?? ''}`}
      aria-label={`gender ${article}`}
    >
      {labelText}
    </span>
  );
}

/** Render the full gender legend (der/die/das/plural) using theme tokens. */
export function GenderLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-meta text-ink-500 dark:text-ink-400">
      <GenderBadge article="der" />
      <GenderBadge article="die" />
      <GenderBadge article="das" />
      <GenderBadge article="plural" labeled />
    </div>
  );
}
