import { Link } from 'react-router-dom';
import { useLang } from '../hooks/useLang';
import { useA1Path } from '../hooks/useA1Path';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { usePageTitle } from '../hooks/usePageTitle';
import { UnitSpine } from '../components/path/UnitSpine';
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
      ? '/dashboard#review-queue-section'
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
            to="/"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
          >
            ← {isDE ? 'Zurück zur Startseite' : 'Back to Home'}
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
            {isDE ? 'Lernpfad' : 'Learning Path'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isDE
              ? 'Dein linearer A1-Kurs — ein Band nach dem anderen.'
              : 'Your linear A1 course — one band at a time.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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

      {/* A1 campaign spine — linear bands with 80% checkpoint gates */}
      <UnitSpine />


    </div>
  );
}