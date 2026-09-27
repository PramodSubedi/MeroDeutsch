/**
 * src/hooks/useQaBridge.ts
 *
 * App side of the QA bridge: listens for mode changes from the control center and
 * applies them to THIS tab, then acknowledges.
 *
 * ── WHAT THIS LISTENER CAN DO ──────────────────────────────────────────────
 * Exactly one thing: call `setDebugMode`. That is a localStorage write that
 * changes what this browser renders. There is no code path here that writes to
 * Supabase, changes a role, grants a plan, or touches another user's data — the
 * surface is intentionally that narrow.
 *
 * ── WHY EVERY MESSAGE IS RE-AUTHORIZED ─────────────────────────────────────
 * `isTrustedAdminOrigin()` alone would trust any page on the admin origin for
 * the lifetime of the tab. The role is therefore re-read on EVERY message
 * rather than cached at mount: if the admin session is revoked or the tab is
 * left open overnight, the channel closes the moment that happens instead of
 * staying live.
 *
 * ── WHY DENIAL IS SILENT TO THE APP ────────────────────────────────────────
 * A rejected message produces no visible effect and only a `qa:denied` reply
 * back to the sender. The app is not a logging surface for other people's
 * probes; the audit trail that matters lives in `admin_audit_log`.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useDebugAccess } from './useDebugAccess';
import { getDebugMode, setDebugMode, type DebugMode } from '../lib/debugMode';
import { isQaTab, isTrustedAdminOrigin, parseQaMessage, type QaCommand } from '../lib/qaBridge';

export function useQaBridge(): void {
  const { isAdmin, isLoading } = useDebugAccess({ lazy: false });
  // Refs, not state: the listener is registered once and must always see the
  // CURRENT role, or a stale closure would keep trusting a revoked session.
  const adminRef = useRef(isAdmin);
  const loadingRef = useRef(isLoading);
  // A command received while authorization was still in flight. Dropping it
  // silently made the admin's FIRST click after opening the app do nothing,
  // which is exactly the click they would try first.
  const pendingRef = useRef<QaCommand | null>(null);

  useEffect(() => {
    adminRef.current = isAdmin;
    loadingRef.current = isLoading;
  }, [isAdmin, isLoading]);

  /**
   * Reply to whoever asked, addressed to the exact origin they came from.
   *
   * ⚠️ THE TARGET IS `opener`, NOT `parent` — the app runs in a TAB opened with
   * `window.open`, not in an iframe. In a top-level tab `window.parent === window`,
   * so posting to `parent` sent every acknowledgement straight back to the app
   * itself and the control centre's status dot could never light up. The
   * `parent !== window` branch is kept for the framed case so the bridge still
   * works if the app is ever embedded.
   *
   * Declared BEFORE `handleCommand`, which closes over it.
   */
  const reply = useCallback((payload: unknown, to: string) => {
    if (to === 'null' || to === '') return; // opaque origin (sandboxed/file:)
    const target = window.parent !== window ? window.parent : window.opener;
    // No opener means the control centre is gone; there is nobody to tell.
    if (!target || target === window) return;
    try {
      target.postMessage(payload, to);
    } catch {
      // A refused postMessage is not worth surfacing to a learner.
    }
  }, []);

  /**
   * Apply one authorized command and acknowledge it. Shared by the live message
   * path and the deferred one, so a replayed command behaves identically to a
   * fresh one.
   */
  const handleCommand = useCallback(
    (message: QaCommand, to: string) => {
      if (message.type === 'qa:ping') {
        reply(
          { type: 'qa:ready', mode: getDebugMode(), path: window.location.pathname, at: Date.now() },
          to
        );
        return;
      }
      // `qa:set-mode`
      setDebugMode(message.mode);
      // Ack AFTER applying, so the navbar's "connected" dot always means the
      // app is actually showing the requested mode.
      reply(
        { type: 'qa:ready', mode: message.mode, path: window.location.pathname, at: Date.now() },
        to
      );
    },
    [reply]
  );

  useEffect(() => {
    // Only tabs the control center actually opened participate. A tab a human
    // navigated to by hand must never accept remote mode changes, even from the
    // admin origin — otherwise "open the app normally, then let the admin drive
    // it" would be possible without the admin's involvement.
    if (!isQaTab()) return;

    function onMessage(event: MessageEvent) {
      if (!isTrustedAdminOrigin(event.origin)) return;
      const message = parseQaMessage(event.data);
      if (!message) return;

      // Only COMMANDS are ever executed. A `qa:ready`/`qa:denied` REPLY arriving
      // from the control centre is not an instruction and must be ignored — the
      // union type keeps that distinction explicit, and the check has to happen
      // BEFORE the pending/deferred paths so a reply can never be queued and
      // later replayed as though the control centre had commanded it.
      if (message.type === 'qa:ready' || message.type === 'qa:denied') return;

      // While the role read is in flight we cannot authorize anything — but we
      // must NOT silently drop the command, because the control centre would
      // then sit there "not connected" with no explanation, and the admin's
      // first click after opening the app (which is exactly when the read is
      // still running) would do nothing.
      //
      // So: hold the command and apply it the moment authorization lands.
      if (loadingRef.current) {
        pendingRef.current = message;
        return;
      }

      if (!adminRef.current) {
        reply({ type: 'qa:denied', reason: 'not an admin' }, event.origin);
        return;
      }

      handleCommand(message, event.origin);
    }

    window.addEventListener('message', onMessage);
    // Tell the opener we are alive and already wearing some mode, so the navbar
    // can render correct state without waiting for the first toggle.
    if (window.opener && window.opener !== window) {
      const openerOrigin = safeOriginOf(window.opener);
      if (openerOrigin && isTrustedAdminOrigin(openerOrigin)) {
        reply(
          { type: 'qa:ready', mode: getDebugMode(), path: window.location.pathname, at: Date.now() },
          openerOrigin
        );
      }
    }
    return () => window.removeEventListener('message', onMessage);
  }, [reply, handleCommand]);

  // Drain a command that arrived while the role read was still running. Kept as
  // a separate effect so it fires on the SAME render where authorization
  // settles, rather than waiting for the next unrelated state change.
  useEffect(() => {
    if (isLoading || !isAdmin) return;
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;

    const openerOrigin = window.opener && window.opener !== window ? safeOriginOf(window.opener) : null;
    if (openerOrigin && isTrustedAdminOrigin(openerOrigin)) {
      handleCommand(pending, openerOrigin);
    }
  }, [isAdmin, isLoading, handleCommand]);
}

/** Read `origin` off a cross-origin handle without throwing. */
function safeOriginOf(handle: Window): string | null {
  try {
    return handle.origin;
  } catch {
    return null;
  }
}

export type { DebugMode };
