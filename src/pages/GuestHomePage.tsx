import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';
import { theme } from '../config/theme';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { SEO } from '../components/common/SEO';
import { LearningPath } from '../components/learning/LearningPath';
import { PracticeToolsGrid } from '../components/PracticeToolsGrid';

/**
 * Guest Home — the "Try free" destination.
 *
 * Product rule (locked): guests get A1 learning modules + a few practice
 * tools; the guided campaign path (/learn spine, units, checkpoints) is a
 * signed-in benefit. The primary CTA anchors to the classic module-card grid
 * (`LearningPath` — the old Home modules, restored here) instead of
 * deep-linking into a single lesson or the path.
 */
export function GuestHomePage() {
  usePageTitle('Try MeroDeutsch');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { hash } = useLocation();

  // Deep links like /home#learning-path (sidebar "Lessons" shortcut) scroll
  // smoothly to the module grid after navigation.
  useEffect(() => {
    if (hash === '#learning-path') {
      document.getElementById('learning-path')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [hash]);

  const scrollToLessons = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    document.getElementById('learning-path')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={`${theme.page.container} w-full space-y-5 pb-8`}>
      <SEO
        title="Start Learning Free | MeroDeutsch"
        description="Try German A1 free as a guest — explore A1 lessons, practice with quick tools, and see how the guided path works. No account required."
      />

      {/* Hero — one primary action: dive into the A1 module cards below */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-white via-slate-50 to-blue-50 p-4 shadow-sm dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 sm:p-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
            {isDE ? 'MeroDeutsch · Gast-Modus' : 'MeroDeutsch · Guest mode'}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl dark:text-white">
            {isDE ? 'Willkommen bei MeroDeutsch' : 'Welcome to MeroDeutsch'}
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
            {isDE
              ? 'Starten Sie mit den A1-Modulen — Alphabet, Zahlen, Artikel und mehr. Kein Konto nötig.'
              : 'Start with the A1 modules — alphabet, numbers, articles, and more. No account needed.'}
          </p>

          <a
            href="#learning-path"
            onClick={scrollToLessons}
            className={`${theme.button.primary} mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 sm:w-auto sm:px-8`}
          >
            {isDE ? 'Lernen starten' : 'Start learning'}
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </a>

          <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
            <Link
              to="/auth"
              className="inline-flex min-h-[44px] items-center text-sm font-semibold text-blue-600 transition hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {isDE ? 'Anmelden, um Fortschritt zu speichern' : 'Sign in to save progress'}
            </Link>
            <Link
              to="/welcome"
              className="inline-flex min-h-[44px] items-center text-xs text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
            >
              {isDE ? 'Was ist MeroDeutsch?' : 'What is MeroDeutsch?'}
            </Link>
          </div>
        </div>
      </section>

      {/* A1 lessons — the classic module cards (guest scope: explore, no path) */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          {isDE ? 'A1-Lektionen' : 'A1 lessons'}
        </h2>
        <div className="mt-2">
          <LearningPath />
        </div>
      </section>

      {/* Practice — full tool grid (same as logged-in users) */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          {isDE ? 'Übung' : 'Practice'}
        </h2>
        <PracticeToolsGrid />
      </section>

      {/* Sign in — the guided path is a signed-in benefit */}
      <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5 dark:border-blue-800/60 dark:bg-blue-950/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {isDE
                  ? 'Melden Sie sich an — Ihr geführter Lernpfad wartet'
                  : 'Sign in — your guided A1 path is waiting'}
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {isDE
                  ? 'Einheiten in fester Reihenfolge, Checkpoints und eine kluge Wiederholung — auf allen Geräten synchronisiert.'
                  : 'Units in a fixed order, checkpoints, and smart review — synced across all your devices.'}
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
      <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
          {isDE
            ? 'Keine Anmeldung nötig, um zu starten. Erstellen Sie später ein Konto, wenn Sie Ihren Fortschritt auf allen Geräten sichern möchten.'
            : 'No account needed to start. Create one later if you want your progress saved across devices.'}
        </p>
      </section>
    </div>
  );
}