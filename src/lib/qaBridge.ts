/**
 * src/lib/qaBridge.ts
 *
 * Wire protocol between the control center and the app, so ONE app tab can be
 * re-dressed as guest / signed-in / premium from the admin navbar.
 *
 * ── WHY A BRIDGE AND NOT A RELOADED URL ────────────────────────────────────
 * The URL hand-off already exists (`?adminmode=`, see `debugModeLink.ts`) and it
 * works — but it only applies a mode at load time. To change modes on a tab you
 * are already browsing, something has to be pushed. `postMessage` is the only
 * channel that works across the two origins.
 *
 * ── THE TRUST MODEL, STATED PLAINLY ───────────────────────────────────────
 * This channel can only ever change what ONE browser displays. It cannot write
 * a row, cannot grant an entitlement, and cannot touch another user. The worst
 * a successful forgery achieves is "this admin's own screen shows premium UI" —
 * a cosmetic outcome with no backend consequence.
 *
 * That low ceiling is deliberate, and it is why this design is acceptable at
 * all. Three independent gates stand in front of it anyway:
 *
 *   1. The SENDER always names an exact target origin. Never `'*'`.
 *   2. The RECEIVER checks `event.origin` against the known admin origin(s).
 *   3. The RECEIVER re-verifies `profiles.role === 'admin'` over RLS for the
 *      CURRENT session, on every message — not once at startup.
 *
 * Gate 3 is the one that matters. Gates 1–2 stop a random third-party site;
 * gate 3 stops a compromised admin session from driving the channel. Because
 * the only payload is a display override, a bypass degrades to a misleading UI
 * and nothing more.
 */
import type { DebugMode } from './debugMode';

/** Messages travelling admin -> app. */
export type QaCommand =
  | { type: 'qa:set-mode'; mode: DebugMode }
  | { type: 'qa:ping' };

/** Messages travelling app -> admin. */
export type QaReply =
  | { type: 'qa:ready'; mode: DebugMode; path: string; at: number }
  | { type: 'qa:denied'; reason: string };

export type QaMessage = QaCommand | QaReply;

export const QA_PARAM = 'qa';

/**
/**
 * The registrable base a host belongs to, with any `admin.` label removed.
 *
 * `admin.merodeutsch.pramods.com.np` → `merodeutsch.pramods.com.np`
 * `merodeutsch.pramods.com.np`        → `merodeutsch.pramods.com.np`  (unchanged)
 *
 * Both apps must resolve to the SAME base, because the control centre derives
 * the app from itself and the app derives the control centre from itself. An
 * earlier version stripped the leftmost DNS label instead, which is only correct
 * for the `admin.` host: from `merodeutsch.pramods.com.np` it produced
 * `pramods.com.np`, so the app derived a control centre that did not exist and
 * the admin derived an app that did not exist. The bridge silently failed on
 * both sides. Stripping the LABEL rather than the label is the fix.
 */
function baseHost(hostname: string): string {
  return hostname.startsWith('admin.') ? hostname.slice('admin.'.length) : hostname;
}

/**
 * Pure derivation of the admin allow-list from a hostname.
 *
 * Extracted so the SECURITY-CRITICAL part is testable. Under bare `tsx` there
 * is no `window`, so the derivation in `trustedAdminOrigins()` never runs and a
 * test of that function alone would pass on an empty list — proving nothing
 * about whether the app origin leaks in.
 */
export function deriveAdminOrigins(hostname: string, protocol: string): string[] {
  const base = baseHost(hostname);
  // Single-label hosts (localhost, and anything without a dot) have no
  // registrable base to hang an `admin.` label off.
  if (!base.includes('.')) return [];
  return [`${protocol}//admin.${base}`];
}

/**
 * Pure derivation of the app allow-list from a hostname.
 *
 * Symmetric to `deriveAdminOrigins`: the app is the base host itself, and the
 * admin sibling is included so the two lists overlap only where they should.
 */
export function deriveAppOrigins(hostname: string, protocol: string, host: string): string[] {
  const base = baseHost(hostname);
  const origins: string[] = [];
  if (base.includes('.')) {
    origins.push(`${protocol}//${base}`);
    origins.push(`${protocol}//admin.${base}`);
  }
  // When actually hosted on `admin.`, the `host` (which carries any port) is
  // the only source that can be stripped reliably.
  if (hostname.startsWith('admin.') && host) {
    origins.push(`${protocol}//${host.slice('admin.'.length)}`);
  }
  return origins;
}

/**
 * Origins allowed to DRIVE the app — the control centre only.
 *
 * The production admin origin comes from `VITE_ADMIN_URL` when present, and the
 * loopback origins are included so the whole flow is testable in local dev on
 * any port. Deriving rather than hard-coding means a staging deployment works
 * without a code change, and a forgotten localhost is harmless in production
 * because `location.origin` will simply not match.
 *
 * ── WHY THE APP ORIGIN IS NOT IN HERE ─────────────────────────────────────
 * This is the set the LEARNER APP checks incoming commands against
 * (`useQaBridge`). It must contain admin origins and nothing else. An earlier
 * version also added the app's own parent domain on the grounds that both apps
 * are "ours" — but that made the gate a no-op: an XSS in the learner app is
 * same-origin with the list it is being tested against, so gate 2 stopped
 * nothing and only the per-message `is_active_admin()` re-read stood between a
 * compromised app and the QA channel.
 *
 * On the `admin.` subdomain the two origins are genuinely distinct, so the
 * separation is real and worth keeping: the control centre is the only thing
 * that may change what the app displays.
 *
 * See `trustedAppOrigins()` for the mirror set, which the control centre uses
 * to validate REPLIES arriving from the app.
 */
export function trustedAdminOrigins(): readonly string[] {
  const configured = readEnv('VITE_ADMIN_URL');
  const origins = new Set<string>(['http://localhost:5173']);

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    // Any Vite dev port, so `npm run dev -- --port 4173` still works.
    origins.add(window.location.origin);
  }

  if (typeof configured === 'string' && configured.trim() !== '') {
    try {
      origins.add(new URL(configured).origin);
    } catch {
      // A malformed VITE_ADMIN_URL must not disable the feature outright; the
      // sibling-subdomain fallback in the receiver covers the normal case.
    }
  }

  // `admin.merodeutsch…` sits next to `merodeutsch…`, so the control-centre
  // origin is the host's own parent domain with an `admin.` label. Derived at
  // runtime so it works in dev and on any sibling deployment with no config.
  if (typeof window !== 'undefined') {
    for (const o of deriveAdminOrigins(window.location.hostname, window.location.protocol)) {
      origins.add(o);
    }
  }

  return Array.from(origins);
}

/**
 * Origins the CONTROL CENTRE accepts replies from — the app, not itself.
 *
 * This is a separate list on purpose. `useQaController` receives `qa:ready` and
 * `qa:denied` from the app tab, so it must be able to trust the APP origin;
 * folding that into `trustedAdminOrigins()` is what previously made the learner
 * app a trusted admin, and it is why the two sets are split here rather than
 * checked with one predicate.
 */
export function trustedAppOrigins(): readonly string[] {
  const configured = readEnv('VITE_APP_URL');
  const origins = new Set<string>(['http://localhost:5173']);

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    origins.add(window.location.origin);
  }

  if (typeof configured === 'string' && configured.trim() !== '') {
    try {
      origins.add(new URL(configured).origin);
    } catch {
      // Malformed VITE_APP_URL: the sibling derivation below still covers the
      // normal deployment.
    }
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname, host } = window.location;
    for (const o of deriveAppOrigins(hostname, protocol, host)) {
      origins.add(o);
    }
  }

  return Array.from(origins);
}

/** True when a message from `origin` may be trusted as the control center. */
export function isTrustedAdminOrigin(origin: string): boolean {
  return trustedAdminOrigins().includes(origin);
}

/** True when a reply from `origin` may be trusted as coming from the app. */
export function isTrustedAppOrigin(origin: string): boolean {
  return trustedAppOrigins().includes(origin);
}

/** `import.meta.env` is a Vite injection and is absent under bare `tsx`. */
function readEnv(key: string): string | undefined {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const value = env?.[key];
  return typeof value === 'string' ? value : undefined;
}

/** True when the URL carries `?qa`, i.e. this tab was opened by the control center. */
export function isQaTab(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has(QA_PARAM);
}

/**
 * Runtime shape guard for anything arriving on `message`.
 *
 * `event.data` is attacker-controlled by definition, so it is validated
 * structurally before any field is read. A message that does not match is
 * discarded silently — the app has no reason to log a rejected probe.
 */
export function parseQaMessage(data: unknown): QaMessage | null {
  // A hostile sender can attach a throwing getter, so even the property reads
  // below are untrusted — `Object.create` with a `type` getter that throws is
  // enough to take down a naive parser. Everything is therefore read inside one
  // try/catch, and any throw is treated exactly like a malformed message.
  try {
    if (typeof data !== 'object' || data === null) return null;
    const candidate = data as {
      type?: unknown;
      mode?: unknown;
      path?: unknown;
      at?: unknown;
      reason?: unknown;
    };
    return parseFields(candidate);
  } catch {
    return null;
  }
}

/** The actual field checks, separated so `parseQaMessage` can guard the reads. */
function parseFields(candidate: {
  type?: unknown;
  mode?: unknown;
  path?: unknown;
  at?: unknown;
  reason?: unknown;
}): QaMessage | null {
  if (candidate.type === 'qa:set-mode') {
    // Re-use the strict mode parser rather than trusting the shape check alone.
    if (candidate.mode !== 'real' && candidate.mode !== 'guest' && candidate.mode !== 'free' && candidate.mode !== 'premium') {
      return null;
    }
    return { type: 'qa:set-mode', mode: candidate.mode };
  }

  if (candidate.type === 'qa:ping') {
    return { type: 'qa:ping' };
  }

  if (candidate.type === 'qa:ready' && typeof candidate.path === 'string') {
    return {
      type: 'qa:ready',
      mode: candidate.mode === 'real' || candidate.mode === 'guest' || candidate.mode === 'free' || candidate.mode === 'premium' ? candidate.mode : 'real',
      path: candidate.path,
      at: typeof candidate.at === 'number' ? candidate.at : 0,
    };
  }

  if (candidate.type === 'qa:denied' && typeof candidate.reason === 'string') {
    return { type: 'qa:denied', reason: candidate.reason };
  }

  return null;
}
