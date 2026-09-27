/**
 * scripts/ci/deployFilter.ts
 *
 * Decides whether a Vercel project needs a build for a given commit.
 *
 * ── THE PROBLEM ────────────────────────────────────────────────────────────
 * The control center and the learner app are two Vercel projects on ONE branch.
 * Vercel builds a project on every push to its branch, so without this filter
 * an admin-only edit ships a full learner rebuild (and a learner deploy that
 * invalidates the PWA service worker for every real user), and a learner-only
 * edit burns an admin build for nobody.
 *
 * Configure each project's "Ignored Build Step" (or `ignoreCommand` in
 * vercel.json) to run this with its target:
 *
 *   learner project → npx tsx scripts/ci/deployFilter.ts learner
 *   admin project   → npx tsx scripts/ci/deployFilter.ts admin
 *
 * ⚠️ Vercel's exit codes are INVERTED from the usual convention:
 *     exit 0 → SKIP the build      exit 1 → CONTINUE (build)
 * Getting this backwards skips EVERY build, so the project looks healthy while
 * never updating again. See the `SKIP` / `BUILD` constants near `main()`.
 *
 * ── WHY vercel.json IS THE MORE RELIABLE PLACEMENT ───────────────────────
 * The dashboard field moves between Vercel UI revisions and is hidden on some
 * project configurations, whereas `ignoreCommand` in vercel.json always applies.
 * The catch is that this repo's vercel.json is shared by BOTH projects, and
 * `ignoreCommand` cannot be host-conditional — so it has to stay per-project in
 * the dashboard. Do not add it to the committed file; that would apply one
 * target's filter to both projects.
 *
 * ── THE ONE RULE THAT MATTERS: FAIL OPEN ───────────────────────────────────
 * A wrong "build" costs a wasted deploy cycle. A wrong "SKIP" ships a stale
 * control center over live user data, or leaves learners on an old build. The
 * second is a real incident and the first is a nuisance, so EVERY ambiguity —
 * no git, no ref, an unknown file, a missing env var — resolves to BUILD.
 *
 * A filter is a deletion: it should only ever remove builds that are
 * provably unnecessary.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type Target = 'admin' | 'learner';

/** Where a changed file belongs. `shared` always builds both projects. */
export type Scope = 'admin' | 'learner' | 'shared';

/**
 * ADMIN_SCOPED — the control center and the app-side code it drives.
 *
 * `src/hooks/useQaBridge.ts` is listed here even though it ships in the
 * LEARNER bundle: it is the receiver for a control-center command, so it
 * changes only as part of admin work and is never touched by lesson content.
 */
const ADMIN_SCOPED = [
  'src/admin/',
  'src/hooks/useQaBridge.ts',
  'src/hooks/useAdminModeBootstrap.ts',
  'src/hooks/useDebugAccess.ts',
  'admin.html',
];

/**
 * SHARED — one file, two deploys.
 *
 * These are the admin app's real dependencies outside `src/admin/`, measured
 * from its import graph rather than guessed:
 *
 *   src/config/theme            src/lib/adminRole
 *   src/data/a1Path             src/lib/debugMode
 *   src/data/curriculum/**      src/lib/debugModeLink
 *   src/lib/qaBridge            src/lib/supabase
 *
 * The rest are build inputs both entries compile: the theme stylesheet, the
 * Tailwind config, the Vite config, the lockfile and the unified vercel.json
 * (whose host-gated rules decide what each origin serves).
 *
 * Listed as prefixes because these directories are shared wholesale. Treating
 * all of `src/data/**` as shared is deliberately conservative: only a few files
 * in it are actually read by the admin bundle, but under-listing here would
 * silently skip an admin deploy, which is the failure this whole file is
 * designed to make impossible.
 *
 * `scripts/` and `supabase/` are deliberately ABSENT. They are not build
 * inputs for either entry — `tsconfig.app.json` includes only `src`, and no
 * `src/` file imports from either directory (verified), so a migration or a
 * maintenance script cannot change a single byte of either bundle. Listing them
 * would have made every schema tweak wake both projects, which is the noise
 * this filter exists to remove.
 */
const SHARED = [
  'src/lib/',
  'src/config/',
  'src/data/',
  'src/context/',
  'src/types/',
  'public/',
  'index.css',
  'tailwind.config.js',
  'postcss.config.js',
  'vite.config.ts',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'package.json',
  'package-lock.json',
  'vercel.json',
  '.env.example',
];

/** Normalize a git path to forward slashes, trimmed of a leading `./`. */
export function normalize(p: string): string {
  return p.trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * Classify one changed path.
 *
 * Order matters: SHARED is tested before the narrower lists so a path like
 * `src/lib/supabase.ts` is never read as learner-only.
 */
export function classify(rawPath: string): Scope {
  const path = normalize(rawPath);
  if (!path) return 'shared';
  if (SHARED.some((p) => path === p || path.startsWith(p))) return 'shared';
  if (ADMIN_SCOPED.some((p) => path === p || path.startsWith(p))) return 'admin';
  return 'learner';
}

export interface Verdict {
  build: boolean;
  reason: string;
}

/**
 * The whole rule, in one pure function so it can be tested without git.
 *
 * Builds when: nothing changed, anything is shared, or the target's own scope
 * was touched. Skips only when EVERY changed file belongs to the other scope.
 */
export function shouldBuild(target: Target, changedPaths: readonly string[]): Verdict {
  if (changedPaths.length === 0) {
    return { build: true, reason: 'no changed files reported — build (fail open)' };
  }

  const scopes = changedPaths.map(classify);
  const touched = new Set<Scope>(scopes);

  if (touched.has('shared')) {
    const why = changedPaths.filter((_, i) => scopes[i] === 'shared');
    return { build: true, reason: `shared input changed: ${why.join(', ')}` };
  }

  const own: Scope = target === 'admin' ? 'admin' : 'learner';
  if (touched.has(own)) {
    return { build: true, reason: `${target}-scoped files changed` };
  }

  return {
    build: false,
    reason: `only ${[...touched].join(', ')}-scoped files changed — ${target} unchanged`,
  };
}

/** True for a usable, fully-qualified git SHA or ref. */
function isRef(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * The base to diff against: the previously-deployed commit.
 *
 * Vercel exposes the target commit as `VERCEL_GIT_COMMIT_SHA` and the one it is
 * replacing as `VERCEL_GIT_PREVIOUS_SHA`. If the previous SHA is missing the
 * filter cannot reason about the delta, so it returns null and the caller
 * builds — a first deploy has nothing to skip anyway.
 */
function baseRef(): string | null {
  const prev = process.env.VERCEL_GIT_PREVIOUS_SHA;
  const head = process.env.VERCEL_GIT_COMMIT_SHA;
  if (isRef(prev) && isRef(head) && prev !== head) return prev;
  return null;
}

/**
 * Files changed between the deployed commit and this one.
 *
 * `git diff --name-only` with no `--diff-filter` so DELETIONS are included —
 * a deleted curriculum file changes the admin bundle just as much as an edited
 * one, and a filter that ignores deletions would skip a required deploy.
 */
function changedFiles(base: string, head: string): string[] | null {
  try {
    const out = execFileSync('git', ['diff', '--name-only', `${base}..${head}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\n').map(normalize).filter(Boolean);
  } catch {
    return null;
  }
}

/** Absolute path to the repo root, derived from this file's location. */
function repoRoot(): string {
  return join(import.meta.dirname ?? __dirname, '..', '..');
}

// ── EXIT CODES: Vercel's convention, which is INVERTED from the usual ──────
//
// Vercel `ignoreCommand` / Ignored Build Step:
//     exit 0 → SKIP the build
//     exit 1 → CONTINUE the build
//
// This is the opposite of the "non-zero means failure" convention most scripts
// follow, so it is stated here, in the table below, and asserted by the
// self-check. Getting it backwards does the quietest possible damage: the
// filter would skip EVERY build and the project would appear to deploy fine
// while never updating again.
//
//   exit  Meaning
//   ----  ---------------------------------------------------------------
//     0   SKIP  — this project has nothing to do for this commit
//     1   BUILD — build, or an ambiguity that must fail open
//
// The "fail open" rule is unchanged by the inversion: a wrong BUILD costs a
// wasted cycle, a wrong SKIP leaves learners or the control centre on a stale
// build. Only the numbers are swapped.
const SKIP = 0;
const BUILD = 1;

/**
 * Read a target from argv, building if it is absent or unrecognized.
 *
 * Defaulting to BUILD on bad input is the same fail-open rule as everywhere
 * else: a mistyped `--ignored-build-step` must degrade into an extra build, not
 * into a project that silently stops deploying.
 */
function readTarget(argv: readonly string[]): Target | null {
  const arg = argv.find((a) => a === 'admin' || a === 'learner');
  return arg === 'admin' || arg === 'learner' ? arg : null;
}

function main(): void {
  const target = readTarget(process.argv.slice(2));
  if (!target) {
    console.log('[deploy-filter] no target given — building (fail open)');
    process.exit(BUILD);
  }

  const head = process.env.VERCEL_GIT_COMMIT_SHA;
  const base = baseRef();
  if (!base || !isRef(head)) {
    console.log('[deploy-filter] no previous deployment to diff against — building');
    process.exit(BUILD);
  }

  if (!existsSync(join(repoRoot(), '.git'))) {
    console.log('[deploy-filter] no .git directory — building');
    process.exit(BUILD);
  }

  const changed = changedFiles(base, head);
  if (!changed) {
    console.log('[deploy-filter] git diff failed — building');
    process.exit(BUILD);
  }

  const verdict = shouldBuild(target, changed);
  if (verdict.build) {
    console.log(`[deploy-filter] BUILD ${target} — ${verdict.reason}`);
    process.exit(BUILD);
  }
  console.log(`[deploy-filter] SKIP ${target} — ${verdict.reason}`);
  process.exit(SKIP);
}

/**
 * Direct-execution guard.
 *
 * Without this, importing the module from the self-check would run `main()`,
 * which calls `process.exit` — killing the check process before a single
 * assertion printed, and producing a suite that "passes" with no output.
 * `import.meta.main` is true only when this file is the entry point.
 */
const isEntryPoint =
  typeof import.meta.main === 'boolean'
    ? import.meta.main
    : process.argv[1]?.endsWith('deployFilter.ts') === true;

if (isEntryPoint) {
  main();
}
