import { Link, Navigate, useParams } from 'react-router-dom';
import { Layers } from 'lucide-react';
import { useLang } from '../hooks/useLang';
import { useA1Path } from '../hooks/useA1Path';
import { A1_CURRICULUM, A1_UNIT_COUNT } from '../data/a1Path';
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
import { CefrComingSoonPanel } from '../components/path/CefrComingSoonPanel';
import {
  CEFR_LEVELS_ROUTE,
  DEFAULT_CEFR_LEVEL_ID,
  getCefrLevel,
  isCefrLevelAvailable,
  parseCefrLevel,
} from '../data/cefrLevels';
import { PracticeToolsGrid } from '../components/PracticeToolsGrid';
import { theme } from '../config/theme';

/**
 * A single CEFR LEVEL's page — `/learn` (A1 today) and `/learn/:levelId`.
 *
 * THE COURSE IS THE DEFAULT ROUTE
 *   `/learn` is the A1 campaign and `DEFAULT_CEFR_LEVEL_ID` fills the absent
 *   `:levelId`, so this one component renders the bare course, `/learn/a1` and
 *   `/learn/a2`. The level GRID is a separate, deliberately secondary route
 *   (`/levels`, `CefrLevelIndexPage`) — see the note on `CEFR_LEVELS_ROUTE`.
 *
 * THE LEVEL IS A ROUTE, NOT A FLAG
 *   `:levelId` comes from the router, so Back/forward and a pasted link both
 *   work, and each level is free to become its own screen. An unknown segment
 *   REDIRECTS to the grid rather than rendering A1 under a URL that claims
 *   otherwise — a wrong deep link should land somewhere real, not lie.
 *
 *   Nothing about the A1 experience changed: the tier split below, the spine,
 *   the 80% gate, the retry rule, the soft lock. Only the URL moved, and the
 *   links that mean "back to the path" now point at A1_PATH_ROUTE.
 *
 * THE TIER SPLIT (unchanged, inside A1)
 *   Guest            the flat module grid (`LearningPath variant="grid"`) —
 *                    "learn what you like", no rank, no position.
 *   Signed-in, free  the SAME six modules as a DESIGNED roadmap
 *                    (`LearningPath variant="path"`) — numbered in teaching
 *                    order, last module ringed — plus the Premium upsell.
 *   Premium          the A1 campaign spine: every module, 80% checkpoint gates,
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
  const { levelId: levelIdParam } = useParams<{ levelId: string }>();
  // Null for a level that does not exist. Resolved BEFORE the title so a bad
  // link never flashes this level's content on its way to the grid.
  //
  // ABSENT is not the same as null. `/learn` (no segment) is the A1 COURSE
  // itself now, so an absent param resolves to the default level and the page
  // renders normally. `null` still means "you asked for a level that does not
  // exist" and must redirect. The route is declared twice in App.tsx — bare and
  // with `:levelId` — so this one component serves `/learn`, `/learn/a1` and
  // `/learn/a2` identically, which is what keeps the deep links alive after the
  // grid moved to `/levels`.
  const levelId = levelIdParam === undefined ? DEFAULT_CEFR_LEVEL_ID : parseCefrLevel(levelIdParam);
  usePageTitle(levelId ? `Learn · ${getCefrLevel(levelId).code}` : 'Learn');
  const { langMode } = useLang();
  const { isAuthenticated } = useAuth();
  const isDE = langMode === 'german';

  const { isPremium, isLoading: planLoading } = usePremium();
  const { getLastModule } = useLastModule();
  const { getPushNode, checkpointBestByUnit, pathMode } = useA1Path();
  const { dueQueue } = useReviewQueue();

  // Unknown / malformed level. `replace` so Back does not bounce the learner
  // straight back into the broken URL they arrived with.
  //
  // This MUST sit below every hook in the component. It used to be the first
  // statement, which meant the four hooks below it were skipped on this render
  // path — and since `:levelId` can go from unknown to valid WITHOUT a remount
  // (the redirect swaps the param in place), React then saw more hooks than the
  // previous render and threw "Rendered more hooks than during the previous
  // render", hard-crashing the learn page. `usePageTitle` above is already
  // null-safe for the same reason.
  if (!levelId) return <Navigate to={CEFR_LEVELS_ROUTE} replace />;

  const level = getCefrLevel(levelId);
  const levelAvailable = isCefrLevelAvailable(levelId);
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
  // a secondary chip, but the primary action here is the next node.
  //
  // No push node means the whole level is finished, so the honest target is the
  // LEVEL GRID ("here is what else there is") — not this same page, which a
  // self-link would make a dead button.
  const resumePath = nextNode?.to ?? CEFR_LEVELS_ROUTE;
  const resumeLabelEn = nextNode ? `Next: ${nextNode.label.en}` : 'All levels';
  const resumeLabelDe = nextNode ? `Weiter: ${nextNode.label.de}` : 'Alle Niveaus';

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

  // ── COMING-SOON LEVEL (A2 / B1) ─────────────────────────────────────────
  // Checked BEFORE the tier split, and deliberately tier-independent: A2 is not
  // free-or-premium, it simply does not exist yet, so gating that screen on the
  // plan would imply A2 is one plan away when it is a curriculum away. The
  // "All levels" back link stays (so A1 is always one click from here) and the
  // only actions are two routes that already exist: A1 and /feedback.
  if (!levelAvailable) {
    return (
      <div className={theme.page.container}>
        <header className="mb-5">
          <Link
            to={CEFR_LEVELS_ROUTE}
            className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-sm px-1 text-meta font-semibold text-ink-500 transition hover:text-accent-700 dark:text-ink-400 dark:hover:text-accent-300"
          >
            <Layers className="h-4 w-4" aria-hidden="true" />
            {isDE ? 'Niveaus' : 'Levels'}
          </Link>
          <p className={`${theme.type.kicker} mt-3`}>
            {isDE ? `${level.code} · Dein Kurs` : `${level.code} · Your course`}
          </p>
          <h1 className={`${theme.type.display} mt-1`}>
            {isDE ? 'Lernpfad' : 'Learning Path'}
          </h1>
        </header>
        <CefrComingSoonPanel level={level} />
      </div>
    );
  }

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
            {/* Same "Levels" affordance as the Premium header below — the free
                tier and the campaign are the same course at two depths, so they
                must not offer different navigation. */}
            <Link
              to={CEFR_LEVELS_ROUTE}
              className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-sm px-1 text-meta font-semibold text-ink-500 transition hover:text-accent-700 dark:text-ink-400 dark:hover:text-accent-300"
            >
              <Layers className="h-4 w-4" aria-hidden="true" />
              {isDE ? 'Niveaus' : 'Levels'}
            </Link>
            <p className={`${theme.type.kicker} mt-3`}>
              {isDE ? `${level.code} · Dein Kurs` : `${level.code} · Your course`}
            </p>
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
          {/* "All levels" became "Levels" and lost its arrow. This page IS the
              course now, so a back-link pointing at the grid described a
              hierarchy that no longer exists — it read as "return to the thing
              you came from" when it is actually "see what else exists". */}
          <Link
            to={CEFR_LEVELS_ROUTE}
            className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-sm px-1 text-meta font-semibold text-ink-500 transition hover:text-accent-700 dark:text-ink-400 dark:hover:text-accent-300"
          >
            <Layers className="h-4 w-4" aria-hidden="true" />
            {isDE ? 'Niveaus' : 'Levels'}
          </Link>
          {/* Editorial voice: kicker names the stage, display names the thing.
              The code comes from the registry, not a literal, so the header
              cannot say "A1" on a page that is actually showing something else. */}
          <p className={`${theme.type.kicker} mt-3`}>
            {isDE ? `${level.code} · Dein Kurs` : `${level.code} · Your course`}
          </p>
          <h1 className={`${theme.type.display} mt-1`}>
            {isDE ? 'Lernpfad' : 'Learning Path'}
          </h1>
          <p className="mt-2 text-body text-ink-500 dark:text-ink-400">
            {isDE
              ? isSelf
                ? `Dein A1-Kurs — alle ${A1_UNIT_COUNT} Module offen, in 5 Etappen.`
                : `Dein linearer A1-Kurs — ${A1_UNIT_COUNT} Module in 5 Etappen.`
              : isSelf
                ? `Your A1 course — all ${A1_UNIT_COUNT} modules open, across 5 stages.`
                : `Your linear A1 course — ${A1_UNIT_COUNT} modules across 5 stages.`}
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
                  ? `Alle ${A1_UNIT_COUNT} Module sind offen. Prüfungen zählen weiterhin, sperren aber nichts.`
                  : `All ${A1_UNIT_COUNT} modules are open. Checkpoints still count, but they lock nothing.`
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