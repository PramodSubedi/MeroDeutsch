import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { useProgress } from '../hooks/useProgress';
import { useLang } from '../hooks/useLang';
import { useStreak } from '../hooks/useStreak';
import { useActivityLog } from '../hooks/useActivityLog';
import { useMilestoneToast } from '../hooks/useMilestoneToast';
import { usePageTitle } from '../hooks/usePageTitle';
import { theme } from '../config/theme';
import { BrandMark } from '../components/BrandMark';
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
import { useDailyQuests } from '../hooks/useDailyQuests';
import { useAchievements } from '../hooks/useAchievements';
import { Link } from 'react-router-dom';
import type { WrongAnswerItem } from '../types';

/** Locale-aware number formatter shared by dashboard stats + review queue counts. */
const numberFormatter = (locale: string) => new Intl.NumberFormat(locale);

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
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const { langMode } = useLang();
  const { streakCount, longestStreak } = useStreak();
  const { reportReview } = useDailyQuests();
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

  const lettersPct = Math.min(100, Math.round((progress.practiced.length / 26) * 100));
  const quizPctBar = progress.quizTotal ? Math.min(100, Math.round((progress.quizCorrect / progress.quizTotal) * 100)) : 0;
  const spellingPct = Math.min(100, Math.round((progress.spellCompleted / 10) * 100));

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
  const gotItLabel = isDE ? 'Verstanden ✓' : 'Got it ✓';
  const isDue = (item: WrongAnswerItem) => {
    if (!item.dueAt) return true;
    return item.dueAt <= new Date().toISOString();
  };

  return (
    <div className={theme.page.container}>
      <SEO
        title="Dashboard | MeroDeutsch"
        description="Track your German learning progress, review queue, streaks, and achievements on MeroDeutsch."
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <BrandMark className="text-xl" />
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{dashboardTitle}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {user ? `${greeting}, ${user.username} 👋` : 'Your learning progress and review queue.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {dueCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-300">
              <span aria-hidden="true">⚠️</span>
              {formatCount.format(dueCount)} {isDE ? 'fällige Einträge' : 'due items'}
            </span>
          )}
          <Link to="/settings" className={theme.button.secondary}>
            ⚙️ {isDE ? 'Einstellungen' : 'Settings'}
          </Link>
        </div>
      </div>

      {/* Milestone/level-up feedback surfaces via the GLOBAL toast in <Layout />
          (single fixed z-[60] viewport) — no inline banner here. */}

      {/* Compact stats grid — shared StatTile component (same as Home) */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={isDE ? 'Alphabet' : 'Alphabet'}
          value={`${lettersPct}%`}
          subValue={`${progress.practiced.length}/26`}
          progressPct={lettersPct}
          color="blue"
        />
        <StatTile
          label={isDE ? 'Quiz' : 'Quiz'}
          value={`${quizPctBar}%`}
          subValue={`${progress.quizCorrect}/${progress.quizTotal}`}
          progressPct={quizPctBar}
          color="emerald"
        />
        <StatTile
          label={isDE ? 'Rechtschreibung' : 'Spelling'}
          value={`${spellingPct}%`}
          subValue={`${progress.spellCompleted}/10`}
          progressPct={spellingPct}
          color="amber"
        />
        <StatTile
          label={overallScoreLabel}
          value={`${formatCount.format(overallScore)}%`}
          caption={isDE ? 'Über Alphabet, Quiz & Rechtschreibung.' : 'Across alphabet, quiz & spelling.'}
          color="blue"
        />
      </div>

      {/* Streak + Progress details — wider cards */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        {/* Same vertical rhythm as StatTile: label → mt-3 bold value → mt-3 detail. */}
        <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{streakLabel}</div>
          <div className="mt-3 flex items-baseline gap-3">
            <div className="text-3xl font-bold leading-none text-emerald-600">{formatCount.format(streakCount)}</div>
            <div className="pb-0.5 text-sm font-medium text-slate-500 dark:text-slate-400">
              {isDE ? 'Längste' : 'Longest'}: {formatCount.format(longestStreak)}
            </div>
          </div>
          <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">{streakSubtitle}</div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{progressLabel}</div>
          <div className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
            <div>{lettersPracticed}: {formatCount.format(progress.practiced.length)}/26</div>
            <div>{spellingRounds}: {formatCount.format(progress.spellCompleted)}</div>
            <div>{quizAttempts}: {formatCount.format(progress.quizTotal)}</div>
          </div>
        </div>
      </div>

      {/* Secondary analytics — collapsed by default so Review stays primary */}
      <details className="group mb-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <summary className="flex cursor-pointer items-center justify-between gap-3 list-none">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {isDE ? 'Detaillierte Analysen' : 'Detailed analytics'}
          </span>
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400 group-open:hidden">
            {isDE ? 'Anzeigen' : 'Show'}
          </span>
          <span className="hidden text-xs font-medium text-blue-600 dark:text-blue-400 group-open:inline">
            {isDE ? 'Ausblenden' : 'Hide'}
          </span>
        </summary>
        <div className="mt-4 space-y-4">
          <ActivityHeatmap activities={activities} />
          <SkillRadarChart />
        </div>
      </details>

      {/* A1 linear campaign progress (bands A–F + checkpoint gates) */}
      <A1PathProgress />

      {/* Daily quests hub + compact SRS due-now widget */}
      <DailyQuestsWidget />
      <SRSReviewWidget />

      <div
        id="review-queue-section"
        className="mt-4 rounded-2xl bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md dark:bg-slate-900"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">{reviewTitle}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{reviewSubtitle}</p>
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
            description={isDE ? 'Super! Du hast keine ausstehenden Reviews. Übe weiter, um dein Wissen zu festigen.' : 'Great! You have no pending reviews. Keep practicing to build your knowledge.'}
            actionLabel={isDE ? 'Zum Alphabet' : 'Go to Alphabet'}
            actionTo="/alphabet"
            secondaryActionLabel={isDE ? 'Zahlen üben' : 'Practice Numbers'}
            secondaryActionTo="/numbers"
          />
        ) : visibleItems.length === 0 ? (
          /* Filter matched nothing (queue itself is non-empty). */
          <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {isDE
              ? 'Keine Einträge für diesen Filter — wähle einen anderen Tab.'
              : 'No items match this filter — try another tab.'}
          </p>
        ) : (
          <div className="space-y-3">
            {visibleItems.map((item) => (
              <div key={item.id} className="rounded-xl bg-slate-50 p-4 transition duration-300 hover:shadow-md dark:bg-slate-800/60">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${theme.moduleBadge[item.moduleType] ?? theme.moduleBadge.fallback}`}>
                        {item.moduleType}
                      </span>
                      {item.errorTag && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/20 dark:text-red-300">
                          🏷️ {item.errorTag}
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${isDue(item) ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                        {isDue(item) ? dueLabel : scheduledLabel}
                      </span>
                    </div>
                    <div className="flex min-w-0 items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      {/* Gender-colored dot when the item carries a German article. */}
                      {(() => {
                        const m = `${item.itemKey} ${item.correctAnswer}`.match(/\b(der|die|das)\b/i);
                        if (!m) return null;
                        const key = m[1].toLowerCase() === 'die' ? 'dieF' : m[1].toLowerCase();
                        return (
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${theme.gender[key as keyof typeof theme.gender].bg}`}
                            title={m[1]}
                            aria-hidden="true"
                          />
                        );
                      })()}
                      <span className="min-w-0 truncate">{item.itemKey}</span>
                      <MasteryIndicator boxLevel={item.boxLevel} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        // SRS Scholar quest: count a completed review.
                        reportReview(1);
                        markCorrect(item.id);
                        // Box 4 Master badge: check if this promotion reaches Box 4.
                        const nextBox = Math.min((item.boxLevel ?? 1) + 1, 4);
                        if (nextBox >= 4) unlockBadge('box4_master');
                        // 🎓 "Mastered" celebration payoff: a correct answer while
                        // ALREADY at box 4 truly graduates (retires) the card.
                        if ((item.boxLevel ?? 1) >= 4) {
                          showToast({
                            message: isDE
                              ? 'Karte gemeistert! Sie hat deine Review-Warteschlange verlassen. 🎓'
                              : 'Card mastered! It graduated from your review queue. 🎓',
                            icon: '🎓',
                          });
                        }
                      }}
                      className={theme.button.primary}
                    >
                      {gotItLabel}
                    </button>
                    <button type="button" onClick={() => markResolved(item.id)} className={theme.button.secondary}>
                      {resolvedLabel}
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  <div>{answerLabel}: {item.userAnswer}</div>
                  <div>{correctLabel}: {item.correctAnswer}</div>
                  <div>{errorsLabel}: {formatCount.format(item.errorCount)}</div>
                  {item.intervalDays ? (
                    <div>{isDE ? 'Nächstes Review in' : 'Next review in'} {formatCount.format(item.intervalDays)} {isDE ? 'Tag(en)' : 'day(s)'}</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}