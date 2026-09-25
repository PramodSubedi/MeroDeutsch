/**
 * src/components/ui/Surface.tsx
 *
 * The ONE place surfaces are defined. Before this, `theme.section.surface`,
 * `theme.panel.surface`, `theme.card.surface` and `StatTile`'s shell were all
 * the same `rounded-2xl bg-white shadow-sm` box — so the app had no surface
 * hierarchy at all and every screen read as the same stack of white boxes.
 *
 * Four tiers, border-led (shadow only where something genuinely floats):
 *   canvas   the app background            — never a card
 *   flat     default content card          — hairline, no shadow
 *   sunken   inset wells, code, muted      — tinted + hairline
 *   raised   popovers, tooltips, menus     — hairline + shadow
 *   overlay  modals, sheets, dialogs       — hairline + strongest shadow
 */
import type { ReactNode } from 'react';

export type SurfaceTier = 'flat' | 'sunken' | 'raised' | 'overlay';

const TIER: Record<SurfaceTier, string> = {
  flat: 'rounded-lg border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900',
  sunken: 'rounded-lg border border-ink-200 bg-ink-50 dark:border-ink-800 dark:bg-ink-800/50',
  raised: 'rounded-lg border border-ink-200 bg-white shadow-lg dark:border-ink-800 dark:bg-ink-900',
  overlay: 'rounded-lg border border-ink-200 bg-white shadow-xl dark:border-ink-800 dark:bg-ink-900',
};

const PAD: Record<SurfaceTier, string> = {
  flat: 'p-4 sm:p-6',
  sunken: 'p-4',
  raised: 'p-4',
  overlay: 'p-6',
};

export interface SurfaceProps {
  tier?: SurfaceTier;
  /** `md` for cards, `sm` for dense rows, `none` when the child owns padding. */
  padding?: 'sm' | 'md' | 'none';
  className?: string;
  children: ReactNode;
  /** Render as a <section> when the surface is a distinct region. */
  as?: 'div' | 'section' | 'article' | 'aside';
}

export function Surface({
  tier = 'flat',
  padding = 'md',
  className = '',
  children,
  as: Tag = 'div',
}: SurfaceProps) {
  return (
    <Tag className={`${TIER[tier]} ${padding === 'none' ? '' : PAD[tier]} ${className}`}>
      {children}
    </Tag>
  );
}
