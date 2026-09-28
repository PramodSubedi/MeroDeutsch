/**
 * src/components/ScrollReset.tsx
 *
 * WHY THIS EXISTS
 * ───────────────
 * Navigating from a long page to a new route left the window at the previous
 * scroll offset, so a learner tapped "Practice" halfway down a lesson and landed
 * halfway down Practice — with the top of the page (and its heading) off-screen
 * above them. Nothing was broken; it just read as a webpage, where scroll
 * position leaking across navigations is expected. Apps start every screen at
 * the top, and that single behaviour is a large part of why they feel like apps.
 *
 * WHY NOT <ScrollRestoration>
 * ──────────────────────────
 * React Router's built-in restoration only works under a DATA router
 * (createBrowserRouter). This app uses <BrowserRouter> + <Routes> (App.tsx), so
 * that component is not available and this is a hand-rolled equivalent. If the
 * app ever migrates to a data router, delete this and use the real thing rather
 * than running both.
 *
 * WHY THE SEARCH STRING IS EXCLUDED  ← the important rule
 * ────────────────────────────────────────────────────
 * Several screens keep their state in the query string: /practice?skill=…,
 * /roleplay?scenario=…, /vocab-trainer?deck=… . Scrolling to the top on those
 * changes would be actively hostile — the learner changes a filter mid-page and
 * the content they were looking at jumps away. So this only reacts to the PATH.
 *
 * The `key` on <Outlet /> is the companion mechanism: React Router preserves an
 * element's state when the route matches, so navigating between two query
 * strings on the SAME path would otherwise leave the previous page's scroll
 * where it was and reuse stale state. Re-keying by the full location makes that
 * a genuine new screen, which is what the learner expects.
 *
 * Deliberately NOT restoring scroll on BACK. Remembering where the user was
 * before they left is a nicety, but it is also how a learner ends up returned
 * to a checkpoint mid-question. Starting at the top is predictable; the A1 path
 * itself is the resume mechanism (useA1Path / useLastModule).
 *
 * `behavior: 'instant'` is explicit rather than left to default: the default is
 * UA-defined, and a 'smooth' implementation would animate the jump, which reads
 * as a glitch and delays the first paint of the new page.
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollReset() {
  const { pathname } = useLocation();

  // The path this effect last acted on. A ref, not state: this must not cause
  // a re-render, and it must survive StrictMode's double-invoke of effects.
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    // Skip the very first mount. The browser restores the previous offset on a
    // reload, and on a fresh navigation the page is already at the top —
    // scrolling here would fight the browser rather than help it.
    if (lastPath.current === null) {
      lastPath.current = pathname;
      return;
    }
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}
