/**
 * src/config/learnerRoutes.ts
 *
 * The learner app's top-level route segments, in ONE list that the curriculum
 * validator and `npm run check:learnerroutes` both read.
 *
 * WHY THIS IS NOT DERIVED FROM `App.tsx`
 * ---------------------------------------
 * `App.tsx` declares routes as JSX, and the validator runs in two places: at
 * module load in the BROWSER (`curriculum/index.ts` validates on import so bad
 * content is loud in dev) and from a Node CLI script. Neither can import a
 * React component tree to read it — the browser path must not pull `App.tsx`
 * into the boot gate, and the CLI path would need a JSX transform. So the list
 * is hand-maintained here and kept honest by a check that diffs it against
 * `App.tsx` mechanically.
 *
 * The direction of authority matters: `App.tsx` is the real router, so a route
 * added THERE without being added HERE fails the check, not the other way
 * round. That is deliberate — the failure should be "you added a route and
 * forgot the registry", never "the registry silently diverged from the router".
 *
 * WHAT IT IS FOR
 * --------------
 * Every `to` in `curriculum/units/*.json` is a link a learner can click, and
 * until this existed nothing checked that they pointed anywhere real. A typo
 * (`/gretings` for `/greetings`) passed `curriculum:validate`, shipped, and
 * 404'd at runtime — the same class of defect that let a hand-authored
 * `/checkpoint/2` survive in `m03.json` while every other unit derived its own.
 *
 * DYNAMIC SEGMENTS ARE NAMES, NOT LITERALS
 * ----------------------------------------
 * `lesson`, `checkpoint`, `learn` and `levels` take params. Only the segment
 * NAME is listed; the validator checks the first path segment, so
 * `/lesson/3/notes` and `/grammar?tab=v2` are both accepted, and a
 * `/lessonz/3` is not.
 *
 * NO REACT, NO IMPORTS BEYOND TYPES — this module is loaded by the validator
 * during the boot gate, so it must stay dependency-free.
 */

/**
 * Top-level segments, without the leading slash. Order mirrors `App.tsx` so a
 * diff between the two reads in the same direction.
 */
export const LEARNER_ROUTE_SEGMENTS = [
  'welcome',
  'auth',
  'home',
  'alphabet',
  'numbers',
  'calendar',
  'articles',
  'greetings',
  'glossary',
  'vocab-trainer',
  'dictation',
  'grammar',
  'pronunciation',
  'roleplay',
  'dashboard',
  'learn',
  'levels',
  'checkpoint',
  'lesson',
  'sentence-builder',
  'games',
  'email-builder',
  'practice',
  'article-sprint',
  'rapid-fire',
  'rapid-blitz',
  'stories',
  'analytics',
  'import',
  'settings',
  'privacy',
  'terms',
  'help',
  'feedback',
] as const;

export type LearnerRouteSegment = (typeof LEARNER_ROUTE_SEGMENTS)[number];

const SEGMENT_SET: ReadonlySet<string> = new Set(LEARNER_ROUTE_SEGMENTS);

/**
 * The first path segment of a route, or `''` for anything that is not a
 * rooted path. Query strings and hashes are stripped first, so `/grammar?tab=v2`
 * yields `grammar` and not `grammar?tab=v2`.
 */
export function routeSegmentOf(path: string): string {
  if (!path.startsWith('/')) return '';
  const withoutQuery = path.split(/[?#]/, 1)[0] ?? '';
  const [, first = ''] = withoutQuery.split('/');
  return first;
}

/**
 * Does this authored route point at a real page?
 *
 * Unknown segments come back with the nearest real segment in the message,
 * because "unknown route '/gretings'" is much less actionable than "did you
 * mean '/greetings'?" — and a typo is the overwhelmingly common cause.
 */
export function isKnownLearnerRoute(path: string): boolean {
  return SEGMENT_SET.has(routeSegmentOf(path));
}

/** A human suggestion for a misspelled segment, or `null` when nothing is close. */
export function suggestRouteSegment(segment: string): string | null {
  if (SEGMENT_SET.has(segment)) return null;
  let best: string | null = null;
  let bestScore = Infinity;
  for (const candidate of SEGMENT_SET) {
    // Cheap edit distance: single pass Levenshtein, no allocation beyond the row.
    const a = segment;
    const b = candidate;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) {
      const row = [i];
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        row[j] = Math.min((row[j - 1] ?? Infinity) + 1, (prev[j] ?? Infinity) + 1, (prev[j - 1] ?? Infinity) + cost);
      }
      prev = row;
    }
    const score = prev[b.length] ?? Infinity;
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  // 1 edit for a short segment, 2 for a long one — loose enough to catch a
  // dropped or doubled character, tight enough not to suggest nonsense.
  const limit = segment.length <= 5 ? 1 : 2;
  return bestScore <= limit ? best : null;
}