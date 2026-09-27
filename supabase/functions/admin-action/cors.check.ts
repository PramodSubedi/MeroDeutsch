/**
 * supabase/functions/admin-action/cors.check.ts
 *
 *   npm run check:cors
 *
 * ── WHAT IS ACTUALLY BEING PROVEN ───────────────────────────────────────────
 * The regression: an unset `ADMIN_ALLOWED_ORIGIN` produced an empty
 * `Access-Control-Allow-Origin`, every browser call to the admin-action
 * function failed its preflight, and every privileged action reported "Could not
 * reach the service" while the code, the guards and 1,105 other checks all
 * passed. Nothing about that failure was reachable from a test, because the
 * value lived in Deno's environment.
 *
 * So the properties asserted below are the ones whose absence caused an
 * outage, plus the two ways a naive "fix" turns a broken function into an
 * exposed one: a `*` wildcard, and a substring match.
 */
import { ALLOW_ORIGIN_SECRET, allowedOrigin, corsHeaders, parseAllowlist } from './cors';

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

const ADMIN = 'https://admin.merodeutsch.pramods.com.np';
const LOCAL = 'http://localhost:5173';

console.log('\n=== 1. THE SECRET NAME IS STABLE ===');
check('the secret is ADMIN_ALLOWED_ORIGIN', ALLOW_ORIGIN_SECRET === 'ADMIN_ALLOWED_ORIGIN', ALLOW_ORIGIN_SECRET);

console.log('\n=== 2. PARSING THE ALLOWLIST ===');
check('null parses to nothing', parseAllowlist(null).length === 0);
check('undefined parses to nothing', parseAllowlist(undefined).length === 0);
check('an empty string parses to nothing', parseAllowlist('').length === 0, JSON.stringify(parseAllowlist('')));
check('whitespace parses to nothing', parseAllowlist('   ').length === 0);
check('one origin yields one entry', parseAllowlist(ADMIN).length === 1);
check('the origin is preserved', parseAllowlist(ADMIN)[0] === ADMIN);
check('two origins yield two entries', parseAllowlist(`${ADMIN},${LOCAL}`).length === 2);
check('surrounding spaces are trimmed', parseAllowlist(` ${ADMIN} , ${LOCAL} `)[1] === LOCAL);
check('a trailing comma is dropped', parseAllowlist(`${ADMIN},`).length === 1, JSON.stringify(parseAllowlist(`${ADMIN},`)));
check('a doubled comma is dropped', parseAllowlist(`${ADMIN},,${LOCAL}`).length === 2);
check('a pasted newline does not survive', parseAllowlist(`${ADMIN}\n${LOCAL}`).length === 2, JSON.stringify(parseAllowlist(`${ADMIN}\n${LOCAL}`)));
check('a one-per-line paste still works', parseAllowlist(`${ADMIN}\n${LOCAL}`)[0] === ADMIN);
check('a windows CRLF paste still works', parseAllowlist(`${ADMIN}\r\n${LOCAL}`).length === 2, JSON.stringify(parseAllowlist(`${ADMIN}\r\n${LOCAL}`)));
check('a newline-separated list grants the second origin', allowedOrigin(LOCAL, parseAllowlist(`${ADMIN}\n${LOCAL}`)) === LOCAL);

console.log('\n=== 3. THE REGRESSION: NOTHING IS GRANTED BY DEFAULT ===');
// THE bug. Before these, an unset secret yielded a blank header and every
// privileged action was unreachable from a browser.
check('an unset secret grants a listed origin nothing', allowedOrigin(ADMIN, parseAllowlist(undefined)) === '');
check('a blank secret grants nothing', allowedOrigin(ADMIN, parseAllowlist('  ')) === '');
check('an unconfigured response has NO allow-origin header', !('Access-Control-Allow-Origin' in corsHeaders(ADMIN, undefined)));
check('an unconfigured response is not a wildcard', !('Access-Control-Allow-Origin' in corsHeaders(ADMIN, '')));
check('a same-origin request with no Origin header is not granted', allowedOrigin(null, parseAllowlist(ADMIN)) === '');

console.log('\n=== 4. A CONFIGURED SECRET GRANTS EXACTLY ITS ORIGIN ===');
check('the production admin origin is echoed', allowedOrigin(ADMIN, parseAllowlist(ADMIN)) === ADMIN);
check('localhost is echoed when listed', allowedOrigin(LOCAL, parseAllowlist(`${ADMIN},${LOCAL}`)) === LOCAL);
check('the header is present for a granted origin', corsHeaders(ADMIN, ADMIN)['Access-Control-Allow-Origin'] === ADMIN);
check('the echoed value equals the request origin exactly', corsHeaders(LOCAL, `${ADMIN},${LOCAL}`)['Access-Control-Allow-Origin'] === LOCAL);

console.log('\n=== 5. AN UNLISTED ORIGIN IS REFUSED ===');
check('a stranger is refused', allowedOrigin('https://evil.example', parseAllowlist(ADMIN)) === '');
check('a lookalike subdomain is refused', allowedOrigin('https://admin.merodeutsch.pramods.com.np.evil.example', parseAllowlist(ADMIN)) === '');
check('plain http against an https entry is refused', allowedOrigin(`http://${ADMIN.replace('https://', '')}`, parseAllowlist(ADMIN)) === '');
check('a trailing slash is refused (no normalisation)', allowedOrigin(`${ADMIN}/`, parseAllowlist(ADMIN)) === '');
check('a different port on localhost is refused', allowedOrigin('http://localhost:4173', parseAllowlist(LOCAL)) === '');

console.log('\n=== 6. NO SUBSTRING MATCH — THE OVERLOOKED ESCAPE ===');
// An `includes()` implementation would grant all three of these. This is the
// most likely way someone "fixes" the outage and quietly exposes the function.
const spoof = `https://evil.example/?next=${ADMIN}`;
check('an allowlisted origin in a query string is refused', allowedOrigin(spoof, parseAllowlist(ADMIN)) === '', spoof);
check('an allowlisted origin in the path is refused', allowedOrigin(`https://evil.example/${ADMIN}`, parseAllowlist(ADMIN)) === '');
check('an allowlisted origin in the fragment is refused', allowedOrigin(`https://evil.example/#${ADMIN}`, parseAllowlist(ADMIN)) === '');
check('a userinfo trick is refused', allowedOrigin(`https://admin.merodeutsch.pramods.com.np@evil.example`, parseAllowlist(ADMIN)) === '');
check('a prefixed origin is refused', allowedOrigin(`https://x${ADMIN}`, parseAllowlist(ADMIN)) === '');

console.log('\n=== 7. NEVER A WILDCARD ===');
// This function holds the service role key. A `*` would let any site attempt
// every privileged call with a stolen token.
for (const raw of [undefined, '', '  ', ADMIN, `${ADMIN},${LOCAL}`, '*', 'https://*']) {
  const h = corsHeaders(ADMIN, raw);
  check(
    `allow-origin is never "*" (secret=${JSON.stringify(raw)})`,
    h['Access-Control-Allow-Origin'] !== '*',
    h['Access-Control-Allow-Origin'] ?? '(absent)',
  );
}
check('a literal "*" in the secret grants nothing', !('Access-Control-Allow-Origin' in corsHeaders(ADMIN, '*')));
check('a wildcard-looking entry grants nothing', !('Access-Control-Allow-Origin' in corsHeaders(ADMIN, 'https://*')));

console.log('\n=== 8. THE OTHER HEADERS SURVIVE ===');
const ok = corsHeaders(ADMIN, ADMIN);
check('allow-headers is preserved', ok['Access-Control-Allow-Headers'] === 'authorization, x-client-info, apikey, content-type');
check('allow-methods is preserved', ok['Access-Control-Allow-Methods'] === 'POST, OPTIONS');
check('the headers are sent even when nothing is granted', corsHeaders('https://evil.example', ADMIN)['Access-Control-Allow-Methods'] === 'POST, OPTIONS');

console.log('\n=== 9. VARY: ORIGIN — A SHARED CACHE MUST NOT CROSS THE ALLOWLIST ===');
// Responses now differ per origin. Without Vary, a cache can hand one origin's
// granted header to another, which silently defeats the whole allowlist.
check('a granted response varies on Origin', ok['Vary'] === 'Origin', ok['Vary'] ?? '(absent)');
check('an ungranted response varies on Origin', corsHeaders(ADMIN, undefined)['Vary'] === 'Origin');

console.log(`\n${failures.length === 0 ? '[summary] ALL' : '[summary]'} ${checks} CHECKS ${failures.length === 0 ? 'PASSED' : `FAILED (${failures.length})`}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
