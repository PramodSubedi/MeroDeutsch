/**
 * src/components/premium/PremiumGate.tsx
 *
 * The paywall. Wraps content that only a premium account may see.
 *
 * WHY THIS SHAPE
 * Three states, not two, and the third is the important one:
 *   loading   render NOTHING. Rendering the paywall while the tier is still
 *             being read would flash "upgrade" at a paying customer on every
 *             navigation, which is both ugly and the fastest way to make
 *             someone cancel.
 *   allowed   render `children`.
 *   blocked   render the upgrade panel.
 *
 * It is modelled on the soft-lock screen in `A1CheckpointPage` deliberately:
 * that screen already solved the "locked but reachable" problem for unit
 * gating, and a second visual language for "locked" in the same app would be
 * worse than reusing one.
 *
 * THE UPGRADE BUTTON IS A PLACEHOLDER, ON PURPOSE
 * There is no billing provider. Wiring this to a real checkout is a separate
 * task with its own decisions (provider, price, webhook, trial), and inventing
 * one here would be worse than an honest dead end. The panel says so and points
 * at the contact route that actually exists.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { usePremium } from '../../hooks/usePremium';
import { useAuth } from '../../hooks/useAuth';
import { theme } from '../../config/theme';
import { A1_PATH_ROUTE } from '../../data/cefrLevels';

export function PremiumGate({ children }: { children: ReactNode }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { isPremium, isLoading } = usePremium();
  const { isAuthenticated } = useAuth();

  // Unknown tier → render nothing rather than guess. A paywall that flashes is
  // worse than a paywall that arrives 100ms late.
  if (isLoading) return null;
  if (isPremium) return <>{children}</>;

  return (
    <div className={theme.page.container}>
      <div className={theme.panel.surface}>
        <div className="text-center">
          <span className="text-4xl" aria-hidden="true">
            🔒
          </span>
          <h1 className="mt-3 text-xl font-bold text-ink-900 dark:text-white">
            {isDE ? 'Premium-Inhalt' : 'Premium content'}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-body text-ink-600 dark:text-ink-300">
            {isDE
              ? 'Die interaktiven Lektionen, Vokabelkarten und Übungen sind kostenlos. Die ausführlichen Lektüre-Notizen zu jeder Lektion sind Teil von Premium.'
              : 'The interactive lessons, word cards and exercises are free. The full in-depth notes for each lesson are part of Premium.'}
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            {isAuthenticated ? (
              // No checkout exists yet, so this deliberately does NOT pretend to
              // start a purchase. It says what is true and offers a real route.
              <Link to="/feedback" className={`${theme.button.primary} inline-flex min-h-[44px]`}>
                {isDE ? 'Premium anfragen' : 'Ask about Premium'}
              </Link>
            ) : (
              <Link to="/auth" className={`${theme.button.primary} inline-flex min-h-[44px]`}>
                {isDE ? 'Anmelden' : 'Sign in'}
              </Link>
            )}
            <Link to={A1_PATH_ROUTE} className={`${theme.button.secondary} inline-flex min-h-[44px]`}>
              {isDE ? 'Zurück zum Lernpfad' : 'Back to the learning path'}
            </Link>
          </div>

          <p className="mt-4 inline-flex items-center gap-1.5 text-meta text-ink-500 dark:text-ink-400">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            {isDE
              ? 'Zahlungen werden derzeit manuell eingerichtet.'
              : 'Checkout is being set up manually at the moment.'}
          </p>
        </div>
      </div>
    </div>
  );
}
