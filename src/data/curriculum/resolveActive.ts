/**
 * src/data/curriculum/resolveActive.ts
 *
 * THE ONE CALL THAT MAKES THE FLAG REAL.
 *
 * `source.ts` defines the rules; `flagReader.ts` reads the wire. Until something
 * calls `loadCurriculum` with both, `curriculum_source` is inert — the
 * mechanism exists and nothing invokes it. This module is that invocation.
 *
 * It is deliberately NOT called during module initialisation. `a1Path.ts` and
 * ~50 existing importers read module-scope constants synchronously, and a
 * network round-trip at import time would make the boot path async for every
 * one of them. So the bundle is always the synchronous baseline, and this
 * upgrades it in the background once the app is running.
 *
 * Call it once, near the root, after mount. It never throws and never blocks
 * rendering: the worst case is that nothing changes and the bundle is used.
 */
import { resolvePath, RESOLVED_PATH, type ResolvedPath } from './index';
import { loadCurriculum, type SourceDecision } from './source';
import { fetchDbCurriculum, readCurriculumSourceFlag } from './flagReader';
import type { CurriculumFile } from './schema';

let current: ResolvedPath = RESOLVED_PATH;
let decision: SourceDecision = { source: 'bundle', reason: 'flag-is-bundle' };
let started = false;

/**
 * The wire readers, replaceable for tests.
 *
 * Defaulting to the real Supabase readers keeps the app's behaviour the default
 * rather than something a test opts INTO — a seam that defaults to a stub is a
 * seam that can be left in by accident. Tests override both.
 */
let readFlag: () => Promise<unknown> = readCurriculumSourceFlag;
let fetchDoc: () => Promise<unknown> = fetchDbCurriculum;

export function __setReadersForTest(
  flag: () => Promise<unknown>,
  doc: () => Promise<unknown>,
): void {
  readFlag = flag;
  fetchDoc = doc;
}

export function getActivePath(): ResolvedPath {
  return current;
}

export function getSourceDecision(): SourceDecision {
  return decision;
}

export async function resolveActiveCurriculum(): Promise<SourceDecision> {
  const result = await loadCurriculum(fetchDoc, resolvePath, readFlag);
  current = result.path;
  decision = result.decision;
  return decision;
}

/**
 * Kick off resolution once. Safe to call repeatedly — later calls are no-ops, so
 * a component that mounts twice cannot race two fetches against each other.
 */
export function startCurriculumResolution(): void {
  if (started) return;
  started = true;
  void resolveActiveCurriculum().catch(() => {
    // Belt and braces: `loadCurriculum` already swallows its own failures, so
    // reaching here means the wiring itself broke. Degrade to the bundle rather
    // than let an unhandled rejection surface as a blank app.
    current = RESOLVED_PATH;
    decision = { source: 'bundle', reason: 'flag-unreadable' };
  });
}

/** Test seam: forget that resolution already started, and restore real readers. */
export function __resetCurriculumResolution(): void {
  started = false;
  current = RESOLVED_PATH;
  decision = { source: 'bundle', reason: 'flag-is-bundle' };
  readFlag = readCurriculumSourceFlag;
  fetchDoc = fetchDbCurriculum;
}

export type { CurriculumFile };
