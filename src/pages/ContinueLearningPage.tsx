import { Link } from 'react-router-dom';
import { useLang } from '../hooks/useLang';
import { useA1Path } from '../hooks/useA1Path';
import { usePageTitle } from '../hooks/usePageTitle';
import { DailyChallenge } from '../components/DailyChallenge';
import { UnitSpine } from '../components/path/UnitSpine';
import { PracticeToolsGrid } from '../components/PracticeToolsGrid';
import { theme } from '../config/theme';

/**
 * Dedicated Learning Hub at /learn.
 *
 * Reuses the existing Word-of-the-Day system (DailyChallenge), the existing
 * A1 Learning Path (LearningPath — extracted from HomePage), and the existing
 * learning tools grid. No new datasets or curriculum types are introduced.
 *
 * Accessible to both guest and authenticated users.
 */

export function ContinueLearningPage() {
  usePageTitle('Learn');
  const { langMode } = useLang();
  const { getPushNode } = useA1Path();
  const isDE = langMode === 'german';

  const nextNode = getPushNode();
  const continuePath = nextNode?.to ?? '/';
  const nextLabelEn = nextNode ? `Next: ${nextNode.label.en}` : 'Go to Home';
  const nextLabelDe = nextNode ? `Weiter: ${nextNode.label.de}` : 'Zur Startseite';

  return (
    <div className={theme.page.container}>
      {/* A. Page header — back-to-home + title */}
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
          >
            ← {isDE ? 'Zurück zur Startseite' : 'Back to Home'}
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
            {isDE ? 'Weiterlernen' : 'Continue Learning'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isDE
              ? 'Dein persönlicher Lernhub — Wort des Tages, Lernpfad und Übungs-Tools.'
              : 'Your personal learning hub — word of the day, learning path, and practice tools.'}
          </p>
        </div>
        <Link
          to={continuePath}
          className={`${theme.button.primary} min-w-[160px] text-center inline-flex items-center justify-center`}
        >
          {isDE ? nextLabelDe : nextLabelEn} →
        </Link>
      </header>

      {/* Thin "Next up" strip above WOTD */}
      {nextNode && (
        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-2 text-xs font-semibold text-blue-800 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-300 flex items-center justify-between gap-2">
          <span>
            👉 {isDE ? 'Nächster Schritt auf deinem Pfad:' : 'Next step on your path:'}{' '}
            <strong className="text-blue-950 dark:text-blue-100">{isDE ? nextNode.label.de : nextNode.label.en}</strong>
          </span>
          <Link
            to={continuePath}
            className="underline hover:text-blue-950 dark:hover:text-blue-100 transition active:scale-95"
          >
            {isDE ? 'Jetzt starten →' : 'Start now →'}
          </Link>
        </div>
      )}

      {/* B. Word of the Day — reuses existing DailyChallenge component with compact variant */}
      <DailyChallenge variant="compact" />

      {/* C. A1 campaign spine — linear units with 80% checkpoint gates */}
      <UnitSpine />

      {/* D. Quick-access tools (3) + link to the full hub on /practice — keeps
          this page distinct from /practice, which shows all six tools. */}
      <section className={`${theme.panel.surface} mb-8`} id="practice">
        <h2 className="mb-4 text-xl font-bold text-slate-950 dark:text-white">
          {isDE ? 'Zusatzwerkzeuge' : 'Extra tools'}
        </h2>
        <PracticeToolsGrid limit={3} footerLink />
      </section>
    </div>
  );
}
