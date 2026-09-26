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
