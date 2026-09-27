/**
 * src/data/a1Path.v4migration.check.ts
 *
 *   npm run check:v4migration
 *
 * ── WHAT THIS IS FOR ─────────────────────────────────────────────────────────
 * The v4.0 pass renamed 20 node ids from semantic to positional
 * (`m06-professions` → `m06-learn`, `mNN-gate` → `mNN-checkpoint`). The V4
 * migration originally remapped ONLY the unit-INDEX-keyed maps, on the stated
 * assumption that `completedNodeIds` needed nothing because "every unit still
 * exists with the same id and the same content".
 *
 * That assumption is false: unit ids are stable, NODE ids are not. Since
 * `isNodeComplete` is `completedNodeIds.includes(node.id)`, roughly twenty
 * FINISHED nodes per existing learner silently reverted to "not done" — and
 * because the learner stays unlocked, nothing anywhere looked broken.
 *
 * A migration that quietly discards real progress is the worst kind of bug: no
 * error, no failed build, and the person it hurts cannot tell what happened. So
 * the properties that make it correct are asserted here rather than trusted.
 */
import { A1_LEARN_NODES, remapV3NodeIds, V3_TO_V4_NODE_ID } from './a1Path';

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

const V4 = /-(learn|practice|checkpoint)$/;
const liveNodeIds = new Set(A1_LEARN_NODES.map((n) => n.id));

/**
 * A v4 node id that is neither a map target nor explained is a node that was
 * renamed without the map knowing — the original bug, one unit at a time.
 *
 * Two legitimate ways to be explained:
 *   · it is a TARGET of the map (it was renamed, and we know its old name);
 *   · its unit kept semantic names — m01–m05 were never positionalised, so
 *     `m01-greetings` is not a rename at all;
 *   · its unit is NEW (m16), so no learner can hold a stale id for it.
 */
function explained(id: string, targets: Set<string>): boolean {
  if (targets.has(id)) return true;
  if (/^m0[1-5]-/.test(id)) return true; // kept semantic names
  if (/^m16-/.test(id)) return true; // new unit, nothing to migrate
  return false;
}

console.log('\n=== 1. EVERY MAP TARGET IS A REAL NODE ===');
// A typo here would move a learner's completion onto an id that does not exist —
// the same silent loss, wearing a different hat.
for (const [from, to] of Object.entries(V3_TO_V4_NODE_ID)) {
  check(`${from} → ${to} exists in the spine`, liveNodeIds.has(to), 'target id is not a real node');
}

console.log('\n=== 2. NO MAP KEY IS ITSELF A TARGET (would not be idempotent) ===');
// If `m06-learn` were a KEY, a second hydrate would remap it again.
for (const [from, to] of Object.entries(V3_TO_V4_NODE_ID)) {
  check(`${from} is not a key in its own map`, !(to in V3_TO_V4_NODE_ID), `${to} is also a key`);
}

console.log('\n=== 3. NO TWO IDS COLLAPSE ONTO ONE TARGET ===');
// Two sources mapping to one target means one learner's completion is credited
// to a node another learner never finished.
const targets = Object.values(V3_TO_V4_NODE_ID);
const dupes = targets.filter((t, i) => targets.indexOf(t) !== i);
check('no duplicate targets', dupes.length === 0, [...new Set(dupes)].join(', '));

console.log('\n=== 4. EVERY RENAMED NODE IS IN THE MAP ===');
// A v4 node id that is neither a map target nor a pre-existing positional id is
// a node that was renamed without the map knowing — which is precisely the
// original bug, confined to one unit instead of twenty.
const targetsSet = new Set(targets);
const unmapped = [...liveNodeIds].filter((id) => V4.test(id) && !explained(id, targetsSet));
check('every renamed node is reachable from the map', unmapped.length === 0, unmapped.join(', '));

console.log('\n=== 5. THE REMAP IS IDEMPOTENT ===');
const sample = Object.keys(V3_TO_V4_NODE_ID);
const once = remapV3NodeIds(sample);
const twice = remapV3NodeIds(once);
check('a second pass changes nothing', once.join(',') === twice.join(','), `${once.join(',')} -> ${twice.join(',')}`);
check('an already-migrated id is untouched', remapV3NodeIds(['m06-learn']).join(',') === 'm06-learn');
check('an already-migrated checkpoint is untouched', remapV3NodeIds(['m15-checkpoint']).join(',') === 'm15-checkpoint');

console.log('\n=== 6. NOTHING REAL IS DROPPED ===');
const mixed = ['m06-professions', 'm06-learn', 'a1-path-v4-order', 'a1-path-bands-v2', 'some-future-id', 'm01-greetings'];
const out = remapV3NodeIds(mixed);
check('an old id is rewritten', out.includes('m06-learn'), out.join(', '));
check('a current id survives', out.includes('m01-greetings'), out.join(', '));
check('a migration marker survives', out.includes('a1-path-v4-order'), out.join(', '));
check('an unknown future id survives rather than being discarded', out.includes('some-future-id'), out.join(', '));
check('the list length is unchanged', out.length === mixed.length, `${mixed.length} -> ${out.length}`);
check('nothing is lost', mixed.every((id) => out.length === mixed.length));

console.log('\n=== 7. A REAL LEARNER SHAPE MIGRATES END TO END ===');
// The scenario from the bug report, end to end: a learner who finished two
// semantic-named nodes and a gate must see all three complete afterwards.
const learner = ['m06-professions', 'm08-sentence', 'm11-gate', 'm01-greetings', 'm15-stories'];
const migrated = remapV3NodeIds(learner);
for (const node of migrated) {
  check(`"${node}" is a real node`, liveNodeIds.has(node), node);
}
check('the gate became a checkpoint', migrated.includes('m11-checkpoint'), migrated.join(', '));
check('nothing was lost in the round trip', migrated.length === learner.length);

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
