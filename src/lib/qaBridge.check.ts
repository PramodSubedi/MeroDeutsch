/**
 * Self-check for the QA bridge protocol.
 *
 * WHY THIS NEEDS A TEST AT ALL
 * ----------------------------
 * `parseQaMessage` is the only thing standing between a hostile web page and the
 * app's identity override, and the input is `event.data` — attacker-controlled by
 * definition. A test that only checked the happy path would prove nothing about
 * the thing that actually matters, which is REJECTION: garbage types, forged
 * modes, prototype-pollution shapes, and messages carrying extra fields.
 *
 * `isTrustedAdminOrigin` is exercised too, for the same reason: an allow-list
 * that accidentally matches everything is indistinguishable from no gate.
 *
 * Run: npx tsx src/lib/qaBridge.check.ts
 */
import {
  deriveAdminOrigins,
  deriveAppOrigins,
  isQaTab,
  isTrustedAdminOrigin,
  isTrustedAppOrigin,
  parseQaMessage,
  trustedAdminOrigins,
  trustedAppOrigins,
  type QaMessage,
} from './qaBridge';

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

console.log('\n=== 1. VALID COMMANDS PARSE ===');
for (const mode of ['real', 'guest', 'free', 'premium'] as const) {
  const parsed = parseQaMessage({ type: 'qa:set-mode', mode });
  check(
    `qa:set-mode ${mode} accepted`,
    parsed?.type === 'qa:set-mode' && parsed.mode === mode,
    JSON.stringify(parsed)
  );
}
check('qa:ping accepted', parseQaMessage({ type: 'qa:ping' })?.type === 'qa:ping');

console.log('\n=== 2. FORGED MODE VALUES ARE REJECTED ===');
// A mode that is not one of the four must never reach setDebugMode.
for (const bogus of ['PREMIUM', 'Premium', 'premium ', ' admin', '', null, 42, {}, [], true]) {
  check(
    `forged mode ${JSON.stringify(bogus)} rejected`,
    parseQaMessage({ type: 'qa:set-mode', mode: bogus }) === null,
    JSON.stringify(parseQaMessage({ type: 'qa:set-mode', mode: bogus }))
  );
}

console.log('\n=== 3. NON-QUIZ TYPES ARE REJECTED ===');
for (const type of ['qa:eval', 'qa:logout', 'postMessage', 'set-mode', '', null, undefined, 0]) {
  check(`type ${JSON.stringify(type)} rejected`, parseQaMessage({ type, mode: 'premium' }) === null);
}

console.log('\n=== 4. NON-OBJECT PAYLOADS ARE REJECTED ===');
// `postMessage` can deliver anything: strings, numbers, null.
for (const payload of [null, undefined, 0, 1, NaN, '', 'qa:set-mode', true, false]) {
  let threw = false;
  let result: QaMessage | null = null;
  try {
    result = parseQaMessage(payload);
  } catch {
    threw = true;
  }
  check(`payload ${String(payload)} rejected without throwing`, !threw && result === null);
}

console.log('\n=== 5. EXOTIC / HOSTILE SHAPES ===');
// Arrays are objects: without an explicit guard an array could be treated as a
// message bag. It has no `type`, so it must fall through to null.
check('array payload rejected', parseQaMessage(['qa:set-mode', 'premium']) === null);
check(
  'nested object mode rejected',
  parseQaMessage({ type: 'qa:set-mode', mode: { toString: () => 'premium' } }) === null
);
// A throwing getter is a real technique against naive parsers.
let hostileThrew = false;
try {
  const evil: Record<string, unknown> = { type: 'qa:set-mode' };
  Object.defineProperty(evil, 'mode', {
    get() {
      throw new Error('boom');
    },
  });
  parseQaMessage(evil);
} catch {
  hostileThrew = true;
}
check('throwing getter does not crash the parser', !hostileThrew);

console.log('\n=== 6. REPLIES PARSE, WITH DEFAULTS FOR MISSING FIELDS ===');
const ready = parseQaMessage({ type: 'qa:ready', mode: 'guest', path: '/learn', at: 5 });
check('qa:ready parses', ready?.type === 'qa:ready');
if (ready?.type === 'qa:ready') {
  check('ready carries the path', ready.path === '/learn');
  check('ready carries the mode', ready.mode === 'guest');
}
check(
  'qa:ready without a path is rejected',
  parseQaMessage({ type: 'qa:ready' }) === null
);
// An unknown mode in a reply degrades to 'real' rather than failing the whole
// message, so a slightly-off ack still lights the navbar's status dot.
const oddReady = parseQaMessage({ type: 'qa:ready', mode: 'nonsense', path: '/' });
check(
  'reply with a bad mode degrades to real',
  oddReady?.type === 'qa:ready' && oddReady.mode === 'real'
);

const denied = parseQaMessage({ type: 'qa:denied', reason: 'not an admin' });
check('qa:denied parses', denied?.type === 'qa:denied' && denied.reason === 'not an admin');

console.log('\n=== 7. EXTRA FIELDS ARE IGNORED, NOT TRUSTED ===');
// A message may carry more than the protocol defines. Surplus keys must be
// dropped rather than passed through into application state.
const extra = parseQaMessage({
  type: 'qa:set-mode',
  mode: 'premium',
  role: 'admin',
  sql: 'DROP TABLE',
});
check(
  'surplus fields are stripped',
  extra !== null && Object.keys(extra).sort().join(',') === 'mode,type',
  JSON.stringify(extra)
);

console.log('\n=== 8. ORIGIN ALLOW-LIST IS AN ALLOW-LIST ===');
check('admin allow-list is non-empty', trustedAdminOrigins().length > 0);
check('app allow-list is non-empty', trustedAppOrigins().length > 0);
check('loopback dev origin is a trusted admin', isTrustedAdminOrigin('http://localhost:5173'));
check('loopback dev origin is a trusted app', isTrustedAppOrigin('http://localhost:5173'));
for (const evil of [
  'https://evil.example.com',
  'http://merodeutsch.pramods.com.np',
  'https://merodeutsch.pramods.com.np.evil.com',
  'http://localhost:5173.evil.com',
  'https://notlocalhost:5173',
  '',
  'null',
]) {
  check(`origin ${JSON.stringify(evil)} is NOT a trusted admin`, !isTrustedAdminOrigin(evil));
}

console.log('\n=== 8b. THE APP ORIGIN MUST NOT BE A TRUSTED ADMIN ===');
// The regression this split exists to prevent. The learner app checks INCOMING
// COMMANDS against `trustedAdminOrigins()`; if the app's own origin were in
// that list, gate 2 would be a no-op and only the per-message role re-read
// would stand between a compromised app and the QA channel.
//
// Tested against the PURE derivation because bare `tsx` has no `window`, so
// testing the assembled list would pass on an empty array and prove nothing.
const APP = 'merodeutsch.pramods.com.np';
const ADMIN = 'admin.merodeutsch.pramods.com.np';
const adminFromApp = deriveAdminOrigins(APP, 'https:');
const adminFromAdmin = deriveAdminOrigins(ADMIN, 'https:');
const appFromApp = deriveAppOrigins(APP, 'https:', APP);
const appFromAdmin = deriveAppOrigins(ADMIN, 'https:', ADMIN);

check('app host derives exactly one admin origin', adminFromApp.length === 1, JSON.stringify(adminFromApp));
check('app host derives the admin sibling', adminFromApp[0] === `https://${ADMIN}`, adminFromApp[0]);
check('APP ORIGIN IS ABSENT from the admin allow-list', !adminFromApp.includes(`https://${APP}`), JSON.stringify(adminFromApp));
check('APP ORIGIN IS ABSENT even when derived from admin', !adminFromAdmin.includes(`https://${APP}`), JSON.stringify(adminFromAdmin));
// Symmetry: both hosts must resolve to the SAME admin origin, or one side of the
// bridge addresses an origin that does not exist and the channel silently dies.
// (An earlier `slice(1)` version got this wrong from the app host.)
check('both hosts derive the identical admin origin', adminFromApp[0] === adminFromAdmin[0], `${adminFromApp[0]} vs ${adminFromAdmin[0]}`);

check('app allow-list contains the app origin', appFromApp.includes(`https://${APP}`), JSON.stringify(appFromApp));
check('app allow-list contains the admin sibling', appFromApp.includes(`https://${ADMIN}`), JSON.stringify(appFromApp));
check('admin host derives the app by stripping the label', appFromAdmin.includes(`https://${APP}`), JSON.stringify(appFromAdmin));
check('the two lists are not the same set', JSON.stringify([...adminFromApp].sort()) !== JSON.stringify([...appFromApp].sort()));

// A single-label host has no parent to derive from; deriving an `admin.`
// sibling of `localhost` would produce an origin that resolves nowhere.
check('localhost derives no admin sibling', deriveAdminOrigins('localhost', 'http:').length === 0);
check('localhost derives no app sibling', deriveAppOrigins('localhost', 'http:', 'localhost').length === 0);

console.log('\n=== 9. TAB DETECTION ===');
// No `window` under bare tsx, so this must be false rather than throwing.
check('isQaTab() is safe without a window', isQaTab() === false);

console.log(
  `\n[summary] ${failures.length === 0 ? `ALL ${checks} CHECKS PASSED` : `${failures.length} of ${checks} FAILED: ${failures.join(', ')}`}`
);
process.exit(failures.length === 0 ? 0 : 1);
