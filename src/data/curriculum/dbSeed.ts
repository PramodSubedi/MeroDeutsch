/**
 * src/data/curriculum/dbSeed.ts
 *
 * A hand-off slot for DB curriculum content, read at module-initialisation time.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * `index.ts` derives the spine in MODULE SCOPE: it builds `CURRICULUM_FILE` and
 * `RESOLVED_PATH` the instant it is evaluated, and ~50 modules read those
 * constants synchronously. ES module evaluation is immutable and one-way — once
 * `index.ts` has run, no later assignment can change what those importers hold.
 *
 * So DB content has to be present BEFORE the first import of `index.ts`, and the
 * only code that can run before it is the boot gate in `main.tsx`. That gate
 * awaits resolution, plants the result here, and only then dynamically imports
 * `App`. By the time `index.ts` is evaluated it reads a seed instead of a bare
 * JSON import.
 *
 * ── WHY A SEPARATE MODULE ───────────────────────────────────────────────────
 * It holds no logic and imports nothing at runtime. If it imported `index.ts` to
 * validate what it was given, the one module that must run FIRST would be the
 * one that triggers the very initialisation it exists to precede.
 */
import type { CurriculumFile } from './schema';

let SEED: unknown = null;

/** Plant content for the next module-graph evaluation. */
export function setDbSeed(raw: unknown): void {
  SEED = raw;
}

/** The planted content, or null when the bundle should be used. */
export function getDbSeed(): unknown {
  return SEED;
}

/**
 * Typed accessor used by `index.ts`.
 *
 * Deliberately not a validator: the boot gate has already run the build's own
 * `validateCurriculum` before planting, and re-validating here would import the
 * schema module into the earliest possible point of boot for no added safety.
 */
export function getDbSeedAsFile(): CurriculumFile | null {
  return SEED === null ? null : (SEED as CurriculumFile);
}

/** Test seam. */
export function __clearDbSeed(): void {
  SEED = null;
}
