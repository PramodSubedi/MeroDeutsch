/**
 * src/data/curriculum/source.ts
 *
 * THE SHADOW SWITCH: `curriculum_source = bundle | db`.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * Phase 3b makes the curriculum loadable from the database so it can be edited
 * in the control centre without a deploy. That is a large change to the boot
 * path of an offline-first PWA, and it is reversible — but only if the
 * previous behaviour stays reachable.
 *
 * The default is therefore `bundle`, and `bundle` must keep working
 * indefinitely. A flag that cannot be turned back is not a rollout, it is a
 * migration with extra steps.
 *
 * ── WHY EVERY DB VALUE IS VALIDATED ─────────────────────────────────────────
 * A malformed unit in the database would otherwise reach `getNodeByRoute` and
 * throw during a learner's lesson, rather than during an admin's publish. The
 * same `validateCurriculum` the build uses is applied to fetched content, so
 * content that could not have shipped cannot be served.
 *
 * ── WHY IT FALLS BACK ──────────────────────────────────────────────────────
 * `db` is an enhancement, never a dependency. A learner opening the app on the
 * subway must get the bundled curriculum whether or not the network answered.
 * Any failure — fetch, parse, validation, missing flag — resolves to the
 * bundle, and the reason is reported for telemetry rather than swallowed.
 */
import { CURRICULUM_FILE, RESOLVED_PATH, type ResolvedPath } from './index';
import { hasCurriculumErrors, validateCurriculum, type CurriculumFile } from './schema';

export type CurriculumSource = 'bundle' | 'db';

/** The only flag that selects the source. Absent or unrecognised = bundle. */
export const CURRICULUM_SOURCE_KEY = 'curriculum_source';

export interface SourceDecision {
  source: CurriculumSource;
  /** Why the bundle was chosen, when it was. Surfaced in System. */
  reason:
    | 'flag-is-bundle'
    | 'flag-unreadable'
    | 'no-db-content'
    | 'db-validate-failed'
    | 'db-derive-failed'
    | 'db-ok';
  /** Populated only when the flag is `db` and the attempt failed. */
  detail?: string;
}

/**
 * Decide the source from a raw flag value.
 *
 * Tolerant by design: anything that is not exactly 'db' means bundle. A typo in
 * a flag value must degrade to the known-good path, never to an unhandled
 * exception on boot.
 */
export function resolveSource(raw: unknown): SourceDecision {
  if (typeof raw !== 'string') {
    return { source: 'bundle', reason: 'flag-unreadable' };
  }
  const v = raw.trim().toLowerCase();
  if (v === 'bundle') return { source: 'bundle', reason: 'flag-is-bundle' };
  if (v !== 'db') return { source: 'bundle', reason: 'flag-unreadable' };
  return { source: 'db', reason: 'db-ok' };
}

/** True when a fetched document is usable as curriculum content. */
export function isUsableDbContent(raw: unknown): raw is CurriculumFile {
  if (raw === null || typeof raw !== 'object') return false;
  const file = raw as Partial<CurriculumFile>;
  if (!Array.isArray(file.clusters) || file.clusters.length === 0) return false;
  if (!Array.isArray(file.units) || file.units.length === 0) return false;
  // The SAME validator the build runs. Content that would fail CI is refused
  // here too, so a bad publish cannot reach a learner.
  if (hasCurriculumErrors(validateCurriculum(raw as CurriculumFile))) return false;
  return true;
}

/** The always-available baseline. Never fails, never throws. */
export function bundleCurriculum(): { file: CurriculumFile; path: ResolvedPath } {
  return { file: CURRICULUM_FILE, path: RESOLVED_PATH };
}

/**
 * The spine the app actually runs on.
 *
 * Resolution happens in `loadCurriculum` (below), but this getter exposes the
 * current best value synchronously so `a1Path.ts` and the many importers that
 * read module-scope constants keep working exactly as before. With the default
 * flag it is the bundle, and nothing changes.
 */
let ACTIVE: ResolvedPath = RESOLVED_PATH;
let ACTIVE_DECISION: SourceDecision = { source: 'bundle', reason: 'flag-is-bundle' };

export function activePath(): ResolvedPath {
  return ACTIVE;
}

export function activeDecision(): SourceDecision {
  return ACTIVE_DECISION;
}

/** Derive a validated spine from fetched content, or null if unusable. */
export function deriveFromDb(
  raw: unknown,
  resolve: (file: CurriculumFile) => ResolvedPath,
): { path: ResolvedPath } | { error: string } {
  if (!isUsableDbContent(raw)) {
    return { error: 'fetched curriculum did not pass validation' };
  }
  try {
    // resolvePath indexes nodes and routes; a structurally-valid-but-unexpected
    // document could still throw here, so it is guarded like everything else.
    return { path: resolve(raw as CurriculumFile) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Load the spine, preferring the database ONLY when the flag says so and the
 * content validates. Any failure resolves to the bundle and records why.
 */
export async function loadCurriculum(
  fetchDb: () => Promise<unknown>,
  resolve: (file: CurriculumFile) => ResolvedPath,
  readFlag: () => Promise<unknown>,
): Promise<{ path: ResolvedPath; decision: SourceDecision }> {
  let decision: SourceDecision;
  try {
    decision = resolveSource(await readFlag());
  } catch (err) {
    // A flag read that throws is just another reason to use the bundle.
    ACTIVE_DECISION = { source: 'bundle', reason: 'flag-unreadable', detail: String(err) };
    return { path: RESOLVED_PATH, decision: ACTIVE_DECISION };
  }

  if (decision.source === 'bundle') {
    ACTIVE = RESOLVED_PATH;
    ACTIVE_DECISION = decision;
    return { path: ACTIVE, decision };
  }

  let raw: unknown;
  try {
    raw = await fetchDb();
  } catch (err) {
    ACTIVE = RESOLVED_PATH;
    ACTIVE_DECISION = { source: 'bundle', reason: 'db-derive-failed', detail: String(err) };
    return { path: ACTIVE, decision: ACTIVE_DECISION };
  }

  if (raw === null || raw === undefined) {
    ACTIVE = RESOLVED_PATH;
    ACTIVE_DECISION = { source: 'bundle', reason: 'no-db-content' };
    return { path: ACTIVE, decision: ACTIVE_DECISION };
  }

  const derived = deriveFromDb(raw, resolve);
  if ('error' in derived) {
    ACTIVE = RESOLVED_PATH;
    ACTIVE_DECISION = { source: 'bundle', reason: 'db-validate-failed', detail: derived.error };
    return { path: ACTIVE, decision: ACTIVE_DECISION };
  }

  ACTIVE = derived.path;
  ACTIVE_DECISION = { source: 'db', reason: 'db-ok' };
  return { path: ACTIVE, decision: ACTIVE_DECISION };
}
