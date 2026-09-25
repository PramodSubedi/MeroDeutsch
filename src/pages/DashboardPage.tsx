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
import { A1PathProgress } from '../components/path/A1PathProgress';
import { DailyQuestsWidget } from '../components/DailyQuestsWidget';
import { StatTile } from '../components/ui/StatTile';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAchievements } from '../hooks/useAchievements';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, ChevronDown, CircleCheck, Gauge, Flame, Pencil, Settings } from 'lucide-react';
import type { WrongAnswerItem } from '../types';
import { ANCHORS } from '../lib/anchors';

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
  const greeting = isDE ? 'Willkommen zurück' : 'Welcome back';
  const dashboardTitle = isDE ? 'Dashboard' : 'Dashboard';
  const reviewTitle = isDE ? 'Review-Warteschlange' : 'Review queue';
  const reviewSubtitle = isDE ? 'Konzentriere dich auf deine häufigsten Fehler.' : 'Focus on your most frequent mistakes.';
  const clearAllLabel = isDE ? 'Alle löschen' : 'Clear all';
  const dueCount = dueQueue.length;
  const resolvedLabel = isDE ? 'Erledigt' : 'Resolved';
  const overallScoreLabel = isDE ? 'Gesamtpunktzahl' : 'Overall score';
  const streakLabel = isDE ? 'Serie' : 'Streak';
  const streakSubtitle = isDE ? 'Aktuelle Serie und längste Rekord-Serie' : 'Current and longest streak';
  const progressLabel = isDE ? 'Fortschritt' : 'Progress';
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
              to="/learn"
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

      {/* Compact stats grid — shared StatTile component (same as Home) */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label={isDE ? 'Alphabet' : 'Alphabet'}
          value={`${lettersPct}%`}
          subValue={`${progress.practiced.length}/26`}
          progressPct={lettersPct}
          color="blue"
          icon={BookOpen}
        />
        <StatTile
          label={isDE ? 'Quiz' : 'Quiz'}
          value={`${quizPctBar}%`}
          subValue={`${progress.quizCorrect}/${progress.quizTotal}`}
          progressPct={quizPctBar}
          color="emerald"
          icon={CircleCheck}
        />
        <StatTile
          label={isDE ? 'Rechtschreibung' : 'Spelling'}
          value={`${spellingPct}%`}
          subValue={`${progress.spellCompleted}/10`}
          progressPct={spellingPct}
          color="amber"
          icon={Pencil}
        />
        <StatTile
          label={overallScoreLabel}
          value={`${formatCount.format(overallScore)}%`}
          caption={isDE ? 'Über Alphabet, Quiz & Rechtschreibung.' : 'Across alphabet, quiz & spelling.'}
          color="blue"
          icon={Gauge}
        />
      </div>

      {/* Streak + Progress details — wider cards */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {/* Same vertical rhythm as StatTile: label → mt-3 bold value → mt-3 detail. */}
        <div className={theme.panel.surface}>
          <div className="flex items-center gap-2 text-meta font-semibold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400"><Flame className="h-4 w-4 text-warning-500" aria-hidden="true" />{streakLabel}</div>
          <div className="mt-3 flex items-baseline gap-3">
            <div className="text-3xl font-bold leading-none text-success-600">{formatCount.format(streakCount)}</div>
            <div className="pb-0.5 text-body font-medium text-ink-500 dark:text-ink-400">
              {isDE ? 'Längste' : 'Longest'}: {formatCount.format(longestStreak)}
            </div>
          </div>
          <div className="mt-3 text-body text-ink-600 dark:text-ink-300">{streakSubtitle}</div>
        </div>

        <div className={theme.panel.surface}>
          <div className="text-meta font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">{progressLabel}</div>
          <div className="mt-3 space-y-1.5 text-body text-ink-600 dark:text-ink-300">
            <div>{lettersPracticed}: {formatCount.format(progress.practiced.length)}/26</div>
            <div>{spellingRounds}: {formatCount.format(progress.spellCompleted)}</div>
            <div>{quizAttempts}: {formatCount.format(progress.quizTotal)}</div>
          </div>
        </div>
      </div>

      {/* Secondary analytics — collapsed by default so Review stays primary */}
      <details className="group mb-4 rounded-lg border border-ink-200 bg-white p-4 shadow-sm dark:bg-ink-900 dark:border-ink-800">
        <summary className="flex cursor-pointer items-center justify-between gap-3 list-none">
          <span className="text-body font-semibold text-ink-700 dark:text-ink-200">
            {isDE ? 'Detaillierte Analysen' : 'Detailed analytics'}
          </span>
          <span className="text-meta font-medium text-accent-600 dark:text-accent-400 group-open:hidden">
            {isDE ? 'Anzeigen' : 'Show'}
          </span>
          <span className="hidden text-meta font-medium text-accent-600 dark:text-accent-400 group-open:inline">
            {isDE ? 'Ausblenden' : 'Hide'}
          </span>
        </summary>
        <div className="mt-4 space-y-4">
          <ActivityHeatmap activities={activities} />
          <SkillRadarChart />
        </div>
      </details>

      {/* The path answers "where next" while the right rail answers "what today". */}
      <div className="mb-6 grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <div className="min-w-0">
          {/* A1 linear campaign progress (bands A–F + checkpoint gates) */}
          <A1PathProgress />
        </div>
        <div className="min-w-0">
          {/* Daily quests hub + compact SRS due-now widget */}
          <DailyQuestsWidget />
          <SRSReviewWidget />
        </div>
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
            actionTo="/learn"
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
    </div>
  );
}