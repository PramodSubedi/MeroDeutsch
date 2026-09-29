/**
 * Self-check for the deploy filter.
 *
 * ── WHY THE ADVERSARIAL CASES ARE THE POINT ───────────────────────────────
 * The failure this filter can cause is a SKIPPED deploy that should have
 * happened: a control center left a version behind, or learners left on an old
 * build. So the tests below are mostly about the paths that must NOT skip —
 * a shared dependency, a deletion, an unknown top-level file, a backslash path
 * from a Windows-authored commit.
 *
 * A filter test that only asserted "admin change skips learner" would pass
 * while the thing that actually breaks stayed unfixed.
 *
 * Run: npx tsx scripts/ci/deployFilter.check.ts
 *
 * `deployFilter` is imported as a MODULE, not run as a script, so that the
 * verdict logic can be tested directly. It guards its own `main()` behind a
 * direct-execution check for exactly this reason — an unguarded `main()` would
 * `process.exit` here and the suite would report success with zero output.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { classify, shouldBuild, type Scope, type Target } from './deployFilter';

const failures: string[] = [];
let checks = 0;

function check(label: string, condition: boolean, detail = ''): void {
  checks += 1;
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    failures.push(label);
  }
}

/** Assert a file's scope. */
function scope(path: string, expected: Scope): void {
  check(`${path} → ${expected}`, classify(path) === expected, `got ${classify(path)}`);
}

/** Assert a target builds for a change set. */
function builds(target: Target, paths: string[], label: string): void {
  const v = shouldBuild(target, paths);
  check(`builds: ${label}`, v.build, v.reason);
}

/** Assert a target skips for a change set. */
function skips(target: Target, paths: string[], label: string): void {
  const v = shouldBuild(target, paths);
  check(`skips: ${label}`, !v.build, v.reason);
}

console.log('\n=== classification ===');
scope('src/admin/pages/UsersPage.tsx', 'admin');
scope('src/admin/AdminApp.tsx', 'admin');
scope('admin.html', 'admin');
scope('src/hooks/useQaBridge.ts', 'admin');
scope('src/hooks/useAdminModeBootstrap.ts', 'admin');
scope('src/hooks/useDebugAccess.ts', 'admin');

scope('src/pages/LessonPage.tsx', 'learner');
scope('src/components/Layout.tsx', 'learner');
scope('src/App.tsx', 'learner');
scope('src/main.tsx', 'learner');
scope('index.html', 'learner');
scope('src/hooks/useAuth.tsx', 'learner');
scope('src/assets/logo.svg', 'learner');

console.log('\n=== shared: must build BOTH targets ===');
// Measured from the admin bundle's real import graph, not guessed.
scope('src/config/theme.ts', 'shared');
scope('src/data/a1Path.ts', 'shared');
scope('src/data/curriculum/index.ts', 'shared');
scope('src/data/curriculum/units/m01.json', 'shared');
scope('src/lib/supabase.ts', 'shared');
scope('src/lib/qaBridge.ts', 'shared');
scope('src/lib/debugMode.ts', 'shared');
scope('src/lib/debugModeLink.ts', 'shared');
scope('src/lib/adminRole.ts', 'shared');
scope('index.css', 'shared');
scope('tailwind.config.js', 'shared');
scope('vite.config.ts', 'shared');
scope('package.json', 'shared');
scope('package-lock.json', 'shared');
scope('vercel.json', 'shared');

console.log('\n=== not build inputs: must NOT wake both projects ===');
// tsconfig.app.json includes only `src`, and no src/ file imports these dirs,
// so they cannot change either bundle.
scope('supabase/migrations/20260929000000_add_profiles_role.sql', 'learner');
scope('scripts/curriculum/validate.ts', 'learner');
scope('scripts/ci/deployFilter.ts', 'learner');
// These two were `src/data/curriculum/*`, so they classified as `shared` and
// woke BOTH Vercel projects on any edit — for gates that run in CI and change
// not one byte of either bundle. They are Node-only modules (they read the
// filesystem), so `src/` was the wrong home for them in the first place; see
// `scripts/ci/appNodeBoundary.check.ts`.
scope('scripts/curriculum/vocabCategoryIndex.ts', 'learner');
scope('scripts/curriculum/vocabCategories.check.ts', 'learner');
skips('admin', ['supabase/migrations/20260929010000_admin_tables.sql'], 'migration only');
skips('admin', ['scripts/seedCurriculum.ts'], 'maintenance script only');
// A shared file inside scripts/ still builds the learner, because that is the
// project whose build pipeline owns the script surface.
builds('learner', ['scripts/curriculum/validate.ts'], 'script change builds learner');
// Editing a content gate must not deploy the app — the gate cannot be a build
// input, and treating it as one ships a rebuild for nothing.
skips('admin', ['scripts/curriculum/vocabCategoryIndex.ts'], 'vocab gate change alone');

console.log('\n=== path normalisation ===');
check('leading ./ is stripped', classify('./src/admin/main.tsx') === 'admin');
check('backslashes are normalised', classify('src\\admin\\main.tsx') === 'admin');
check('empty path is shared (fail open)', classify('') === 'shared');
check('whitespace-only is shared (fail open)', classify('   ') === 'shared');

console.log('\n=== learner target ===');
skips('learner', ['src/admin/pages/AnalyticsPage.tsx'], 'admin-only change');
skips('learner', ['src/admin/AdminLayout.tsx', 'admin.html'], 'admin + admin.html');
skips('learner', ['src/hooks/useQaBridge.ts'], 'app-side bridge receiver only');
skips('learner', ['src/admin/pages/UsersPage.tsx', 'src/admin/data/analytics.ts'], 'admin page + admin data');
builds('learner', ['src/pages/LessonPage.tsx'], 'learner page');
builds('learner', ['src/lib/supabase.ts'], 'shared dep (admin imports it)');
builds('learner', ['src/data/curriculum/units/m01.json'], 'curriculum data');
builds('learner', ['vercel.json'], 'unified routing config');
builds('learner', ['package-lock.json'], 'lockfile');
builds('learner', ['vite.config.ts'], 'vite config');
builds('learner', ['index.css'], 'shared stylesheet');
builds('learner', ['src/admin/pages/UsersPage.tsx', 'src/lib/qaBridge.ts'], 'admin + shared dep');
builds('learner', [], 'no changed files');

console.log('\n=== admin target ===');
skips('admin', ['src/pages/LessonPage.tsx'], 'learner-only change');
skips('admin', ['src/components/Layout.tsx', 'src/App.tsx'], 'layout + app shell');
skips('admin', ['index.html', 'src/main.tsx'], 'learner entry + html');
skips('admin', ['src/hooks/useAuth.tsx'], 'unrelated hook');
builds('admin', ['src/admin/pages/CurriculumPage.tsx'], 'admin page');
builds('admin', ['admin.html'], 'admin entry html');
builds('admin', ['src/lib/qaBridge.ts'], 'shared dep the admin bundle imports');
builds('admin', ['src/config/theme.ts'], 'shared theme');
builds('admin', ['vercel.json'], 'unified routing config');
builds('admin', ['src/pages/LessonPage.tsx', 'src/admin/main.tsx'], 'learner + admin');

console.log('\n=== deletions count as changes ===');
// A removed curriculum file alters the admin bundle exactly as an edit does.
builds('admin', ['src/data/curriculum/units/m09.json'], 'deleted curriculum file');
builds('learner', ['src/data/curriculum/schema.ts'], 'deleted schema');

console.log('\n=== unknown paths fail open ===');
// A new top-level file is not classified, so it defaults to learner-only. If
// it ever turns out to be a build input, the learner deploy happens but the
// admin deploy would be skipped — asserted here so the behaviour is a decision
// on record rather than an accident.
check('unknown path defaults to learner', classify('some/new/thing.txt') === 'learner');
skips('admin', ['some/new/thing.txt'], 'unknown path leaves admin alone');

/**
 * ── EXIT-CODE CONTRACT ─────────────────────────────────────────────────────
 * The verdict logic is unit-tested above, but the EXIT CODE is what Vercel
 * actually reads, and it is inverted from the usual convention:
 *
 *     0 → SKIP the build        1 → CONTINUE (build)
 *
 * So these run the real script and read the real process exit status. If the
 * inversion is ever "corrected" the wrong way, this fails loudly instead of
 * silently skipping every future deploy.
 */
console.log('\n=== 10. EXIT CODE CONTRACT (real process runs) ===');

interface Run {
  code: number;
  log: string;
}

/** Run the filter as Vercel would, and capture the exit code. */
function runFilter(args: string[], env: Record<string, string> = {}): Run {
  const r = spawnSync(
    process.execPath,
    [resolve(import.meta.dirname ?? __dirname, 'deployFilter.ts'), ...args],
    { encoding: 'utf8', env: { ...process.env, ...env } },
  );
  return { code: r.status ?? -1, log: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

// SKIP must be 0 and BUILD must be 1. Asserted as literals, not imported, so
// an edit to the constants in the script shows up here as a failure.
const VERCEL_SKIP = 0;
const VERCEL_BUILD = 1;

const HEAD = '68fdd7153c92e7e74ab6e9ecfdeef2137c6d74ea';
const PREV = '97cabb4f710793a48bf0b1b0db3b2e9ec5876539';
const realRange = { VERCEL_GIT_COMMIT_SHA: HEAD, VERCEL_GIT_PREVIOUS_SHA: PREV };

// HEAD~1..HEAD touched package.json, src/config/, src/data/ and src/lib/ — all
// shared — so BOTH targets must BUILD, i.e. exit 1.
const realLearner = runFilter(['learner'], realRange);
check(
  'shared change → learner exit 1 (BUILD)',
  realLearner.code === VERCEL_BUILD,
  `exit ${realLearner.code}; ${realLearner.log.trim().slice(0, 120)}`,
);
const realAdmin = runFilter(['admin'], realRange);
check(
  'shared change → admin exit 1 (BUILD)',
  realAdmin.code === VERCEL_BUILD,
  `exit ${realAdmin.code}; ${realAdmin.log.trim().slice(0, 120)}`,
);

// A no-target invocation must BUILD, never SKIP. This is the fail-open
// guarantee: a mistyped command must cost a build, not silence a project.
const noTarget = runFilter([]);
check(
  'no target → exit 1 (BUILD, fail open)',
  noTarget.code === VERCEL_BUILD,
  `exit ${noTarget.code}; ${noTarget.log.trim().slice(0, 120)}`,
);

// No previous deployment → nothing to diff → BUILD.
const firstDeploy = runFilter(['learner'], { VERCEL_GIT_COMMIT_SHA: HEAD, VERCEL_GIT_PREVIOUS_SHA: '' });
check(
  'first deploy → exit 1 (BUILD, fail open)',
  firstDeploy.code === VERCEL_BUILD,
  `exit ${firstDeploy.code}; ${firstDeploy.log.trim().slice(0, 120)}`,
);

console.log('\n=== 11. vercel.json MUST MATCH VERCEL\'S SCHEMA ===');
// The reason this section exists: `vercel.json` once carried a `"//"` comment
// key holding the design rationale. It parsed fine as JSON and every local
// check passed, then Vercel rejected the DEPLOY with
//   should NOT have additional property `//`
// — i.e. the failure only surfaced at deploy time, on the one step that could
// not be iterated on quickly.
//
// The lesson: a config file is validated against a schema we do not control, so
// the properties we USE are worth asserting. This is not a full schema check —
// it is the subset that has actually bitten, plus the invariants that keep the
// two projects correctly separated.
const vercelPath = resolve(import.meta.dirname ?? __dirname, '..', '..', 'vercel.json');
const vercelRaw = readFileSync(vercelPath, 'utf8');
interface Route {
  src?: string;
  dest?: string;
  handle?: string;
  status?: number;
  has?: { type: string; value: string }[];
}

const vercel = JSON.parse(vercelRaw) as Record<string, unknown>;

/** The admin host every host-gated rule must name. */
const ADMIN_HOST = 'admin.merodeutsch.pramods.com.np';

/** Properties the Vercel vercel.json schema actually defines. */
const VERCEL_SCHEMA_PROPERTIES = new Set([
  '$schema', 'build', 'buildCommand', 'builds', 'cleanUrls', 'crons',
  'devCommand', 'framework', 'functions', 'github', 'headers', 'ignoreCommand',
  'installCommand', 'installs', 'outputDirectory', 'public', 'redirects',
  'regions', 'rewrites', 'routes', 'trailingSlash', 'version',
]);
const extra = Object.keys(vercel).filter((k) => !VERCEL_SCHEMA_PROPERTIES.has(k));
check(
  'no unknown top-level properties (a "//" comment key fails the deploy)',
  extra.length === 0,
  `unexpected: ${extra.join(', ')}`,
);

const rewrites = (vercel.routes ?? vercel.rewrites) as Route[];
check('a routing array is present', Array.isArray(rewrites));
check('routing is non-empty', rewrites.length > 0);
check('the config uses `routes`, not `rewrites`', Array.isArray(vercel.routes));

// The failure this whole section was rewritten for: with `rewrites`, the root
// path `/` was served from the FILESYSTEM (Vercel resolves `/` to the static
// index.html) before any rewrite was evaluated, so `admin.` returned the
// LEARNER app at `/` while every deep link correctly served the control
// centre. `routes` lets the root rule sit above `{ handle: "filesystem" }`.
//
// Asserted explicitly: if someone reverts to `rewrites`, this fails locally
// instead of in production.
const rootRule = rewrites.findIndex((r) => r.src === '/' && r.dest === '/admin.html');
const fsIndex = rewrites.findIndex((r) => r.handle === 'filesystem');
check('an explicit ROOT rule → /admin.html exists', rootRule >= 0, `index ${rootRule}`);
check('a filesystem handler exists', fsIndex >= 0, `index ${fsIndex}`);
check(
  'the ROOT rule is ordered BEFORE the filesystem handler',
  rootRule >= 0 && fsIndex >= 0 && rootRule < fsIndex,
  `root at ${rootRule}, filesystem at ${fsIndex}`,
);
check(
  'the root rule is host-gated (else the learner root would serve the admin shell)',
  !!rewrites[rootRule]?.has?.some((h) => h.type === 'host' && h.value === ADMIN_HOST),
  JSON.stringify(rewrites[rootRule]?.has),
);

// Declared up front: the ordering assertions below all compare against these
// three indices, and a `const` used before its declaration is a runtime
// ReferenceError rather than a compile error.
const adminSpa = rewrites.findIndex((r) => r.src === '/(.*)' && r.dest === '/admin.html');
const learnerCatchAll = rewrites.findIndex((r) => r.src === '/(.*)' && r.dest === '/index.html');
const swRule = rewrites.find((r) => r.src === '/sw.js');

check('a /sw.js rule exists', !!swRule, 'missing');
check('the /sw.js rule is host-gated', !!swRule?.has?.some((h) => h.type === 'host' && h.value === ADMIN_HOST));
// It must be a REAL 404. An earlier version rewrote to a non-existent path,
// which fell through to the SPA catch-all and returned 200 text/html — so the
// "deny" served a document instead of refusing, and the browser happily
// installed a learner service worker on the admin origin. `status` cannot fall
// through to a later rule, which is exactly the property needed here.
check('the /sw.js rule uses status, not dest', swRule?.status === 404 && swRule?.dest === undefined, JSON.stringify(swRule));
check(
  'the /sw.js rule is ordered BEFORE the SPA catch-all',
  !!swRule && rewrites.indexOf(swRule) < adminSpa,
  `sw at ${swRule ? rewrites.indexOf(swRule) : -1}, catch-all at ${adminSpa}`,
);

// The SPA catch-all must sit AFTER the filesystem handler, or every hashed
// asset under /assets/ would be rewritten to admin.html and the page would
// load no JavaScript at all.
check('an admin SPA catch-all exists', adminSpa >= 0, `index ${adminSpa}`);
check(
  'the SPA catch-all is ordered AFTER the filesystem handler',
  adminSpa > fsIndex,
  `catch-all at ${adminSpa}, filesystem at ${fsIndex}`,
);

check('a learner catch-all exists', learnerCatchAll >= 0);
check(
  'the admin catch-all is ordered BEFORE the learner catch-all',
  adminSpa >= 0 && learnerCatchAll >= 0 && adminSpa < learnerCatchAll,
  `admin at ${adminSpa}, learner at ${learnerCatchAll}`,
);
check('the learner catch-all is LAST (it is the fallback)', learnerCatchAll === rewrites.length - 1);

// Host-gated rules must name the ADMIN host. A rule that lost its `has` clause
// would silently apply to the learner project.
const hostGated = rewrites.filter((r) => r.has?.some((h) => h.type === 'host'));
check('at least one rule is host-gated', hostGated.length >= 1, `found ${hostGated.length}`);
check(
  'every host-gated rule targets the admin host',
  hostGated.every((r) => r.has?.some((h) => h.value === ADMIN_HOST)),
  JSON.stringify(hostGated.map((r) => r.has?.[0]?.value)),
);

// The learner SW must be revalidated, or a deploy can be masked by a cached
// sw.js — the usual cause of "PWA not updating".
const headers = vercel.headers as { source: string; has?: unknown[]; headers: { key: string; value: string }[] }[];
const swHeader = headers.find((h) => h.source === '/sw.js');
check('sw.js has a revalidate header', !!swHeader?.headers.some((x) => /must-revalidate/.test(x.value)));
check('sw.js header is NOT host-gated (both apps need the SW)', !swHeader?.has, JSON.stringify(swHeader?.has));

// The noindex headers must be host-gated for the reason above.
const noindexRule = headers.find((h) => h.headers.some((x) => /noindex/.test(x.value)));
check('a noindex rule exists', !!noindexRule);
check(
  'the noindex rule IS host-gated (unconditional would deindex the learner app)',
  !!noindexRule?.has?.some((x) => (x as { type?: string; value?: string })?.type === 'host'),
  JSON.stringify(noindexRule?.has),
);

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
