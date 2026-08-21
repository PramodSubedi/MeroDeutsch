import { useCallback, useEffect, useRef, useState } from 'react';

export interface MilestoneToast {
  message: string;
  icon?: string;
}

const AUTO_DISMISS_MS = 4000;

/**
 * Non-blocking milestone toast. Shows a small banner with CSS animation,
 * auto-dismisses after a few seconds. No heavy libraries.
 */
export function useMilestoneToast() {
  const [toast, setToast] = useState<MilestoneToast | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  // Stable identities are critical: Layout's level-up effect depends on
  // showToast, and an unstable identity would re-run that effect every
  // render -> setLevelUpCallback -> re-render -> infinite update loop.
  const showToast = useCallback((next: MilestoneToast) => {
    setToast(next);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setToast(null), AUTO_DISMISS_MS);
  }, []);

  const dismissToast = useCallback(() => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    setToast(null);
  }, []);

  return { toast, showToast, dismissToast };
}