/**
 * scripts/ci/routes.check.ts
 *
 *   npm run check:routes
 *
 * ── WHAT THIS IS FOR ─────────────────────────────────────────────────────────
 * The admin control centre has a hand-written nav list and a hand-written route
 * table that must agree. Nothing in the type system connects them: a `NAV_ITEMS`
 * entry can name a path no `<Route>` serves, and `tsc` reports nothing because
 * both are individually valid `string`s.
 *
 * That failure has no other guard. A nav link to `/review-queue` that no route
 * serves lands on the catch-all `<Route path="*">`, which redirects to `/` — so
 * the operator clicks "Review queue", is bounced to the dashboard, and has no
 * error anywhere to explain why. The page may well exist; it is simply
 * unreachable.
 *
 * This cannot be a browser test, because every admin route needs credentials.
 * It IS a static property though, and static is exactly what a pure check is for
 * — the same trade `deployFilter.check.ts` already makes.
 *
 * Both directions are asserted, because both have shipped-shaped failures:
 *   nav → no route   (click a link, get silently redirected)
 *   route → no nav   (a page exists that nothing links to)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
const APP = path.join(ROOT, 'src', 'admin', 'AdminApp.tsx');
const LAYOUT = path.join(ROOT, 'src', 'admin', 'AdminLayout.tsx');

console.log('\n=== 0. THE FILES EXIST ===');
check('AdminApp.tsx is readable', fs.existsSync(APP), APP);
check('AdminLayout.tsx is readable', fs.existsSync(LAYOUT), LAYOUT);
if (!fs.existsSync(APP) || !fs.existsSync(LAYOUT)) {
  console.log(`\n[summary] FAILED — cannot check routes without ${APP}`);
  process.exit(1);
}

const app = fs.readFileSync(APP, 'utf8');
const layout = fs.readFileSync(LAYOUT, 'utf8');

/** `to: '/users'` in the nav table. */
const navPaths = [...layout.matchAll(/\bto:\s*'([^']+)'/g)].map((m) => m[1]);
/** `path="users"` on a `<Route>` — relative to the layout route at "/". */
const routePaths = [...app.matchAll(/<Route\s+path="([^"]*)"/g)].map((m) => m[1]);

// The index route is declared as `index`, not as a literal "/".
const hasIndex = /<Route\s+index\b/.test(app) || /<Route\s+path=""/.test(app);
// The catch-all is a deliberate redirect, not a page.
const catchAll = /<Route\s+path="\*"/.test(app);

console.log('\n=== 1. THE SOURCES PARSED ===');
// A regex that silently matches nothing would make every check below vacuously
// true — the same failure mode as an unwired suite, one level deeper. So the
// extraction is itself asserted.
check('nav paths were found', navPaths.length > 0, `found ${navPaths.length}`);
check('route paths were found', routePaths.length > 0, `found ${routePaths.length}`);
check('an index route exists', hasIndex);
check('a catch-all redirect exists', catchAll);

const routes = new Set(routePaths.filter((p) => p !== '*').map((p) => `/${p}`));
if (hasIndex) routes.add('/');

console.log('\n=== 2. EVERY NAV LINK HAS A ROUTE ===');
// The whole point. A nav entry with no route is the silent-redirect bug.
for (const nav of navPaths) {
  check(`nav "${nav}" has a route`, routes.has(nav), `no <Route> serves ${nav}`);
}

console.log('\n=== 3. EVERY ROUTE IS REACHABLE FROM THE NAV ===');
const nav = new Set(navPaths);
for (const r of routes) {
  check(`route "${r}" appears in the nav`, nav.has(r), 'page exists but nothing links to it');
}

console.log('\n=== 4. SHAPE SANITY ===');
check('no duplicate nav paths', new Set(navPaths).size === navPaths.length, navPaths.join(', '));
check('no duplicate route paths', new Set(routePaths).size === routePaths.length, routePaths.join(', '));
check('every nav path starts with /', navPaths.every((p) => p.startsWith('/')), navPaths.join(', '));
check('no nav path has a stray trailing slash', navPaths.every((p) => !p.endsWith('/') || p === '/'), navPaths.join(', '));
check('the catch-all is the only wildcard', routePaths.filter((p) => p.includes('*')).length <= 1);
check('routes are mounted under the admin layout', /<Route element=\{<AdminLayout \/>\}>/.test(app));

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
