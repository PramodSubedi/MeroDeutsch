/**
 * src/lib/debugModeLink.ts
 *
 * The admin app → learner app handshake for the QA mode simulator.
 *
 * ── THE PROBLEM THIS SOLVES ────────────────────────────────────────────────
 * The simulator is driven by localStorage, and localStorage is partitioned per
 * ORIGIN. The control center runs on `admin.merodeutsch…` and the app it
 * inspects runs on `merodeutsch…`. They share a Supabase project but NOT a
 * storage jar, so the admin app physically cannot write the key that
 * `useAuth`/`usePremium` read. A toggle inside the admin app that called
 * `setDebugMode()` directly would update a key nothing else can see: it would
 * look like it worked and change nothing.
 *
 * ── THE MECHANISM ──────────────────────────────────────────────────────────
 * The admin app cannot push, so the LEARNER app pulls. The control centre
 * builds a normal link carrying `?adminmode=<mode>`; the learner app reads it
 * on boot and applies it — but ONLY after independently confirming the signed-in
 * account is an admin.
 *
 * The verification is the whole point, and it happens on the LEARNER side,
 * against `profiles.role` over RLS. Without it, `?adminmode=premium` would be a
 * URL any visitor could paste to get premium UI. With it, a non-admin's request
 * is discarded and the parameter stripped.
 *
 * The parameter is removed from the URL after handling (see
 * `useAdminModeBootstrap`) so the mode cannot be silently re-applied by a stale
 * link, a refresh, or a shared URL — the state belongs in storage, not in
 * history.
 */

import type { DebugMode } from './debugMode';

export const ADMIN_MODE_PARAM = 'adminmode';

/** Narrow an untrusted URL value to a real mode. Anything else → null. */
export function parseAdminMode(raw: string | null): DebugMode | null {
  return raw === 'real' || raw === 'guest' || raw === 'free' || raw === 'premium' ? raw : null;
}

/**
 * The learner app's origin, as seen from the admin app.
 *
 * Order matters:
 *   1. `VITE_APP_URL` — the explicit, correct answer when the admin app is
 *      deployed somewhere that is not a sibling subdomain.
 *   2. Sibling-subdomain derivation — in the normal deployment
 *      (`admin.merodeutsch.pramods.com.np`) the learner app is the same host
 *      minus the `admin.` label, so this needs no configuration at all.
 *   3. Relative `/` — the local-dev and single-origin case, where both entries
 *      are served by one Vite server.
 *
 * Returning a relative URL is deliberate: it keeps the module free of any
 * assumption that a deployment exists, which is what lets the whole feature be
 * tested locally.
 */
export function resolveAppUrl(): string {
  // `import.meta.env` is a Vite INJECTION — it is undefined under bare `tsx`
  // (the self-check) and in any non-Vite tool. Reading it unguarded throws a
  // TypeError, which would take down the whole control centre rather than
  // merely losing the configured URL, so it is read defensively.
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const configured = env?.VITE_APP_URL;
  if (typeof configured === 'string' && configured.trim() !== '') {
    return configured.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const { host, protocol } = window.location;
    if (host.startsWith('admin.')) {
      return `${protocol}//${host.slice('admin.'.length)}`;
    }
  }

  return '';
}

/**
 * The host-resolution rule, extracted so it can be tested against real inputs.
 *
 * Kept separate from `resolveAdminUrl` because that function reads
 * `window.location`, which does not exist under `tsx` — and the loopback branch
 * (the one that makes the feature work in local dev) is exactly the branch most
 * likely to regress unnoticed.
 */
export function resolveAdminUrlFor(origin: string): string {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return '';
  }
  const { host, protocol, hostname } = url;

  const isLoopback =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  if (isLoopback) {
    return `${protocol}//${host}/admin.html`;
  }

  // Already on the control centre: nothing to link to.
  if (hostname.startsWith('admin.')) return '';

  return `${protocol}//admin.${host}`;
}

/**
 * The CONTROL CENTER's origin, as seen from the learner app.
 *
 * The mirror image of `resolveAppUrl`, and used by Settings to surface an
 * "Admin panel" entry to accounts that hold `profiles.role = 'admin'`.
 *
 * Same three-tier strategy, in the opposite direction:
 *   1. `VITE_ADMIN_URL` — the explicit answer, and the only one that works if
 *      the control centre is not a sibling subdomain.
 *   2. Sibling derivation — `merodeutsch.…` ⇒ `admin.merodeutsch.…`. This is the
 *      production layout, so it works with no configuration.
 *   3. Localhost ⇒ `/admin.html` on the SAME origin. In dev both entries are
 *      served by one Vite dev server, so pointing at `admin.localhost` would
 *      resolve nowhere. Returning a same-origin path is what lets the feature be
 *      tested without any environment setup.
 *
 * Returns `''` when no control centre can be determined, so callers can HIDE the
 * entry rather than render a link that 404s.
 */
export function resolveAdminUrl(): string {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const configured = env?.VITE_ADMIN_URL;
  if (typeof configured === 'string' && configured.trim() !== '') {
    return configured.replace(/\/+$/, '');
  }

  if (typeof window === 'undefined') return '';
  return resolveAdminUrlFor(window.location.origin);
}

/**
 * Build a learner-app URL that opens in the given simulated mode.
 *
 * `path` lets the admin jump straight to a screen worth checking (the campaign,
 * a lesson, the paywall) instead of always landing on Home.
 */
export function buildModeUrl(mode: DebugMode, path = '/'): string {
  const base = resolveAppUrl();
  const target = path.startsWith('/') ? path : `/${path}`;
  const separator = target.includes('?') ? '&' : '?';
  return `${base}${target}${separator}${ADMIN_MODE_PARAM}=${mode}`;
}
