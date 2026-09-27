/**
 * src/lib/debugMode.ts
 *
 * Identity/tier SIMULATOR for QA — flip the real app between how a guest, a
 * free learner and a premium learner each see it, in the real browser, against
 * the real code.
 *
 * ── WHY THIS IS LOCAL-ONLY, AND WHY THAT IS THE POINT ──────────────────────
 * Everything here is `localStorage`. It NEVER writes to Supabase and never
 * touches `profiles.plan`. That is not a limitation to work around — it is the
 * security model:
 *
 *   · A local override cannot grant anyone real premium. The entitlement truth
 *     is `profiles.plan`, which is guarded by a database trigger
 *     (`protect_profile_plan`) so a client cannot write its own plan.
 *   · If the simulator wrote to the database to be "more realistic", it would
 *     have to hold a service-role key in a browser bundle. That is a far larger
 *     prize for an XSS bug than a QA toggle ever needs to be.
 *
 * So: simulate the VIEW, never the ACCOUNT. `real` is the only mode that reads
 * or writes anything as the signed-in user.
 *
 * ── WHY GUEST IS THE INTERESTING MODE ──────────────────────────────────────
 * `usePremium` already had a documented free/premium override, so those two
 * modes were mostly plumbing. Guest was not: nothing in the app could pretend
 * to be signed out. `guest` is the highest-value QA mode because it exercises
 * an entire class of branch — `AppHomeSwitch`, `RootRedirect`, nav gating,
 * guest-scoped storage (`scopedKey(..., 'guest')`) — that is otherwise very easy
 * to break and never notice until a real visitor hits it.
 *
 * ── CROSS-TAB / CROSS-MODE COHERENCE ───────────────────────────────────────
 * State lives in localStorage but React needs to re-render, so this module
 * keeps a tiny in-process subscription set plus a `storage` listener. The
 * listener is what makes two open tabs of the same app agree instead of one
 * silently showing a stale mode.
 */

import { getItem, removeItem, setItem } from '../utils/safeStorage';

export type DebugMode = 'real' | 'guest' | 'free' | 'premium';

export const DEBUG_MODES: readonly DebugMode[] = ['real', 'guest', 'free', 'premium'];

/**
 * Deliberately NOT `scopedKey`-suffixed: this is a device-level QA switch for
 * whoever is signed in, not per-user progress. A per-user key would make the
 * simulator "sticky" to whichever account was used first, which is exactly the
 * confusion a monitoring tool must not have.
 */
const MODE_KEY = 'meroDeutschDebugMode';

/** The premium override `usePremium` has always read. Shared, not duplicated. */
export const PREMIUM_OVERRIDE_KEY = 'germanPremiumOverride';

const MODE_LABELS: Record<DebugMode, { label: string; blurb: string }> = {
  real: { label: 'Real', blurb: 'Your actual account and plan. Nothing simulated.' },
  guest: { label: 'Guest', blurb: 'Signed out. Guest Home, marketing landing, guest-scoped data.' },
  free: { label: 'Free', blurb: 'Signed in on the free tier. Roadmap, no A1 campaign.' },
  premium: { label: 'Premium', blurb: 'Signed in with premium. Full A1 campaign unlocked.' },
};

export function debugModeLabel(mode: DebugMode): string {
  return MODE_LABELS[mode].label;
}

export function debugModeBlurb(mode: DebugMode): string {
  return MODE_LABELS[mode].blurb;
}

function coerce(raw: string | null): DebugMode {
  return raw === 'guest' || raw === 'free' || raw === 'premium' ? raw : 'real';
}

/** Current stored mode. Unknown/legacy values degrade to `real`, never throw. */
export function getDebugMode(): DebugMode {
  return coerce(getItem(MODE_KEY));
}

type Listener = (mode: DebugMode) => void;
const listeners = new Set<Listener>();

function emit(mode: DebugMode): void {
  for (const listener of listeners) {
    try {
      listener(mode);
    } catch {
      // A broken subscriber must not prevent the others from updating, and must
      // certainly not leave the mode half-applied.
    }
  }
}

export function subscribeDebugMode(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Apply a mode, keeping the two storage keys that the app actually reads in
 * sync (`meroDeutschDebugMode` here, `germanPremiumOverride` in `usePremium`).
 *
 * Writing both means neither hook needs to know this module exists — the tier
 * override keeps working exactly as it did before, including for anyone using
 * it without the simulator.
 */
export function setDebugMode(mode: DebugMode): void {
  if (mode === 'real') {
    removeItem(MODE_KEY);
    removeItem(PREMIUM_OVERRIDE_KEY);
  } else {
    setItem(MODE_KEY, mode);
    // `guest` deliberately writes no premium override: with no account there is
    // no tier to force, and `usePremium` already resolves a null userId to
    // 'free'. Writing one here would be a lie about a signed-out visitor.
    if (mode === 'free') setItem(PREMIUM_OVERRIDE_KEY, 'free');
    else if (mode === 'premium') setItem(PREMIUM_OVERRIDE_KEY, 'premium');
    else removeItem(PREMIUM_OVERRIDE_KEY);
  }

  if (typeof window !== 'undefined') {
    // Same-tab subscribers (React) plus other tabs of this origin.
    window.dispatchEvent(new Event('mero-debug-mode'));
  }
  emit(coerce(getItem(MODE_KEY)));
}

/** True when anything is being simulated — drives the "not production" banner. */
export function isSimulating(): boolean {
  return getDebugMode() !== 'real';
}
