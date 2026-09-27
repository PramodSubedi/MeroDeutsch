/**
 * src/components/path/moduleProgress.ts
 *
 * The two things every path surface needs and must agree on:
 *   1. HOW FAR THROUGH this lesson am I  → `computeModuleProgress`
 *   2. WHAT IS ITS STATE, in words       → `phaseStateWord`
 *
 * WHY SHARED
 * The answer needs two pieces of live state (`isNodeComplete`,
 * `isCheckpointComplete`) and one piece of static content (`A1_CURRICULUM`'s
 * id -> node map). State must be read through the caller's `useA1Path()` call —
 * a hook reading the context itself would work, but then the roadmap, the
 * dashboard strip and the shell waypoint could each drift into their own idea
 * of "done". They can't drift if they all call the same pure function with the
 * same two predicates. No new state, no second source of truth.
 *
 * WHAT COUNTS
 *   · the learn / practice nodes of the module (visit = complete, rule A)
 *   · the module's checkpoint, because a module is only "finished" once its
 *     80% gate is passed — without it a passed module could never reach 100%,
 *     and a ring stuck at 67% on a finished lesson is a lie.
 * A module with no gate (SUPPORT) does not get that extra step, so its ring can
 * still reach 100% on its nodes alone.
 */
import { A1_CURRICULUM } from '../../data/a1Path';
import type { A1Unit, PathNode } from '../../data/a1Path';
import type { A1UnitPhase } from '../../hooks/useA1Path';

export interface ModuleProgress {
  /** Completed steps, including the gate. */
  done: number;
  /** Total steps, including the gate. */
  total: number;
  /** 0..100, rounded for display. */
  pct: number;
}

/** Progress through one module, from path state + authored content. */
export function computeModuleProgress(
  unit: A1Unit,
  isNodeComplete: (node: PathNode) => boolean,
  isCheckpointComplete: (unitIndex: number) => boolean,
): ModuleProgress {
  let done = 0;
  let total = 0;

  for (const id of unit.nodeIds) {
    const node = A1_CURRICULUM.nodeMap[id];
    if (!node) continue;
    // The gate is counted once, below, in its own step.
    if (node.kind === 'checkpoint') continue;
    total += 1;
    if (isNodeComplete(node)) done += 1;
  }

  if (unit.checkpoint) {
    total += 1;
    if (isCheckpointComplete(unit.index)) done += 1;
  }

  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

/**
 * The one-word state for a lesson, in the learner's UI language.
 *
 * `passed` is passed in rather than derived, because "gate passed" outranks the
 * display phase: a module can be 'done' (passed) while its own ring still needs
 * the distinction from 'current'. Keeping the precedence here means the
 * roadmap, the strip and the waypoint cannot disagree about wording either.
 */
export function phaseStateWord(phase: A1UnitPhase, passed: boolean, isDE: boolean): string {
  if (passed) return isDE ? 'Bestanden' : 'Passed';
  switch (phase) {
    case 'locked':
      return isDE ? 'Gesperrt' : 'Locked';
    case 'current':
      return isDE ? 'Aktuell' : 'Current';
    case 'done':
      return isDE ? 'Bestanden' : 'Passed';
    case 'optional':
      return isDE ? 'Nebenweg' : 'Side track';
    default:
      return isDE ? 'Offen' : 'Open';
  }
}

/* ── whole-level rollup (the /learn level grid + the level switcher) ──────── */

/**
 * One number for a whole level, used by the /learn level grid and the level
 * switcher on a level page. Both surfaces need the same three facts — how many
 * modules are finished, what share that is, and what colour the ring should be
 * — so they call this instead of each keeping their own tally.
 */
export interface CefrLevelProgress {
  /** Modules at 100% (learn nodes + checkpoint), per the rule above. */
  done: number;
  /** Modules in the level. */
  total: number;
  /**
   * Share of STEPS, 0..100. The finer-grained figure: it moves after a single
   * lesson, where the module count does not.
   */
  pct: number;
  /**
   * Share of MODULES, 0..100 — the same unit as `done / total`.
   *
   * Both numbers exist because they disagree by design, and a surface that
   * shows one next to the other must pick the matching pair: a 33% steps ring
   * beside "0 / 15 modules done" reads as a broken widget, not as two truths.
   * The level grid pairs this with `done / total`; the A1 spine keeps its own
   * per-module step rings, which have no count beside them.
   */
  modulePct: number;
  /**
   * The ring's colour family, taken from the learner's real position: the
   * phase of the first module that is not yet finished, or 'done'. Reusing
   * `getUnitPhase` is the point — the grid's ring then means exactly what the
   * same-coloured ring means on the spine.
   */
  phase: A1UnitPhase;
}

/**
 * Roll a level's modules up into a single progress figure.
 *
 * The per-module maths is NOT reimplemented: every module goes through
 * `computeModuleProgress`, which is the function the spine's own rings are
 * drawn from. A grid that disagreed with the roadmap it links to would be
 * worse than no figure at all.
 */
export function summarizeLevelProgress(
  units: A1Unit[],
  isNodeComplete: (node: PathNode) => boolean,
  isCheckpointComplete: (unitIndex: number) => boolean,
  getUnitPhase: (unitIndex: number) => A1UnitPhase,
): CefrLevelProgress {
  let done = 0;
  let stepsDone = 0;
  let stepsTotal = 0;
  let firstIncomplete: A1Unit | undefined;

  for (const unit of units) {
    const { done: d, total } = computeModuleProgress(
      unit,
      isNodeComplete,
      isCheckpointComplete,
    );
    stepsDone += d;
    stepsTotal += total;
    // A module counts as finished only at 100%, so a learner sees the figure
    // jump by one whole module at a time instead of creeping up on a
    // half-finished lesson.
    if (total > 0 && d === total) done += 1;
    else if (!firstIncomplete) firstIncomplete = unit;
  }

  return {
    done,
    total: units.length,
    // Share of STEPS, not of modules: with 15 modules that is far more
    // responsive in the first few lessons than a module count that sits on 0.
    pct: stepsTotal > 0 ? Math.round((stepsDone / stepsTotal) * 100) : 0,
    modulePct: units.length > 0 ? Math.round((done / units.length) * 100) : 0,
    phase:
      done === units.length
        ? 'done'
        : firstIncomplete
          ? getUnitPhase(firstIncomplete.index)
          : 'available',
  };
}
