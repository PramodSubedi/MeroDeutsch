/**
 * supabase/functions/admin-action/cors.ts
 *
 * WHICH ORIGINS MAY CALL THE PRIVILEGE BOUNDARY.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * The function shipped reading its allow-origin from a secret
 * (`ADMIN_ALLOWED_ORIGIN`) that nobody had ever set. The result was an EMPTY
 * `Access-Control-Allow-Origin` on every response, so the browser's preflight
 * failed and the control centre could never read a reply. Every privileged
 * action — ban, promote, demote, publish, repair — surfaced as "Could not reach
 * the admin-action service", while every READ-ONLY surface kept working
 * perfectly, because PostgREST and GoTrue send their own correct CORS headers.
 * Only the one endpoint that needed this header was missing it.
 *
 * 1,105 passing checks did not catch it, because the value lived in Deno's
 * environment where no test could see it. That is the entire reason this logic
 * is pure and exported: the rules are now testable, and the empty-allowlist
 * case — the one that actually shipped — has an explicit, asserted behaviour.
 *
 * ── WHY AN ALLOWLIST ECHO, NEVER `*` ────────────────────────────────────────
 * This function holds the service-role key and will act on any valid admin JWT
 * it is handed. `Access-Control-Allow-Origin: *` would let ANY site attempt
 * those calls with a token lifted from XSS or a shared machine. The JWT is what
 * actually stops them, not CORS — but there is no reason to widen the blast
 * radius when echoing one matched origin is equally easy.
 *
 * Echoing the request's own Origin (rather than hardcoding a string) is what
 * makes local dev work: the admin entry is served from the Vite dev server at
 * a different origin from the function, so a single hardcoded production origin
 * would break every local run.
 *
 * Pure — no Deno, no network, no env. index.ts does the wiring.
 */

/** Header set on every response, whatever the origin. */
const BASE_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const;

/** The secret this module reads. Named once so the wiring cannot drift. */
export const ALLOW_ORIGIN_SECRET = 'ADMIN_ALLOWED_ORIGIN';

/**
 * Split the secret into a list of origins.
 *
 * Comma-separated so production and loopback can live in one secret, and also
 * split on newlines: pasting a list into the Supabase dashboard readily arrives
 * one-per-line, and treating that as a single invalid entry would leave an
 * empty allowlist and reproduce the exact outage this file exists to prevent —
 * with no error anywhere to say why. Blank entries are dropped for the same
 * reason a trailing comma must not become an "origin".
 */
export function parseAllowlist(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .split(/[,\r\n]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * The origin to echo back, or `''` to grant nothing.
 *
 * EXACT string match. Never a prefix, substring or suffix test — otherwise
 * `https://evil.example/?next=https://admin.example.com` would pass a
 * `includes` check and hand a stranger a working CORS grant.
 *
 * Returning `''` rather than special-casing keeps the failure mode identical to
 * today's empty header, which the browser already treats as a refusal. An
 * unconfigured deployment stays broken-and-obvious instead of becoming
 * accidentally permissive.
 */
export function allowedOrigin(origin: string | null, allowlist: readonly string[]): string {
  if (!origin) return '';
  return allowlist.includes(origin) ? origin : '';
}

/**
 * CORS headers for one request.
 *
 * `Vary: Origin` is unconditional because the response now DEPENDS on the
 * request's origin. Without it a shared cache can serve one origin's granted
 * header to a different origin — the quiet way an allowlist stops being one.
 */
export function corsHeaders(
  origin: string | null,
  rawAllowlist: string | null | undefined,
): Record<string, string> {
  const granted = allowedOrigin(origin, parseAllowlist(rawAllowlist));
  return {
    ...BASE_HEADERS,
    // OMITTED entirely when ungranted, not emitted as an empty string: a blank
    // header is confusing to debug and some proxies echo it back verbatim.
    ...(granted ? { 'Access-Control-Allow-Origin': granted } : {}),
    Vary: 'Origin',
  };
}
