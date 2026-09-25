/**
 * src/config/navigation.ts
 *
 * SINGLE source of truth for the app shell's navigation model.
 *
 * The shell previously declared destinations three times — the desktop rail
 * (AppSidebar), the mobile drawer (same file, different sections), the mobile
 * bottom bar (BottomNav) — and a fourth time in the md–lg header strip
 * (Layout). Four hand-maintained lists is why the same route could be "active"
 * in one surface and dead-quiet in another.
 *
 * The model, in one table:
 *   Primary destinations   → Today / Learn / Practice / Progress (gated)
 *   Secondary destinations → Help / Settings / Send feedback
 *
 * Surfaces, by role (no surface repeats another's job):
 *   Desktop rail  (lg+)  → brand, waypoint, PRIMARY, secondary, collapse
 *   Bottom bar   (<lg)   → PRIMARY
 *   Mobile drawer (<lg)  → brand, waypoint, secondary, account
 *   Header               → page context + utilities only
 *
 * Every surface derives both its labels AND its active state from here, so they
 * cannot drift. Route membership is derived from the module registry
 * (config/modules.ts) rather than re-listed, so a new module joins the right
 * section by existing in one place.
 */

import { BookOpen, Home, LayoutDashboard, LifeBuoy, Send, Settings, Target } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MODULES } from './modules';
import type { Module } from './modules';
import { anchorHref, ANCHORS } from '../lib/anchors';
import type { LocalizedLabel } from '../data/a1Path';

/** Exact-or-child-prefix match. `'/'` is Home's alias so the root redirect
 *  (authenticated → /home) never leaves the shell unhighlighted. */
function matchesPath(pathname: string, path: string): boolean {
  if (pathname === path) return true;
  if (path === '/home' && pathname === '/') return true;
  return pathname.startsWith(`${path}/`);
}

function matchesAny(pathname: string, paths: readonly string[]): boolean {
  return paths.some((path) => matchesPath(pathname, path));
}

/** Every route a module category owns, from the one registry. */
function modulePaths(category: Module['category']): string[] {
  return MODULES.filter((module) => module.category === category).map((module) => module.path);
}

export interface NavDestination {
  id: string;
  /** Canonical route for this destination. */
  to: string;
  /** Full label (rail / drawer). */
  label: LocalizedLabel;
  /** Compact label (bottom bar — must fit 4 tabs at 360px). */
  short: LocalizedLabel;
  icon: LucideIcon;
  /** Routes that light this destination up (exact or `path + '/'` child). */
  matchPaths: readonly string[];
  /** Hidden entirely for signed-out visitors. */
  authOnly?: boolean;
  /**
   * Guest variant. The A1 spine is a signed-in benefit, so guests get a
   * "Lessons" shortcut to the module grid on Home instead of the spine. Its own
   * `matchPaths` keeps the section lit while the learner is inside a lesson,
   * without stealing Home's active state.
   */
  guest?: {
    to: string;
    label: LocalizedLabel;
    short: LocalizedLabel;
    matchPaths: readonly string[];
  };
  /** Render the live due-review count from useReviewQueue (never re-derived). */
  badge?: 'due';
}


export const PRIMARY_NAV: readonly NavDestination[] = [
  {
    id: 'today',
    to: '/home',
    label: { en: 'Today', de: 'Heute' },
    short: { en: 'Today', de: 'Heute' },
    icon: Home,
    matchPaths: ['/home'],
  },
  {
    id: 'learn',
    to: '/learn',
    label: { en: 'Learn', de: 'Lernen' },
    short: { en: 'Learn', de: 'Lernen' },
    icon: BookOpen,
    // The spine itself, the checkpoint route, and every learning module — so a
    // deep link like /articles keeps "Learn" lit instead of needing a shortcut
    // row to steal the active state.
    matchPaths: [...new Set(['/learn', '/checkpoint', ...modulePaths('learning')])],
    guest: {
      to: anchorHref('/home', ANCHORS.learningPath),
      label: { en: 'Lessons', de: 'Lektionen' },
      short: { en: 'Lessons', de: 'Lektionen' },
      // Guests have no "Learn" nav target of their own, but they can still
      // deep-link to /learn and every lesson route — so the row stays lit while
      // they are inside the learning area (and the header chip says "Lessons").
      // '/home' is deliberately absent: Today owns Home.
      matchPaths: [...new Set(['/learn', '/checkpoint', ...modulePaths('learning')])],
    },
  },
  {
    id: 'practice',
    to: '/practice',
    label: { en: 'Practice', de: 'Üben' },
    short: { en: 'Practice', de: 'Üben' },
    icon: Target,
    matchPaths: [...new Set(['/practice', ...modulePaths('practice')])],
  },
  {
    id: 'progress',
    to: '/dashboard',
    label: { en: 'Progress', de: 'Fortschritt' },
    short: { en: 'Progress', de: 'Fortschritt' },
    icon: LayoutDashboard,
    // Analytics is the same destination (progress data), so it lights this too.
    matchPaths: ['/dashboard', '/analytics'],
    authOnly: true,
    badge: 'due',
  },
];

export interface SecondaryDestination {
  id: string;
  to: string;
  label: LocalizedLabel;
  icon: LucideIcon;
  matchPaths: readonly string[];
}

/**
 * Support/account destinations. Analytics and Import are intentionally NOT
 * listed: they are account-scoped and already live in the UserMenu dropdown in
 * the header at every breakpoint — listing them again here is exactly the
 * duplication this table exists to remove.
 */
export const SECONDARY_NAV: readonly SecondaryDestination[] = [
  {
    id: 'help',
    to: '/help',
    label: { en: 'Help', de: 'Hilfe' },
    icon: LifeBuoy,
    matchPaths: ['/help', '/feedback'],
  },
  {
    id: 'settings',
    to: '/settings',
    label: { en: 'Settings', de: 'Einstellungen' },
    icon: Settings,
    matchPaths: ['/settings', '/privacy', '/terms'],
  },
  {
    id: 'feedback',
    to: '/feedback',
    label: { en: 'Send feedback', de: 'Feedback senden' },
    icon: Send,
    matchPaths: ['/feedback'],
  },
];


/** Primary destinations visible to the current visitor. */
export function getPrimaryNav(isAuthenticated: boolean): NavDestination[] {
  return PRIMARY_NAV.filter((item) => !item.authOnly || isAuthenticated);
}

/** Where a destination actually navigates, honouring the guest variant. */
export function navTarget(item: NavDestination, isAuthenticated: boolean): string {
  return !isAuthenticated && item.guest ? item.guest.to : item.to;
}

/** Localized label for the current visitor (rail / drawer). */
export function navLabel(item: NavDestination, isAuthenticated: boolean, isDE: boolean): string {
  const label = !isAuthenticated && item.guest ? item.guest.label : item.label;
  return isDE ? label.de : label.en;
}

/** Localized compact label (bottom bar). */
export function navShortLabel(item: NavDestination, isAuthenticated: boolean, isDE: boolean): string {
  const label = !isAuthenticated && item.guest ? item.guest.short : item.short;
  return isDE ? label.de : label.en;
}

/** Is this destination the one the learner is currently inside? */
export function isNavActive(pathname: string, item: NavDestination, isAuthenticated: boolean): boolean {
  if (!isAuthenticated && item.guest) return matchesAny(pathname, item.guest.matchPaths);
  return matchesAny(pathname, item.matchPaths);
}

/** The primary destination containing `pathname`, or undefined. */
export function getActiveDestination(pathname: string, isAuthenticated: boolean): NavDestination | undefined {
  return getPrimaryNav(isAuthenticated).find((item) => isNavActive(pathname, item, isAuthenticated));
}

/** The secondary destination containing `pathname`, or undefined. */
export function getActiveSecondary(pathname: string): SecondaryDestination | undefined {
  return SECONDARY_NAV.find((item) => matchesAny(pathname, item.matchPaths));
}

export interface NavSection {
  id: string;
  label: string;
  icon: LucideIcon;
}

/**
 * "Where am I?" for the header context chip. Falls back to a neutral workspace
 * label for routes that belong to no section (e.g. /import), so the chip can
 * never disagree with the rail.
 */
export function navSectionFor(pathname: string, isAuthenticated: boolean, isDE: boolean): NavSection {
  const primary = getActiveDestination(pathname, isAuthenticated);
  if (primary) {
    return { id: primary.id, label: navLabel(primary, isAuthenticated, isDE), icon: primary.icon };
  }
  const secondary = getActiveSecondary(pathname);
  if (secondary) {
    return { id: secondary.id, label: isDE ? secondary.label.de : secondary.label.en, icon: secondary.icon };
  }
  return { id: 'workspace', label: isDE ? 'Arbeitsbereich' : 'Workspace', icon: BookOpen };
}
