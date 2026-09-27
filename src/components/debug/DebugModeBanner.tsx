/**
 * src/components/debug/DebugModeBanner.tsx
 *
 * Persistent "you are not looking at production" strip.
 *
 * WHY A BANNER RATHER THAN JUST A SETTINGS TOGGLE
 * A simulator that is only visible on one page is easy to leave switched on and
 * then misread: an admin checks a guest flow, navigates away, and later reports
 * "guests can't see the A1 spine" — when in fact they were looking at their own
 * premium account. This strip follows the user through the WHOLE app, so a
 * simulated state is impossible to forget about.
 *
 * It is deliberately loud and dismiss-free. "Exit" is one click and is always
 * offered; a dismissable warning would be a warning nobody sees.
 *
 * z-index: sits above page content but below the app's own overlays, matching
 * `theme.layout.header`'s z-50 band. It is `sticky top-0`, and the header it
 * sits under is also `sticky top-0`, so the two stack rather than overlap.
 */
import { useDebugMode } from '../../hooks/useDebugMode';
import { setDebugMode, debugModeLabel } from '../../lib/debugMode';

export function DebugModeBanner() {
  // ⚠️ DELIBERATELY NOT GATED ON `isAdmin` — this was a real bug.
  //
  // The banner used to require `isAdmin`, reasoning that only admins can set a
  // mode. But in GUEST mode `useAuth` reports `user: null`, so `useDebugAccess`
  // cannot resolve a role and `isAdmin` is false — which meant the banner
  // vanished in precisely the mode where an admin most needs it. The result was
  // an app that looked permanently signed out, with no warning and no visible
  // way to exit, i.e. "login is broken".
  //
  // The correction: the banner's job is to warn WHOEVER IS LOOKING AT THE
  // SCREEN, and to offer a one-click exit. A non-admin can never set a mode, so
  // the banner is invisible to them by definition — `isSimulating` alone is the
  // correct condition, and it is the one that cannot deadlock.
  //
  // It also reads no role over the network: `getDebugMode()` is a pure
  // localStorage read, so this costs a signed-in learner nothing.
  const { mode, isSimulating } = useDebugMode();

  if (!isSimulating) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex min-h-[44px] flex-wrap items-center justify-center gap-3 bg-warning-600 px-4 py-2 text-center text-meta font-bold text-white"
    >
      <span>
        Simulating the <strong>{debugModeLabel(mode)}</strong> experience — this is not your real
        account, and sign-in will not appear to work.
      </span>
      <button
        type="button"
        onClick={() => setDebugMode('real')}
        className="shrink-0 rounded-full bg-white/20 px-3 py-1 text-micro font-extrabold uppercase tracking-wide text-white transition hover:bg-white/30"
      >
        Exit
      </button>
    </div>
  );
}
