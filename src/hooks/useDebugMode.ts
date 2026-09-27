/**
 * src/hooks/useDebugMode.ts
 *
 * Read the active simulation mode, and stay in sync with changes — including
 * changes made in another tab of this origin.
 *
 * ── WHY THIS EXISTS SEPARATE FROM `useDebugAccess` ─────────────────────────
 * `useDebugAccess` answers "may this visitor USE the simulator?", which needs a
 * `profiles.role` read. That is the correct gate for a CONTROL (the navbar
 * switcher, the Settings entry).
 *
 * It is the WRONG gate for a WARNING (the banner). The banner exists to tell
 * someone that what they are looking at is simulated, and to offer an exit. That
 * is a usability affordance for whoever is on screen, not a permission check.
 *
 * Gating it on the role is actively self-defeating, and was a real bug: in guest
 * mode `useAuth` reports `user: null`, so the role cannot be read, so the banner
 * that explained the apparently-broken app would itself be hidden. The result
 * was an app that looked permanently signed out with no way out.
 *
 * This hook reads localStorage only — no network request, no permission notion,
 * and therefore no way to deadlock the screen it exists to explain. Safety
 * warnings must not depend on the thing they are warning about.
 */
import { useEffect, useState } from 'react';
import { getDebugMode, subscribeDebugMode, type DebugMode } from '../lib/debugMode';

export interface DebugModeState {
  /** The active simulation mode; `real` when nothing is overridden. */
  mode: DebugMode;
  /** True when anything is being simulated. */
  isSimulating: boolean;
}

export function useDebugMode(): DebugModeState {
  const [mode, setMode] = useState<DebugMode>(() => getDebugMode());

  useEffect(() => {
    // Re-read on mount: the initialiser only runs once, and another tab may have
    // changed the mode while this component was unmounted.
    setMode(getDebugMode());

    const sync = () => setMode(getDebugMode());
    const unsubscribe = subscribeDebugMode(sync);
    window.addEventListener('storage', sync);
    window.addEventListener('mero-debug-mode', sync);
    return () => {
      unsubscribe();
      window.removeEventListener('storage', sync);
      window.removeEventListener('mero-debug-mode', sync);
    };
  }, []);

  return { mode, isSimulating: mode !== 'real' };
}
