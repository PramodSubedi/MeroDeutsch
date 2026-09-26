/**
 * src/components/path/UpgradeToSpine.tsx
 *
 * The Premium upsell shown to guests and signed-in free users on /learn.
 *
 * WHY A COMPONENT AND NOT INLINE COPY
 *   The A1 campaign spine became the paid curriculum, so "free" and "premium"
 *   now have genuinely different learning surfaces. The upsell is the seam
 *   between them and it appears on more than one page (the /learn free branch
 *   and the guest home), so the wording lives in one place. When the copy
 *   changes it changes once.
 *
 * HONEST BY CONSTRUCTION
 *   There is no billing provider wired up, so this does NOT pretend to start a
 *   purchase and must never grow a "Subscribe" button. It states what Premium
 *   adds, then offers a real route: "Ask about Premium" (/feedback) for a
 *   signed-in learner, "Sign in" (/auth) for a guest. The `isOverridden` flag
 *   from usePremium is surfaced so a local tier override is visible while
 *   testing rather than silently changing what someone sees.
 */

import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { usePremium } from '../../hooks/usePremium';
import { useAuth } from '../../hooks/useAuth';
import { theme } from '../../config/theme';

export function UpgradeToSpine() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { isAuthenticated } = useAuth();
  const { isOverridden } = usePremium();

  return (
    <section
      className="mt-6 rounded-lg border border-accent-200 bg-gradient-to-br from-accent-50/70 to-white p-5 dark:border-accent-800/60 dark:from-accent-950/30 dark:to-ink-950"
      aria-labelledby="upgrade-to-spine-heading"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-meta font-semibold uppercase tracking-[0.16em] text-accent-600 dark:text-accent-400">
            Premium
          </p>
          <h2
            id="upgrade-to-spine-heading"
            className="mt-1 text-lg font-semibold tracking-tight text-ink-950 dark:text-white"
          >
            {isDE ? 'Der vollständige A1-Kurs' : 'The full A1 curriculum'}
          </h2>
          <p className="mt-1.5 max-w-xl text-body text-ink-600 dark:text-ink-300">
            {isDE
              ? 'Premium verwandelt die Bausteine in einen geführten Kurs: 15 Module in 5 Etappen, jede Prüfung ab 80 % schaltet die nächste frei, und dein Fortschritt wird auf allen Geräten gespeichert.'
              : 'Premium turns the building blocks into a guided course: 15 modules across 5 stages, each checkpoint unlocks the next at 80% or better, and your progress follows you across devices.'}
          </p>
          {isOverridden && (
            <p className="mt-2 text-meta text-warning-600 dark:text-warning-400">
              {isDE
                ? 'Hinweis: Tier wird lokal überschrieben (Testmodus).'
                : 'Note: tier is locally overridden (test mode).'}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <Link
            to={isAuthenticated ? '/feedback' : '/auth'}
            className={`${theme.button.primary} inline-flex min-h-[44px] items-center justify-center gap-2`}
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {isAuthenticated
              ? isDE
                ? 'Premium anfragen'
                : 'Ask about Premium'
              : isDE
                ? 'Anmelden'
                : 'Sign in'}
          </Link>
          <p className="text-meta text-ink-500 dark:text-ink-400">
            {isDE ? 'Kein Abo im Checkout — wir melden uns.' : 'No checkout yet — we will be in touch.'}
          </p>
        </div>
      </div>
    </section>
  );
}