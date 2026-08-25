import { Link } from 'react-router-dom';
import { useLang } from '../hooks/useLang';
import { useA1Path } from '../hooks/useA1Path';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { usePageTitle } from '../hooks/usePageTitle';
import { DailyChallenge } from '../components/DailyChallenge';
import { UnitSpine } from '../components/path/UnitSpine';
import { DailySession } from '../components/path/DailySession';
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
  const { dueQueue } = useReviewQueue();
  const isDE = langMode === 'german';

  const dueCount = dueQueue.length;
  const nextNode = getPushNode();

  // Resume CTA: when due items exist, route to the daily session (which starts
  // with review — due-first, no bypass). Otherwise target the next incomplete
  // path node (getPushNode prefers a checkpoint when it is next).
  const resumePath = dueCount > 0 ? '/learn#daily-session' : (nextNode?.to ?? '/learn');
  const resumeLabelEn = dueCount > 0 ? `Review ${dueCount}` : (nextNode ? `Next: ${nextNode.label.en}` : 'Go to path');
  const resumeLabelDe = dueCount > 0 ? `${dueCount} Review` : (nextNode ? `Weiter: ${nextNode.label.de}` : 'Zum Lernpfad');

  return (
    <div className={theme.page.container}>
      {/* A. Page header — back-to-home + title + due chip + Resume CTA */}
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
        <div className="flex flex-wrap items-center gap-3">
          {/* Due-count chip — surfaces review pressure at the Learn entry point. */}
          {dueCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-300">
              <span aria-hidden="true">⚠️</span>
              {dueCount} {isDE ? 'fällig' : 'due'}
            </span>
          )}
          <Link
            to={resumePath}
            className={`${theme.button.primary} min-w-[160px] text-center inline-flex items-center justify-center`}
          >
            {isDE ? resumeLabelDe : resumeLabelEn} →
          </Link>
        </div>
      </header>

      {/* The header chip + <DailySession /> below already surface review
          pressure — no extra soft-prompt banner (UI-clutter fix #1). */}

      {/* B. Daily session — due reviews first (max 8) -> summary -> next path node */}
      <DailySession />

      {/* C. Word of the Day — reuses existing DailyChallenge component with compact variant */}
      <DailyChallenge variant="compact" />

      {/* D. A1 campaign spine — linear units with 80% checkpoint gates */}
      <UnitSpine />

      {/* E. Quick-access tools (3) + link to the full hub on /practice — keeps
          this page distinct from /practice, which shows all six tools. The
          heading is deliberately secondary (small uppercase muted) so it reads
          as "extra", not as the main path. */}
      <section className={`${theme.panel.surface} mb-8`} id="practice">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          {isDE ? 'Zusatzwerkzeuge' : 'Extra tools'}
        </h2>
        <PracticeToolsGrid limit={3} footerLink />
      </section>
    </div>
  );
}
