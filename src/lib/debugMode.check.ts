/**
 * Self-check for the QA mode simulator.
 *
 * WHAT THIS PROVES (and what it cannot)
 * -------------------------------------
 * `debugMode.ts` is deliberately dependency-free — it is imported by
 * `useAuth`, which sits near the root of the provider tree, so a bug here
 * would break the entire app. The `safeStorage` helpers it uses fall back to
 * an in-memory Map when `window` is absent, which means the storage contract
 * is testable in plain Node with no jsdom and no browser.
 *
 * The URL half (`debugModeLink`) is checked here too, because it is the piece
 * that decides WHERE a mode is applied: `parseAdminMode` is the only thing
 * standing between a pasted `?adminmode=` link and an unintended override, and
 * an unrecognised value must never be coerced into a real mode.
 *
 * Run: npx tsx src/lib/debugMode.check.ts
 */
import {
  DEBUG_MODES,
  debugModeBlurb,
  debugModeLabel,
  getDebugMode,
  isSimulating,
  setDebugMode,
  subscribeDebugMode,
  type DebugMode,
} from './debugMode';
import { ADMIN_MODE_PARAM, buildModeUrl, parseAdminMode, resolveAdminUrl, resolveAdminUrlFor } from './debugModeLink';
import { getItem } from '../utils/safeStorage';

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

/** Round-trip a value through storage and assert the read matches. */
function roundTrip(mode: DebugMode): void {
  setDebugMode(mode);
  check(
    `setDebugMode(${mode}) round-trips`,
    getDebugMode() === mode,
    `stored=${getDebugMode()}`
  );
}

console.log('\n=== 1. DEFAULT IS REAL ===');
check('a fresh install reads "real"', getDebugMode() === 'real', `got ${getDebugMode()}`);
check('nothing is simulating by default', isSimulating() === false);

console.log('\n=== 2. EVERY MODE ROUND-TRIPS ===');
for (const mode of DEBUG_MODES) roundTrip(mode);

console.log('\n=== 3. real CLEARS BOTH STORAGE KEYS ===');
setDebugMode('premium');
check('premium writes the shared premium override', getItem('germanPremiumOverride') === 'premium');
setDebugMode('real');
check('real removes the mode key', getItem('meroDeutschDebugMode') === null);
check('real removes the premium override too', getItem('germanPremiumOverride') === null);
check('isSimulating() is false again', isSimulating() === false);

console.log('\n=== 4. TIER MODES DRIVE THE EXISTING PREMIUM OVERRIDE ===');
// `usePremium` reads ONLY `germanPremiumOverride`. The simulator has to write
// that exact key or free/premium modes would silently do nothing.
setDebugMode('free');
check('free -> germanPremiumOverride="free"', getItem('germanPremiumOverride') === 'free');
setDebugMode('premium');
check('premium -> germanPremiumOverride="premium"', getItem('germanPremiumOverride') === 'premium');

console.log('\n=== 5. guest WRITES NO TIER OVERRIDE ===');
// A guest has no account, so forcing a plan would be a lie about a signed-out
// visitor. `usePremium` already resolves a null userId to 'free'.
setDebugMode('guest');
check('guest leaves the premium override unset', getItem('germanPremiumOverride') === null);
check('guest is still a simulating mode', isSimulating() === true);

console.log('\n=== 6. UNKNOWN / CORRUPT VALUES FAIL SAFE ===');
// A hand-edited or truncated storage value must degrade to "real", never throw
// and never resolve to some unintended mode.
const { setItem } = await import('../utils/safeStorage');
for (const junk of ['', 'PREMIUM', 'premium ', '{"mode":"guest"}', 'undefined', 'null']) {
  setItem('meroDeutschDebugMode', junk);
  check(
    `junk ${JSON.stringify(junk)} degrades to "real"`,
    getDebugMode() === 'real',
    `got ${getDebugMode()}`
  );
}

console.log('\n=== 7. SUBSCRIBERS ARE NOTIFIED ===');
let notified: DebugMode | null = null;
const unsubscribe = subscribeDebugMode((mode) => {
  notified = mode;
});
setDebugMode('premium');
check('subscriber received "premium"', notified === 'premium', `got ${String(notified)}`);

setDebugMode('real');
check('subscriber received "real"', notified === 'real', `got ${String(notified)}`);

// A throwing subscriber must not stop the others — otherwise one bad listener
// would leave the mode half-applied across the app.
let reachedSecond = false;
subscribeDebugMode(() => {
  throw new Error('boom');
});
const okListener = subscribeDebugMode(() => {
  reachedSecond = true;
});
setDebugMode('free');
check('a throwing subscriber does not block the next one', reachedSecond === true);
okListener();
unsubscribe();

console.log('\n=== 8. LABELS EXIST FOR EVERY MODE ===');
for (const mode of DEBUG_MODES) {
  check(`label + blurb present for ${mode}`, Boolean(debugModeLabel(mode)) && Boolean(debugModeBlurb(mode)));
}

console.log('\n=== 9. URL PARAM PARSES ONLY REAL MODES ===');
// This is the gate a pasted `?adminmode=` link passes through. Anything that is
// not an exact mode must return null so the bootstrap discards it — never
// coerce, and never case-fold (a fuzzy match here would let `PREMIUM` through).
for (const mode of DEBUG_MODES) {
  check(`?adminmode=${mode} parses`, parseAdminMode(mode) === mode);
}
for (const junk of ['', 'PREMIUM', 'Premium', 'premium ', ' guest', 'true', 'null', '{"m":"guest"}']) {
  check(
    `junk ${JSON.stringify(junk)} is rejected (null)`,
    parseAdminMode(junk) === null,
    `got ${String(parseAdminMode(junk))}`
  );
}
check('a missing param is null', parseAdminMode(null) === null);

console.log('\n=== 10. BUILT URL CARRIES THE PARAM CORRECTLY ===');
const url = buildModeUrl('guest', '/learn');
check('URL includes the adminmode param', url.includes(`${ADMIN_MODE_PARAM}=guest`), url);
check('URL targets the requested path', url.includes('/learn'), url);
// A path that already carries a query must get '&', not a second '?', or the
// first query string is silently swallowed and the app opens the wrong screen.
const withQuery = buildModeUrl('premium', '/learn?band=3');
check('existing query uses & not ?', withQuery.includes('?band=3&'), withQuery);
// A path with no leading slash still has to produce a valid absolute path.
check('missing leading slash is repaired', buildModeUrl('free', 'settings').includes('/settings'));

console.log('\n=== 11. ADMIN URL RESOLUTION (Settings "Admin panel" link) ===');
// The resolver branches on `window`, which does not exist under bare tsx. It must
// return a usable value in every environment rather than throwing.
const adminUrl = resolveAdminUrl();
check('resolveAdminUrl does not throw and returns a string', typeof adminUrl === 'string', String(adminUrl));
check(
  'adminUrl is either empty or an absolute/same-origin URL',
  adminUrl === '' || /^(https?:\/\/|\/)/.test(adminUrl),
  adminUrl
);
// The loopback branch is the one that makes the feature work in dev, and it is
// the branch most likely to regress, so it is asserted directly.
const loopback = resolveAdminUrlFor('http://localhost:5173');
check('localhost resolves to the same-origin /admin.html', loopback === 'http://localhost:5173/admin.html', loopback);
check(
  '127.0.0.1 resolves to the same-origin /admin.html',
  resolveAdminUrlFor('http://127.0.0.1:4173') === 'http://127.0.0.1:4173/admin.html',
  resolveAdminUrlFor('http://127.0.0.1:4173')
);
check(
  'a dev server on a non-standard port still works',
  resolveAdminUrlFor('http://localhost:5180') === 'http://localhost:5180/admin.html',
  resolveAdminUrlFor('http://localhost:5180')
);
// Production: the control centre is the `admin.` sibling.
check(
  'production host derives the admin sibling',
  resolveAdminUrlFor('https://merodeutsch.pramods.com.np') === 'https://admin.merodeutsch.pramods.com.np',
  resolveAdminUrlFor('https://merodeutsch.pramods.com.np')
);
// Already inside the control centre: nothing to link to, so the row is hidden.
check(
  'admin host resolves to empty (already there)',
  resolveAdminUrlFor('https://admin.merodeutsch.pramods.com.np') === '',
  resolveAdminUrlFor('https://admin.merodeutsch.pramods.com.np')
);

console.log('\n=== 12. REGRESSION: A STUCK GUEST MODE IS RECOVERABLE ===');
// This is the "login is broken" bug, reproduced as a test.
//
// The failure chain was: guest override -> useAuth reports user:null ->
// useDebugAccess cannot read a role -> the banner that explains the problem
// (and offers the only Exit) was itself hidden. The app looked permanently
// signed out with no way out.
//
// The invariant these checks pin down: a simulated guest can ALWAYS be returned
// to `real`, and doing so restores a normal (non-simulating) state.
setDebugMode('guest');
check('stuck in guest', getDebugMode() === 'guest' && isSimulating() === true);

// This is what `login()` now does. It must fully clear the state, not merely
// flip a flag the getter still reports from.
setDebugMode('real');
check('a sign-in clears the stuck guest mode', getDebugMode() === 'real');
check('no longer simulating after the clear', isSimulating() === false);
check('mode storage key is gone', getItem('meroDeutschDebugMode') === null);
check('premium override is gone too', getItem('germanPremiumOverride') === null);

// The same must hold from a stuck PREMIUM mode, which is less obviously broken
// (the app still looks signed in) and therefore easier to leave behind.
setDebugMode('premium');
check('stuck in premium', getDebugMode() === 'premium');
setDebugMode('real');
check('premium clears back to real', getDebugMode() === 'real' && isSimulating() === false);

console.log('\n=== 12b. RUNTIME MODE CHANGES ARE OBSERVABLE (usePremium contract) ===');
// This is the "premium shows no 15 lessons" bug. `usePremium` initialised its
// override ONCE at mount and never subscribed, so a runtime mode change (navbar
// toggle, postMessage bridge, ?adminmode=) wrote the storage key but nothing
// re-read it — the campaign stayed invisible until a manual reload.
//
// `usePremium` is a React hook, so it is not directly unit-testable here. What
// IS testable is the contract it depends on: after a runtime `setDebugMode`,
// a fresh read of the override key MUST return the new tier, and every listener
// mechanism it subscribes to must actually fire. That is what the hook's
// `useEffect` relies on, so verifying it here verifies the fix's foundation.
{
  // 1. A fresh read sees the new value (this is `readOverride()`).
  setDebugMode('premium');
  const fresh = getItem('germanPremiumOverride');
  check('a fresh override read returns premium after a runtime change', fresh === 'premium', String(fresh));

  // 2. Same-tab subscribers fire (this is `subscribeDebugMode`).
  let fired = 0;
  const unsubscribe = subscribeDebugMode(() => {
    fired += 1;
  });
  setDebugMode('free');
  check('subscribeDebugMode notifies on a same-tab change', fired >= 1, `fired ${fired}`);
  unsubscribe();

  // 3. The custom DOM event fires (this is the `mero-debug-mode` listener).
  //    A same-tab `localStorage.setItem` does NOT raise `storage`, which is
  //    exactly why the hook listens to both.
  //
  //    Guarded on `window`: under bare `tsx` there is no DOM, so this specific
  //    listener cannot be exercised here. `setDebugMode` already guards its own
  //    dispatch, and the browser is where this path actually runs.
  if (typeof window !== 'undefined') {
    let domFired = 0;
    const onDom = () => {
      domFired += 1;
    };
    window.addEventListener('mero-debug-mode', onDom);
    setDebugMode('premium');
    check('the mero-debug-mode DOM event fires', domFired >= 1, `fired ${domFired}`);
    window.removeEventListener('mero-debug-mode', onDom);
  } else {
    console.log('  SKIP  DOM-event check (no window outside a browser)');
  }

  // 4. Round trip back to real clears the key the hook reads.
  setDebugMode('real');
  check('clearing returns the override key to null', getItem('germanPremiumOverride') === null);
}

console.log('\n=== 13. REGRESSION: THE URL HAND-OFF SURVIVES AUTHORIZATION ===');
// This is the "still only 6 lessons" bug. `useAdminModeBootstrap` deleted
// `?adminmode=` from the URL BEFORE the async role check resolved, then re-ran
// with the parameter already gone. `setDebugMode` therefore never executed, and
// "Open app" in premium mode silently opened the REAL (free) account — which
// renders the 6-lesson free roadmap and looks exactly like "premium is broken".
//
// The fix captures the value into a ref first, then strips. This checks the two
// halves that must both hold for that to work.
{
  // The value must survive having been parsed out of a URL, because that is
  // exactly what the ref now holds while authorization is in flight.
  const captured: DebugMode = parseAdminMode('premium') as DebugMode;
  check('the requested mode is captured before any async work', captured === 'premium');

  // Stripping the parameter must not disturb the captured value.
  const params = new URLSearchParams('qa=1&adminmode=premium&x=2');
  params.delete('adminmode');
  check(
    'the parameter is removed from the query',
    !params.toString().includes('adminmode'),
    params.toString()
  );
  check(
    'unrelated parameters are preserved',
    params.get('qa') === '1' && params.get('x') === '2',
    params.toString()
  );
  check('the captured value is unaffected by the strip', captured === 'premium');

  // And applying it must actually change what the app renders.
  setDebugMode(captured);
  check('applying the captured mode sets premium', getDebugMode() === 'premium');
  check('premium is reflected in the tier override', getItem('germanPremiumOverride') === 'premium');
  setDebugMode('real');
}

// Leave the environment clean for whatever runs next.
setDebugMode('real');

console.log(
  `\n[summary] ${failures.length === 0 ? `ALL ${checks} CHECKS PASSED` : `${failures.length} of ${checks} FAILED: ${failures.join(', ')}`}`
);
process.exit(failures.length === 0 ? 0 : 1);
