/**
 * scripts/ci/adminConfigWrites.check.ts
 *
 *   npm run check:adminconfig
 *
 * ── WHAT THIS IS FOR ─────────────────────────────────────────────────────────
 * The admin control centre writes `app_config` through `config.set`. The Edge
 * Function decides what that means, and the only authority is `CONFIG_KEYS` in
 * `src/shared/configKeys.ts`.
 *
 * Nothing in the type system connects a page that WRITES a key to the list that
 * ALLOWS it. `config: { key: 'announcement_banner', value: payload }` is a valid
 * object literal for a `key: string` field, and `ConfigWritePayload.key` is
 * deliberately `string` rather than a union — so a key the server has never
 * heard of type-checks perfectly and fails at runtime with `400 invalid-config`.
 *
 * That is not hypothetical. It is exactly what shipped: the Announcement Banner
 * editor called `config.set` with a key absent from the allow-list, so every save
 * returned 400, the feature was 100% non-functional from its first release, and
 * 1 267 checks were green throughout. The failure is invisible to a unit suite
 * precisely because nothing in the unit suite looks at the pages.
 *
 * This is a static property, and static is what a pure check is for — the same
 * trade `scripts/ci/routes.check.ts` already makes for the nav/route table. It
 * also cannot be a browser test: every admin route needs credentials.
 *
 * ── WHAT IT COVERS, AND WHAT IT CANNOT ───────────────────────────────────────
 * It resolves two shapes of call site:
 *
 *   1. a string LITERAL —  `config: { key: 'curriculum_source', … }`
 *   2. a named constant   —  `config: { key: CHATBOT_KEYS.baseUrl, … }`,
 *                           resolved through the real `CHATBOT_KEYS` map so the
 *                           check reads the values rather than the field names.
 *
 * A DYNAMIC key (`config: { key: flag.key, … }`, which the generic flags panel
 * does) cannot be resolved statically and is deliberately reported as such
 * rather than silently skipped — a call site that cannot be checked is a gap the
 * next reader should see. That gap is why `FlagsPanel` now filters to boolean
 * keys via `isBooleanConfigKey`, and why the check below asserts it does.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANNOUNCEMENT_BANNER_KEY, CONFIG_KEYS, isBooleanConfigKey } from '../../src/shared/configKeys.ts';
import { CHATBOT_KEYS } from '../../src/data/chatbot/config.ts';

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
const ADMIN_DIR = path.join(ROOT, 'src', 'admin');

/** Every .ts/.tsx under src/admin, excluding the check files themselves. */
function adminSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...adminSources(full));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.check.ts')) {
      out.push(full);
    }
  }
  return out;
}

const files = adminSources(ADMIN_DIR);
const sources = new Map(files.map((f) => [f, fs.readFileSync(f, 'utf8')]));
const rel = (f: string) => path.relative(ROOT, f).replace(/\\/g, '/');

console.log('\n=== 0. THE SOURCES PARSED ===');
// A directory walk that returned nothing would make every check below vacuous —
// the same failure mode as an unwired suite, one level deeper.
check('admin sources were found', files.length > 0, `found ${files.length}`);
check('the shared allow-list was found', Object.keys(CONFIG_KEYS).length > 0);
check('the companion key map was found', Object.keys(CHATBOT_KEYS).length > 0, Object.keys(CHATBOT_KEYS).join(', '));

console.log('\n=== 1. EVERY COMPANION KEY IS WRITABLE ===');
// The chatbot page writes through `CHATBOT_KEYS.*`, so its keys are resolved
// from the real map rather than typed out here.
for (const [field, key] of Object.entries(CHATBOT_KEYS)) {
  check(`chatbot key "${field}" → "${key}" is in CONFIG_KEYS`, key in CONFIG_KEYS);
}

console.log('\n=== 2. EVERY CONFIG KEY THE UI WRITES IS ALLOWED ===');
interface WriteSite {
  file: string;
  line: number;
  key: string;
  via: string;
}
const resolvedWrites: WriteSite[] = [];
const unresolvedWrites: { file: string; line: number; expr: string }[] = [];

/**
 * Shared constants an admin page may name instead of a literal.
 *
 * The whole point of extracting the allow-list is that both sides read the SAME
 * value, so a page that writes `ANNOUNCEMENT_BANNER_KEY` is already guaranteed
 * consistent — and this check says so explicitly rather than passing it over.
 */
const SHARED_CONSTANTS: Record<string, string> = {
  ANNOUNCEMENT_BANNER_KEY,
};

for (const [file, source] of sources) {
  const lines = source.split('\n');
  lines.forEach((text, i) => {
    if (!/\bconfig\s*:\s*\{/.test(text)) return;

    // `key: 'literal'` — the common shape.
    const literal = /\bkey\s*:\s*'([^']+)'/.exec(text);
    if (literal) {
      resolvedWrites.push({ file: rel(file), line: i + 1, key: literal[1], via: 'literal' });
      return;
    }

    // `key: CONSTANT` or `key: obj.member` — resolvable, or deferred to a rule.
    // The member access must be part of the capture: `flag.key` is not `flag`.
    const named = /\bkey\s*:\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/.exec(text);
    if (named && named[1] in SHARED_CONSTANTS) {
      resolvedWrites.push({
        file: rel(file),
        line: i + 1,
        key: SHARED_CONSTANTS[named[1]],
        via: named[1],
      });
      return;
    }

    // `key,` — shorthand property, so the key is a local or a parameter.
    const shorthand = /\bconfig\s*:\s*\{\s*key\s*,/.exec(text);
    unresolvedWrites.push({
      file: rel(file),
      line: i + 1,
      expr: named ? named[1] : shorthand ? 'key (shorthand/parameter)' : '(unparsed)',
    });
  });
}

check('at least one config write was found', resolvedWrites.length > 0, `found ${resolvedWrites.length}`);

for (const w of resolvedWrites) {
  check(
    `${w.file}:${w.line} writes an allowed key "${w.key}" (${w.via})`,
    w.key in CONFIG_KEYS,
    `"${w.key}" is not in CONFIG_KEYS — validateConfigWrite will return 400 invalid-config`,
  );
}

console.log('\n=== 3. UNRESOLVED CONFIG WRITES ARE GOVERNED, NOT SKIPPED ===');
// Two dynamic shapes exist, and both are resolvable by a rule other than
// "ignore it":
//
//   `config: { key: flag.key }`     the generic flags panel. Not resolvable
//                                    statically — governed by section 4, which
//                                    asserts the panel only offers a control for
//                                    keys it can actually write.
//   `config: { key, value }`        a `save(key, value, reason)` wrapper. The
//                                    key is a parameter, so the CALL SITES are
//                                    what matters, and they are all constants.
const saves = [...sources.entries()].find(([f]) => f.endsWith('ChatbotSettingsPage.tsx'));
check('ChatbotSettingsPage.tsx was located', saves !== undefined);

if (saves) {
  const [file, source] = saves;
  console.log(`  INFO  inspecting ${rel(file)}`);
  const saveCalls = [...source.matchAll(/\bsave\(\s*(CHATBOT_KEYS\.\w+)\s*,/g)].map((m) => m[1]);
  check('every save() call passes a resolved CHATBOT_KEYS constant', saveCalls.length > 0, `found ${saveCalls.length}`);
  for (const call of saveCalls) {
    const field = call.split('.')[1];
    const key = (CHATBOT_KEYS as Record<string, string>)[field];
    check(
      `save(${call}) → "${key}" is in CONFIG_KEYS`,
      typeof key === 'string' && key in CONFIG_KEYS,
      `"${String(key)}" is not in CONFIG_KEYS`,
    );
  }
}

check('at least one unresolved config write exists to govern', unresolvedWrites.length > 0, `found ${unresolvedWrites.length}`);
for (const d of unresolvedWrites) {
  const isFlagsPanel = /flag\.key/.test(d.expr);
  const isSaveParameter = d.expr.startsWith('key') && d.file.endsWith('ChatbotSettingsPage.tsx');
  check(
    `${d.file}:${d.line} unresolved key "${d.expr}" is governed`,
    isFlagsPanel || isSaveParameter,
    'an unrecognised unresolved config write — the boolean-only and save-call guarantees may not cover it',
  );
}

console.log('\n=== 4. THE FLAGS PANEL OFFERS A TOGGLE ONLY FOR BOOLEAN KEYS ===');
// The panel rendered `FlagToggle` for EVERY row while writing a boolean, so
// `curriculum_source` (string) and `announcement_banner` (object) could only
// ever 400 — and one click on the former would have attempted to write `true`
// over the flag that chooses which curriculum every learner is served.
const systemPage = [...sources.entries()].find(([f]) => f.endsWith('SystemPage.tsx'));
check('SystemPage.tsx was located', systemPage !== undefined);

if (systemPage) {
  const source = systemPage[1];
  check('FlagsPanel filters on the shared allow-list', /isBooleanConfigKey/.test(source));
  check('FlagsPanel no longer maps a toggle over every row', !/\{flags\.map\(\(flag\) => \(\s*<li/.test(source) || /isBooleanConfigKey/.test(source));
  // Every string/object key must be excluded from the boolean-editable set.
  for (const [key, spec] of Object.entries(CONFIG_KEYS)) {
    if (spec.types.includes('boolean')) continue;
    check(`"${key}" is not offered as a toggle`, !isBooleanConfigKey(key));
  }
}

console.log('\n=== 5. THE ALLOW-LIST HAS NO UNWRITABLE-BY-THE-UI ENTRAPMENT ===');
// A key that IS writable server-side but that no page can reach is a feature
// that was designed and then never surfaced. Recorded as information, not a
// failure — the list legitimately includes keys a page may not need.
const uiMentioned = new Set<string>([
  ...resolvedWrites.map((w) => w.key),
  ...Object.values(CHATBOT_KEYS),
]);
for (const key of Object.keys(CONFIG_KEYS)) {
  console.log(`  INFO  ${uiMentioned.has(key) ? 'referenced by the UI' : 'no UI reference'} — ${key}`);
}

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
