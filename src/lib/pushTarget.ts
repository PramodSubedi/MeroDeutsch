import { CEFR_LEVELS_ROUTE } from '../data/cefrLevels';
/**
 * src/lib/pushTarget.ts
 *
 * ONE answer to "where does Continue/Resume go?", for every surface that asks.
 *
 * THE DUPLICATION THIS REMOVES
 * --------------------------
 * Two surfaces render the same "next step in the course" control, and they used
 * to disagree about what "no next step" means:
 *
 *   /learn   `nextNode?.to ?? CEFR_LEVELS_ROUTE`  → "All levels"  → /levels
 *   Home     `hasCampaign ? … : null`              → "All caught up — go to
 *                                                 path"           → /learn
 *
 * Both are "the campaign is finished", and they answered it differently. The
 * Home one is also the worse answer on its own terms: a learner already sitting
 * on Home gets a button that links back to Home, which is a dead button — the
 * exact failure `/learn`'s own comment warns about ("not this same page, which
 * a self-link would make a dead button").
 *
 * So the finished case resolves to the CEFR LEVEL GRID everywhere: it is a real
 * destination, it answers "what else is there", and it is never a self-link
 * from either surface.
 *
 * WHY A SEPARATE MODULE
 * ---------------------
 * Both callers sit in different trees (`pages/` and `components/path/`) and
 * both already import `getPushNode` from the same hook, so neither could own
 * this. It is pure data in, pure data out — no React, no router — so it is
 * testable without mounting either surface.
 */
/** The minimum a push node needs to describe a destination. */
export interface DescribableNode {
  to: string;
  label: { en: string; de: string };
}

export interface PushTarget {
  /** Where the control navigates. Never the page that rendered it. */
  to: string;
  /** Localized label for the control. */
  label: string;
  /**
   * True when the campaign is complete and this is the "nothing left in this
   * course" fallback rather than a real next node. A surface may style it
   * differently (success colouring vs. the normal primary action).
   */
  isComplete: boolean;
}

/**
 * Resolve the push node into a navigable, labeled target.
 *
 * `pushNode` is `getPushNode()`'s result: `null` when the level is finished,
 * `undefined` in the shape it can be omitted as. Both mean the same thing here,
 * and neither can produce a self-link.
 */
export function resolvePushTarget(
  pushNode: DescribableNode | null | undefined,
  isDE: boolean,
): PushTarget {
  if (pushNode) {
    return {
      to: pushNode.to,
      label: isDE ? `Weiter: ${pushNode.label.de}` : `Next: ${pushNode.label.en}`,
      isComplete: false,
    };
  }
  return {
    to: CEFR_LEVELS_ROUTE,
    label: isDE ? 'Alle Niveaus' : 'All levels',
    isComplete: true,
  };
}
