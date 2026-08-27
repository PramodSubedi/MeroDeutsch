import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../../config/theme';
import { LearningPath } from '../learning/LearningPath';
import { useAchievements, ALL_BADGES } from '../../hooks/useAchievements';
import { useAuth } from '../../hooks/useAuth';
import { useLang } from '../../hooks/useLang';
import { useProgress } from '../../hooks/useProgress';
import { useReviewQueue } from '../../hooks/useReviewQueue';
import { useStreak } from '../../hooks/useStreak';
import { useXp } from '../../hooks/useXp';
import { DailySession } from '../path/DailySession';
import { StatTile } from '../ui/StatTile';

const PRACTICE_ITEM_STYLES = [
  {
    accent: 'amber',
    styles: {
      card: 'border-amber-200/70 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/30',
      badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
      hover: 'hover:border-amber-300',
    },
  },
  {
    accent: 'indigo',
    styles: {
      card: 'border-indigo-200/70 bg-indigo-50/60 dark:border-indigo-900/50 dark:bg-indigo-950/30',
      badge: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300',
      hover: 'hover:border-indigo-300',
    },
  },
  {
    accent: 'rose',
    styles: {
      card: 'border-rose-200/70 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-950/30',
      badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
      hover: 'hover:border-rose-300',
    },
  },
] as const;

export function HomeLayoutA() {
  const { langMode } = useLang();
  const { user, isAuthenticated } = useAuth();
  const { progress } = useProgress();
  const { queue } = useReviewQueue();
  const { streakCount } = useStreak();
  const { totalXp, level, xpProgress } = useXp();
  const { unlockedBadges, checkAndUnlock } = useAchievements();
  const isDE = langMode === 'german';

  useEffect(() => {
    if (progress) {
      checkAndUnlock(progress);
    }
  }, [progress, checkAndUnlock]);

  const progressCount = progress?.practiced?.length ?? 0;
  const progressPct = Math.min(100, Math.max(0, Math.round((progressCount / 26) * 100)));
  const quizPct = progress?.quizTotal
    ? Math.min(100, Math.max(0, Math.round(((progress.quizCorrect ?? 0) / progress.quizTotal) * 100)))
    : 0;
  
  const reviewCount = queue?.length ?? 0;
  const displayName = user?.username || (isAuthenticated ? 'Learner' : 'MeroDeutsch learner');
  const greeting = isAuthenticated
    ? isDE
      ? `Willkommen zurück, ${displayName}`
      : `Welcome back, ${displayName}`
    : isDE
      ? 'Willkommen bei MeroDeutsch'
      : 'Welcome to MeroDeutsch';



  const practiceItems = [
    {
      title: isDE ? 'Schnell-Quiz' : 'Rapid‑Fire Blitz',
      description: isDE ? 'Schnelle Artikel-Abfragen' : 'Quick article recall drills',
      to: '/rapid-fire',
      ...PRACTICE_ITEM_STYLES[0],
    },
    {
      title: isDE ? 'Diktation' : 'Dictation',
      description: isDE ? 'Anhören und transkribieren' : 'Listen and transcribe',
      to: '/dictation',
      ...PRACTICE_ITEM_STYLES[1],
    },
    {
      title: isDE ? 'Aussprache' : 'Pronunciation',
      description: isDE ? 'Aussprachetraining' : 'Pronunciation practice',
      to: '/pronunciation',
      ...PRACTICE_ITEM_STYLES[2],
    },
  ];

  return (
    <div className={`${theme.page.container} w-full space-y-6 pb-8`}>
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-slate-50 to-blue-50 p-4 shadow-card ring-1 ring-slate-200/70 dark:from-slate-900 dark:via-slate-950 dark:to-blue-950/40 dark:ring-slate-800/70 sm:p-5 md:p-8">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            {isAuthenticated && streakCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                <span aria-hidden="true">🔥</span>
                <span>{streakCount} {isDE ? 'Tage' : 'day streak'}</span>
              </span>
            )}
            {/* "All clear" badge: emerald-800 on emerald-50 ≈ 7:1 contrast (≥ 4.5:1 WCAG AA). */}
            {reviewCount === 0 && (
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

      {/* Shared StatTile component — same source of truth as DashboardPage */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={isDE ? 'Fortschritt' : 'Progress'}
          value={`${progressPct}%`}
          subValue={`${progressCount}/26`}
          progressPct={progressPct}
          color="blue"
        />
        <StatTile
          label={isDE ? 'Genauigkeit' : 'Accuracy'}
          value={`${quizPct}%`}
          subValue="Quiz"
          progressPct={quizPct}
          color="emerald"
        />
        <StatTile
          label={isDE ? 'Review' : 'Review queue'}
          value={String(reviewCount)}
          subValue={isDE ? 'Wartend' : 'Queued'}
          to="/dashboard"
          color="blue"
        />
        <StatTile
          label="Level & XP"
          value={String(level)}
          subValue={`${totalXp} XP`}
          progressPct={xpProgress}
          color="violet"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {practiceItems.map(({ title, description, to, styles }) => (
          <Link
            key={title}
            to={to}
            className={`group block rounded-2xl border p-4 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover sm:p-5 ${styles.card} ${styles.hover}`}
          >
            <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold ${styles.badge}`}>
              {title.charAt(0)}
            </div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>
            {/* Visible click affordance — matches LearningPath.tsx "Start →" */}
            <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 transition group-hover:text-blue-800 dark:text-blue-300">
              {isDE ? 'Starten' : 'Start'} →
            </div>
          </Link>
        ))}
      </section>

      {/* A1 module grid — visible to guests and signed-in users alike so the
          core learning modules are discoverable from Home without /learn. */}
      <LearningPath />

      <section className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800/70">
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
