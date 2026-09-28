/**
 * Lightweight PWA install prompt hook.
 * Captures `beforeinstallprompt` and exposes a `promptInstall` action.
 * Non-blocking — the app works fine without installing.
 *
 * WHY `isStandalone` LIVES HERE
 * ─────────────────────────────
 * This hook already owns "has the app been installed", which until now meant
 * only "did the user accept the prompt THIS session" — true for nobody who
 * arrived from the home screen. That is not the same question: `appinstalled`
 * only fires for the install that happened in the current page view, so an
 * already-installed user relaunching from their icon was being told, in
 * Settings, that they could install. Reading the display mode fixes that and
 * keeps the question in one place instead of open-coding the same three media
 * queries at every call site.
 *
 * ALL THREE FORMS ARE CHECKED, because "installed" means different things:
 *   - `display-mode: standalone` — Android, desktop Chrome/Edge install
 *   - `display-mode: minimal-ui`   — the fallback declared in the manifest
 *   - `navigator.standalone`       — iOS Safari, which has no media query at all
 * Missing the iOS branch is the common bug here: iPhone users are the largest
 * installed cohort for this app and are the one platform that needs it.
 */
import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS first: it exposes no display-mode media query, only this property.
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  if (iosStandalone === true) return true;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches
  );
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(detectStandalone);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setJustInstalled(true);
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    // A user can also install from the browser's own UI (⋮ → Install app),
    // which fires no event we can hear. Matching the change is what makes
    // `isStandalone` trustworthy in the first place, rather than only true for
    // installs this page happened to witness.
    const mqlStandalone = window.matchMedia('(display-mode: standalone)');
    const mqlMinimal = window.matchMedia('(display-mode: minimal-ui)');
    const sync = () => setIsStandalone(detectStandalone());
    mqlStandalone.addEventListener('change', sync);
    mqlMinimal.addEventListener('change', sync);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      mqlStandalone.removeEventListener('change', sync);
      mqlMinimal.removeEventListener('change', sync);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setJustInstalled(true);
      setIsStandalone(true);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return {
    canInstall: Boolean(deferredPrompt) && !isStandalone,
    /** True once installed, whether this page session or an earlier one. */
    isInstalled: justInstalled || isStandalone,
    isStandalone,
    promptInstall,
  };
}