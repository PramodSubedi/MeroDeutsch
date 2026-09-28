/**
 * src/hooks/useAppBadge.ts
 *
 * Mirrors the due-review count onto the installed app's home-screen icon.
 *
 * WHY
 * An installed PWA is, from the home screen, a plain coloured square. The badge
 * is the one piece of OS-level state a web app can still own, and it is the
 * single highest-leverage re-engagement surface in the entire product: the
 * number is already computed and already rendered on the Practice tab, so this
 * costs no extra queries and no new state — it just promotes a number the user
 * can see in-app to one they can see before opening the app.
 *
 * The count is passed in, never re-derived here. BottomNav and this hook must
 * never disagree, and the only way to guarantee that is for both to read the
 * same `dueQueue.length`.
 *
 * SUPPORT AND ITS LIMITS (all handled silently, none of them are failures)
 * ────────────────────────────────────────────────────────────────────────
 * `navigator.setAppBadge` is Chromium-only, and on Android it requires the
 * installed PWA to be launchable — the browser throws a SecurityError for
 * tabbed installs. Safari and Firefox have no implementation at all. So every
 * path here is wrapped and a miss is a no-op: the app must never break because
 * a platform cannot draw a dot on an icon.
 *
 * 0 IS MEANINGFUL, NOT ABSENT
 * `clearAppBadge` is the call for an empty queue, and it is the important one:
 * leaving a stale "12" on the icon after the learner has reviewed everything is
 * worse than showing nothing, because it is a claim the app has stopped
 * honouring. The update is therefore written on every change, including the
 * change back to zero.
 *
 * No permission is requested. Badges are not a promptable permission, and
 * asking for notification permission to draw a dot would be a trade the app
 * should not make.
 *
 * TYPING NOTE: `setAppBadge`/`clearAppBadge` are already declared on `Navigator`
 * via lib.dom's `NavigatorBadge`, so no augmentation interface is needed. They
 * are still absent at RUNTIME on Safari and Firefox, which is what the
 * feature check below is for — TypeScript describes the full platform, not the
 * browser in front of the learner.
 */
import { useEffect } from 'react';

export function useAppBadge(dueCount: number): void {
  useEffect(() => {
    // lib.dom types these as always present; they are not, at runtime, on
    // Safari or Firefox. So the check is real and not a type artefact.
    if (typeof navigator === 'undefined' || typeof navigator.setAppBadge !== 'function') {
      return;
    }

    let cancelled = false;
    const apply = async () => {
      try {
        if (cancelled) return;
        if (dueCount > 0) {
          await navigator.setAppBadge(dueCount);
        } else if (typeof navigator.clearAppBadge === 'function') {
          await navigator.clearAppBadge();
        } else {
          // Some Chromium builds expose only the setter.
          await navigator.setAppBadge(0);
        }
      } catch {
        // Tabbed installs and locked-down browsers reject this. The in-app badge
        // on the Practice tab is the fallback and it always works.
      }
    };

    void apply();
    return () => {
      // A fast sequence of due-count changes can leave an older setAppBadge
      // promise in flight; flagging teardown stops it from resolving into a
      // newer state.
      cancelled = true;
    };
  }, [dueCount]);
}
