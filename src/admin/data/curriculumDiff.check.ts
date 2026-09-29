/**
 * src/admin/data/curriculumDiff.check.ts
 *
 *   npm run check:currdiff
 *
 * The bundle-versus-database comparison that makes the `db` switch reviewable.
 *
 * The point of the module is that a structural difference is DETECTABLE, so
 * these tests are about the comparison not lying: not claiming two documents are
 * the same when they are not, not inventing a difference that is not there, and
 * not crashing on the shapes that occur before a first publish.
 */
import { bundleBaseline, diffCurriculum, summariseDiff, type CurriculumDiff } from './curriculumDiff';
import type { CurriculumFile } from '../../data/curriculum/schema';

let checks = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail = ''): void {
  checks += 1;
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    failures.push(label);
  }
}

const BUNDLE = bundleBaseline();
const bundleUnitIds = BUNDLE.units.map((u) => u.id);
const firstId = bundleUnitIds[0];

function unitOf(file: { units: unknown[] }, id: string) {
  return (file.units as { id: string }[]).find((u) => u.id === id);
}

/** A deep-ish copy with a mutation applied to one unit. */
function withUnit(id: string, mutate: (u: Record<string, unknown>) => void): unknown {
  const clone = JSON.parse(JSON.stringify(BUNDLE)) as Record<string, unknown>;
  const target = (clone.units as Record<string, unknown>[]).find((u) => u.id === id)!;
  mutate(target);
  return clone;
}

console.log('\n=== 0. THE BUNDLE IS USABLE AS A BASELINE ===');
check('the bundle has units', BUNDLE.units.length > 0, String(BUNDLE.units.length));
check('the bundle has a first unit id', typeof firstId === 'string' && firstId !== '');
check('bundle units have node arrays', BUNDLE.units.every((u) => Array.isArray(u.nodes)));
// Node identity is `id` first, then `to`. `to` is optional — checkpoints get
// theirs derived — so a comparison keyed on `to` alone reports every checkpoint
// as changed.
check('bundle nodes have an id or a to', BUNDLE.units.every((u) => u.nodes.every((n) => typeof n.id === 'string' || typeof n.to === 'string')));
check('every bundle node has an id', BUNDLE.units.every((u) => u.nodes.every((n) => typeof n.id === 'string' && n.id !== '')));
// The baseline must be the AUTHORED document, never the seeded one. If it were
// the seed, "bundle versus database" would be "database versus database" and the
// diff would report identical for any document the gate had accepted.
check('the baseline has clusters', Array.isArray(BUNDLE.clusters) && BUNDLE.clusters.length > 0, String(BUNDLE.clusters?.length));
check('the baseline is freshly derived each call', bundleBaseline() !== bundleBaseline());

console.log('\n=== 1. AN ABSENT DOCUMENT IS NOT AN ERROR ===');
// Before a first publish, `curriculum_document` does not exist. That is a normal
// state, and the useful answer is "you have not published anything yet" rather
// than an exception or a misleading "identical".
for (const [label, value] of [['null', null], ['undefined', undefined], ['a string', 'nope'], ['an array', []]] as const) {
  let result: CurriculumDiff | null = null;
  let threw = false;
  try {
    result = diffCurriculum(value, BUNDLE);
  } catch {
    threw = true;
  }
  check(`diffing against ${label} does not throw`, !threw);
  check(`diffing against ${label} reports every unit as bundle-only`, result?.verdict === 'bundle-only', result?.verdict);
}

console.log('\n=== 2. AN IDENTICAL DOCUMENT IS IDENTICAL ===');
const same = diffCurriculum(JSON.parse(JSON.stringify(BUNDLE)), BUNDLE);
check('a byte-equal copy is identical', same.verdict === 'identical', same.verdict);
check('an identical document has no differing fields', same.units.every((u) => u.missingNodes.length === 0 && u.extraNodes.length === 0 && u.changedFields.length === 0));
check('cluster counts match', same.clusterCounts.bundle === same.clusterCounts.db);
check('no top-level change is reported', same.topLevelChanges.length === 0, same.topLevelChanges.join(', '));
check('the summary says so in one line', summariseDiff(same).length === 1 && summariseDiff(same)[0].includes('matches'));

// Key order must not be treated as a difference. A database round-trip through
// JSONB does not preserve key order, so an order-sensitive comparison would
// report every field as changed on a document nobody edited.
const reordered = (() => {
  const clone = JSON.parse(JSON.stringify(BUNDLE)) as Record<string, unknown>;
  const u = (clone.units as Record<string, unknown>[])[0] as Record<string, unknown>;
  const title = u.title as Record<string, unknown>;
  u.title = Object.fromEntries(Object.entries(title).reverse());
  return clone;
})();
check('key order is not a difference', diffCurriculum(reordered, BUNDLE).verdict === 'identical');

console.log('\n=== 3. A MISSING UNIT IS REPORTED, NOT MISSED ===');
const withoutFirst = (() => {
  const clone = JSON.parse(JSON.stringify(BUNDLE)) as Record<string, unknown>;
  clone.units = (clone.units as unknown[]).slice(1);
  return clone;
})();
const missing = diffCurriculum(withoutFirst, BUNDLE);
// The rollup verdict is "diverged", not "bundle-only": the other units match
// exactly, and a document that is mostly-identical with one unit missing HAS
// diverged. "bundle-only" is reserved for the case where every unit is missing,
// which is what "you have published nothing" looks like (§1).
check('one missing unit among matching units is diverged', missing.verdict === 'diverged', missing.verdict);
const missingRow = missing.units.find((u) => u.id === firstId);
check('the missing unit is named', missingRow !== undefined);
check('the missing unit is bundle-only', missingRow?.verdict === 'bundle-only');
check('the missing unit reports every node as missing', (missingRow?.missingNodes.length ?? 0) === (unitOf(BUNDLE, firstId)?.nodes.length ?? -1), `${missingRow?.missingNodes.length}`);
check('the units that remain are identical', missing.units.filter((u) => u.id !== firstId).every((u) => u.verdict === 'identical'));
check('the summary names the missing unit', summariseDiff(missing).some((l) => l.startsWith(firstId) && l.includes('not in the database')));

console.log('\n=== 4. AN EXTRA UNIT IS REPORTED ===');
const extra = (() => {
  const clone = JSON.parse(JSON.stringify(BUNDLE)) as Record<string, unknown>;
  const u = JSON.parse(JSON.stringify(clone.units![0])) as Record<string, unknown>;
  u.id = 'm99';
  (u.title as Record<string, unknown>).en = 'A Unit From Nowhere';
  clone.units = [...(clone.units as unknown[]), u];
  return clone;
})();
const added = diffCurriculum(extra, BUNDLE);
check('one extra unit among matching units is diverged', added.verdict === 'diverged', added.verdict);
const extraRow = added.units.find((u) => u.id === 'm99');
check('the extra unit is named', extraRow !== undefined);
check('the extra unit is db-only', extraRow?.verdict === 'db-only');check('the extra unit reports no missing nodes', extraRow?.missingNodes.length === 0);
// With no bundle counterpart there is nothing to compare a title against, so
// every field would read as "changed" — a difference the operator did not make
// and has to read past.
check('the extra unit reports NO changed fields', extraRow?.changedFields.length === 0, extraRow?.changedFields.join(', '));
check('the summary says it is not in the bundle', summariseDiff(added).some((l) => l.startsWith('m99') && l.includes('not in the bundle')));

// The id must not collide with a bundle unit, or it is compared rather than
// added — and `m01` happens to be a real unit id.
const allNew = { clusters: BUNDLE.clusters, units: [{ id: 'zz99', title: { en: 'One' }, nodes: [] }] };

// `db-only` is a PER-UNIT verdict, not a document one. Comparing against a
// non-empty bundle always yields a `bundle-only` row for each of the bundle's
// own units, so "every unit is db-only" is unreachable — and the document-level
// union no longer claims it.
check('an entirely new document is diverged, not "db-only"', diffCurriculum(allNew, BUNDLE).verdict === 'diverged', diffCurriculum(allNew, BUNDLE).verdict);
check('the new unit is db-only per unit', diffCurriculum(allNew, BUNDLE).units.find((u) => u.id === 'zz99')?.verdict === 'db-only');
check('the bundle units are bundle-only per unit', diffCurriculum(allNew, BUNDLE).units.filter((u) => u.id !== 'zz99').every((u) => u.verdict === 'bundle-only'));

console.log('\n=== 5. A CONTENT CHANGE IS REPORTED ===');
const retitled = withUnit(firstId, (u) => {
  (u.title as Record<string, unknown>).en = 'Completely Different';
});
const changed = diffCurriculum(retitled, BUNDLE);
check('a title change is diverged', changed.verdict === 'diverged', changed.verdict);
const changedRow = changed.units.find((u) => u.id === firstId);
check('the changed field is named exactly', changedRow?.changedFields.includes('title.en'), changedRow?.changedFields.join(', '));
check('a title change is not reported as a node change', (changedRow?.missingNodes.length ?? 0) === 0 && (changedRow?.extraNodes.length ?? 0) === 0);
check('the summary names the changed field', summariseDiff(changed).some((l) => l.includes('title.en')));

const renamedNode = withUnit(firstId, (u) => {
  (u.nodes as Record<string, unknown>[])[0].id = 'brand-new-node';
});
const nodeDiff = diffCurriculum(renamedNode, BUNDLE);
const nodeRow = nodeDiff.units.find((u) => u.id === firstId);
check('a renamed node is one missing and one extra', nodeRow?.missingNodes.length === 1 && nodeRow?.extraNodes.length === 1, `${nodeRow?.missingNodes.length}/${nodeRow?.extraNodes.length}`);
check('the new identity is named as extra', nodeRow?.extraNodes.some((n) => n.includes('brand-new-node')));

const addedNode = withUnit(firstId, (u) => {
  (u.nodes as Record<string, unknown>[]).push({ id: 'extra-node', to: '/extra' });
});
const addRow = diffCurriculum(addedNode, BUNDLE).units.find((u) => u.id === firstId);
check('an added node is extra only', addRow?.extraNodes.some((n) => n.includes('extra-node')) && (addRow?.missingNodes.length ?? 0) === 0);

// A checkpoint's `to` is DERIVED from its unit index, so inserting a unit
// renumbers every checkpoint route after it. Keying on `to` would report the
// whole back half of the course as changed on a document nobody edited.
const renumbered = (() => {
  const clone = JSON.parse(JSON.stringify(BUNDLE)) as Record<string, unknown>;
  for (const u of clone.units as Record<string, unknown>[]) {
    for (const n of (u.nodes as Record<string, unknown>[])) {
      if (typeof n.to === 'string' && n.to.startsWith('/checkpoint/')) n.to = `/checkpoint/${Number(n.to.split('/').pop()) + 1}`;
    }
  }
  return clone;
})();
check('a renumbered checkpoint route is not a content change', diffCurriculum(renumbered, BUNDLE).verdict === 'identical', diffCurriculum(renumbered, BUNDLE).verdict);

console.log('\n=== 6. A TOP-LEVEL CHANGE IS REPORTED ===');
const fewerClusters = (() => {
  const clone = JSON.parse(JSON.stringify(BUNDLE)) as Record<string, unknown>;
  clone.clusters = (clone.clusters as unknown[]).slice(1);
  return clone;
})();
const clusterDiff = diffCurriculum(fewerClusters, BUNDLE);
check('a changed cluster count is reported', clusterDiff.topLevelChanges.includes('clusters'), clusterDiff.topLevelChanges.join(', '));
check('both cluster counts are stated', clusterDiff.clusterCounts.bundle === BUNDLE.clusters.length && clusterDiff.clusterCounts.db === BUNDLE.clusters.length - 1);
check('`units` is not summarised as a top-level change', !clusterDiff.topLevelChanges.includes('units'));

// A cluster-count mismatch while every unit matches is the worst kind of lie:
// every unit row reads clean, and the document is still not the same document.
check('a cluster-only change is not "identical"', clusterDiff.verdict !== 'identical', clusterDiff.verdict);

console.log('\n=== 7. DEGENERATE DOCUMENTS ===');
const noUnits = diffCurriculum({ units: [] }, BUNDLE);
check('an empty units array is bundle-only, not identical', noUnits.verdict === 'bundle-only', noUnits.verdict);
const malformedUnits = diffCurriculum({ units: [null, 42, { noId: true }] }, BUNDLE);
check('malformed unit entries do not throw', malformedUnits.verdict !== 'identical');
check('a unit with no id is ignored rather than crashing', !malformedUnits.units.some((u) => u.id === 'undefined'));
// An empty BUNDLE with an empty document is genuinely identical.
const emptyBoth = diffCurriculum({ units: [] }, { units: [] } as unknown as CurriculumFile);
check('empty versus empty is identical', emptyBoth.verdict === 'identical', emptyBoth.verdict);

console.log('\n=== 8. THE REAL BUNDLE AGAINST A REALISTIC DB DOCUMENT ===');
// The shape the publish pipeline actually produces: the bundle with one unit
// edited and one removed.
const realistic = (() => {
  const clone = JSON.parse(JSON.stringify(BUNDLE)) as Record<string, unknown>;
  clone.units = (clone.units as unknown[]).slice(1);
  const last = (clone.units as Record<string, unknown>[]).at(-1)!;
  (last.title as Record<string, unknown>).en = 'Edited In The Database';
  return clone;
})();
const real = diffCurriculum(realistic, BUNDLE);
check('the realistic document is diverged', real.verdict === 'diverged', real.verdict);
check('it reports both problems', summariseDiff(real).length === 2, String(summariseDiff(real).length));
// Every reported line must name a CAUSE. A line with no reason is the failure
// mode: an operator scrolling past "m16" with nothing after it cannot tell
// whether the tool was unsure or there was genuinely nothing to say.
const realLines = summariseDiff(real);
check('every reported unit has a reason', realLines.every((l) => /not in the|missing nodes|extra nodes|changed:/.test(l)), realLines.join(' | '));
check('no line is just an id and a dash', !realLines.some((l) => /^[\w-]+ —\s*$/.test(l)), realLines.join(' | '));

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
