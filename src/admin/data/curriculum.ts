/**
 * src/admin/data/curriculum.ts
 *
 * Read model for the Curriculum section.
 *
 * ── WHY THIS READS THE BUNDLE AND NOT THE DATABASE ──────────────────────────
 * The curriculum is AUTHORED CONTENT. It lives in
 * `src/data/curriculum/units/*.json`, is validated by
 * `src/data/curriculum/schema.ts`, and is bundled into the app at build time.
 *
 * So this module imports the SAME resolved spine the learner app runs on, via the
 * `src/data/curriculum` barrel. That is the important property: the control
 * centre and the app cannot disagree about the bundle, because they are
 * literally the same data. A second read path for the bundle would be the exact
 * drift this page exists to prevent.
 *
 * ── THE `curriculum_units` TABLE IS NOT WHAT THIS READS ──────────────────────
 * This file's header used to say "There is no `curriculum_units` table — the
 * original plan's migration referencing one would have failed to apply". That was
 * true when written. It is false now: the table exists (migration
 * `20260930020000`) and is read by `curriculumStore.ts`, which owns the editable
 * copy.
 *
 * The statement survived its own falsification because nothing contradicted it
 * inside this file, and a reader had no reason to re-derive it. The two models
 * are genuinely different and both are correct:
 *
 *   · HERE     the bundle, compiled in, always available, never edited here
 *   · STORE    the published database copy, editable, and what `db` serves
 *
 * They can disagree — which is the thing worth reviewing — and
 * `curriculumDiff.ts` is what compares them. Conflating them, in either
 * direction, is the mistake this comment now prevents.
 *
 * `curriculum_versions` is the append-only SNAPSHOT history for rollback. It is
 * read-only from here; writes go through the service-role function.
 */
import { CURRICULUM_ISSUES, RESOLVED_PATH } from '../../data/curriculum';
import { hasCurriculumErrors } from '../../data/curriculum/schema';
import { supabase } from '../../lib/supabase';

export interface UnitSummary {
  id: string;
  index: number;
  code: string;
  title: string;
  theme: string;
  goal: string;
  kind: 'core' | 'support';
  nodeCount: number;
  checkpointCount: number;
  bonusCount: number;
  hasLesson: boolean;
  vocabCategories: string[];
}

export interface CurriculumData {
  units: UnitSummary[];
  totalNodes: number;
  totalCheckpoints: number;
  issues: { level: string; where: string; message: string }[];
  hasErrors: boolean;
  /** Snapshots recorded in `curriculum_versions`, newest first. */
  versions: { id: string; unitId: string; editorId: string; createdAt: string }[];
  errors: string[];
}

/**
 * Build the unit summaries from the RESOLVED spine.
 *
 * Labels are read from the `en` side of the bilingual pairs. The admin surface
 * is English-only (it has no language context of its own), and picking a
 * locale that could differ per admin would make the list unstable between
 * renders.
 */
export function summarizeUnits(): UnitSummary[] {
  const nodesByUnit = new Map<number, { learn: number; checkpoint: number }>();
  for (const node of RESOLVED_PATH.learnNodes) {
    const entry = nodesByUnit.get(node.unitIndex) ?? { learn: 0, checkpoint: 0 };
    if (node.kind === 'checkpoint') entry.checkpoint += 1;
    else entry.learn += 1;
    nodesByUnit.set(node.unitIndex, entry);
  }
  const bonusByUnit = new Map<number, number>();
  for (const node of RESOLVED_PATH.bonusNodes) {
    bonusByUnit.set(node.unitIndex, (bonusByUnit.get(node.unitIndex) ?? 0) + 1);
  }

  return RESOLVED_PATH.units.map((unit) => {
    const counts = nodesByUnit.get(unit.index) ?? { learn: 0, checkpoint: 0 };
    return {
      id: unit.id,
      index: unit.index,
      code: unit.code,
      title: unit.title.en,
      theme: unit.theme.en,
      goal: unit.goal.en,
      kind: unit.kind,
      nodeCount: counts.learn,
      checkpointCount: counts.checkpoint,
      bonusCount: bonusByUnit.get(unit.index) ?? 0,
      hasLesson: unit.hasLesson === true,
      vocabCategories: unit.vocabCategories ?? [],
    };
  });
}

export async function fetchCurriculum(): Promise<CurriculumData> {
  const errors: string[] = [];

  // The version history is supplementary: a failure here must not stop the
  // page from showing the actual curriculum, which is the primary content.
  const versions = await supabase
    .from('curriculum_versions')
    .select('id, unit_id, editor_id, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (versions.error) errors.push(`curriculum_versions: ${versions.error.message}`);

  return {
    units: summarizeUnits(),
    totalNodes: RESOLVED_PATH.learnNodes.length,
    totalCheckpoints: RESOLVED_PATH.learnNodes.filter((n) => n.kind === 'checkpoint').length,
    issues: CURRICULUM_ISSUES.map((i) => ({
      level: i.level,
      where: i.where,
      message: i.message,
    })),
    hasErrors: hasCurriculumErrors(CURRICULUM_ISSUES),
    versions: (versions.data ?? []).map((v) => ({
      id: String(v.id),
      unitId: String(v.unit_id),
      editorId: String(v.editor_id),
      createdAt: String(v.created_at),
    })),
    errors,
  };
}

/** Count issues by severity, for the summary chips. */
export function issueCounts(issues: { level: string }[]): { errors: number; warnings: number } {
  return {
    errors: issues.filter((i) => i.level === 'error').length,
    warnings: issues.filter((i) => i.level === 'warning').length,
  };
}
