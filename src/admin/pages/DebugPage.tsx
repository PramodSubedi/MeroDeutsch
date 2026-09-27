/**
 * src/admin/pages/DebugPage.tsx
 *
 * The QA simulator's home. This is the ONLY place the mode can be changed.
 *
 * ── WHY IT IS HERE AND NOT IN LEARNER SETTINGS ─────────────────────────────
 * Two independent reasons:
 *
 *  1. Authority. The override unlocks premium UI. A control for it has no
 *     business sitting in a page every account can open, even one that
 *     self-gates on `role`.
 *  2. It would not work from the wrong shape anyway. The control centre is a
 *     DIFFERENT ORIGIN, so `setDebugMode()` called in this app writes a key the
 *     learner app never reads. The mode has to travel as a URL
 *     (`?adminmode=`) and be applied by the learner app after IT verifies the
 *     role. That is what `buildModeUrl` produces and
 *     `useAdminModeBootstrap` consumes.
 *
 * So the buttons below are links, not state toggles — each opens the real site
 * in a new tab already wearing the identity being tested.
 */
import { ExternalLink, RotateCcw } from 'lucide-react';
import { theme } from '../../config/theme';
import { buildModeUrl, resolveAppUrl } from '../../lib/debugModeLink';
import { DEBUG_MODES, debugModeLabel, type DebugMode } from '../../lib/debugMode';
import { useAdminAuth } from '../hooks/useAdminAuth';

/**
 * Paths worth checking per mode — where a tier or identity bug would show.
 *
 * `/learn/a1` is THE important one and it is easy to get wrong: `/learn` is the
 * CEFR level GRID (`CefrLevelIndexPage`), not the campaign. The 15-module spine
 * only renders on a level page, so linking to `/learn` and concluding "premium
 * shows no lessons" is a false negative — the tier was right, the URL was wrong.
 */
const MODE_PATHS: Record<DebugMode, string[]> = {
  real: ['/', '/learn', '/dashboard'],
  guest: ['/', '/welcome', '/practice'],
  free: ['/', '/learn/a1', '/settings'],
  premium: ['/', '/learn/a1', '/lesson/0/notes'],
};

/** A short, readable label for a path (the full path is too long for a chip). */
function pathLabel(path: string): string {
  if (path === '/') return 'Home';
  if (path === '/learn') return 'Level grid';
  if (path === '/learn/a1') return 'A1 · 15 units';
  return path;
}

/**
 * Where "Open app" should land.
 *
 * The bug: it always targeted `/`, so closing the tab while reviewing
 * `/lesson/3/notes` and re-opening dumped the admin back on the homepage. The
 * app reports its location on every acknowledgement, so the last known path is
 * reused instead.
 *
 * The `//` guard is a genuine safety check, not pedantry: a path of `//evil.com`
 * is protocol-relative and would navigate the new tab OFF-SITE. The value is
 * remote-controlled (it arrives over postMessage from another origin), so it is
 * validated before being handed to `window.open`.
 */
export function reopenPathFor(path: string | null): string {
  if (!path) return '/';
  if (!path.startsWith('/') || path.startsWith('//')) return '/';
  return path;
}

export function DebugPage() {
  const { profile } = useAdminAuth();
  const appUrl = resolveAppUrl();

  return (
    <div className="space-y-6">
      <header>
        <p className={theme.type.kicker}>Quality assurance</p>
        <h1 className={theme.page.heading}>QA simulator</h1>
        <p className={theme.page.description}>
          How the mode simulator works, and shortcuts into the app in each mode.
        </p>
      </header>

      <HowItWorks appUrl={appUrl} />
      <NavbarIsTheControl />
      <JumpLinks />
      <ExitSection />

      <p className="text-meta text-ink-500 dark:text-ink-400">
        Applying a mode as <strong>{profile?.username ?? 'this admin'}</strong>. Modes change only what
        the browser displays — no plan, role or progress row is ever written to the database.
      </p>
    </div>
  );
}

/**
 * Why the buttons are links rather than a local toggle. Stated in the UI because
 * the cross-origin detail is genuinely surprising, and an admin debugging the
 * wrong thing loses an afternoon to it.
 */
function HowItWorks({ appUrl }: { appUrl: string }) {
  return (
    <>
      <div className="rounded-md border border-accent-200 bg-accent-50 p-4 text-body text-accent-900 dark:border-accent-900 dark:bg-accent-950/40 dark:text-accent-200">
        <p className="font-semibold">The control centre and the app are different origins</p>
        <p className="mt-1 text-meta">
          A mode cannot be set from here directly — this page and the app have separate browser
          storage. Each link therefore carries <code className="font-mono">?adminmode=</code>, and the
          app applies it <em>only after confirming your account has the admin role</em>. The parameter is
          then removed from the URL, so a refresh or a shared link will not re-apply it.
        </p>
      </div>

      {appUrl === '' && (
        <div className="rounded-md border border-warning-200 bg-warning-50 p-4 text-body text-warning-900 dark:border-warning-900 dark:bg-warning-950/40 dark:text-warning-200">
          No separate app origin detected — links will open relative to this host. Set{' '}
          <code className="font-mono">VITE_APP_URL</code> to point at{' '}
          <code className="font-mono">merodeutsch.pramods.com.np</code> in production.
        </div>
      )}
    </>
  );
}

/**
 * The mode buttons live in the NAVBAR, not here.
 *
 * This page previously rendered its own `ModeCards`, which meant two
 * independent sets of controls — and because each called `useQaController()`
 * separately, they held SEPARATE state and could disagree about the active mode.
 * That duplication was a genuine defect, not a cosmetic one: an admin could
 * click "Premium" here and see "Real" highlighted in the navbar.
 *
 * There is now exactly ONE control, in the header, available from every page.
 * This section exists to say so, rather than leaving an empty page.
 */
function NavbarIsTheControl() {
  return (
    <section className="rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
      <h2 className={theme.type.section}>The mode switch is in the navbar</h2>
      <p className="mt-1 text-body text-ink-600 dark:text-ink-300">
        <strong>View as</strong> — Guest, Signed in, Premium, Real — lives in the header, so it is one
        click away from every screen. There is deliberately only one set of controls: two would each
        keep their own state and eventually disagree about which mode is active.
      </p>
      <p className="mt-2 text-meta text-ink-500 dark:text-ink-400">
        The header shows the live status: the current mode, the path the app tab is on, and a green
        dot once the app has acknowledged a change.
      </p>
    </section>
  );
}

/**
 * Deep links into the app for a specific mode.
 *
 * These open a NEW tab, which is different from the navbar's single-tab flow:
 * these are for opening a specific screen in a specific mode, not for driving
 * the tab you already have. Useful when you know exactly where you are going
 * (`/lesson/4/notes` in premium) rather than exploring.
 */
function JumpLinks() {
  return (
    <section className="rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
      <h2 className={theme.type.section}>Jump straight to a screen</h2>
      <p className="mt-1 text-meta text-ink-500 dark:text-ink-400">
        Each link opens a new tab already wearing that mode. Use the navbar when you want to browse
        the one tab you have open.
      </p>
      <div className="mt-3 space-y-4">
        {DEBUG_MODES.map((mode) => (
          <div key={mode}>
            <p className="text-micro font-extrabold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
              {debugModeLabel(mode)}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {MODE_PATHS[mode].map((path) => (
                <a
                  key={path}
                  href={buildModeUrl(mode, path)}
                  target="_blank"
                  rel="noreferrer"
                  className={theme.button.secondarySmall}
                >
                  {pathLabel(path)}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExitSection() {
  return (
    <section className="rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
      <h2 className={theme.type.section}>Leaving a mode</h2>
      <p className="mt-1 text-meta text-ink-600 dark:text-ink-300">
        A mode persists in that tab's storage until changed, so a stale simulation is easy to forget.
        Every simulated tab shows a persistent amber banner with a one-click <strong>Exit</strong>,
        and the link below returns to <code className="font-mono">real</code>.
      </p>
      <a
        href={buildModeUrl('real')}
        target="_blank"
        rel="noreferrer"
        className={`${theme.button.primary} mt-3`}
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Open the real experience
      </a>
    </section>
  );
}
