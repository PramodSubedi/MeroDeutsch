/**
 * src/config/grammarTabs.ts — the single source of truth for /grammar tabs.
 *
 * WHY IT LIVES HERE
 * `GrammarPage` used to own the list inline, which meant nothing else could ask
 * "is `?tab=foo` real?" — so a link to a tab that does not exist (`akkusativ`,
 * `review`) failed silently: `GrammarPage` falls back to `sein`, so the chip
 * looked inert and the learner landed on the wrong panel with no error anywhere.
 *
 * Authored curriculum data (`units/mNN.json` node routes, lesson `docRoute`) is
 * checked against this list by `scripts/curriculum/validate.ts`, so a typo in a
 * node route is a build failure instead of a dead link.
 */
export const GRAMMAR_TABS = [
  'sein',
  'haben',
  'weakVerb',
  'conjugation',
  'stem',
  'v2',
  'modals',
  'prefix',
  'cases',
  'accusative',
  'bridge',
  'review',
] as const;

export type GrammarTab = (typeof GRAMMAR_TABS)[number];

export const DEFAULT_GRAMMAR_TAB: GrammarTab = 'sein';

export function isGrammarTab(value: string | null | undefined): value is GrammarTab {
  return !!value && (GRAMMAR_TABS as readonly string[]).includes(value);
}

/**
 * Tabs that render their own reference panel INSTEAD of a fetched drill deck.
 *
 * `GrammarPage` otherwise calls `getGrammarDrills(tab)` on mount, which is a
 * wasted round trip for a panel with no drills and then renders an empty
 * "no exercises" state below a perfectly good table. A new reference tab MUST be
 * listed here or it shows a pointless empty drill list.
 */
export const TABS_WITHOUT_DRILLS: readonly string[] = ['bridge', 'accusative', 'review'];
