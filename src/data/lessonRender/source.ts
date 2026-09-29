/**
 * src/data/lessonRender/source.ts
 *
 * THE RENDERER SWITCH: `lesson_render = legacy | run`.
 *
 * ── WHAT THIS IS FOR ────────────────────────────────────────────────────────
 * The guided step-flow lesson replaces the current document + tab lesson page.
 * Replacing it outright on 16 units and a premium route is not a change that
 * should be all-or-nothing: if the new renderer has a defect, the only
 * alternative is a revert deploy, and learners get the defect in the meantime.
 *
 * So the new renderer ships BEHIND this switch, defaulting to the behaviour that
 * already exists. Flipping the flag is a single-row edit in the control centre
 * and takes effect on the learner's next navigation; reverting is the same edit
 * in reverse. That is the whole definition of a rollout.
 *
 * The principle is not invented here. `data/curriculum/source.ts` states it for
 * the curriculum shadow switch and `resolveActive.check.ts:70-79` asserts it —
 * "A switch that cannot be turned back is not a rollout, it is a migration."
 * This is the same mechanism, for the same reason, applied to UI rather than
 * content.
 *
 * ── WHY `legacy` IS THE DEFAULT, NOT `run` ──────────────────────────────────
 * The default is the branch that is already in production and has no new code
 * in its render path. An absent, unreadable, misspelled or hostile flag value
 * must all land on it, because the alternative is a typo in one JSONB cell
 * turning every lesson into an error page for every learner at once.
 *
 * ── WHY THE RESOLUTION IS A SEPARATE MODULE ─────────────────────────────────
 * This file is pure: no Supabase, no React, no storage. It is the layer a check
 * script can exercise with no network and no browser, which is the only reason
 * the failure modes below are actually tested rather than merely intended.
 */

export type LessonRender = 'legacy' | 'run';

/** The only flag that selects the renderer. Absent or unrecognised = legacy. */
export const LESSON_RENDER_KEY = 'lesson_render';

/**
 * Mirrors `CONFIG_KEYS.lesson_render.values`.
 *
 * Duplicated rather than imported-and-re-indexed on purpose: the vocabulary is
 * a compile-time constant here, so the resolver stays a pure function of its
 * input with no registry lookup in the middle. `source.check.ts` asserts the
 * two agree, which is what keeps the duplication honest — the same trick
 * `CHATBOT_CONFIG_KEYS` uses and `check:chatconfig` pins.
 */
export const LESSON_RENDER_VALUES: readonly LessonRender[] = ['legacy', 'run'];

export interface LessonRenderDecision {
  render: LessonRender;
  /**
   * Why `legacy` was chosen, when it was. Surfaced in the admin System page and
   * logged in dev, so "the switch says run but the app shows legacy" is
   * answerable rather than mysterious.
   */
  reason:
    /** The flag explicitly said `legacy` — a deliberate rollback. */
    | 'flag-is-legacy'
    /** The flag explicitly said `run`. */
    | 'flag-is-run'
    /** Absent, unreadable, or not one of the known values. */
    | 'flag-unreadable';
  /** Present only when the flag read threw. */
  detail?: string;
}

/** True when `raw` names a renderer this build knows how to render. */
export function isKnownLessonRender(raw: unknown): raw is LessonRender {
  if (typeof raw !== 'string') return false;
  return LESSON_RENDER_VALUES.includes(raw.trim().toLowerCase() as LessonRender);
}

/**
 * Decide the renderer from a raw flag value.
 *
 * Tolerant by design, for the same reason `resolveSource` is: a value that is
 * not exactly one of the two known strings means the current, working
 * behaviour. There is deliberately no third "try it and see" state — a partially
 * applied renderer is the failure mode a switch exists to prevent.
 */
export function resolveLessonRender(raw: unknown): LessonRenderDecision {
  if (typeof raw !== 'string') {
    return { render: 'legacy', reason: 'flag-unreadable' };
  }
  const v = raw.trim().toLowerCase();
  if (v === 'run') return { render: 'run', reason: 'flag-is-run' };
  if (v === 'legacy') return { render: 'legacy', reason: 'flag-is-legacy' };
  return { render: 'legacy', reason: 'flag-unreadable' };
}

/** The value to use when the flag has not been read yet, or could not be. */
export function legacyDecision(): LessonRenderDecision {
  return { render: 'legacy', reason: 'flag-unreadable' };
}
