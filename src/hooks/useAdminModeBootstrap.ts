/**
 * src/hooks/useAdminModeBootstrap.ts
 *
 * Applies `?adminmode=<mode>` handed over by the control center, once, on boot.
 *
 * ── WHY THE LEARNER APP HAS TO DO THIS ITSELF ──────────────────────────────
 * The control centre lives on a different ORIGIN, so it cannot write this
 * origin's localStorage. It therefore hands the mode over in the URL and lets
 * the app that owns the storage apply it. See `src/lib/debugModeLink.ts` for
 * the full reasoning.
 *
 * ── WHY THE ROLE CHECK CANNOT BE SKIPPED ───────────────────────────────────
 * Without verification, `?adminmode=premium` would be a link any visitor could
 * paste to unlock premium UI. The check is therefore:
 *   · performed HERE, in the app that owns the data, not in the admin app that
 *     asked for it;
 *   · read from `profiles.role` over RLS, so it cannot be forged client-side;
 *   · a non-admin's request is DISCARDED, not downgraded — the parameter is
 *     stripped and nothing is applied.
 *
 * The override that ultimately results is still localStorage-only (see
 * `debugMode.ts`), so even a genuine admin's simulation can never write a real
 * entitlement.
 *
 * ── WHY THE PARAMETER IS STRIPPED ──────────────────────────────────────────
 * Leaving it in place would mean a stale link, a browser Back, or a shared URL
 * silently re-applies a mode long after the admin stopped testing. The mode
 * belongs in storage, not in history. `replaceState` (not `pushState`) so it
 * does not even add an entry to the back stack.
 */
import { useEffect, useRef } from 'react';
import { useDebugAccess } from './useDebugAccess';
import { setDebugMode, type DebugMode } from '../lib/debugMode';
import { ADMIN_MODE_PARAM, parseAdminMode } from '../lib/debugModeLink';

export function useAdminModeBootstrap(): void {
  // `lazy: false`: the role read must not be deferred, or the app would briefly
  // render the real identity before snapping to the simulated one.
  const { isAdmin, isLoading } = useDebugAccess({ lazy: false });

  // ⚠️ CAPTURE, THEN STRIP, THEN APPLY — never strip-and-forget.
  //
  // The bug: `?adminmode=` was deleted from the URL BEFORE the async role check
  // had resolved, and the effect re-ran when `isLoading` flipped with the
  // parameter already gone. `setDebugMode` therefore NEVER ran. "Open app" in
  // premium mode silently opened the real (free) account, and the admin saw the
  // 6-lesson free roadmap — which reads exactly like "premium is broken".
  //
  // The fix: read the parameter ONCE into a ref, then strip it from the URL so
  // a refresh or a shared link cannot replay the request. The ref survives
  // re-renders, so the value is still available when authorization lands.
  const requestedRef = useRef<DebugMode | null>(null);

  // Capture + strip. Runs once, on mount — deliberately NOT keyed on
  // `isAdmin`/`isLoading`, which is what caused the original loss.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const requested = parseAdminMode(params.get(ADMIN_MODE_PARAM));
    if (!requested) return;

    requestedRef.current = requested;

    // Strip unconditionally and immediately. A rejected, unknown or
    // not-yet-authorized value must never linger in the URL, and removing it
    // here is what stops a refresh mid-check from replaying the request.
    params.delete(ADMIN_MODE_PARAM);
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', next);
  }, []);

  // Apply, but only once authorization is settled. Consuming the ref makes this
  // idempotent: a later role change cannot re-apply a stale request.
  useEffect(() => {
    if (isLoading || !isAdmin) return;
    const requested = requestedRef.current;
    if (!requested) return;
    requestedRef.current = null;
    setDebugMode(requested);
  }, [isAdmin, isLoading]);
}
