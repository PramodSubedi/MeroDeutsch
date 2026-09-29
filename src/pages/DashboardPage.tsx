import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { useProgress } from '../hooks/useProgress';
import { useProgressMetrics } from '../hooks/useProgressMetrics';
import { useLang } from '../hooks/useLang';
import { useStreak } from '../hooks/useStreak';
import { useActivityLog } from '../hooks/useActivityLog';
import { useMilestoneToast } from '../hooks/useMilestoneToast';
import { usePageTitle } from '../hooks/usePageTitle';
import { genderTokenFor, theme } from '../config/theme';
import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { SEO } from '../components/common/SEO';
import { ActivityHeatmap } from '../components/ActivityHeatmap';
import { SkillRadarChart } from '../components/SkillRadarChart';
import { ReviewSessionManager, filterReviewQueue } from '../components/ReviewSessionManager';
import { MasteryIndicator } from '../components/MasteryIndicator';
import { SRSReviewWidget } from '../components/SRSReviewWidget';
import { CoursePosition } from '../components/dashboard/CoursePosition';
import { MetricRow } from '../components/dashboard/MetricRow';
import { CheckpointTrajectory } from '../components/dashboard/CheckpointTrajectory';
import { ActivityTrend } from '../components/dashboard/ActivityTrend';
import { QueueBreakdown } from '../components/dashboard/QueueBreakdown';
import { useA1Path } from '../hooks/useA1Path';
import { useHasA1Campaign } from '../hooks/usePremium';
import { A1_UNITS } from '../data/a1Path';
import { useXp } from '../hooks/useXp';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAchievements } from '../hooks/useAchievements';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, Gauge, Flame, RefreshCw, Settings } from 'lucide-react';
import type { WrongAnswerItem } from '../types';
import { ANCHORS } from '../lib/anchors';
import { A1_PATH_ROUTE } from '../data/cefrLevels';
import { activityCounts } from '../lib/activitySeries';

/** Locale-aware number formatter shared by dashboard stats + review queue counts. */
const numberFormatter = (locale: string) => new Intl.NumberFormat(locale);
const REVIEW_PREVIEW_COUNT = 6;

export function DashboardPage() {
  usePageTitle('Dashboard');
  const { user, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const isSprint = searchParams.get('sprint') === 'true';
  const { queue, dueQueue, markCorrect, markResolved, clearQueue } = useReviewQueue();
  const { progress } = useProgress();
  // Lifted filter state: the SAME rules drive both this item list and the
  // ReviewSessionManager's Start Session pool (Bug A fix — one source of truth).
  const [reviewFilter, setReviewFilter] = useState<string>('all');
  const visibleItems = useMemo(() => filterReviewQueue(queue, reviewFilter), [queue, reviewFilter]);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const { langMode } = useLang();
  const { streakCount, longestStreak } = useStreak();
  const { attemptsByUnit } = useA1Path();
  const { hasCampaign } = useHasA1Campaign();
  const { totalXp, level, xpProgress } = useXp();
  const { unlockBadge } = useAchievements();
  const { activities } = useActivityLog();
  const { showToast } = useMilestoneToast();
  const isDE = langMode === 'german';
  const locale = isDE ? 'de-DE' : 'en-US';
  const formatCount = numberFormatter(locale);

  // Smooth-scroll to hash anchor on mount (e.g. from Home's review link).
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const id = hash.replace('#', '');
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const { lettersPct, quizPct: quizPctBar, spellingPct } = useProgressMetrics();

  // Milestone toasts (non-blocking, once per session).
  useEffect(() => {
    if (progress.practiced.length >= 26) {
      showToast({ message: isDE ? 'Alle 26 Buchstaben geübt! 🏆' : 'All 26 letters practiced! 🏆', icon: '🏆' });
    } else if (progress.practiced.length >= 10) {
      showToast({ message: isDE ? '10 Buchstaben geschafft! 🔤' : '10 letters done! 🔤', icon: '🔤' });
    }
    if (streakCount >= 3) {
      showToast({ message: isDE ? `${streakCount}-Tage-Serie! 🔥` : `${streakCount}-day streak! 🔥`, icon: '🔥' });
    }
    if (streakCount >= 7) {
      unlockBadge('streak_7');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // Overall score = genuine blend across alphabet, quiz & spelling. Previously
  // this duplicated quiz accuracy under two different labels on the same page.
  const overallScore = Math.round((lettersPct + quizPctBar + spellingPct) / 3);

  /* ── Course-scoped headline metrics ──────────────────────────────────────
   * The four tiles at the top of this page used to be Alphabet-era
   * (letters practiced /26, quiz %, spelling %, "overall"). For a learner
   * walking the A1 campaign those numbers describe almost none of what they
   * have done: the course is six bands and five gates, and `/alphabet` is only
   * an optional side track. So the headline answered "how far through the
   * alphabet am I?" while `A1PathProgress` further down the page answered
   * "how far through the course am I?" — two competing truths.
   *
   * These are now derived from the SAME state `A1PathProgress` reads, so the
   * tiles and the band strip beneath them can never disagree.
   *
   * CORE bands only (A, C, D, E, F). Band B is a SUPPORT band with no gate, so
   * including it would understate progress — the same trap ContextPanel
   * documents.
   */
  /* ── Gate average ────────────────────────────────────────────────────────
   * Mean of the best score on every gate the learner has actually attempted.
   * No attempts yet -> null, so the caption can say "no checkpoint attempted"
   * rather than showing a fake 0%.
   *
   * This is the ONLY aggregate the Dashboard still derives itself. The pass
   * COUNT moved into `CoursePosition`, which reads it from the same
   * `getUnitPhase`/`isCheckpointComplete` state the rings themselves use — so
   * the number on screen and the strip drawn under it cannot drift.
   *
   * CORE units only: the `support` band has no gate, so including it would
   * understate progress. That is the same trap `ContextPanel` documents.
   */
  // Plain consts, NOT useMemo: the hook block above has an early
  // `return <Navigate>`, so a hook here would be conditionally called.
  const coreUnits = A1_UNITS.filter((unit) => unit.kind === 'core');
  const attemptedScores = coreUnits
    .map((unit) => attemptsByUnit[unit.index]?.best)
    .filter((s): s is number => typeof s === 'number');
  const gateAveragePct =
    attemptedScores.length === 0
      ? null
      : Math.round((attemptedScores.reduce((a, b) => a + b, 0) / attemptedScores.length) * 100);

  // The real 14-day activity series, for the stat-tile sparkline. Same shared
  // builder the trend chart uses, so the tile and the chart can never disagree
  // about which days had activity.
  //
  // A plain const, NOT useMemo, for the reason spelled out above: the hook
  // block has an early `return <Navigate>`, so a hook here would be
  // conditionally called. 14 iterations over a 120-entry array is not worth
  // memoising anyway.
  const activitySpark = activityCounts(activities, 14);

  const greeting = isDE ? 'Willkommen zurück' : 'Welcome back';
  const dashboardTitle = isDE ? 'Dashboard' : 'Dashboard';
  const reviewTitle = isDE ? 'Review-Warteschlange' : 'Review queue';
  const reviewSubtitle = isDE ? 'Konzentriere dich auf deine häufigsten Fehler.' : 'Focus on your most frequent mistakes.';
  const clearAllLabel = isDE ? 'Alle löschen' : 'Clear all';
  const dueCount = dueQueue.length;
  const resolvedLabel = isDE ? 'Erledigt' : 'Resolved';
  const overallScoreLabel = isDE ? 'Gesamtpunktzahl' : 'Overall score';
  const streakLabel = isDE ? 'Serie' : 'Streak';
  const lettersPracticed = isDE ? 'Alphabet-Buchstaben geübt' : 'Alphabet letters practiced';
  const spellingRounds = isDE ? 'Abgeschlossene Rechtschreibrunden' : 'Spelling rounds completed';
  const quizAttempts = isDE ? 'Quiz-Versuche' : 'Quiz attempts';
  const answerLabel = isDE ? 'Antwort' : 'Answer';
  const correctLabel = isDE ? 'Richtig' : 'Correct';
  const errorsLabel = isDE ? 'Fehler' : 'Errors';
  const dueLabel = isDE ? 'Fällig' : 'Due';
  const scheduledLabel = isDE ? 'Geplant' : 'Scheduled';
  const isDue = (item: WrongAnswerItem) => {
    if (!item.dueAt) return true;
    return item.dueAt <= new Date().toISOString();
  };
  const reviewItems = showAllReviews ? visibleItems : visibleItems.slice(0, REVIEW_PREVIEW_COUNT);
  const hiddenReviewCount = Math.max(0, visibleItems.length - REVIEW_PREVIEW_COUNT);

  return (
    <div className={theme.page.container}>
      <SEO
        title="Dashboard | MeroDeutsch"
        description="Track your German learning progress, review queue, streaks, and achievements on MeroDeutsch."
      />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-ink-200 pb-5 dark:border-ink-800">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent-600 dark:text-accent-400">
            {isDE ? 'DEIN LERNÜBERBLICK' : 'YOUR LEARNING OVERVIEW'}
          </p>
          <h1 className="mt-1 break-words text-2xl font-bold text-ink-900 dark:text-white">{dashboardTitle}</h1>
          <p className="mt-1 text-body text-ink-500 dark:text-ink-400">
            {user ? `${greeting}, ${user.username}` : (isDE ? 'Dein Lernfortschritt und deine Wiederholungen.' : 'Your learning progress and review queue.')}
          </p>
        </div>
        <div className="relative flex flex-wrap items-center gap-2">
          {dueCount > 0 ? (
            <Link
              to={`/dashboard#${ANCHORS.reviewQueue}`}
              className="inline-flex min-h-10 items-center gap-2 rounded-sm bg-accent-600 px-3.5 text-body font-semibold text-white shadow-sm transition hover:bg-accent-700"
            >
              {formatCount.format(dueCount)} {isDE ? 'jetzt wiederholen' : 'reviews due'}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <Link
              to={A1_PATH_ROUTE}
              className="inline-flex min-h-10 items-center gap-2 rounded-sm bg-accent-600 px-3.5 text-body font-semibold text-white shadow-sm transition hover:bg-accent-700"
            >
              {isDE ? 'Weiterlernen' : 'Continue learning'}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
          <Link to="/settings" aria-label={isDE ? 'Einstellungen' : 'Settings'} title={isDE ? 'Einstellungen' : 'Settings'} className="inline-flex h-10 w-10 items-center justify-center rounded-sm text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-white">
            <Settings className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      {/* Milestone/level-up feedback surfaces via the GLOBAL toast in <Layout />
          (single fixed z-[60] viewport) — no inline banner here. */}

      {/* THE PAGE HIERARCHY, IN ONE LINE: course position -> peer metrics ->
          the work. This used to open with FOUR equal-weight stat cards, two of
          which restated the course ("Modules 3/15") that `A1PathProgress`
          stated 400px lower with a DIFFERENT denominator ("3 of 16") — the
          same "two competing truths" failure the comment above describes having
          fixed for the Alphabet-era tiles, reintroduced one component down.

          `CoursePosition` now owns the course figure outright: one number, one
          denominator, matching the sixteen rings drawn directly beneath it. The
          gate average moved from a peer card to a caption under that number,
          because "am I passing" is a qualifier on progress, not a rival
          headline.

          Gated on `hasCampaign` for the same reason the old strip was: a free
          learner is on the `LearningPath` roadmap, which has no per-unit rings,
          no stage codes and no "next node" — rendering a course position for
          them would invent a progress model they are not being measured on. */}
      {hasCampaign && <CoursePosition gateAveragePct={gateAveragePct} />}

      {/* Peer metrics. Due reviews, streak and XP answer three DIFFERENT
          questions and none of them is "how far through the course", so none
          competes with the block above. One hairline-divided surface rather than
          three floating cards, so a secondary number cannot read as a headline.
          Home keeps the card-style `StatTile` for the same figures — a
          different role on a different page, not a restyled duplicate. */}
      <MetricRow
        label={isDE ? 'Deine Zahlen' : 'Your numbers'}
        metrics={[
          {
            label: isDE ? 'Wiederholen' : 'Reviews due',
            value: formatCount.format(dueCount),
            detail: isDE ? 'jetzt fällig' : 'ready now',
            icon: RefreshCw,
            tone: 'warning',
            to: `/dashboard#${ANCHORS.reviewQueue}`,
            // The due count itself is a snapshot with no history, so the
            // sparkline is the learner's overall 14-day effort, not a trend in
            // "reviews due". Labelled as activity in the card below rather
            // than implying this number moves.
            spark: activitySpark,
          },
          {
            label: streakLabel,
            value: formatCount.format(streakCount),
            detail: isDE
              ? `längste ${formatCount.format(longestStreak)}`
              : `longest ${formatCount.format(longestStreak)}`,
            icon: Flame,
            tone: 'success',
          },
          {
            label: 'Level & XP',
            value: String(level),
            detail: `${formatCount.format(totalXp)} XP`,
            icon: Gauge,
            tone: 'accent',
            // `xpProgress` was already available on this hook and was simply
            // not being read. The gauge shows progress toward the NEXT level,
            // which is the only reason a level number is interesting.
            ring: xpProgress,
          },
        ]}
      />

      {/* "Where next" lives on the left rail; "what today" answers here.
          The daily-quests hub is deliberately NOT repeated here: it renders on
          Home (`HomeLayoutA`), and two copies of a claimable-XP widget on two
          pages is one more place for a learner to think a quest can be claimed
          twice. The SRS due-now widget below has no Home equivalent, so it
          stays. */}
      <div className="mb-6">
        <SRSReviewWidget />
      </div>

      <div
        id={ANCHORS.reviewQueue}
        className="mt-6 overflow-hidden rounded-lg border border-ink-200 bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md dark:border-ink-800 dark:bg-ink-900"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-ink-950 dark:text-white">{reviewTitle}</h2>
            <p className="text-body text-ink-500 dark:text-ink-400">{reviewSubtitle}</p>
          </div>
          {queue.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmClearOpen(true)}
              className={theme.button.secondary}
            >
              {clearAllLabel}
            </button>
          )}
        </div>

        <ConfirmDialog
          open={confirmClearOpen}
          title={isDE ? 'Reviews löschen?' : 'Clear reviews?'}
          message={
            isDE
              ? 'Sollen alle offenen Review-Einträge gelöscht werden? Dieser Schritt kann nicht rückgängig gemacht werden.'
              : 'Clear all open review items? This cannot be undone.'
          }
          confirmLabel={isDE ? 'Alle löschen' : 'Clear all'}
          cancelLabel={isDE ? 'Abbrechen' : 'Cancel'}
          onConfirm={() => {
            setConfirmClearOpen(false);
            void clearQueue().then((ok) => {
              if (!ok) {
                showToast({
                  message: isDE
                    ? 'Cloud-Löschen fehlgeschlagen — lokale Einträge wurden entfernt.'
                    : 'Cloud delete failed — local items were removed.',
                  icon: '⚠️',
                });
              }
            });
          }}
          onCancel={() => setConfirmClearOpen(false)}
        />

        {/* SRS Review Session Manager (filter tabs + flashcard player + summary) — embedded, no nested card */}
        <ReviewSessionManager
          queue={queue}
          dueQueue={dueQueue}
          onMarkCorrect={markCorrect}
          onGraduate={() => {
            // 🎓 "Mastered" celebration payoff (box-4 retirement): badge +
            // non-blocking milestone toast, consistent with other payoffs here.
            unlockBadge('box4_master');
            showToast({
              message: isDE
                ? 'Karte gemeistert! Sie hat deine Review-Warteschlange verlassen. 🎓'
                : 'Card mastered! It graduated from your review queue. 🎓',
              icon: '🎓',
            });
          }}
          embedded
          limit={isSprint ? 10 : undefined}
          autoStart={isSprint}
          activeFilter={reviewFilter}
          onActiveFilterChange={setReviewFilter}
        />

        {queue.length === 0 ? (
          <EmptyState
            icon="🎯"
            title={isDE ? 'Keine Review-Einträge' : 'No Review Items'}
            description={isDE ? 'Alles erledigt. Starte eine neue Lektion, damit deine nächste Wiederholung gezielt entsteht.' : 'All caught up. Start a new lesson and your next review will be generated from real practice.'}
            actionLabel={isDE ? 'Weiterlernen' : 'Continue learning'}
            actionTo={A1_PATH_ROUTE}
            secondaryActionLabel={isDE ? 'Alphabet üben' : 'Practice Alphabet'}
            secondaryActionTo="/alphabet"
          />
        ) : visibleItems.length === 0 ? (
          /* Filter matched nothing (queue itself is non-empty). */
          <p className="py-6 text-center text-body text-ink-500 dark:text-ink-400">
            {isDE
              ? 'Keine Einträge für diesen Filter — wähle einen anderen Tab.'
              : 'No items match this filter — try another tab.'}
          </p>
        ) : (
          <div className="space-y-2">
            {reviewItems.map((item) => (
              <details key={item.id} className="group rounded-md border border-ink-200 bg-ink-50 transition-colors hover:border-accent-300 dark:border-ink-700 dark:bg-ink-800/60 dark:hover:border-accent-700">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-meta font-semibold ${theme.moduleBadge[item.moduleType] ?? theme.moduleBadge.fallback}`}>
                        {item.moduleType}
                      </span>
                      {item.errorTag && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-danger-50 px-2 py-0.5 text-meta font-semibold text-danger-700 dark:bg-danger-950/20 dark:text-danger-300">
                          {item.errorTag}
                        </span>
                      )}
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-meta font-semibold ${isDue(item) ? 'bg-warning-100 text-warning-800 dark:bg-warning-900/40 dark:text-warning-300' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-400'}`}>
                        {isDue(item) ? dueLabel : scheduledLabel}
                      </span>
                    </div>
                    <div className="mt-1 flex min-w-0 items-center gap-2 text-body font-medium text-ink-700 dark:text-ink-200">
                      {/* Gender-colored dot when the item carries a German article. */}
                      {(() => {
                        const m = `${item.itemKey} ${item.correctAnswer}`.match(/\b(der|die|das)\b/i);
                        if (!m) return null;
                        const t = genderTokenFor(m[1]);
                        return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${t.bg}`} title={m[1]} aria-hidden="true" />;
                      })()}
                      <span className="min-w-0 truncate">{item.itemKey}</span>
                      <MasteryIndicator boxLevel={item.boxLevel} />
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-ink-400 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="flex flex-wrap items-end justify-between gap-3 border-t border-ink-200 px-3 pb-3 pt-2 text-body text-ink-500 dark:border-ink-700 dark:text-ink-400">
                  <div>
                    <div>{answerLabel}: {item.userAnswer}</div>
                    <div>{correctLabel}: {item.correctAnswer}</div>
                    <div>{errorsLabel}: {formatCount.format(item.errorCount)}</div>
                    {item.intervalDays ? (
                      <div>{isDE ? 'Nächstes Review in' : 'Next review in'} {formatCount.format(item.intervalDays)} {isDE ? 'Tag(en)' : 'day(s)'}</div>
                    ) : null}
                  </div>
                  {/* Triage-only action. Grading remains exclusively in the session above. */}
                  <button type="button" onClick={() => markResolved(item.id)} className={theme.button.secondary}>
                    {resolvedLabel}
                  </button>
                </div>
              </details>
            ))}
          {hiddenReviewCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllReviews((current) => !current)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-sm border border-ink-200 px-3 py-2 text-body font-semibold text-accent-700 transition hover:bg-accent-50 dark:border-ink-700 dark:text-accent-300 dark:hover:bg-accent-950/30"
            >
              {showAllReviews
                ? (isDE ? 'Weniger anzeigen' : 'Show fewer')
                : (isDE ? `${hiddenReviewCount} weitere anzeigen` : `Show ${hiddenReviewCount} more reviews`)}
              <ChevronDown className={`h-4 w-4 transition-transform ${showAllReviews ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
          )}
          </div>
        )}
      </div>

      {/* ── ANALYSIS, BELOW THE WORK ───────────────────────────────────────
          The four blocks above this comment are the page's jobs: where am I,
          how are my numbers, what is due, and the review queue itself. Each is
          an action the learner can take or a fact they can act on.

          Everything from here down is REFLECTION — it describes past attempts
          rather than offering anything to do. It is deliberately last, and the
          ordering is a correction, not a preference.

          WHAT WENT WRONG HERE: an earlier pass of this work put the letter-
          practice card, the checkpoint trajectory and the skill radar between
          the metrics and the review queue. That read fine in isolation — each
          block is individually worth showing — but stacking them pushed the
          review queue, the page's primary task and the target of the "44
          reviews due" button in the header, roughly 600px further down. The
          charts answered questions the learner had not asked yet, and the thing
          they came to do was now below the fold on a laptop.

          The rule this encodes: NEW information that requires a click to act on
          (a gate score, a skill breakdown, a due-review list) ranks ABOVE OLD
          information that only reports (a heatmap of days already studied).
          Practice volume is the oldest, least actionable thing here, so it is
          last of the three. */}

      {/* ── THE THREE QUESTION-ANSWERING CHARTS ─────────────────────────────
          Each of these turns a number that was already on the page into a
          shape. None of them invents a metric, and each answers something the
          text above it cannot:

            review debt  -> "is this 44 stuff I ALMOST know, or never knew?"
            activity     -> "is my effort rising, or did I stop?"
            trajectory   -> "am I getting better, or just getting further?"

          `ReviewBreakdown` goes first because it qualifies the review queue
          directly above it; `ActivityTrend` second because its sparkline is
          the same data in miniature in the stat row. */}

      <div className="mb-6">
        <QueueBreakdown queue={queue} />
      </div>

      <div className="mb-6">
        <ActivityTrend activities={activities} />
      </div>

      {/* CHECKPOINT TRAJECTORY — the learner's score line, now under the work.
          This is the one dataset that had NO surface at all: `attemptsByUnit`
          carries a per-unit best score and attempt count that nothing ever
          plotted, so "am I improving or just advancing?" had no answer.

          The pass line here and the gate average in `CoursePosition` are both
          derived from `CHECKPOINT_PASS_THRESHOLD`, so the headline up top and
          the chart down here can never disagree about what "passing" is. */}
      {hasCampaign && (
        <div className="mb-6">
          <CheckpointTrajectory />
        </div>
      )}

      {/* SKILL ANALYSIS — PROMOTED OUT OF THE COLLAPSED BLOCK.
          This used to live inside a `<details>` that was closed by default, on
          the reasoning that "review stays primary". But a radar chart the
          learner must click twice to find is not secondary content — it is the
          one surface that answers "which skill do I need to work on", and the
          drill-down links inside it go straight to the tool that fixes it.
          It is now visible AND below the work, which satisfies both: it needs
          no click to discover, and it no longer delays the review queue. */}
      <div className="mb-6">
        <SkillRadarChart />
      </div>

      {/* LETTER PRACTICE — the optional side track.
          The streak card that used to sit here was DELETED rather than restyled:
          it rendered the same two numbers (`streakCount`, `longestStreak`) that
          the `MetricRow` now shows, in a bigger card, further down the page. Two
          blocks stating one fact is the exact defect that made the course figure
          appear as both "3/15" and "3 of 16" — so the fix is to have one of
          each, not to make the duplicate prettier.

          What remains is genuinely a different question: these four counters
          describe the optional Alphabet/spelling track (the `support` band),
          which the course headline deliberately does not count, so they are
          framed as a side track rather than as course progress. It is last of
          the three because it reports volume rather than naming a weakness. */}
      <div className="mb-6">
        <div className={theme.panel.surface}>
          <div className="text-meta font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
            {isDE ? 'Buchstaben-Praxis' : 'Letter practice'}
          </div>
          <div className="mt-3 space-y-1.5 text-body text-ink-600 dark:text-ink-300">
            <div>{lettersPracticed}: {formatCount.format(progress.practiced.length)}/26</div>
            <div>{spellingRounds}: {formatCount.format(progress.spellCompleted)}</div>
            <div>{quizAttempts}: {formatCount.format(progress.quizTotal)}</div>
            <div>{overallScoreLabel}: {formatCount.format(overallScore)}%</div>
          </div>
          <p className="mt-2 text-meta text-ink-500 dark:text-ink-400">
            {isDE
              ? 'Alphabet & Rechtschreibung sind eine optionale Nebenstrecke (Band B).'
              : 'Alphabet & spelling are an optional side track (Band B).'}
          </p>
        </div>
      </div>

      {/* Activity history — genuinely secondary, so it stays behind a click.
          A heatmap of days already studied reports the past and offers no
          action, which is why it is the very last thing on the page. */}
      <details className="group mb-4 rounded-lg border border-ink-200 bg-white p-4 shadow-sm dark:bg-ink-900 dark:border-ink-800">
        <summary className="flex cursor-pointer items-center justify-between gap-3 list-none">
          <span className="text-body font-semibold text-ink-700 dark:text-ink-200">
            {isDE ? 'Aktivitätsverlauf' : 'Activity history'}
          </span>
          <span className="text-meta font-medium text-accent-600 dark:text-accent-400 group-open:hidden">
            {isDE ? 'Anzeigen' : 'Show'}
          </span>
          <span className="hidden text-meta font-medium text-accent-600 dark:text-accent-400 group-open:inline">
            {isDE ? 'Ausblenden' : 'Hide'}
          </span>
        </summary>
        <div className="mt-4">
          <ActivityHeatmap activities={activities} />
        </div>
      </details>
    </div>
  );
}
