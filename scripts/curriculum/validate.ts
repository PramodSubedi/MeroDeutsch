/**
 * scripts/curriculum/validate.ts — the content gate
 *
 * Validates the authored campaign (clusters.json + units/*.json) through the
 * app's OWN loader, so it checks exactly the content the app will consume —
 * including things a JSON schema cannot see, such as whether a unit's
 * `vocabCategories`, checkpoint `specs` and node routes can actually be served.
 *
 * Exits non-zero on any error, so it can gate CI and a pre-commit hook.
 *
 * Usage: npm run curriculum:validate
 */
import { CURRICULUM_FILE, CURRICULUM_ISSUES } from '../../src/data/curriculum';
import { formatCurriculumIssues, hasCurriculumErrors } from '../../src/data/curriculum/schema';

const issues = [...CURRICULUM_ISSUES];

for (const unit of [...CURRICULUM_FILE.units].sort((a, b) => a.order - b.order)) {
  const specs = unit.checkpoint?.specs.reduce((sum, spec) => sum + spec.count, 0) ?? 0;
  const nodes = unit.nodes.length + (unit.bonus?.length ?? 0);
  console.log(
    `  ${unit.id}  ${unit.code}  ${String(nodes).padStart(2)} nodes  ` +
      `${String(specs).padStart(2)} checkpoint items  ${unit.title.en}`
  );
}

console.log(`\n${formatCurriculumIssues(issues)}`);

if (hasCurriculumErrors(issues)) {
  console.error('\nCurriculum INVALID — fix the unit files before publishing.');
  process.exit(1);
}
console.log('\nCurriculum valid.');