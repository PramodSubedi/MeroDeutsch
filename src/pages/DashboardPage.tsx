import { useEffect } from 'react';
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
import { ReviewSessionManager } from '../components/ReviewSessionManager';
import { MasteryIndicator } from '../components/MasteryIndicator';
import { SRSReviewWidget } from '../components/SRSReviewWidget';
import { DailyQuestsWidget } from '../components/DailyQuestsWidget';
import { StatTile } from '../components/ui/StatTile';
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
  const { langMode } = useLang();
  const { streakCount, longestStreak } = useStreak();
  const { reportReview } = useDailyQuests();
  const { unlockBadge } = useAchievements();
  const { activities } = useActivityLog();
  const { toast, showToast, dismissToast } = useMilestoneToast();
  const isDE = langMode === 'german';
  const locale = isDE ? 'de-DE' : 'en-US';
  const formatCount = numberFormatter(locale);

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

      {toast && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 shadow-sm dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
          <span>{toast.icon} {toast.message}</span>
          <button type="button" onClick={dismissToast} className="text-blue-500 hover:text-blue-700" aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

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
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{streakLabel}</div>
          <div className="mt-3 flex items-baseline gap-3">
            <div className="text-3xl font-bold leading-none text-emerald-600">{formatCount.format(streakCount)}</div>
            <div className="pb-0.5 text-sm font-medium text-slate-500 dark:text-slate-400">
              {isDE ? 'Längste' : 'Longest'}: {formatCount.format(longestStreak)}
            </div>
          </div>
          <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">{streakSubtitle}</div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{progressLabel}</div>
          <div className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
            <div>{lettersPracticed}: {formatCount.format(progress.practiced.length)}/26</div>
            <div>{spellingRounds}: {formatCount.format(progress.spellCompleted)}</div>
            <div>{quizAttempts}: {formatCount.format(progress.quizTotal)}</div>
          </div>
        </div>
      </div>

      {/* Activity Heatmap (intensity tiers + XP tooltips) */}
      <div className="mt-4">
        <ActivityHeatmap activities={activities} />
      </div>

      {/* Tactical skill radar — accuracy across Grammar/Vocab/Listening/Spelling */}
      <div className="mt-4">
        <SkillRadarChart />
      </div>

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
              onClick={() => {
                const confirmed = window.confirm(
                  isDE
                    ? 'Sollen alle offenen Review-Einträge gelöscht werden? Dieser Schritt kann nicht rückgängig gemacht werden.'
                    : 'Clear all open review items? This cannot be undone.'
                );
                if (confirmed) clearQueue();
              }}
              className={theme.button.secondary}
            >
              {clearAllLabel}
            </button>
          )}
        </div>

        {/* SRS Review Session Manager (filter tabs + flashcard player + summary) — embedded, no nested card */}
        <ReviewSessionManager
          queue={queue}
          dueQueue={dueQueue}
          onMarkCorrect={markCorrect}
          embedded
          limit={isSprint ? 10 : undefined}
          autoStart={isSprint}
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
        ) : (
          <div className="space-y-3">
            {queue.map((item) => (
              <div key={item.id} className="rounded-xl bg-slate-50 p-4 transition duration-300 hover:shadow-md dark:bg-slate-800/60">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${item.moduleType === 'alphabet' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : item.moduleType === 'numbers' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' : item.moduleType === 'calendar' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : item.moduleType === 'articles' ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' : item.moduleType === 'greetings' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' : item.moduleType === 'grammar' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : item.moduleType === 'pronunciation' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' : item.moduleType === 'dictation' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                        {item.moduleType}
                      </span>
                      {item.errorTag && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950/20 dark:text-red-300">
                          🏷️ {item.errorTag}
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${isDue(item) ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
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