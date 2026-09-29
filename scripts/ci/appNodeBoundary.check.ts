/**
 * scripts/ci/appNodeBoundary.check.ts
 *
 *   npx tsx scripts/ci/appNodeBoundary.check.ts
 *
 * ── WHAT THIS IS FOR ─────────────────────────────────────────────────────────
 * A Node-only module under `src/` is a COMPILE error, not a runtime one: the app
 * tsconfig sets `types` to the Vite client types only, so `import * as fs from
 * 'fs'` fails `tsc -b` with `TS2591: Cannot find name 'fs'`. That is a loud,
 * annoying failure — and it is also the GOOD case, because it happens before Vite
 * ever tries to bundle Node builtins for a browser.
 *
 * The tempting fix for that red build is to add `"node"` to the app's `types`.
 * That silences the error and destroys the safety net: `process` and `fs` now
 * typecheck inside genuine app code, and the failure moves from a compile error
 * to a browser runtime error, where nobody is looking. This check exists to make
 * that trade explicit — if a Node-only file shows up under `src/`, the answer is
 * to MOVE it to `scripts/`, never to widen the app's types.
 *
 * This is not hypothetical. `scripts/curriculum/vocabCategoryIndex.ts` lived at
 * `src/data/curriculum/` and broke the production Vercel build on commit
 * b808226. It is not a `*.check.ts` file, so the exclusion glob that keeps the
 * other Node-only files in `src/` out of the app build did not catch it.
 *
 * ── WHY THE EXEMPTION LIST IS EXACTLY THE TSCONFIG ONE ───────────────────────
 * A file is allowed to be Node-only if, and only if, the app build already
 * excludes it. Anything else is a build break waiting to happen. Keep this list
 * and the `exclude` array in `tsconfig.app.json` in lockstep — if you widen one,
 * this check must widen with it or it starts demanding the impossible.
 *
 * Run:  npx tsx scripts/ci/appNodeBoundary.check.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';

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

const SRC = path.join(process.cwd(), 'src');

/** Every source file that is NOT exempt from the app build. */
function appBuildFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'test') continue;
      appBuildFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      // The `*.check.ts` / `*.test.ts` names, mirrored from tsconfig.app.json.
      if (/\.(check|test)\.tsx?$/.test(entry.name)) continue;
      out.push(full);
    }
  }
  return out;
}

/** Drop comments so a doc block mentioning `fs` cannot trip the scan. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * Node builtins, from the running interpreter rather than a hand-kept list that
 * goes stale. `builtinModules` yields bare names; `node:`-prefixed ones are
 * normalised away so both spellings resolve to the same entry.
 */
const BUILTINS = new Set(builtinModules.map((m) => m.replace(/^node:/, '')));

/** True when a module specifier names a Node builtin. */
export function isNodeBuiltin(specifier: string): boolean {
  return BUILTINS.has(specifier.replace(/^node:/, ''));
}

/** Every builtin specifier imported by a source file. */
export function builtinImports(src: string): string[] {
  const code = stripComments(src);
  const found: string[] = [];
  const re =
    /\bfrom\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const m of code.matchAll(re)) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (spec && isNodeBuiltin(spec)) found.push(spec);
  }
  return [...new Set(found)];
}

// ── 1. The detector must actually detect ─────────────────────────────────────
//
// A scanner whose regex silently stopped matching would report a clean repo and
// protect nothing. So it is pointed at a synthetic offender first: if this fails,
// every PASS below is meaningless.
console.log('\n=== detector self-test ===');
check(
  'detects a bare builtin import',
  builtinImports(`import * as fs from 'fs';`).includes('fs'),
);
check(
  'detects a node: prefixed builtin import',
  builtinImports(`import path from 'node:path';`).includes('node:path'),
);
check(
  'detects a require() of a builtin',
  builtinImports(`const os = require('os');`).includes('os'),
);
check(
  'ignores a comment mentioning a builtin',
  builtinImports(`// import * as fs from 'fs';\n/* from 'path' */\nconst x = 1;`).length === 0,
);
check('ignores an ordinary package import', builtinImports(`import React from 'react';`).length === 0);
check('ignores a relative import', builtinImports(`import x from './vocabCategories.check';`).length === 0);

// ── 2. No Node-only module in the app build ──────────────────────────────────
console.log('\n=== src/ must not import Node builtins ===');
const files = appBuildFiles(SRC).sort();
check('the scan found src/ files (a zero count means the walk is broken)', files.length > 0);

for (const file of files) {
  const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
  const offenders = builtinImports(fs.readFileSync(file, 'utf8'));
  check(
    `${rel} is browser-safe`,
    offenders.length === 0,
    offenders.length ? `imports ${offenders.join(', ')} — move it to scripts/ or add "node" to tsconfig.app.json` : '',
  );
}

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${
  failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`
}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}