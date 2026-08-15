import type { Badge } from '../types';

/**
 * Achievement badges — permanent unlockables beyond the base progression set.
 * Defined here so pages/hooks can reference badge ids without scattering
 * magic strings. Rules are evaluated at the calling site (Dashboard, Rapid
 * Fire, Review widget) via `useAchievements().unlockBadge(id)`.
 */
export const ADDITIONAL_BADGES: Badge[] = [
  {
    id: 'blitz_50',
    label: 'Blitz 50 WPM',
    description: 'Reach 50 words per minute in Rapid-Fire Blitz',
    icon: '⚡',
    requirement: '50+ WPM in a blitz round',
  },
  {
    id: 'box4_master',
    label: 'Leitner Box 4 Master',
    description: 'Promote any review item to Leitner Box 4 (max mastery)',
    icon: '🧠',
    requirement: 'Reach Box 4 on any SRS card',
  },
  {
    id: 'streak_7',
    label: '7-Day Streak',
    description: 'Keep a 7-day learning streak alive',
    icon: '🔥',
    requirement: '7 consecutive days of learning',
  },
];

/** Lookup helper for the additional badges (icon + label at a glance). */
export function getAdditionalBadge(id: string): Badge | undefined {
  return ADDITIONAL_BADGES.find((b) => b.id === id);
}