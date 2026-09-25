/**
 * src/config/moduleRail.ts
 *
 * Opt-in registry for the desktop context rail (`xl+`).
 *
 * THE RAIL IS EXCEPTIONALLY RARE, BY DESIGN. A full audit of all 17 module
 * routes plus the two hubs found that EVERY one of them already owns a
 * mode/tab strip and its own in-page reference — the roleplay scenario picker,
 * the grammar tab index, the `<GenderLegend />` on /articles and
 * /sentence-builder, the number rules on /numbers, the pronunciation tables.
 * A rail that restates any of those is pure duplication, which is exactly the
 * defect this feature was originally built to fix.
 *
 * So the rule is inverted: a route gets a rail ONLY by adding itself here,
 * with a written rationale. Silence means no rail and a full-width page.
 *
 * Currently ONE route qualifies:
 *   /learn — `UnitSpine` is a per-band LIST. What it cannot show in one
 *   glance is the roll-up across bands: how many of the five gates are
 *   passed, and which gate is the one to tackle next. That aggregate is
 *   genuinely new information, not a restatement.
 *
 * Audited and deliberately EXCLUDED (each already has the content on-page):
 *   /articles, /sentence-builder (GenderLegend) · /roleplay (scenario picker)
 *   /grammar (URL-addressable tab index) · /numbers (rule panels)
 *   /calendar, /greetings, /vocab-trainer, /email-builder (mode switches)
 *   /alphabet (filter + search + per-letter modal) · /pronunciation
 *   (A1_PHONETICS / A1_SOUND_SHIFTS) · /games, /rapid-fire (tab strips)
 *   /glossary, /dictation, /stories, /article-sprint (self-contained)
 *   /practice (it IS an index)
 *
 * Related but separate: `DashboardPage` renders `<A1PathProgress />` in full
 * mode, which shows the same per-band list `UnitSpine` shows on /learn. That
 * duplication is pre-existing and is NOT addressed here.
 */

export type RailKind = 'a1-aggregate';

export interface RailSpec {
  kind: RailKind;
  /**
   * Why this route earns a rail. Written down so the next person adding a
   * spec has to justify it, and so a reviewer can check the claim.
   */
  rationale: string;
}

/** Keyed by exact pathname — hubs and module routes alike. */
export const RAIL_SPECS: Readonly<Record<string, RailSpec>> = {
  '/learn': {
    kind: 'a1-aggregate',
    rationale:
      'UnitSpine lists bands one card at a time; it never states the cross-band roll-up (gates passed, next gate due).',
  },
};

/** The rail spec for this route, or undefined — which means NO rail. */
export function railSpecFor(pathname: string): RailSpec | undefined {
  return RAIL_SPECS[pathname];
}
