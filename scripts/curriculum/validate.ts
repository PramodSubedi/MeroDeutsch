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
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CURRICULUM_FILE, CURRICULUM_ISSUES } from '../../src/data/curriculum';
import {
  formatCurriculumIssues,
  hasCurriculumErrors,
  type CurriculumIssue,
} from '../../src/data/curriculum/schema';
import { GRAMMAR_TABS } from '../../src/config/grammarTabs';

const issues: CurriculumIssue[] = [...CURRICULUM_ISSUES];

/* ── authored pedagogy shape ────────────────────────────────────────────────── */

/**
 * The keys `UnitPedagogy` actually declares. Anything else is dead weight: it is
 * read by no component, so the content silently never reaches a learner.
 *
 * This check exists because of a shipped crash. Units 6-16 authored
 * `honorifics` as `{}` / `{du, Sie}` instead of `{title, rows}`; `{}` is TRUTHY,
 * so `LessonPedagogy` rendered `<HonorificsTable title={undefined} rows={undefined}>`
 * and that component's first `title.de` threw — a hard white-screen on the notes
 * page of 11 of 16 units. The unit validator only ever checked nodes, clusters
 * and labels, so nothing caught it.
 */
const PEDAGOGY_KEYS = new Set([
  'honorifics',
  'grammarComparison',
  'genderLegend',
  'umlautCallout',
  'suffixNote',
  'grammarNote',
  'ruleTable',
]);

/** Tables whose rows must be arrays of objects. */
const TABLE_KEYS = ['honorifics', 'grammarComparison', 'ruleTable'] as const;

for (const unit of CURRICULUM_FILE.units) {
  const ped = unit.pedagogy;
  if (!ped) continue;
  const raw = ped as unknown as Record<string, unknown>;

  for (const key of Object.keys(raw)) {
    if (!PEDAGOGY_KEYS.has(key)) {
      issues.push({
        level: 'warn',
        where: `${unit.id}.pedagogy.${key}`,
        message:
          'not part of UnitPedagogy — no component reads this key, so the content never renders. ' +
          'Use grammarNote/ruleTable, or move the table into the lesson file\'s `grammar[]`.',
      });
    }
  }

  for (const key of TABLE_KEYS) {
    const block = raw[key];
    if (block === undefined) continue;
    if (typeof block !== 'object' || block === null) {
      issues.push({
        level: 'error',
        where: `${unit.id}.pedagogy.${key}`,
        message: 'must be an object with a `rows` array.',
      });
      continue;
    }
    const rows = (block as { rows?: unknown }).rows;
    if (rows === undefined) {
      // THE crash precondition: a truthy block with no rows.
      issues.push({
        level: 'error',
        where: `${unit.id}.pedagogy.${key}`,
        message:
          'has no `rows` array. The renderer is truthy on this object and will read ' +
          '`title.de` / `rows.map` on undefined and throw — omit the key entirely if unused.',
      });
      continue;
    }
    if (!Array.isArray(rows)) {
      issues.push({
        level: 'error',
        where: `${unit.id}.pedagogy.${key}.rows`,
        message: 'must be an array.',
      });
    }
  }
}

/* ── authored routes resolve ───────────────────────────────────────────────── */

/**
 * A `?tab=` / `?mode=` / `?focus=` value that is not in its real list does not
 * error — `GrammarPage` falls back to `sein` and `RapidBlitzPage` falls through to
 * Mixed. A chip then looks inert and lands on the wrong panel with nothing in the
 * console. Both are silent, so they have to be checked here.
 */
const RAPID_MODES = new Set([
  'mixed',
  'vocabulary-translation',
  'audio-comprehension',
  'article-precision',
  'number-conversion',
  'verb-conjugation',
  'pronunciation-reading',
]);
const SENTENCE_FOCUS = new Set(['akkusativ', 'separable']);
const TAB_LIST: readonly string[] = GRAMMAR_TABS;

function checkRoute(where: string, to: string | undefined): void {
  if (!to) return;
  const queryAt = to.indexOf('?');
  if (queryAt === -1) return;
  for (const pair of to.slice(queryAt + 1).split('&')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const key = pair.slice(0, eq);
    const value = decodeURIComponent(pair.slice(eq + 1));
    let known: readonly string[] | null = null;
    let label = '';
    if (key === 'tab') {
      known = TAB_LIST;
      label = 'grammar tab';
    } else if (key === 'mode') {
      known = [...RAPID_MODES];
      label = 'rapid-fire mode';
    } else if (key === 'focus') {
      known = [...SENTENCE_FOCUS];
      label = 'sentence-builder focus';
    }
    if (known && !known.includes(value)) {
      issues.push({
        level: 'error',
        where,
        message: `unknown ${label} "${value}" — it silently falls back instead of failing. Valid: ${known.join(', ')}.`,
      });
    }
  }
}

for (const unit of CURRICULUM_FILE.units) {
  for (const node of unit.nodes) checkRoute(`${unit.id}.nodes.${node.id}.to`, node.to);
  for (const bonus of unit.bonus ?? []) checkRoute(`${unit.id}.bonus.${bonus.id}.to`, bonus.to);
}

/* ── lesson documents ───────────────────────────────────────────────────────── */

/**
 * The lesson documents were completely unchecked, which is how the notes-page
 * crash shipped. Each is validated for the two things that actually break the
 * page: unparseable JSON, and a missing objectives list (`Objectives` reads
 * `objectives.en.length` directly).
 */
const LESSONS_DIR = path.resolve(process.cwd(), 'src/data/curriculum/lessons');
let lessonsChecked = 0;

for (const unit of CURRICULUM_FILE.units) {
  if (!unit.hasLesson) continue;
  const file = path.join(LESSONS_DIR, `${unit.id}.json`);
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    issues.push({
      level: 'error',
      where: `lessons/${unit.id}.json`,
      message: 'missing, but the unit sets `hasLesson: true`.',
    });
    continue;
  }
  lessonsChecked++;

  let lesson: Record<string, unknown>;
  try {
    lesson = JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    issues.push({
      level: 'error',
      where: `lessons/${unit.id}.json`,
      message: `does not parse: ${(err as Error).message}`,
    });
    continue;
  }

  const objectives = lesson.objectives as { en?: unknown } | undefined;
  if (!objectives || !Array.isArray(objectives.en) || objectives.en.length === 0) {
    issues.push({
      level: 'error',
      where: `lessons/${unit.id}.json`,
      message: '`objectives.en` must be a non-empty string array (the Objectives block reads .length directly).',
    });
  }

  checkRoute(`lessons/${unit.id}.json docRoute`, lesson.docRoute as string | undefined);
}

console.log(`\n  ${lessonsChecked} lesson document(s) checked\n`);

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