import { hasCurriculumErrors, validateCurriculum, type CurriculumFile } from './schema';

export const CURRICULUM_SOURCE_KEY = 'curriculum_source';

/** Validate a published document without initializing the active curriculum. */
export function isUsableDbContent(raw: unknown): raw is CurriculumFile {
  if (raw === null || typeof raw !== 'object') return false;
  const file = raw as Partial<CurriculumFile>;
  if (!Array.isArray(file.clusters) || file.clusters.length === 0) return false;
  if (!Array.isArray(file.units) || file.units.length === 0) return false;
  return !hasCurriculumErrors(validateCurriculum(raw as CurriculumFile));
}
