import { useCallback, useEffect, useState } from 'react';

export interface MilestoneToast {
  message: string;
  icon?: string;
}

const AUTO_DISMISS_MS = 4000;

/**
 * Non-blocking milestone toast — GLOBAL single-instance store.
 *
 * Every consumer (Layout, DashboardPage, …) shares ONE toast state, so all
 * `showToast` calls funnel into the single fixed z-[60] viewport rendered by
 * <Layout>. Pages call `showToast` and render nothing themselves — no more
 * duplicated inline banners (UI-clutter fix: one toast system sitewide).
 *
 * Stable identities are critical: Layout's level-up effect depends on
 * showToast, and an unstable identity would re-run that effect every
 * render -> setLevelUpCallback -> re-render -> infinite update loop.
 */

type Listener = (toast: MilestoneToast | null) => void;

let currentToast: MilestoneToast | null = null;
let autoDismissTimer: number | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener(currentToast);
}

function clearTimer(): void {
  if (autoDismissTimer !== null) {
    window.clearTimeout(autoDismissTimer);
    autoDismissTimer = null;
  }
}

export function useMilestoneToast() {
  const [toast, setToast] = useState<MilestoneToast | null>(currentToast);

  useEffect(() => {
    listeners.add(setToast);
    return () => {
      listeners.delete(setToast);
    };
  }, []);

  const showToast = useCallback((next: MilestoneToast) => {
    currentToast = next;
    clearTimer();
    autoDismissTimer = window.setTimeout(() => {
      currentToast = null;
      notify();
    }, AUTO_DISMISS_MS);
    notify();
  }, []);

  const dismissToast = useCallback(() => {
    clearTimer();
    currentToast = null;
    notify();
  }, []);

  return { toast, showToast, dismissToast };
}