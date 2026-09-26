import { Link } from 'react-router-dom';
import { useLang } from '../hooks/useLang';
import { useA1Path } from '../hooks/useA1Path';
import { A1_CURRICULUM } from '../data/a1Path';
import { ANCHORS, anchorHref } from '../lib/anchors';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAuth } from '../hooks/useAuth';
import { usePremium } from '../hooks/usePremium';
import { useLastModule } from '../hooks/useLastModule';
import { LearningPath } from '../components/learning/LearningPath';
import { UpgradeToSpine } from '../components/path/UpgradeToSpine';
import { UnitSpine } from '../components/path/UnitSpine';
import { PathModeToggle } from '../components/path/PathModeToggle';
import { PracticeToolsGrid } from '../components/PracticeToolsGrid';
import { theme } from '../config/theme';

/**
 * Dedicated Learning Hub at /learn. TIER-SPLIT.
 *
 *   Guest            the flat module grid (`LearningPath variant="grid"`) —
 *                    "learn what you like", no rank, no position.
 *   Signed-in, free  the SAME six modules as a DESIGNED roadmap
 *                    (`LearningPath variant="path"`) — numbered in teaching
 *                    order, last module ringed — plus the Premium upsell.
 *   Premium          the A1 campaign spine: 15 modules, 80% checkpoint gates,
 *                    the guided/self-guided toggle and "you are here".
 *
 * Per the A1 campaign plan the Premium branch is the linear band spine ONLY —
 * no daily session, no word-of-the-day, no tool-grid body. Warm-up (due
 * reviews) lives on Home; practice tools are the compact quick-access row at
 * the bottom. The header surfaces review pressure (Warm-up target) and the Push
 * next node (via getPushNode, which prefers a checkpoint when one is next).
 *
 * Both branches render the same Quick-practice row and the same due-review
 * chip, so the free roadmap is a real destination rather than a teaser.
 */
export function ContinueLearningPage() {
  usePageTitle('Learn');
  const { langMode } = useLang();
  const { isAuthenticated } = useAuth();
  // Tier gate. The A1 campaign spine is the Premium curriculum; everyone else
  // gets the learning-components path. `isLoading` is checked before branching
  // so the page never flashes the free path at someone who is actually
  // Premium for the ~100ms the plan read takes.
  const { isPremium, isLoading: planLoading } = usePremium();
  const { getLastModule } = useLastModule();
  const { getPushNode, checkpointBestByUnit, pathMode } = useA1Path();
  const { dueQueue } = useReviewQueue();
  const isDE = langMode === 'german';
  // Drives every copy decision on this page: which module strip, which resume
  // label, and whether the header can honestly call the course "linear".
  const isSelf = pathMode === 'self';

  const dueCount = dueQueue.length;
  const nextNode = getPushNode();

  // FREE TIERS: there is no campaign, so Resume continues the last module the
  // learner opened instead of an A1 push node. Guests get '/alphabet' as the
  // floor from useLastModule, which is a sane first step rather than a dead
  // end.
  const freeResumePath = getLastModule();
  const FREE_RESUME_EN = 'Continue learning';
  const FREE_RESUME_DE = 'Weiterlernen';

  // PREMIUM: Resume ALWAYS continues the campaign. It used to jump to
  // /dashboard#review-queue whenever anything was due, which meant standing on
  // the spine threw you OUT of the spine — the one page whose entire job is
  // "here is your next step in the course". Due reviews are still surfaced, as
  // a secondary chip, but the primary action on /learn is the next node.
  const resumePath = nextNode?.to ?? '/learn';
  const resumeLabelEn = nextNode ? `Next: ${nextNode.label.en}` : 'Go to path';
  const resumeLabelDe = nextNode ? `Weiter: ${nextNode.label.de}` : 'Zum Lernpfad';

  // "You are here" — the band the push node lives in, plus its gate best score.
  const youAreHere = (() => {
    if (!nextNode) return null;
    const unit = A1_CURRICULUM.units[nextNode.unitIndex];
    if (!unit) return null;
    const best = checkpointBestByUnit[nextNode.unitIndex];
    const pct = typeof best === 'number' ? Math.round(best * 100) : null;
    return {
      code: unit.code,
      title: isDE ? unit.title.de : unit.title.en,
      isGate: nextNode.kind === 'checkpoint',
      bestPct: pct,
    };
  })();

  // Unknown tier -> render nothing rather than guess, and never flash the free
  // path at someone who is actually Premium. Matches PremiumGate's rule.
  if (planLoading) return null;

  // ── FREE TIER: guests + signed-in free ──────────────────────────────────
  // Same page, same routes, same quick-practice row — only the learning
  // surface differs. Guests get the flat grid ("learn what you like");
  // signed-in free users get the same components as a designed, numbered path
  // with their last module ringed.
  if (!isPremium) {
    return (
      <div className={theme.page.container}>
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              to="/home"
              className="inline-flex items-center gap-1 text-body text-accent-600 hover:text-accent-800 dark:text-accent-300 dark:hover:text-accent-200"
            >
              ← {isDE ? 'Zurück zur Startseite' : 'Back to Home'}
            </Link>
            <p className={`${theme.type.kicker} mt-3`}>{isDE ? 'A1 · Dein Kurs' : 'A1 · Your course'}</p>
            <h1 className={`${theme.type.display} mt-1`}>
              {isDE ? 'Lernpfad' : 'Learning Path'}
            </h1>
            <p className="mt-2 text-body text-ink-500 dark:text-ink-400">
              {isAuthenticated
                ? isDE
                  ? 'Dein A1-Kurs in sechs Bausteinen — in der empfohlenen Reihenfolge.'
                  : 'Your A1 course in six building blocks — in the recommended order.'
                : isDE
                  ? 'Wähle freely, was du lernen willst — kein Konto nötig.'
                  : 'Pick what you want to learn — no account needed.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {dueCount > 0 && (
              <Link
                to={anchorHref('/dashboard', ANCHORS.reviewQueue)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-warning-200 bg-warning-50 px-3.5 py-1.5 text-meta font-semibold text-warning-700 transition hover:bg-warning-100 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none active:scale-95 dark:border-warning-700/60 dark:bg-warning-900/30 dark:text-warning-300"
              >
                <span aria-hidden="true">⚠️</span>
                {dueCount} {isDE ? 'fällig' : 'due'}
              </Link>
            )}
            <Link
              to={freeResumePath}
              className={`${theme.button.primary} min-w-[160px] text-center inline-flex items-center justify-center`}
            >
              {isDE ? FREE_RESUME_DE : FREE_RESUME_EN} →
            </Link>
          </div>
        </header>

        <LearningPath variant={isAuthenticated ? 'path' : 'grid'} />

        {/* Premium upsell — the A1 campaign spine is the paid curriculum. */}
        <UpgradeToSpine />

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

  // ── PREMIUM: the A1 campaign spine ──────────────────────────────────────
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
              ? isSelf
                ? 'Dein A1-Kurs — alle 15 Module offen, in 5 Etappen.'
                : 'Dein linearer A1-Kurs — 15 Module in 5 Etappen.'
              : isSelf
                ? 'Your A1 course — all 15 modules open, across 5 stages.'
                : 'Your linear A1 course — 15 modules across 5 stages.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Due reviews are a SECONDARY affordance here, never the primary CTA.
              Clicking it leaves the spine deliberately — the Dashboard owns
              review — so it is styled as a plain chip, not a button that
              competes with Resume. */}
          {dueCount > 0 && (
            <Link
              to={anchorHref('/dashboard', ANCHORS.reviewQueue)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-warning-200 bg-warning-50 px-3.5 py-1.5 text-meta font-semibold text-warning-700 transition hover:bg-warning-100 focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-none active:scale-95 dark:border-warning-700/60 dark:bg-warning-900/30 dark:text-warning-300"
            >
              <span aria-hidden="true">⚠️</span>
              {dueCount} {isDE ? 'fällig' : 'due'}
            </Link>
          )}
          <Link
            to={resumePath}
            className={`${theme.button.primary} min-w-[160px] text-center inline-flex items-center justify-center`}
          >
            {isDE ? resumeLabelDe : resumeLabelEn} →
          </Link>
        </div>
      </header>

      {/* Guided ⇄ self-guided. Sits above the spine (not buried in Settings) so
          the choice is discoverable at the moment it becomes relevant — someone
          who is annoyed by a gate usually feels that here, not three pages away.
          `compact` drops the explanation line, which the card below carries. */}
      <div className="mb-5 rounded-md border border-ink-200 bg-white p-3.5 dark:border-ink-800 dark:bg-ink-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-meta font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
              {isDE ? 'Lernmodus' : 'Learning mode'}
            </p>
            <p className="mt-1 text-meta text-ink-500 dark:text-ink-400">
              {isSelf
                ? isDE
                  ? 'Alle 15 Module sind offen. Prüfungen zählen weiterhin, sperren aber nichts.'
                  : 'All 15 modules are open. Checkpoints still count, but they lock nothing.'
                : isDE
                  ? 'Jedes Modul wird nach der vorherigen Prüfung (≥80 %) freigeschaltet.'
                  : 'Each module unlocks after the previous checkpoint (≥80%).'}
            </p>
          </div>
          <PathModeToggle compact />
        </div>
      </div>

      {/* Where am I, in one line. Previously the page opened with a generic
          "Learning Path" heading and a button, leaving the learner to work out
          their position from the spine below. */}
      {youAreHere && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-ink-200 bg-white px-3.5 py-2.5 text-meta dark:border-ink-800 dark:bg-ink-900">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-100 text-meta font-bold text-accent-700 dark:bg-accent-900/40 dark:text-accent-300">
            {youAreHere.code}
          </span>
          <span className="font-semibold text-ink-700 dark:text-ink-200">
            {isDE ? `Du bist bei Modul ${youAreHere.code}` : `You are at Module ${youAreHere.code}`}
          </span>
          <span className="text-ink-500 dark:text-ink-400">{youAreHere.title}</span>
          {youAreHere.isGate && youAreHere.bestPct !== null && (
            <span className="text-ink-500 dark:text-ink-400">
              {isDE ? `· Prüfungs-Bestwert ${youAreHere.bestPct}%` : `· checkpoint best ${youAreHere.bestPct}%`}
            </span>
          )}
        </div>
      )}

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