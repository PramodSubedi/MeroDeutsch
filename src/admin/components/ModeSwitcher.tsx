/**
 * src/admin/components/ModeSwitcher.tsx
 *
 * The persistent navbar control. Always visible in the control-center header, so
 * switching identity is one click from any page rather than a trip to a
 * dedicated screen.
 *
 * WHAT THE THREE TOGGLES MEAN
 *   Guest     the app renders as if nobody is signed in
 *   Signed in the app renders as a free-tier learner
 *   Premium   the app renders as a premium learner (full A1 campaign)
 * plus `real`, which removes every override.
 *
 * NONE OF THIS LOGS ANYONE IN OR OUT. The modes are a local display override
 * (see `src/lib/debugMode.ts`); your admin session is never touched, and no row
 * is ever written. The only genuine requirement is that the app tab is signed
 * in ON ITS OWN ORIGIN at least once, because "signed in" and "premium" are
 * views of an authenticated user — the tier is overridden, the session is real.
 */
import { ExternalLink, RefreshCw, Wrench } from 'lucide-react';
import { theme } from '../../config/theme';
import { useQaController } from '../hooks/useQaController';
import type { DebugMode } from '../../lib/debugMode';

const TOGGLES: { mode: DebugMode; label: string }[] = [
  { mode: 'guest', label: 'Guest' },
  { mode: 'free', label: 'Signed in' },
  { mode: 'premium', label: 'Premium' },
  { mode: 'real', label: 'Real' },
];

export function ModeSwitcher() {
  const { mode, path, connected, denied, openApp, setMode, reconnect, tabClosed } = useQaController();

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="QA mode simulator">
      <span className="flex items-center gap-1.5 text-micro font-extrabold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
        <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
        View as
      </span>

      {/* A radiogroup: arrow keys and screen readers work, and only one can be
          active, which matches what the toggles actually mean. */}
      <div className="flex overflow-hidden rounded-md border border-ink-200 dark:border-ink-800" role="radiogroup" aria-label="Simulated identity">
        {TOGGLES.map(({ mode: option, label }) => {
          const active = option === mode;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMode(option)}
              className={[
                'min-h-[36px] px-2.5 text-meta font-semibold transition',
                active
                  ? 'bg-accent-600 text-white'
                  : 'bg-white text-ink-600 hover:bg-ink-100 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800',
              ].join(' ')}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Connection dot. A stale "connected" indicator is worse than none, so it
          only lights when the app has actually acknowledged. */}
      <span
        className="flex items-center gap-1.5 text-meta font-semibold"
        title={denied ?? (connected ? 'App tab is connected' : 'No app tab connected')}
      >
        <span
          aria-hidden="true"
          className={`h-2 w-2 rounded-full ${connected ? 'bg-success-500' : 'bg-ink-300 dark:bg-ink-600'}`}
        />
        <span className="text-ink-600 dark:text-ink-300">
          {path ?? 'app tab'}
        </span>
      </span>

      {tabClosed && !connected && (
        <span className="text-meta text-warning-600 dark:text-warning-500">tab closed</span>
      )}

      <button
        type="button"
        onClick={() => openApp()}
        className={theme.button.secondarySmall}
        title="Open the app in a tab, or focus the one already open"
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        Open app
      </button>

      <button
        type="button"
        onClick={reconnect}
        className={theme.button.icon}
        aria-label="Re-sync with the app tab"
        style={{ width: '36px', height: '36px' }}
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
