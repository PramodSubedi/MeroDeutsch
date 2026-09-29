/**
 * scripts/ci/learnerRoutes.check.ts
 *
 *   npm run check:learnerroutes
 *
 * ── WHAT THIS IS FOR ─────────────────────────────────────────────────────────
 * `src/config/learnerRoutes.ts` is a HAND-MAINTAINED list of the learner app's
 * top-level route segments, and `src/data/curriculum/schema.ts` validates every
 * authored `to` in `curriculum/units/*.json` against it.
 *
 * That only helps if the list matches the real router. A hand-maintained list
 * with no cross-check is a new way to be wrong: add a page to `App.tsx`, forget
 * the list, and any unit pointing at the new page is reported as broken by a
 * validator that is itself out of date.
 *
 * So this diffs the two MECHANICALLY. `App.tsx` is the authority — the failure
 * has to read "you added a route and forgot the registry", never "the registry
 * quietly drifted". That asymmetry is the whole point: the router is what runs,
 * so the list is what must conform.
 *
 * This cannot be a browser test (every route needs no auth but the file is JSX,
 * and the check must run with zero app state) — and it does not need to be,
 * because the property is purely static: the same trade `routes.check.ts`
 * already makes for the admin app.
 *
 * Dynamic segments are compared by NAME: `lesson/:unitIndex/notes` contributes
 * `lesson`, matching how the validator reads an authored `/lesson/3/notes`.
 * `path="*"` is the catch-all and is deliberately excluded — it is not a page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEARNER_ROUTE_SEGMENTS } from '../../src/config/learnerRoutes';

let checks = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail = ''): void {
  checks += 1;
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    failures.push(label);
  }
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const APP_TSX = path.join(ROOT, 'src', 'App.tsx');

console.log('\n=== 0. THE ROUTER IS READABLE ===');
check('src/App.tsx is readable', fs.existsSync(APP_TSX), APP_TSX);
if (!fs.existsSync(APP_TSX)) {
  console.log(`\n[summary] FAILED — cannot check routes without ${APP_TSX}`);
  process.exit(1);
}
const app = fs.readFileSync(APP_TSX, 'utf8');

/**
 * The literal segments `App.tsx` actually serves.
 *
 * The regex anchors on `<Route` and requires a quoted `path`, so it cannot pick
 * up a `path=` on some other element or a `to=` on a Link. `path="*"` is the
 * catch-all, not a page, so it is filtered.
 */
const declared = [...app.matchAll(/<Route\s[^>]*?\bpath="([^"]+)"/g)]
  .map((m) => (m[1] ?? '').split('/')[0] ?? '')
  .filter((segment) => segment.length > 0 && segment !== '*');

const declaredSet = new Set(declared);
const listedSet = new Set<string>(LEARNER_ROUTE_SEGMENTS);

console.log('\n=== 1. THE REGISTRY IS INTERNALLY SOUND ===');
check(
  'learnerRoutes.ts has no duplicate segments',
  LEARNER_ROUTE_SEGMENTS.length === listedSet.size,
  `${LEARNER_ROUTE_SEGMENTS.length} entries, ${listedSet.size} unique`,
);
check(
  'every listed segment is lowercase-kebab (the shape a route path uses)',
  [...listedSet].every((s) => /^[a-z0-9][a-z0-9-]*$/.test(s)),
  [...listedSet].filter((s) => !/^[a-z0-9][a-z0-9-]*$/.test(s)).join(', '),
);

console.log('\n=== 2. ROUTER -> REGISTRY (a new page must be registered) ===');
const missingFromRegistry = declared.filter((s) => !listedSet.has(s));
for (const segment of missingFromRegistry) {
  check(`route '/${segment}' is registered in learnerRoutes.ts`, false, 'add it there');
}
if (missingFromRegistry.length === 0) {
  check(`all ${declaredSet.size} routed segments are registered`, true);
}

console.log('\n=== 3. REGISTRY -> ROUTER (a stale entry is a false alarm) ===');
const missingFromRouter = [...listedSet].filter((s) => !declaredSet.has(s));
for (const segment of missingFromRouter) {
  check(`'/${segment}' is actually routed in App.tsx`, false, 'remove it from learnerRoutes.ts');
}
if (missingFromRouter.length === 0) {
  check(`all ${listedSet.size} registered segments are really routed`, true);
}

console.log('\n=== 4. SHAPE ===');
check('the catch-all "*" is not registered as a page', !listedSet.has('*'));
check(
  'the registry is not empty',
  listedSet.size > 0,
);

console.log(
  failures.length === 0
    ? `\n[summary] ALL ${checks} CHECKS PASSED\n`
    : `\n[summary] ${failures.length} of ${checks} CHECKS FAILED — learnerRoutes.ts and App.tsx disagree\n`,
);
process.exit(failures.length === 0 ? 0 : 1);