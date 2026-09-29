/**
 * src/data/lessonRender/resolveActive.ts
 *
 * THE ONE CALL THAT MAKES THE SWITCH REAL.
 *
 * ── WHY THIS IS NOT THE SAME SHAPE AS `curriculum/resolveActive.ts` ──────────
 * That module is, by its own header, "observability, not behaviour":
 * `a1Path.ts` snapshots `RESOLVED_PATH` into ~50 module-scope constants at
 * IMPORT time, so a value resolved after mount can never reach them, and a
 * `location.reload()` re-evaluates the graph before any network resolution runs
 * — it would serve the bundle again, forever.
 *
 * This switch does not have that problem, and it is worth being explicit about
 * why, because getting it wrong would silently reproduce the same bug:
 *
 *   · the consumer is a REACT COMPONENT (`LessonRoute`), which renders after
 *     mount, so a value resolved later IS visible to it; and
 *   · the value is read through `subscribe()`, never snapshotted at import.
 *
 * So a plain module variable plus a subscription list is sufficient, and no
 * boot-gate rework is needed.
 *
 * ── TWO FACTS, NOT ONE ─────────────────────────────────────────────────────
 * This module deliberately keeps apart the two things a single decision object
 * would have to conflate:
 *
 *   · `getLessonRender()` — what to render. Changes ONLY on a clean read.
 *   · `getLessonRenderRead()` — what the last read attempt did. Telemetry.
 *
 * A failed read is not new information. If it overwrote the renderer, a
 * momentary network blip would swap a learner's lesson content out from under
 * them mid-session, and the decision would then disagree with the render — the
 * worst possible state for an operator trying to answer "why is this learner
 * seeing the old page?". So a failure is recorded, and the last known-good
 * value stands. There is always a floor: `legacy` is the initial value, so a
 * first-ever load with no cache and a failed read renders `legacy`.
 *
 * ── WHY THE LOCALSTORAGE MIRROR ─────────────────────────────────────────────
 * The flag is async, so a naive implementation renders `legacy`, resolves, then
 * re-renders as `run` — a visible content swap on every lesson open, for a
 * visitor on a fast connection who reads normally. That is worse than either
 * renderer alone.
 *
 * The resolved value is therefore mirrored to localStorage and read back
 * SYNCHRONOUSLY when this module initialises, so a returning learner renders the
 * correct renderer on first paint and pays the resolution latency once per
 * browser. The cache is a hint, never an override: it can only ever hold a value
 * a clean read produced, and a clean read replaces it.
 */
import { readLessonRenderFlag } from './flagReader';
import {
  legacyDecision,
  resolveLessonRender,
  type LessonRender,
  type LessonRenderDecision,
} from './source';

/** The localStorage key holding the mirrored renderer. Exported for the check. */
export const LESSON_RENDER_CACHE_KEY = 'meroDeutschLessonRender';

/**
 * Whether this is a dev build, as a BUILD-TIME constant.
 *
 * `import.meta.env?.DEV` rather than `import.meta.env.DEV` for one reason: the
 * check scripts import this module under plain `tsx`, where `import.meta.env` does
 * not exist and the unguarded form throws before a single check runs. Vite
 * replaces the `import.meta.env` text with the real env object, so under the
 * bundler this is still a compile-time `true`/`false` — the dev branch is folded
 * away in a production build, not merely skipped.
 */
const DEV_BUILD: boolean = Boolean(import.meta.env?.DEV);

/* ── the synchronous cache ─────────────────────────────────────────────────── */

/**
 * Read the mirrored value. Returns `undefined` when there is no usable cache.
 *
 * Guarded against a throwing or absent `localStorage`, because this runs during
 * module initialisation on the boot path: Safari private mode throws on
 * `getItem`, and a throw here would take the whole app down over a hint.
 */
function readCache(): LessonRender | undefined {
  try {
    if (typeof localStorage === 'undefined') return undefined;
    return localStorage.getItem(LESSON_RENDER_CACHE_KEY) === 'run' ? 'run' : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(render: LessonRender): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(LESSON_RENDER_CACHE_KEY, render);
  } catch {
    // A full or unavailable store is not worth failing a lesson render over.
  }
}

/* ── the store ─────────────────────────────────────────────────────────────── */

/**
 * A DEV-ONLY override from the URL: `/lesson/6?render=run`.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The whole point of the flag is that it is a DATA change, but that makes the
 * feature unviewable before the row exists: with nothing in `app_config`, the
 * read fails soft and every lesson renders `legacy` — which is correct, and
 * means the new renderer cannot be looked at without either a migration or a
 * Supabase round trip. The reviewer who has to approve this work should not have
 * to write to a production table to do it.
 *
 * ── WHY IT IS DEV-ONLY, COMPILED OUT ─────────────────────────────────────────
 * `import.meta.env.DEV` is a build-time constant, so this whole block is dead
 * code in a production bundle — the `if` folds away and the `render` query
 * parameter is not read at all. That is the point: if the URL could force the
 * renderer in production, the flag would not be the single source of truth, and
 * "flip one row to roll back" would be a claim rather than a fact.
 */
function readDevOverride(): LessonRender | undefined {
  if (!DEV_BUILD) return undefined;
  try {
    const requested = new URLSearchParams(window.location.search).get('render');
    return requested === 'run' || requested === 'legacy' ? requested : undefined;
  } catch {
    return undefined;
  }
}

const devOverride = readDevOverride();

/**
 * The renderer in force. Seeded from the DEV override, then the cache, so the
 * FIRST PAINT is right, and `legacy` whenever both are absent.
 */
let current: LessonRender = devOverride ?? readCache() ?? 'legacy';

/** The outcome of the last read ATTEMPT, whether or not it changed anything. */
let lastRead: LessonRenderDecision | null = null;
let started = false;
const listeners = new Set<() => void>();

/**
 * The wire reader, replaceable for tests.
 *
 * Defaulting to the real reader keeps the app's behaviour the default rather
 * than something a test opts INTO — a seam that defaults to a stub is a seam
 * that can be left in by accident.
 */
let readFlag: () => Promise<unknown> = readLessonRenderFlag;

export function __setReaderForTest(flag: () => Promise<unknown>): void {
  readFlag = flag;
}

/** What to render, synchronously. Never blocks, never throws. */
export function getLessonRender(): LessonRender {
  return current;
}

/**
 * What the last read attempt did. `null` before the first attempt.
 *
 * Separate from `getLessonRender()` on purpose — see the header. A `run`
 * renderer alongside a `flag-unreadable` read is a meaningful, healthy state:
 * the last good value is in force and the latest probe failed.
 */
export function getLessonRenderRead(): LessonRenderDecision | null {
  return lastRead;
}

/** Subscribe to renderer changes. Returns an unsubscribe function. */
export function subscribeLessonRender(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

/**
 * Apply a read outcome.
 *
 * Only a CLEAN read moves the renderer. A failed or unrecognised read is
 * recorded in `lastRead` and leaves `current` alone.
 */
function apply(decision: LessonRenderDecision): LessonRenderDecision {
  lastRead = decision;
  // A DEV override outranks the flag, including a clean one — otherwise a
  // reviewer with `?render=legacy` on the URL would watch the flag silently
  // override them, and the whole point of the parameter is to be the final word.
  if (devOverride) return decision;
  if (decision.reason === 'flag-is-run' || decision.reason === 'flag-is-legacy') {
    if (decision.render !== current) {
      current = decision.render;
      writeCache(decision.render);
      emit();
    }
  }
  return decision;
}

/** Resolve the flag once and publish the outcome. Never throws. */
export async function resolveLessonRenderOnce(): Promise<LessonRenderDecision> {
  let raw: unknown;
  try {
    raw = await readFlag();
  } catch (err) {
    return apply({ render: current, reason: 'flag-unreadable', detail: String(err) });
  }
  return apply(resolveLessonRender(raw));
}

/**
 * Kick off resolution once. Safe to call repeatedly — later calls are no-ops, so
 * a component that mounts twice cannot race two fetches against each other.
 */
export function startLessonRenderResolution(): void {
  if (started) return;
  started = true;
  void resolveLessonRenderOnce().catch(() => {
    // Belt and braces: the reader already fails soft, so reaching here means the
    // wiring itself broke. Degrade to the known-good renderer rather than let an
    // unhandled rejection surface as a blank lesson.
    lastRead = legacyDecision();
  });
}

/** Test seam: forget that resolution started, and restore the real reader. */
export function __resetLessonRenderResolution(): void {
  started = false;
  lastRead = null;
  // NOT reset to 'legacy': a reset must be able to return to the state the real
  // app would be in, which is the dev override if one is on the URL. Forcing
  // 'legacy' here would make a `?render=run` test look like it had been undone.
  current = devOverride ?? readCache() ?? 'legacy';
  listeners.clear();
  readFlag = readLessonRenderFlag;
}
