import { Link } from 'react-router-dom';
import { useLang } from '../hooks/useLang';
import { useA1Path } from '../hooks/useA1Path';
import { ANCHORS, anchorHref } from '../lib/anchors';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { usePageTitle } from '../hooks/usePageTitle';
import { UnitSpine } from '../components/path/UnitSpine';
import { PracticeToolsGrid } from '../components/PracticeToolsGrid';
import { theme } from '../config/theme';

/**
 * Dedicated Learning Hub at /learn.
 *
 * Per the A1 campaign plan, /learn is the LINEAR BAND SPINE ONLY — no daily
 * session, no word-of-the-day, no tool grid body. Warm-up (due reviews) lives
 * on Home; practice tools are the compact quick-access row at the bottom.
 *
 * The header surfaces review pressure (Warm-up target) and the Push next node
 * (via getPushNode, which prefers a checkpoint when one is next). Accessible to
 * guest and authenticated users. Reuses UnitSpine + existing quick tools.
 */
export function ContinueLearningPage() {
  usePageTitle('Learn');
  const { langMode } = useLang();
  const { getPushNode } = useA1Path();
  const { dueQueue } = useReviewQueue();
  const isDE = langMode === 'german';

  const dueCount = dueQueue.length;
  const nextNode = getPushNode();

  // Warm-up: due reviews first -> Dashboard review slot. Otherwise Push.
  const resumePath =
    dueCount > 0
      ? anchorHref('/dashboard', ANCHORS.reviewQueue)
      : (nextNode?.to ?? '/learn');
  const resumeLabelEn =
    dueCount > 0
      ? `Review ${dueCount}`
      : (nextNode ? `Next: ${nextNode.label.en}` : 'Go to path');
  const resumeLabelDe =
    dueCount > 0
      ? `${dueCount} Review`
      : (nextNode ? `Weiter: ${nextNode.label.de}` : 'Zum Lernpfad');

  return (
    <div className={theme.page.container}>
      {/* Page header — back-to-home + title + due chip + Resume CTA */}
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/home"
            className="inline-flex items-center gap-1 text-body text-accent-600 hover:text-accent-800 dark:text-accent-300 dark:hover:text-accent-200"
          >
            ← {isDE ? 'Zurück zur Startseite' : 'Back to Home'}
          </Link>
          {/* Editorial voice: kicker names the stage, display names the thing. */}
          <p className={`${theme.type.kicker} mt-3`}>{isDE ? 'A1 · Dein Kurs' : 'A1 · Your course'}</p>
          <h1 className={`${theme.type.display} mt-1`}>
            {isDE ? 'Lernpfad' : 'Learning Path'}
          </h1>
          <p className="mt-2 text-body text-ink-500 dark:text-ink-400">
            {isDE
              ? 'Dein linearer A1-Kurs — ein Band nach dem anderen.'
              : 'Your linear A1 course — one band at a time.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {dueCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-warning-200 bg-warning-50 px-3 py-1 text-meta font-semibold text-warning-700 shadow-sm dark:border-warning-700/60 dark:bg-warning-900/30 dark:text-warning-300">
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

      {/* A1 campaign spine — linear bands with 80% checkpoint gates */}
      <UnitSpine />

      {/* Quick practice access. The rail and bottom bar intentionally do NOT
          list tools (four destinations, not a catalog), so this is where a
          learner standing on the spine jumps to a drill. Derived from the
          module registry, so a new tool appears here automatically. */}
      <section className="mt-10 border-t border-ink-200 pt-6 dark:border-ink-800">
        <h2 className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
          {isDE ? 'Schnellübung' : 'Quick practice'}
        </h2>
        <p className="mb-4 text-meta text-ink-500 dark:text-ink-400">
          {isDE
            ? 'Optionale Übungen — sie blockieren deinen Pfad nie.'
            : 'Optional drills — they never block your path.'}
        </p>
        <PracticeToolsGrid limit={4} footerLink />
      </section>
    </div>
  );
}