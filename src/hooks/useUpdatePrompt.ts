/**
 * src/hooks/useUpdatePrompt.ts
 *
 * Service-worker update lifecycle, exposed to React.
 *
 * WHY THIS EXISTS
 * ───────────────
 * `registerSW` is called in main.tsx, OUTSIDE React, because the admin entry
 * must never register it. That leaves no component able to receive the
 * `onNeedRefresh` callback. This module is the bridge: main.tsx pushes the
 * update function into a module-level slot, and `useUpdatePrompt` — mounted
 * once by Layout — subscribes to it and renders the offer.
 *
 * WHY THE OFFER IS A TOAST AND NOT A MODAL
 * ─────────────────────────────────────────
 * A modal is the obvious choice for "reload the app" and it is the wrong one.
 * A deploy can land while a learner is halfway through a checkpoint, and a modal
 * would either block that attempt or be dismissed without being read. A toast is
 * non-blocking, so the learner can finish the question first and take the update
 * when they are at a natural pause. It rides the existing global toast store, so
 * it cannot collide with a level-up or milestone toast — one toast, sitewide.
 *
 * The update is OFFERED, never forced. There is no timer that applies it and no
 * auto-reload. A learner who never taps it keeps using the build they have,
 * which is strictly better than the previous silent mid-answer reload.
 */
import { useCallback, useEffect, useState } from 'react';

type UpdateFn = (reloadPage?: boolean) => Promise<void>;

let pendingUpdate: UpdateFn | null = null;

type Listener = (update: UpdateFn | null) => void;
const listeners = new Set<Listener>();

/**
 * Hand the app a way to activate a waiting worker. Called from main.tsx.
 * Idempotent: a later registration replaces an earlier one.
 */
export function setUpdateAvailable(update: UpdateFn): void {
  pendingUpdate = update;
  for (const listener of listeners) listener(pendingUpdate);
}

/** True once a new build is staged and the learner has been told. */
export function useUpdatePrompt() {
  const [update, setUpdate] = useState<UpdateFn | null>(pendingUpdate);

  useEffect(() => {
    listeners.add(setUpdate);
    // A new build may have finished installing between module init and this
    // effect running, so seed from the module slot rather than assuming null.
    setUpdate(pendingUpdate);
    return () => {
      listeners.delete(setUpdate);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    const run = pendingUpdate;
    if (!run) return;
    // Clearing first means a second tap cannot fire two reloads, and the UI can
    // unmount the toast immediately rather than waiting for the page to die.
    pendingUpdate = null;
    for (const listener of listeners) listener(null);
    void run(true);
  }, []);

  const dismissUpdate = useCallback(() => {
    // Dismissed WITHOUT applying. The worker stays waiting; the next reload
    // (whichever the learner triggers) will pick it up. Nothing is lost — the
    // staged build is already on disk.
    pendingUpdate = null;
    for (const listener of listeners) listener(null);
  }, []);

  return { hasUpdate: update !== null, applyUpdate, dismissUpdate };
}
