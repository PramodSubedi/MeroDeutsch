import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../../config/theme';
import { RefreshCw, Target, TrendingUp, Zap } from 'lucide-react';
import { useAchievements, ALL_BADGES } from '../../hooks/useAchievements';
import { useAuth } from '../../hooks/useAuth';
import { useLang } from '../../hooks/useLang';
import { useProgress } from '../../hooks/useProgress';
import { useProgressMetrics } from '../../hooks/useProgressMetrics';
import { useReviewQueue } from '../../hooks/useReviewQueue';
import { useStreak } from '../../hooks/useStreak';
import { useXp } from '../../hooks/useXp';
import { DailySession } from '../path/DailySession';
import { DailyChallenge } from '../DailyChallenge';
import { StatTile } from '../ui/StatTile';
import { DailyQuestsWidget } from '../DailyQuestsWidget';

export function HomeLayoutA() {
  const { langMode } = useLang();
  const { user, isAuthenticated } = useAuth();
  const { progress } = useProgress();
  const { queue, dueQueue } = useReviewQueue();
  const { streakCount } = useStreak();
  const { totalXp, level, xpProgress } = useXp();
  const { unlockedBadges, checkAndUnlock } = useAchievements();
  const isDE = langMode === 'german';

  useEffect(() => {
    if (progress) {
      checkAndUnlock(progress);
    }
  }, [progress, checkAndUnlock]);

  // Alphabet progress percentages come from ONE shared selector (also used by
  // the Dashboard, Analytics and the Alphabet page) — see useProgressMetrics.
  const { lettersCount: progressCount, lettersPct: progressPct, quizPct } = useProgressMetrics();
  
  const reviewCount = queue?.length ?? 0;
  // This layout is only mounted for authenticated users (AppHomeSwitch routes
  // guests to GuestHomePage), so no guest fallbacks are needed here.
  const displayName = user?.username || 'Learner';

  // Time-of-day dynamic greeting (07:00–11:00 morning, 11:00–18:00 day, else evening).
  const hour = new Date().getHours();
  const timeGreeting = isDE
    ? hour < 11
      ? 'Guten Morgen'
      : hour < 18
        ? 'Guten Tag'
        : 'Guten Abend'
    : hour < 11
      ? 'Good morning'
      : hour < 18
        ? 'Good afternoon'
        : 'Good evening';
  const greeting = `${timeGreeting}, ${displayName}`;

  return (
    <div className={`${theme.page.container} w-full space-y-5 pb-8`}>
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-white via-slate-50 to-blue-50 p-4 shadow-sm dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 sm:p-5 md:p-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            {isAuthenticated && streakCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                <span aria-hidden="true">🔥</span>
                <span>{streakCount} {isDE ? 'Tage' : 'day streak'}</span>
              </span>
            )}
            {/* "All clear" badge: emerald-800 on emerald-50 ≈ 7:1 contrast (≥ 4.5:1 WCAG AA). */}
            {/* "All clear" = nothing DUE right now (same predicate as
                DailySession's CTA branch). Items queued for the future don't
                block the all-clear — reconciled with the dueQueue source. */}
            {dueQueue.length === 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                <span aria-hidden="true">✅</span>
                <span>{isDE ? 'Alles erledigt' : 'All clear'}</span>
              </span>
            )}
          </div>

          {/* Single primary action lives in <DailySession /> directly below —
              the hero deliberately renders NO second CTA so the screen has
              exactly one primary "start" affordance (UI-clutter fix #1). */}
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
              MeroDeutsch
            </p>
            <h1 className="mt-2 min-w-0 break-words text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-5xl">
              {greeting}
            </h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
              {isDE
                ? 'Neue Wörter, schnelle Reviews und klare nächste Schritte — alles auf einer Seite.'
                : 'New words, quick reviews, and the next best step — all in one place.'}
            </p>
          </div>
        </div>
      </section>

      {/* Daily session: due reviews first (max 8) -> summary -> next path node */}
      <DailySession />

      {/* Word of the Day + daily challenge — reactivates the existing
          DailyChallenge system on the logged-in Home (it was orphaned from
          the old HomePage restructure). Reads curriculumService, shuffles at
          create, feeds addWrongAnswer/XP — no new system introduced. */}
      {isAuthenticated && <DailyChallenge />}

      {/* Shared StatTile component — same source of truth as DashboardPage */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={isDE ? 'Fortschritt' : 'Progress'}
          value={`${progressPct}%`}
          subValue={`${progressCount}/26`}
          progressPct={progressPct}
          color="blue"
          icon={TrendingUp}
        />
        <StatTile
          label={isDE ? 'Genauigkeit' : 'Accuracy'}
          value={`${quizPct}%`}
          subValue="Quiz"
          progressPct={quizPct}
          color="emerald"
          icon={Target}
        />
        <StatTile
          label={isDE ? 'Review' : 'Review queue'}
          value={String(reviewCount)}
          subValue={isDE ? 'Wartend' : 'Queued'}
          to="/dashboard"
          color="blue"
          icon={RefreshCw}
        />
        <StatTile
          label="Level & XP"
          value={String(level)}
          subValue={`${totalXp} XP`}
          progressPct={xpProgress}
          color="violet"
          icon={Zap}
        />
      </section>

      {/* Daily quests (shared with Dashboard) — logged-in only. */}
      {isAuthenticated && <DailyQuestsWidget />}

      <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
            {isDE ? 'Errungenschaften' : 'Achievements'}
          </h2>
          <Link to="/dashboard" className="text-sm font-medium text-blue-600 dark:text-blue-400">
            {isDE ? 'Alle anzeigen' : 'See all'}
          </Link>
        </div>
        {unlockedBadges.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {unlockedBadges.slice(0, 6).map((badge) => (
              <Link
                key={badge.id}
                to="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200"
              >
                <span>{badge.icon}</span>
                {badge.label}
              </Link>
            ))}
            {/* Next locked badges — grayscale + lock so progression reads at a glance */}
            {ALL_BADGES.filter((b) => !unlockedBadges.some((u) => u.id === b.id))
              .slice(0, 3)
              .map((badge) => (
                <span
                  key={badge.id}
                  title={badge.requirement}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-400 grayscale dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500"
                >
                  <span aria-hidden="true">🔒</span>
                  {badge.label}
                </span>
              ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isDE ? 'Noch keine Abzeichen — starte heute mit einem kurzen Drill.' : 'No badges yet — start with a quick drill today.'}
          </p>
        )}
      </section>
    </div>
  );
}
