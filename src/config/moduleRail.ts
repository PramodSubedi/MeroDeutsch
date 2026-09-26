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
 * SECOND, INDEPENDENT GATE: TIER. `/learn` describes the A1 campaign (the
 * 15-module spine and its checkpoint gates), which is the Premium curriculum, so
 * `ContextPanel` renders no aggregate rail for a guest or a signed-in free
 * learner. The `/lesson/` prefix is NOT gated: it annotates the free interactive
 * lesson, and is only suppressed on the `/notes` document route. This file
 * answers "may this ROUTE have a rail?"; ContextPanel answers "may this TIER
 * see one?". Both must say yes, and neither file can decide the other's half.
 *
 * Currently ONE route qualifies:
 *   /learn — `UnitSpine` is a per-module LIST. What it cannot show in one
 *   glance is the roll-up across modules: how many of the fifteen checkpoints
 *   are passed, and which one is the one to tackle next. That aggregate is
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
 *
 * SECOND ENTRY: /lesson/:n. The lesson page is the study surface, and the
 * practice tools are deliberately NOT on it — they are optional reinforcement
 * for material the learner has just read. The rail is the only place that can
 * say which tools suit THIS lesson (`data/lessonPracticeLinks.ts`) without
 * turning the lesson into a tool launcher. It qualifies on the same test as
 * /learn: information the page below genuinely cannot show in one glance.
 */

export type RailKind = 'a1-aggregate' | 'a1-lesson';

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
      'UnitSpine lists lessons one row at a time; it never states the cross-lesson roll-up (gates passed, next gate due).',
  },
};

/**
 * PARAM routes, which cannot live in the exact-path table above because the
 * pathname carries a variable. Matched by prefix on a `/seg/:` boundary so
 * `/lesson/3` matches while `/lessons-stuff` does not.
 */
const RAIL_PREFIX_SPECS: ReadonlyArray<{ prefix: string; spec: RailSpec }> = [
  {
    prefix: '/lesson/',
    spec: {
      kind: 'a1-lesson',
      rationale:
        'The lesson page holds the study material only. Which practice tools drill THIS lesson is per-lesson knowledge the page cannot state, so it lives in the rail.',
    },
  },
];

/** The rail spec for this route, or undefined — which means NO rail. */
export function railSpecFor(pathname: string): RailSpec | undefined {
  const exact = RAIL_SPECS[pathname];
  if (exact) return exact;
  for (const entry of RAIL_PREFIX_SPECS) {
    if (pathname.startsWith(entry.prefix) && pathname.length > entry.prefix.length) {
      return entry.spec;
    }
  }
  return undefined;
}

/**
 * The unit index a `/lesson/:n` pathname refers to, or null. Exported so the
 * rail reads the SAME number the page does instead of re-parsing the path with
 * its own rules.
 */
export function lessonIndexFromPath(pathname: string): number | null {
  if (!pathname.startsWith('/lesson/')) return null;
  const raw = pathname.slice('/lesson/'.length);
  // Tolerate a trailing slash; reject anything non-numeric so /lesson/abc
  // renders the page's own "Lesson not found" state instead of a rail for a
  // lesson that does not exist.
  const cleaned = raw.endsWith('/') ? raw.slice(0, -1) : raw;
  if (!/^\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
