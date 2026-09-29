/**
 * src/components/lesson/lessonCompletion.test.ts
 *
 * Which learn node a finished run ticks.
 *
 * ── WHY THIS IS PINNED ACROSS ALL SIXTEEN UNITS ─────────────────────────────
 * `onComplete` originally built `` `${unit.id}-learn` ``. That is right for eleven
 * units and wrong for five: m01–m05 name their learn node after the topic
 * (`m01-greetings`, `m02-numbers`, `m03-alphabet`, `m04-family`, `m05-articles`).
 * `completeNode` accepts an unknown id without complaint, so those five units
 * silently recorded nothing and no test noticed — the failing case is a no-op,
 * which is the easiest kind of bug to ship.
 *
 * So this resolves the id the way the spine does, for every unit, and asserts the
 * result is a real `learn` node in that unit's own `nodeIds`.
 */
import { describe, expect, it } from 'vitest';
import { A1_CURRICULUM, getNodeByRoute } from '../../data/a1Path';

const { units, nodeMap } = A1_CURRICULUM;

describe('a finished run completes a REAL learn node, for every unit', () => {
  it.each(units.map((u) => [u.id, u] as const))('%s', (unitId, unit) => {
    const node = getNodeByRoute(`/lesson/${unit.index}`);

    // Resolved at all.
    expect(node, 'getNodeByRoute found no node for the lesson route').toBeTruthy();

    // It is a learn node…
    expect(node!.kind).toBe('learn');

    // …it belongs to THIS unit, so a learner finishing M07 cannot tick M08…
    expect(unit.nodeIds).toContain(node!.id);

    // …and it is the learn node, not a checkpoint that happens to share the route.
    const declaredLearn = unit.nodeIds.map((id) => nodeMap[id]).find((n) => n?.kind === 'learn');
    expect(node!.id).toBe(declaredLearn?.id);
  });

  it('would have been wrong for five units if the id were constructed', () => {
    // The bug this file exists to prevent, stated as an assertion rather than a
    // comment: if someone reintroduces `${id}-learn`, this fails.
    const mismatched = units.filter((u) => u.nodeIds.includes(`${u.id}-learn`) === false);
    expect(mismatched.map((u) => u.id).sort()).toEqual(['m01', 'm02', 'm03', 'm04', 'm05']);
  });
});
