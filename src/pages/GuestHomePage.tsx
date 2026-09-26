import { Link } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';
import { theme } from '../config/theme';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { SEO } from '../components/common/SEO';
import { LearningPath } from '../components/learning/LearningPath';
import { UpgradeToSpine } from '../components/path/UpgradeToSpine';
import { PracticeToolsGrid } from '../components/PracticeToolsGrid';
/**
 * Guest Home — the "Try free" destination.
 *
 * GUESTS ARE ALWAYS ON THE FREE TIER: `entitlementService.getPlan` returns
 * 'free' for a guest because there is no profile row. So this page renders the
 * flat learning-components grid (``LearningPath variant="grid"``): alphabet,
 * numbers, calendar, articles, greetings, stories — learn what you like, in no
 * particular order, with no step numbers and no "last visited" ring, because
 * a guest has no account to carry a position between devices.
 *
 * The guided A1 campaign spine (``components/path/UnitSpine``) is the PREMIUM
 * curriculum and is upsold by ``UpgradeToSpine`` below rather than shown here.
 * That is a tier boundary, not a contradiction: both link to the same
 * service-backed routes, so every lesson below stays reachable either way.
 */
export function GuestHomePage() {
  usePageTitle('Try MeroDeutsch');
  const { langMode } = useLang();
  const isDE = langMode === 'german';


  return (
    <div className={`${theme.page.container} w-full space-y-5 pb-8`}>
      <SEO
        title="Start Learning Free | MeroDeutsch"
        description="Try German A1 free as a guest — open the alphabet, numbers, calendar, articles, greetings and stories, and practise with quick tools. No account required."
      />

      {/* Hero — one primary action: open the first learning component. Not the A1
          spine (Premium), so it points at /alphabet directly. */}
      <section className="overflow-hidden rounded-lg bg-gradient-to-br from-white via-ink-50 to-accent-50 p-4 shadow-sm dark:from-ink-950 dark:via-ink-950 dark:to-ink-900 sm:p-6">
        <div className="max-w-2xl">
          <p className="text-meta font-semibold uppercase tracking-[0.18em] text-accent-600 dark:text-accent-400">
            {isDE ? 'MeroDeutsch · Gast-Modus' : 'MeroDeutsch · Guest mode'}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-ink-950 sm:text-4xl dark:text-white">
            {isDE ? 'Willkommen bei MeroDeutsch' : 'Welcome to MeroDeutsch'}
          </h1>
          <p className="mt-3 max-w-xl text-body leading-7 text-ink-600 dark:text-ink-300">
            {isDE
              ? 'Wähle, was du lernen willst — Alphabet, Zahlen, Kalender und mehr. Kein Konto nötig.'
              : 'Pick what you want to learn — alphabet, numbers, calendar and more. No account needed.'}
          </p>

          <Link
            to="/alphabet"
            className={`${theme.button.primary} mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 sm:w-auto sm:px-8`}
          >
            {isDE ? 'Lernen starten' : 'Start learning'}
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>

          <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
            <Link
              to="/auth"
              className="inline-flex min-h-[44px] items-center text-body font-semibold text-accent-600 transition hover:text-accent-800 dark:text-accent-400 dark:hover:text-accent-300"
          >
              {isDE ? 'Anmelden, um Fortschritt zu speichern' : 'Sign in to save progress'}
          </Link>
            <Link
              to="/welcome"
              className="inline-flex min-h-[44px] items-center text-meta text-ink-500 underline-offset-2 hover:underline dark:text-ink-400"
          >
              {isDE ? 'Was ist MeroDeutsch?' : 'What is MeroDeutsch?'}
          </Link>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-meta font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
          {isDE ? 'Lernmodule' : 'Learning modules'}
        </h2>
        <div className="mt-2">
          <LearningPath variant="grid" />
        </div>
      </section>

      <UpgradeToSpine />

      {/* Practice — full tool grid (same as logged-in users) */}
      <section>
        <h2 className="mb-2 text-meta font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
          {isDE ? 'Übung' : 'Practice'}
        </h2>
        <PracticeToolsGrid />
      </section>

      {/* Sign in - free, and it upgrades the experience from grid to designed path */}
      <section className="rounded-lg border border-accent-200 bg-accent-50/60 p-5 dark:border-accent-800/60 dark:bg-accent-950/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-600 text-white">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-body font-semibold text-ink-900 dark:text-white">
                {isDE
                  ? 'Melden Sie sich an — Fortschritt speichern und dem Pfad folgen'
                  : 'Sign in — keep your progress and follow the path'}
              </h3>
              <p className="mt-1 text-body text-ink-600 dark:text-ink-300">
                {isDE
                  ? 'Deine Module in der empfohlenen Reihenfolge — Fortschritt gespeichert und auf allen Geräten synchronisiert.'
                  : 'Your modules in the recommended order — with progress saved and synced across all your devices.'}
              </p>
            </div>
          </div>
          <Link
            to="/auth"
            className={`${theme.button.primary} inline-flex min-h-[48px] shrink-0 items-center justify-center px-6`}
          >
            {isDE ? 'Kostenlos registrieren' : 'Sign up free'}
          </Link>
        </div>
      </section>

      {/* Guest-mode reassurance */}
      <section className="rounded-lg border border-ink-200 bg-white p-4 shadow-sm dark:bg-ink-900 dark:border-ink-800">
        <p className="text-body leading-6 text-ink-600 dark:text-ink-300">
          {isDE
            ? 'Keine Anmeldung nötig, um zu starten. Erstellen Sie später ein Konto, wenn Sie Ihren Fortschritt auf allen Geräten sichern möchten.'
            : 'No account needed to start. Create one later if you want your progress saved across devices.'}
        </p>
      </section>
    </div>
  );
}
