/**
 * src/admin/data/curriculumDiff.ts
 *
 * Compare a stored curriculum document against the bundle, and a snapshot
 * against the live draft.
 *
 * ── WHY THIS IS A PURE MODULE ────────────────────────────────────────────────
 * The decision to switch `curriculum_source` to `db` is a content decision, and
 * the only way to make it well is to SEE the difference. That comparison was
 * available nowhere: the store list showed titles and node counts, the version
 * list showed timestamps, and neither ever said how the database content
 * compares to the content learners get today.
 *
 * So the review had to be done by hand, or not at all. Pure functions make it
 * assertable, which is what `curriculumDiff.check.ts` does.
 *
 * ── WHAT A DIFF IS AND IS NOT ────────────────────────────────────────────────
 * It reports STRUCTURAL differences — which unit ids exist, which node routes
 * exist, which title strings differ. It does not judge quality, and it cannot:
 * two documents can be structurally identical and one can be much better. What it
 * can do is make the review possible, which is the part a tool should own.
 */
import clustersJson from '../../data/curriculum/clusters.json';
import { UNIT_FILES } from '../../data/curriculum/units.generated';
import { CURRICULUM_SCHEMA_VERSION } from '../../data/curriculum/schema';
import type {
  Cluster,
  CurriculumFile,
  CurriculumUnitFile,
} from '../../data/curriculum/schema';

type CurriculumUnit = CurriculumUnitFile;

/**
 * The authored bundle, assembled the same way `data/curriculum/index.ts` does —
 * but WITHOUT going through it.
 *
 * That module consults `dbSeed` and calls `resolvePath`, so importing it would
 * (a) run the whole spine derivation to answer a question about two JSON
 * documents, and (b) return the SEEDED document when the flag is `db` — at which
 * point the "difference between bundle and database" would be the difference
 * between the database and itself. Always nil.
 *
 * So the baseline is rebuilt here from the same two sources. Duplication of six
 * lines, and it is worth more than the import it replaces.
 */
export function bundleBaseline(): CurriculumFile {
  return {
    schemaVersion: CURRICULUM_SCHEMA_VERSION,
    clusters: clustersJson as unknown as Cluster[],
    units: UNIT_FILES as unknown as CurriculumUnit[],
  } as unknown as CurriculumFile;
}

/**
 * Verdict for ONE unit against the bundle.
 *
 * `db-only` exists here and NOT in `CurriculumDiff['verdict']`, because it is
 * only ever true per unit. At document level it is unreachable: comparing against
 * a non-empty bundle always produces a `bundle-only` row for every unit the
 * bundle has, so "every unit is db-only" can never hold. It used to be a branch
 * in the rollup — a code path nothing could enter, which is the same dead-branch
 * smell this module was written to avoid.
 */
export type UnitVerdict = 'identical' | 'db-only' | 'bundle-only' | 'diverged';

/**
 * Verdict for the WHOLE document.
 *
 * `bundle-only` is what an absent or unpopulated document reports, which is the
 * state before a first publish and the answer an operator most needs to be able
 * to read at a glance.
 */
export type DiffVerdict = 'identical' | 'bundle-only' | 'diverged';

export interface UnitDiff {
  id: string;
  verdict: UnitVerdict;
  /** Node routes present in the bundle and not in the database. */
  missingNodes: string[];
  /** Node routes present in the database and not in the bundle. */
  extraNodes: string[];
  /** Human-readable field differences, e.g. `title.en`. */
  changedFields: string[];
}

export interface CurriculumDiff {
  verdict: DiffVerdict;
  units: UnitDiff[];
  /** Field paths that differ outside `units` — `clusters`, `meta`, and so on. */
  topLevelChanges: string[];
  /** `clusters.length` on each side, because a cluster count mismatch is serious. */
  clusterCounts: { bundle: number; db: number };
}

/**
 * A node's stable identity, used to detect structural change.
 *
 * The field is `to`, not `route` — `CurriculumNodeFile` names it `to`, and it is
 * OPTIONAL for checkpoints, whose route the builder derives. So a node's
 * identity is `id` when present, else `to`. Using `id` first matters: a
 * checkpoint's `to` moves when a unit is inserted before it, and that is a
 * renumbering, not a content change.
 */
function nodeKey(node: unknown): string | null {
  if (!node || typeof node !== 'object') return null;
  const n = node as { id?: unknown; to?: unknown };
  if (typeof n.id === 'string' && n.id !== '') return `id:${n.id}`;
  if (typeof n.to === 'string' && n.to !== '') return `to:${n.to}`;
  return null;
}

function nodeKeys(unit: CurriculumUnit | undefined): string[] {
  if (!unit) return [];
  const nodes: unknown[] = Array.isArray(unit.nodes) ? (unit.nodes as unknown[]) : [];
  return nodes
    .map(nodeKey)
    .filter((k): k is string => k !== null)
    .sort();
}

function unitTitleFields(unit: CurriculumUnit | undefined): Record<string, string> {
  const title = unit?.title as Record<string, unknown> | undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(title ?? {})) {
    if (typeof v === 'string') out[`title.${k}`] = v;
  }
  return out;
}

function compareUnit(bundle: CurriculumUnit | undefined, db: CurriculumUnit | undefined): UnitDiff {
  const id = (db?.id ?? bundle?.id ?? '?') as string;
  const bundleNodes = new Set(nodeKeys(bundle));
  const dbNodes = new Set(nodeKeys(db));

  const missingNodes = [...bundleNodes].filter((n) => !dbNodes.has(n));
  const extraNodes = [...dbNodes].filter((n) => !bundleNodes.has(n));
  // Compared ONLY when both sides exist. With one side absent there is nothing
  // to compare a title against, and computing the difference anyway reports
  // every field of a db-only unit as "changed" — inventing differences the
  // operator then has to read past to find the one that matters.
  const changedFields =
    !bundle || !db ? [] : compareStrings(unitTitleFields(bundle), unitTitleFields(db));

  // The per-unit verdict must actually be a verdict. It used to report
  // 'diverged' for every unit present on both sides regardless of whether
  // anything differed, which made the rollup meaningless — two identical
  // documents and two documents differing in every unit both came out as
  // 'diverged', and an added unit could never read as 'db-only'.
  const verdict: UnitDiff['verdict'] =
    !bundle
      ? 'db-only'
      : !db
        ? 'bundle-only'
        : missingNodes.length === 0 && extraNodes.length === 0 && changedFields.length === 0
          ? 'identical'
          : 'diverged';

  return { id, verdict, missingNodes, extraNodes, changedFields };
}

function compareStrings(a: Record<string, string>, b: Record<string, string>): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((k) => a[k] !== b[k]).sort();
}

function unitsOf(file: unknown): Map<string, CurriculumUnit> {
  const out = new Map<string, CurriculumUnit>();
  const list = (file as { units?: unknown } | null)?.units;
  if (!Array.isArray(list)) return out;
  for (const u of list) {
    if (u && typeof u === 'object' && typeof (u as CurriculumUnit).id === 'string') {
      out.set((u as CurriculumUnit).id, u as CurriculumUnit);
    }
  }
  return out;
}

/**
 * Compare two curriculum documents.
 *
 * `db` may be null or malformed — that is the normal state before a first
 * publish, and a diff against nothing is a useful answer, not an error.
 */
export function diffCurriculum(db: unknown, bundle: CurriculumFile = bundleBaseline()): CurriculumDiff {
  const bundleUnits = unitsOf(bundle);
  const dbUnits = unitsOf(db);

  const ids = new Set([...bundleUnits.keys(), ...dbUnits.keys()]);
  const units: UnitDiff[] = [...ids]
    .sort()
    .map((id) => compareUnit(bundleUnits.get(id), dbUnits.get(id)));

  const topLevelChanges = compareTopLevel(bundle, db);

  // `identical` is a claim about the WHOLE DOCUMENT, so it must consider the
  // top level too. It used to look only at units — which meant a document whose
  // clusters had been edited reported "identical" while every unit row read
  // clean. That is the most dangerous shape of lie this module could produce,
  // because the units are exactly what an operator would scan.
  const allUnitsIdentical = units.every((u) => u.verdict === 'identical');

  const verdict: DiffVerdict = (() => {
    if (units.length === 0) return topLevelChanges.length === 0 ? 'identical' : 'diverged';
    if (allUnitsIdentical) return topLevelChanges.length === 0 ? 'identical' : 'diverged';
    // "Every unit the bundle has is missing" is what an unpublished document
    // looks like, and it is worth naming distinctly: it is the state an operator
    // is in before the first publish, and the answer to "did my publish work?".
    if (units.every((u) => u.verdict === 'bundle-only')) return 'bundle-only';
    return 'diverged';
  })();

  return {
    verdict,
    units,
    topLevelChanges,
    clusterCounts: {
      bundle: Array.isArray((bundle as { clusters?: unknown }).clusters) ? (bundle as { clusters: unknown[] }).clusters.length : 0,
      db: Array.isArray((db as { clusters?: unknown } | null)?.clusters) ? (db as { clusters: unknown[] }).clusters.length : 0,
    },
  };
}

function compareTopLevel(bundle: unknown, db: unknown): string[] {
  const changes: string[] = [];
  const b = bundle as Record<string, unknown>;
  const d = (db ?? {}) as Record<string, unknown>;
  for (const key of new Set([...Object.keys(b), ...Object.keys(d)])) {
    // `units` has its own row per unit; a summary of it is noise here.
    if (key === 'units') continue;
    if (JSON.stringify(b[key]) !== JSON.stringify(d[key])) changes.push(key);
  }
  return changes.sort();
}

/** One line per unit with a difference, for a `<ul>` an operator can scan. */
export function summariseDiff(d: CurriculumDiff): string[] {
  if (d.verdict === 'identical') return ['The database document matches the bundle exactly.'];

  const lines = d.units
    .filter((u) => u.verdict !== 'identical')
    .map((u) => {
      const parts: string[] = [];
      if (u.verdict === 'db-only') parts.push('not in the bundle');
      if (u.verdict === 'bundle-only') parts.push('not in the database');
      if (u.missingNodes.length) parts.push(`missing nodes: ${u.missingNodes.join(', ')}`);
      if (u.extraNodes.length) parts.push(`extra nodes: ${u.extraNodes.join(', ')}`);
      if (u.changedFields.length) parts.push(`changed: ${u.changedFields.join(', ')}`);
      return `${u.id} — ${parts.join('; ')}`;
    });

  // A top-level change with every unit clean is precisely the case an operator
  // would miss by scanning the unit rows, so it gets its own line.
  if (d.topLevelChanges.length > 0) {
    lines.push(`Document level — changed: ${d.topLevelChanges.join(', ')}`);
  }
  return lines;
}
