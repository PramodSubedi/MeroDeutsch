/**
 * src/data/chatbot/config.check.ts
 *
 *   npm run check:chatconfig
 *
 * Regression checks for the companion's global config.
 *
 * Every assertion below is a case that was wrong at some point, or a rule that
 * fails SILENTLY. Silence is the danger specific to this module: an unparseable
 * flag does not throw, it quietly yields the shipped default, and the only
 * symptom is that an admin's change appears to do nothing. So the tolerance
 * surface is pinned exhaustively rather than sampled.
 *
 * The last section is the one that cannot be proved by the pure layer alone.
 * `CHATBOT_CONFIG_KEYS` exists in BOTH the Edge Function's allow-list and here;
 * a key added to one and not the other is either a flag nobody can write, or a
 * control bound to a key the server refuses. That is only catchable by reading
 * both files, which is what §8 does.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BUNDLED_CHATBOT_DEFAULTS,
  CHATBOT_CONFIG_KEYS,
  CHATBOT_KEYS,
  CHATBOT_KEY_PREFIX,
  isModelAllowed,
  parseBool,
  parseIntensity,
  parseLanguageMix,
  parseModelList,
  parseText,
  resolveChatbotConfig,
} from './config';
import {
  __resetChatbotResolution,
  __setReaderForTest,
  getChatbotDefaults,
  getChatbotResolutionReason,
  resolveChatbotDefaults,
  startChatbotConfigResolution,
} from './resolve';

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

/* ── 1. the key set is closed ─────────────────────────────────────────────── */
console.log('\n=== 1. THE KEY SET ===');
check('there are exactly seven keys', CHATBOT_CONFIG_KEYS.length === 7, String(CHATBOT_CONFIG_KEYS.length));
check('every key uses the shared prefix', CHATBOT_CONFIG_KEYS.every((k) => k.startsWith(CHATBOT_KEY_PREFIX)), CHATBOT_CONFIG_KEYS.join(', '));
check('no key is duplicated', new Set(CHATBOT_CONFIG_KEYS).size === CHATBOT_CONFIG_KEYS.length);
check('the derived list covers CHATBOT_KEYS exactly', [...CHATBOT_CONFIG_KEYS].sort().join() === Object.values(CHATBOT_KEYS).sort().join(), CHATBOT_CONFIG_KEYS.join(', '));

/* ── 2. booleans ──────────────────────────────────────────────────────────── */
console.log('\n=== 2. BOOLEAN PARSING ===');
check('true stays true', parseBool(true) === true);
check('false stays false', parseBool(false) === false);
// A hand-written row holds the STRING; a migration that quoted it would
// silently flip the kill switch off.
check('the string "true" is true', parseBool('true') === true);
check('the string "false" is false', parseBool('false') === false);
check('case and padding are tolerated', parseBool('  TRUE  ') === true);
// These are the coercions that would make a flag flip on a typo.
for (const bad of [1, 0, 'yes', 'no', 'on', 'off', '', '   ', null, undefined, {}, [], 'truthy']) {
  check(`${JSON.stringify(bad)} is not a boolean`, parseBool(bad) === null, JSON.stringify(bad));
}

/* ── 3. text and lists ────────────────────────────────────────────────────── */
console.log('\n=== 3. TEXT AND MODEL LISTS ===');
check('text is trimmed', parseText('  a  ') === 'a');
check('empty text is null', parseText('   ') === null);
check('a number is not text', parseText(42) === null);
check('a boolean is not text', parseText(true) === null);
// The case-preservation case. `Qwen2.5:3b` lowercased names a model the learner
// does not have, which is exactly how the `config.set` handler used to break it.
check('a model name keeps its case', parseText('Qwen2.5:3b') === 'Qwen2.5:3b');
check('a model list is split and trimmed', JSON.stringify(parseModelList(' a:1 , b:2 ')) === JSON.stringify(['a:1', 'b:2']));
check('a single-entry list works', JSON.stringify(parseModelList('only:1')) === JSON.stringify(['only:1']));
check('list order is preserved', JSON.stringify(parseModelList('z:1, a:1')) === JSON.stringify(['z:1', 'a:1']));
// ",,," is text with no models in it. Reading it as an EMPTY list would mean
// "unrestricted" — the opposite of the narrow list the admin appears to have typed.
check('a list of only commas is absent, not empty', parseModelList(',,,') === null);
check('a trailing comma is tolerated', JSON.stringify(parseModelList('a:1,')) === JSON.stringify(['a:1']));
check('an empty string is not a list', parseModelList('') === null);
check('a non-string is not a list', parseModelList({ a: 1 }) === null);
check('the reset seam restores the bundled state', getChatbotResolutionReason() === 'bundled');

/* ── 4. closed vocabularies ──────────────────────────────────────────────── */
console.log('\n=== 4. CLOSED VOCABULARIES ===');
check('serious parses', parseIntensity('serious') === 'serious');
check('playful parses', parseIntensity('PLAYFUL') === 'playful');
check('sarcastic is refused', parseIntensity('sarcastic') === null);
check('an empty intensity is refused', parseIntensity('') === null);
check('de_en_ne parses', parseLanguageMix('de_en_ne') === 'de_en_ne');
check('de_np is refused', parseLanguageMix('de_np') === null);

/* ── 5. resolution falls back, never throws ───────────────────────────────── */
console.log('\n=== 5. RESOLUTION ===');
const empty = resolveChatbotConfig({});
check('an empty record is the bundled default', JSON.stringify(empty) === JSON.stringify(BUNDLED_CHATBOT_DEFAULTS));
check('null is the bundled default', JSON.stringify(resolveChatbotConfig(null)) === JSON.stringify(BUNDLED_CHATBOT_DEFAULTS));
check('undefined is the bundled default', JSON.stringify(resolveChatbotConfig(undefined)) === JSON.stringify(BUNDLED_CHATBOT_DEFAULTS));
// A total garbage record must be indistinguishable from no record at all.
const garbage = resolveChatbotConfig({
  [CHATBOT_KEYS.enabled]: 'maybe',
  [CHATBOT_KEYS.baseUrl]: {},
  [CHATBOT_KEYS.defaultModel]: 42,
  [CHATBOT_KEYS.allowedModels]: ',,,',
  [CHATBOT_KEYS.intensity]: 'sarcastic',
  [CHATBOT_KEYS.languageMix]: 'klingon',
  [CHATBOT_KEYS.autoOpen]: 'perhaps',
});
check('a wholly unrecognised record is the bundled default', JSON.stringify(garbage) === JSON.stringify(BUNDLED_CHATBOT_DEFAULTS), JSON.stringify(garbage));

const override = resolveChatbotConfig({
  [CHATBOT_KEYS.enabled]: false,
  [CHATBOT_KEYS.baseUrl]: 'http://192.168.1.42:11434',
  [CHATBOT_KEYS.defaultModel]: 'Qwen2.5:7b',
  [CHATBOT_KEYS.allowedModels]: 'Qwen2.5:7b, llama3.2:3b',
  [CHATBOT_KEYS.intensity]: 'playful',
  [CHATBOT_KEYS.languageMix]: 'de_en',
  [CHATBOT_KEYS.autoOpen]: false,
});
check('a full record overrides every field', override.model === 'Qwen2.5:7b' && override.enabled === false && override.intensity === 'playful');
check('a model name survives resolution with its case', override.model === 'Qwen2.5:7b');
check('a LAN base URL survives resolution', override.baseUrl === 'http://192.168.1.42:11434');
// PARTIAL override: the one thing an admin changes must not reset the rest.
const partial = resolveChatbotConfig({ [CHATBOT_KEYS.enabled]: false });
check('a partial override touches only its own field', partial.enabled === false && partial.model === BUNDLED_CHATBOT_DEFAULTS.model && partial.baseUrl === BUNDLED_CHATBOT_DEFAULTS.baseUrl);
check('an override never invents a field the record omitted', Object.keys(partial).sort().join() === Object.keys(BUNDLED_CHATBOT_DEFAULTS).sort().join());

/* ── 6. the cross-key rule ────────────────────────────────────────────────── */
console.log('\n=== 6. MODEL PERMISSION ===');
check('an empty list permits anything', isModelAllowed('anything', []));
check('a listed model is permitted', isModelAllowed('a:1', ['a:1', 'b:2']));
check('an unlisted model is refused', !isModelAllowed('c:3', ['a:1', 'b:2']));
// Case-sensitivity again: the allow-list holds real model identifiers.
check('a case-differing model is NOT permitted', !isModelAllowed('qwen2.5:3b', ['Qwen2.5:3b']));
check('the shipped default is permitted by the shipped list', isModelAllowed(BUNDLED_CHATBOT_DEFAULTS.model, BUNDLED_CHATBOT_DEFAULTS.allowedModels));
check('surrounding space is tolerated', isModelAllowed('  a:1  ', ['a:1']));

/* ── 7. the resolver holds state correctly ────────────────────────────────── */
console.log('\n=== 7. THE RESOLVER ===');
__resetChatbotResolution();
check('the resolver starts on the bundled defaults', getChatbotDefaults().model === BUNDLED_CHATBOT_DEFAULTS.model);
check('the resolver starts as "bundled"', getChatbotResolutionReason() === 'bundled');

__setReaderForTest(async () => ({ [CHATBOT_KEYS.defaultModel]: 'from-db:1b' }));
await resolveChatbotDefaults();
check('a successful read updates the held config', getChatbotDefaults().model === 'from-db:1b');
check('a successful read is reported as "db"', getChatbotResolutionReason() === 'db');

__setReaderForTest(async () => {
  throw new Error('network down');
});
await resolveChatbotDefaults();
// The whole point of the module: a flag that cannot be read must not take the
// companion — or the lesson the learner is in the middle of — down with it.
check('a throwing reader falls back to the bundled defaults', JSON.stringify(getChatbotDefaults()) === JSON.stringify(BUNDLED_CHATBOT_DEFAULTS));
check('a throwing reader is reported as unreadable', getChatbotResolutionReason() === 'db-unreadable');

__setReaderForTest(async () => ({}));
await resolveChatbotDefaults();
check('an empty record is reported as "bundled", not "db"', getChatbotResolutionReason() === 'bundled');

__resetChatbotResolution();
let calls = 0;
__setReaderForTest(async () => {
  calls += 1;
  return { [CHATBOT_KEYS.defaultModel]: 'once-only:1b' };
});
await startChatbotConfigResolution();
await startChatbotConfigResolution();
await startChatbotConfigResolution();
// A component that mounts twice must not race two fetches, and must not
// overwrite fresher state with a second, slower one.
check('resolution runs exactly once however often it is called', calls === 1, String(calls));
check('the first result is kept', getChatbotDefaults().model === 'once-only:1b');
__resetChatbotResolution();

/* ── 8. the two sides cannot drift ───────────────────────────────────────────
 * `CHATBOT_CONFIG_KEYS` is declared in the Edge Function's allow-list AND here.
 * Nothing in the type system connects them, and a mismatch is silent in both
 * directions:
 *
 *   key in publish.ts only  → an admin control bound to a key the server
 *                              REFUSES to write. The toggle moves, the write
 *                              400s, and the page reports "saved" only if the
 *                              failure is not surfaced honestly.
 *   key here only            → a flag the server accepts that nothing can set.
 *
 * So the two files are read and compared. `check:routes` already makes this
 * trade for the nav table — it is a static property, and static is exactly what
 * a pure check is for.
 */
console.log('\n=== 8. THE SERVER ALLOW-LIST AGREES ===');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const PUBLISH = 'supabase/functions/admin-action/publish.ts';
const MIGRATION = 'supabase/migrations/20260930030000_seed_chatbot_config.sql';

// The extraction is itself asserted: a regex that silently matched nothing would
// make every comparison below vacuously true — the same failure mode as an
// unwired suite, one level deeper.
const serverKeys = [...read(PUBLISH).matchAll(/^\s{2}(chatbot_\w+):\s*\{/gm)].map((m) => m[1]);
check('the server keys were found', serverKeys.length > 0, `found ${serverKeys.length}`);
check('the server allow-list has the same seven keys', serverKeys.length === 7, String(serverKeys.length));
check(
  'the two key sets are identical',
  [...serverKeys].sort().join() === [...CHATBOT_CONFIG_KEYS].sort().join(),
  `server: ${serverKeys.join(',')} | app: ${CHATBOT_CONFIG_KEYS.join(',')}`,
);
for (const key of CHATBOT_CONFIG_KEYS) {
  check(`${key} is writable server-side`, serverKeys.includes(key));
}

console.log('\n=== 9. THE SEED MIGRATION AGREES ===');
const migration = read(MIGRATION);
const seeded = [...migration.matchAll(/\('(chatbot_\w+)',\s*'/g)].map((m) => m[1]);
check('the seeded keys were found', seeded.length > 0, `found ${seeded.length}`);
check('the migration seeds the same seven keys', seeded.length === 7, String(seeded.length));
check(
  'the seeded key set is identical to the app key set',
  [...seeded].sort().join() === [...CHATBOT_CONFIG_KEYS].sort().join(),
  `seed: ${seeded.join(',')}`,
);
// The seed must not re-apply over a decision an admin has since made.
check('the seed never overwrites an existing value', /ON CONFLICT \(key\) DO NOTHING/.test(migration));
// The booleans have to land as JSON booleans, not the strings "true" — the
// quoted form reads as enabled too (the reader tolerates it) but is a different
// value in the table, and a future strict reader would disagree.
check('chatbot_enabled seeds a real JSON boolean', /'chatbot_enabled',\s*'true'::jsonb/.test(migration));
check('chatbot_default_auto_open seeds a real JSON boolean', /'chatbot_default_auto_open',\s*'true'::jsonb/.test(migration));
check('the default model seeds as a JSON string', /'chatbot_default_model',\s*'"qwen2\.5:3b"'::jsonb/.test(migration));
// The defaults the code ships and the defaults the table holds must be the same
// values, or the admin page shows one thing and a fresh learner gets another.
//
// Note the DOUBLE quotes: a JSONB string is written `'"x"'::jsonb`, whereas a
// JSONB boolean is written `'true'::jsonb`. The two forms look interchangeable in
// a migration and are not — quoting a boolean would store the string "true",
// which the reader happens to tolerate but a strict future reader would not.
const asJsonbString = (v: string) => `"${v}"`;
check('the seeded base URL matches the bundled default', migration.includes(`'${asJsonbString(BUNDLED_CHATBOT_DEFAULTS.baseUrl)}'::jsonb`), BUNDLED_CHATBOT_DEFAULTS.baseUrl);
check('the seeded model matches the bundled default', migration.includes(`'${asJsonbString(BUNDLED_CHATBOT_DEFAULTS.model)}'::jsonb`), BUNDLED_CHATBOT_DEFAULTS.model);
check('the seeded intensity matches the bundled default', migration.includes(`'${asJsonbString(BUNDLED_CHATBOT_DEFAULTS.intensity)}'::jsonb`), BUNDLED_CHATBOT_DEFAULTS.intensity);
check('the seeded language mix matches the bundled default', migration.includes(`'${asJsonbString(BUNDLED_CHATBOT_DEFAULTS.languageMix)}'::jsonb`), BUNDLED_CHATBOT_DEFAULTS.languageMix);
// A boolean seeded as a quoted string would be the quiet version of this bug.
check('no chatbot boolean is seeded as a quoted string', !/'chatbot_(enabled|default_auto_open)',\s*'"true"'::jsonb/.test(migration));
for (const model of BUNDLED_CHATBOT_DEFAULTS.allowedModels) {
  check(`the seeded allow-list contains ${model}`, migration.includes(model), model);
}

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
