/**
 * scripts/curriculum/backfillUnits.ts
 *
 * Import the BUNDLED curriculum into `curriculum_units` as drafts.
 *
 *   npx tsx scripts/curriculum/backfillUnits.ts            # dry run (default)
 *   npx tsx scripts/curriculum/backfillUnits.ts --apply    # write
 *
 * ── WHY A SCRIPT AND NOT PART OF THE MIGRATION ─────────────────────────────
 * A migration runs once, silently, and cannot be reviewed before it touches
 * data. This is a content import of 15 units that learners will eventually be
 * served, so it is deliberately a separate, dry-run-by-default step.
 *
 * ── WHY EVERY ROW LANDS AS A DRAFT ─────────────────────────────────────────
 * `is_published` stays FALSE for everything this script writes. Publishing is a
 * separate, deliberate act. That means the worst outcome of running it is an
 * empty-looking control centre, never learners being served content nobody
 * looked at.
 *
 * ── WHY IT REFUSES TO RUN ON INVALID CONTENT ───────────────────────────────
 * The same `validateCurriculum` the build uses runs first. If the bundle on disk
 * is broken, this script exits non-zero and writes nothing, rather than
 * importing a spine that would fail the runtime validator anyway.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
// Statically imported. This module is ESM ("type": "module"), where `require`
// is not defined — the previous lazy `require('dotenv')` threw
// "require is not defined" the moment credentials were actually needed, which is
// to say on every `--apply` and never on a dry run. A script whose write path
// is the only path that has ever crashed is a script that has never been run.
import dotenv from 'dotenv';
import { CURRICULUM_FILE, RESOLVED_PATH } from '../../src/data/curriculum';
import { hasCurriculumErrors, validateCurriculum } from '../../src/data/curriculum/schema';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const UNITS_DIR = path.join(ROOT, 'src', 'data', 'curriculum', 'units');

const apply = process.argv.includes('--apply');

/** Env files are loaded once; a dry run simply never calls `env()`. */
let envLoaded = false;

function loadEnv(): void {
  if (envLoaded) return;
  dotenv.config({ path: path.join(ROOT, '.env'), override: false });
  dotenv.config({ path: path.join(ROOT, '.env.local'), override: true });
  envLoaded = true;
}

function env(name: string): string {
  loadEnv();
  const v = process.env[name];
  if (!v) {
    console.error(`✗ ${name} is not set`);
    process.exit(2);
  }
  return v;
}

async function main(): Promise<void> {
  // ── 1. Refuse to import content the build would reject ───────────────────
  const issues = validateCurriculum(CURRICULUM_FILE);
  if (hasCurriculumErrors(issues)) {
    console.error('✗ the bundle on disk does not validate. Refusing to import it.\n');
    for (const i of issues.filter((x) => x.level === 'error').slice(0, 20)) {
      console.error(`  ${i.where}: ${i.message}`);
    }
    process.exit(1);
  }
  console.log(`✓ bundle validates — ${RESOLVED_PATH.units.length} units, no errors`);

  // ── 2. Read each unit file from disk, not from the barrel ───────────────
  // The barrel is generated; reading the files directly is what an author
  // edited, so the import reflects the source rather than a build artefact.
  const files = readdirSync(UNITS_DIR).filter((f) => /^m\d{2}\.json$/.test(f)).sort();
  if (files.length === 0) {
    console.error(`✗ no unit files in ${UNITS_DIR}`);
    process.exit(1);
  }

  const rows = files.map((f) => {
    const doc = JSON.parse(readFileSync(path.join(UNITS_DIR, f), 'utf8')) as {
      id: string;
      order: number;
    };
    return {
      id: doc.id,
      order: doc.order,
      doc,
      is_published: false,
    };
  });

  // Duplicate ids or orders would violate the constraints mid-import and leave a
  // half-written table, so they are caught here instead.
  const dupId = rows.map((r) => r.id).filter((id, i, a) => a.indexOf(id) !== i);
  const dupOrder = rows.map((r) => r.order).filter((o, i, a) => a.indexOf(o) !== i);
  if (dupId.length > 0 || dupOrder.length > 0) {
    console.error(`✗ duplicate ids ${dupId.join(', ')} / orders ${dupOrder.join(', ')}`);
    process.exit(1);
  }

  console.log(`\n${apply ? 'Applying' : 'Dry run — would write'} ${rows.length} DRAFT unit(s):\n`);
  for (const r of rows) {
    const title = (r.doc as { title?: { en?: string } }).title?.en ?? '(no title)';
    const nodes = (r.doc as { nodes?: unknown[] }).nodes?.length ?? 0;
    console.log(`  ${r.id}  order ${String(r.order).padStart(2)}  ${nodes} nodes  ${title}`);
  }

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to write these as unpublished drafts.');
    console.log('Nothing was written. curriculum_source is unchanged.');
    return;
  }

  // ── 3. Write, as drafts, with the service role ──────────────────────────
  const supabase = createClient(env('VITE_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.from('curriculum_units').upsert(rows, { onConflict: 'id' });
  if (error) {
    console.error(`\n✗ import failed: ${error.message}`);
    console.error('The table may now be partially written — inspect before retrying.');
    process.exit(1);
  }

  console.log(`\n✓ imported ${rows.length} unit(s) as UNPUBLISHED drafts.`);
  console.log('Still to do deliberately: review, then publish, then flip curriculum_source to db.');
}

// The rejection is already reported inside `main`; this just keeps a stray
// throw from printing an unhandled stack at the operator.
void main().catch((err: unknown) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
