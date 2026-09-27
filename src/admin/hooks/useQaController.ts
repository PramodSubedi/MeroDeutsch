/**
 * src/admin/hooks/useQaController.ts
 *
 * Control-center side of the QA bridge: owns the handle to the ONE app tab and
 * re-dresses it without opening new ones.
 *
 * ── WHY THE HANDLE LIVES IN MEMORY, NOT STORAGE ────────────────────────────
 * A `Window` reference cannot be serialized. There is also no cross-origin way
 * to rediscover an already-open tab after a page reload: `BroadcastChannel` and
 * `localStorage` are both origin-scoped, so the two apps cannot see each other's
 * tabs. The consequence is stated plainly in the UI — reloading the control
 * center forgets the tab, and "Open app" opens a fresh one.
 *
 * ── WHY A HANDLE SURVIVES NAVIGATION ───────────────────────────────────────
 * The handle is to the TAB, not to a document. The admin can browse the app
 * freely inside it and every subsequent `postMessage` still lands, because the
 * receiving document is replaced but the browsing context is the same object.
 * That property is the whole reason this design beats opening a tab per mode.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DebugMode } from '../../lib/debugMode';
import { QA_PARAM, isTrustedAppOrigin, parseQaMessage, type QaCommand } from '../../lib/qaBridge';
import { resolveAppUrl } from '../../lib/debugModeLink';

/** Remembered across control-center reloads (this origin only). */
const MODE_KEY = 'meroDeutschAdminQaMode';

function coerce(raw: string | null): DebugMode {
  return raw === 'guest' || raw === 'free' || raw === 'premium' ? raw : 'real';
}

function readStoredMode(): DebugMode {
  try {
    return coerce(window.localStorage.getItem(MODE_KEY));
  } catch {
    return 'real';
  }
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export interface QaStatus {
  /** The mode the control center believes the tab is wearing. */
  mode: DebugMode;
  /** Path the tab last reported, e.g. `/learn`. */
  path: string | null;
  /** True once the tab has acknowledged a message. */
  connected: boolean;
  /** Set when the app refused (e.g. the admin session was revoked). */
  denied: string | null;
  openApp: (mode?: DebugMode) => void;
  setMode: (mode: DebugMode) => void;
  /** Focus the existing tab and re-sync, or open one if it is gone. */
  reconnect: () => void;
  /** True when a handle exists but the tab was closed by the user. */
  tabClosed: boolean;
}

/**
 * Where to reopen the app.
 *
 * Reopening at `/` used to throw away the admin's place: closing the tab while
 * reviewing `/lesson/3/notes` and re-opening it dumped them back on the
 * homepage, which is both disorienting and slow to re-navigate. The app reports
 * its location on every acknowledgement, so the last known path is remembered
 * here and reused.
 *
 * The rule — including its protocol-relative `//evil.com` guard, which matters
 * because this value arrives over postMessage from another origin — is defined
 * once in `DebugPage` and imported here, so the safety check cannot drift
 * between the two call sites.
 */
import { reopenPathFor } from '../pages/DebugPage';

export function useQaController(): QaStatus {
  const [mode, setModeState] = useState<DebugMode>(() => readStoredMode());
  const [path, setPath] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [denied, setDenied] = useState<string | null>(null);
  const [tabClosed, setTabClosed] = useState(false);

  const winRef = useRef<Window | null>(null);
  // Refs, not state: the listener is registered once and must always see the
  // CURRENT values, or a stale closure would keep trusting a revoked session.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  // The app's last reported location, used to reopen the tab where the admin
  // left off. Ref (not state) so `openApp` can read it without re-binding.
  const pathRef = useRef<string | null>(null);

  /** Push a mode to the open tab, addressed to the app's exact origin. */
  const send = useCallback((next: DebugMode) => {
    const win = winRef.current;
    const appUrl = resolveAppUrl();
    // Exact target origin, derived from the app URL. NEVER '*' — a wildcard
    // would hand the command to whatever page holds the handle.
    const targetOrigin = appUrl ? safeOrigin(appUrl) : null;
    if (!win || win.closed || !targetOrigin) return;

    setModeState(next);
    setConnected(false); // cleared until the app acknowledges
    const command: QaCommand = { type: 'qa:set-mode', mode: next };
    try {
      win.postMessage(command, targetOrigin);
    } catch {
      setConnected(false);
    }
  }, []);

  // Listen for the app's acknowledgements.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Gate on the APP allow-list, not the admin one. Incoming messages here are
      // `qa:ready` / `qa:denied` REPLIES from the app tab, so the origin to
      // authorize is the app's. Checking it against the admin list would have
      // been correct only while that list also contained the app origin, which is
      // exactly the conflation that let the learner app drive the QA channel.
      if (!isTrustedAppOrigin(event.origin)) return;
      // Only accept a reply that came from the APP origin, not from another
      // trusted admin page open in a different tab.
      const appUrl = resolveAppUrl();
      if (appUrl) {
        const origin = safeOrigin(appUrl);
        if (origin && origin !== event.origin) return;
      }

      const message = parseQaMessage(event.data);
      if (!message) return;
      if (message.type === 'qa:ready') {
        setModeState(message.mode);
        setPath(message.path);
        // Remembered for the next `openApp` so the tab reopens here rather than
        // on the homepage.
        pathRef.current = message.path;
        setConnected(true);
        setDenied(null);
        setTabClosed(false);
      } else if (message.type === 'qa:denied') {
        setConnected(false);
        setDenied(message.reason);
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Poll the handle so a tab closed by the user is reflected, instead of the
  // navbar silently claiming a connection that no longer exists.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (winRef.current && winRef.current.closed) {
        setTabClosed(true);
        setConnected(false);
        winRef.current = null;
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, []);

  const persist = useCallback((next: DebugMode) => {
    try {
      window.localStorage.setItem(MODE_KEY, next);
    } catch {
      // Non-fatal: the navbar falls back to in-memory state.
    }
  }, []);

  /** Open the app in a tab marked QA-controlled, or focus the existing one. */
  const openApp = useCallback(
    (requested?: DebugMode) => {
      const next = requested ?? modeRef.current;
      persist(next);
      setModeState(next);

      if (winRef.current && !winRef.current.closed) {
        winRef.current.focus();
        send(next);
        return;
      }

      setConnected(false);
      setDenied(null);
      setTabClosed(false);
      const appUrl = resolveAppUrl();
      // Reopen WHERE THE ADMIN LEFT OFF, not on the homepage. The mode travels in
      // the query string; the path is whatever the app last reported.
      const target = `${appUrl}${reopenPathFor(pathRef.current)}?${QA_PARAM}=1&adminmode=${next}`;
      const opened = window.open(target, 'mero-qa-app');
      winRef.current = opened;
      if (!opened) {
        // Popup blocked. Say so rather than leaving the admin thinking it opened.
        setDenied('popup blocked — allow popups for this site');
      }
    },
    [persist, send]
  );

  const setMode = useCallback(
    (next: DebugMode) => {
      persist(next);
      // If a tab is already open, drive it; otherwise just record the choice so
      // "Open app" opens in the right mode.
      if (winRef.current && !winRef.current.closed) {
        send(next);
      } else {
        setModeState(next);
      }
    },
    [persist, send]
  );

  const reconnect = useCallback(() => {
    if (winRef.current && !winRef.current.closed) {
      const appUrl = resolveAppUrl();
      const targetOrigin = appUrl ? safeOrigin(appUrl) : null;
      if (targetOrigin) {
        const ping: QaCommand = { type: 'qa:ping' };
        try {
          winRef.current.postMessage(ping, targetOrigin);
        } catch {
          /* the tab is gone; the interval will clear the handle */
        }
      }
      winRef.current.focus();
    } else {
      openApp();
    }
  }, [openApp]);

  return { mode, path, connected, denied, openApp, setMode, reconnect, tabClosed };
}
