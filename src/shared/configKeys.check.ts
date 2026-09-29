/**
 * src/shared/configKeys.check.ts
 *
 *   npm run check:configkeys
 *
 * The invariants of the writable-config allow-list itself.
 *
 * ── WHAT THIS SUITE IS FOR ───────────────────────────────────────────────────
 * `CONFIG_KEYS` is the single authority on what `config.set` may write, shared by
 * the Edge Function and the admin UI. That makes it load-bearing in a way a
 * hand-typed list never was: a mistake here is not a typo in one place, it is a
 * rule the whole product obeys.
 *
 * The failures that actually happened, and the checks below that would have
 * caught them:
 *
 *   1. `announcement_banner` was writable from the UI and absent here. The
 *      feature was 100% non-functional and 1 267 checks were green. That class
 *      is now closed by `scripts/ci/adminConfigWrites.check.ts` (which reads the
 *      UI); THIS file pins the rules those keys are validated against.
 *   2. `types` had no `object` member, so a structured payload had no legal
 *      shape and the key could not be written at all — the same symptom as (1),
 *      reached a different way.
 */
import {
  ANNOUNCEMENT_BANNER_KEY,
  ANNOUNCEMENT_SEVERITIES,
  CHATBOT_CONFIG_KEYS,
  CONFIG_KEYS,
  isBooleanConfigKey,
  readAnnouncementBanner,
  validateAnnouncementBanner,
  type ConfigKeySpec,
} from './configKeys';

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

const KEYS = Object.keys(CONFIG_KEYS);

console.log('\n=== 0. THE LIST IS POPULATED ===');
// A regex or filter that matched nothing would make every check below vacuous.
check('CONFIG_KEYS has entries', KEYS.length > 0, `found ${KEYS.length}`);
check('CHATBOT_CONFIG_KEYS has entries', CHATBOT_CONFIG_KEYS.length > 0, `found ${CHATBOT_CONFIG_KEYS.length}`);

console.log('\n=== 1. EVERY SPEC IS WELL FORMED ===');
for (const key of KEYS) {
  const spec = CONFIG_KEYS[key] as ConfigKeySpec;
  check(`${key}: has a non-empty types list`, spec.types.length > 0);
  check(`${key}: types are known`, spec.types.every((t) => t === 'boolean' || t === 'string' || t === 'object'));
  check(`${key}: has a description`, typeof spec.description === 'string' && spec.description.trim().length > 0);
  check(`${key}: does not accept both boolean and object`, !(spec.types.includes('boolean') && spec.types.includes('object')));
  // `values` is the case-folding trigger. A case-sensitive identifier key that
  // declares one gets lowercased on write, which is how `Qwen2.5:3b` became a
  // model name no runtime recognises.
  check(
    `${key}: case-folding values are lowercase`,
    spec.values === undefined || spec.values.every((v) => v === v.toLowerCase()),
    JSON.stringify(spec.values),
  );
  // An object key with a closed vocabulary is incoherent: there is nothing to
  // enumerate. It would also make the normaliser treat it as a string spec.
  check(`${key}: object keys declare no values`, !spec.types.includes('object') || spec.values === undefined);
  // An object key with no validator is an open write of arbitrary JSON into a row
  // the learner app renders. The write path refuses it; this pins the reason.
  check(`${key}: object keys carry a validator`, !spec.types.includes('object') || typeof spec.validate === 'function');
}

console.log('\n=== 2. THE CLOSED SET IS THE SET WE MEAN ===');
// Named explicitly. A key silently added to CONFIG_KEYS is a new global switch
// the learner app reads on boot, and that deserves to be a deliberate diff line.
const EXPECTED = [
  'curriculum_source',
  'maintenance_mode',
  'registration_open',
  ANNOUNCEMENT_BANNER_KEY,
  'chatbot_enabled',
  'chatbot_base_url',
  'chatbot_default_model',
  'chatbot_allowed_models',
  'chatbot_default_intensity',
  'chatbot_default_language_mix',
  'chatbot_default_auto_open',
  // The lesson renderer's rollout switch. Added by the lesson-render work
  // alongside `src/config/learnerRoutes.ts`; listed here so the closed set stays
  // a deliberate diff line rather than a count that drifts.
  //
  // It earns its place on the merits, not by necessity: it is the one flag with
  // an EXPIRY written into its own comment ("the rollback window is the
  // rollout; when it closes, so does the switch"). A flag left behind with one
  // meaningful value is a control that lies.
  'lesson_render',
];
for (const key of EXPECTED) check(`${key} is writable`, key in CONFIG_KEYS);
check(
  'no unexpected keys',
  KEYS.every((k) => EXPECTED.includes(k)),
  KEYS.filter((k) => !EXPECTED.includes(k)).join(', '),
);
check('the key count matches the expected set', KEYS.length === EXPECTED.length, `${KEYS.length} vs ${EXPECTED.length}`);

console.log('\n=== 3. THE COMPANION PREFIX DERIVATION ===');
check('every chatbot_ key is in CONFIG_KEYS', CHATBOT_CONFIG_KEYS.every((k) => k in CONFIG_KEYS));
check(
  'CHATBOT_CONFIG_KEYS is exactly the chatbot_ prefix',
  CHATBOT_CONFIG_KEYS.every((k) => k.startsWith('chatbot_')) &&
    KEYS.filter((k) => k.startsWith('chatbot_')).length === CHATBOT_CONFIG_KEYS.length,
);
// The announcement banner must NOT be swept up by the prefix filter, or the
// chatbot page would try to render it as a companion setting.
check('announcement_banner is not a chatbot key', !CHATBOT_CONFIG_KEYS.includes(ANNOUNCEMENT_BANNER_KEY));

console.log('\n=== 4. BOOLEAN DETECTION (drives the /system flags panel) ===');
check('maintenance_mode is boolean-editable', isBooleanConfigKey('maintenance_mode'));
check('registration_open is boolean-editable', isBooleanConfigKey('registration_open'));
check('chatbot_enabled is boolean-editable', isBooleanConfigKey('chatbot_enabled'));
// The three that were rendered with a boolean toggle anyway and could only 400.
check('curriculum_source is NOT boolean-editable', !isBooleanConfigKey('curriculum_source'));
check('chatbot_base_url is NOT boolean-editable', !isBooleanConfigKey('chatbot_base_url'));
check('announcement_banner is NOT boolean-editable', !isBooleanConfigKey(ANNOUNCEMENT_BANNER_KEY));
check('an unknown key is not boolean-editable', !isBooleanConfigKey('no_such_key'));

console.log('\n=== 5. ANNOUNCEMENT BANNER — VALIDATION ===');
const good = { text: 'Scheduled maintenance at 22:00', severity: 'info', dismissible: true };
check('a well-formed banner passes', validateAnnouncementBanner(good).length === 0, validateAnnouncementBanner(good).join('; '));
check('an optional https link passes', validateAnnouncementBanner({ ...good, link: 'https://example.com/x' }).length === 0);
check('an empty link is treated as absent', validateAnnouncementBanner({ ...good, link: '' }).length === 0);

const rejects: [string, unknown][] = [
  ['null', null],
  ['an array', []],
  ['a string', 'hello'],
  ['missing text', { severity: 'info', dismissible: true }],
  ['blank text', { text: '   ', severity: 'info', dismissible: true }],
  ['over-long text', { text: 'x'.repeat(501), severity: 'info', dismissible: true }],
  ['a bad severity', { text: 'a', severity: 'critical', dismissible: true }],
  ['a missing severity', { text: 'a', dismissible: true }],
  ['a non-boolean dismissible', { text: 'a', severity: 'info', dismissible: 'yes' }],
  // The stored-XSS vector. This banner renders pre-signin on the learner app.
  ['a javascript: link', { ...good, link: 'javascript:alert(1)' }],
  ['a relative link', { ...good, link: '/settings' }],
  ['a data: link', { ...good, link: 'data:text/html,<script>alert(1)</script>' }],
];
for (const [label, value] of rejects) {
  const problems = validateAnnouncementBanner(value);
  check(`rejects ${label}`, problems.length > 0, JSON.stringify(value));
}
check('accepts every declared severity', ANNOUNCEMENT_SEVERITIES.every((s) => validateAnnouncementBanner({ ...good, severity: s }).length === 0));
check('text of exactly 500 characters is accepted', validateAnnouncementBanner({ ...good, text: 'x'.repeat(500) }).length === 0);

console.log('\n=== 6. ANNOUNCEMENT BANNER — READ-SIDE COERCION ===');
const norm = readAnnouncementBanner({ text: '  hi  ', severity: 'warning', dismissible: false, extra: 'drop me' });
check('text is trimmed', norm.text === 'hi', norm.text);
check('severity survives', norm.severity === 'warning');
check('dismissible survives', norm.dismissible === false);
check('unknown keys are dropped', !('extra' in norm));
check('a link is trimmed', readAnnouncementBanner({ ...good, link: '  https://a.test/  ' }).link === 'https://a.test/');
check('a blank link is omitted', readAnnouncementBanner({ ...good, link: '   ' }).link === undefined);
check('a bad severity degrades to info', readAnnouncementBanner({ ...good, severity: 'nope' }).severity === 'info');
check('a missing dismissible defaults to true', readAnnouncementBanner({ text: 'a', severity: 'info' }).dismissible === true);
check('coercion tolerates null', readAnnouncementBanner(null).text === '');

// The invariant that matters. `readAnnouncementBanner` recovers `severity` and
// `dismissible` from a malformed row on purpose — that is the whole point of a
// tolerant reader. It must NOT be able to recover `text`, because text is the
// entire content of a banner shown to every visitor, and a reader that invented
// one would turn "the stored row is broken" into "here is a valid banner to
// save" — putting the wrong words in front of the whole product.
const recoveredText = rejects
  .filter(([label]) => label !== 'a bad severity' && label !== 'a missing severity' && label !== 'a non-boolean dismissible')
  .filter(([, value]) => validateAnnouncementBanner(readAnnouncementBanner(value)).length === 0);
check(
  'the reader never invents banner text',
  recoveredText.length === 0,
  recoveredText.map(([label]) => label).join(', '),
);
// And the recovery it DOES perform is stated, so a change to it is deliberate.
check(
  'a bad severity is recovered to info',
  readAnnouncementBanner({ text: 'a', severity: 'critical', dismissible: true }).severity === 'info',
);
check(
  'a non-boolean dismissible is recovered to true',
  readAnnouncementBanner({ text: 'a', severity: 'info', dismissible: 'yes' }).dismissible === true,
);
check('missing text stays missing', readAnnouncementBanner({ severity: 'info', dismissible: true }).text === '');

// A well-formed banner must round-trip unchanged, or the editor would show
// something different from what the write path validated.
const canonical = readAnnouncementBanner(good);
check('a valid banner round-trips', validateAnnouncementBanner(canonical).length === 0);
check('a valid banner round-trips unchanged', JSON.stringify(canonical) === JSON.stringify(good), JSON.stringify(canonical));

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
