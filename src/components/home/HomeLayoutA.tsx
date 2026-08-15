import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import { useAchievements } from '../../hooks/useAchievements';
import { useAuth } from '../../hooks/useAuth';
import { useLang } from '../../hooks/useLang';
import { useLastModule } from '../../hooks/useLastModule';
import { useProgress } from '../../hooks/useProgress';
import { useReviewQueue } from '../../hooks/useReviewQueue';
import { useStreak } from '../../hooks/useStreak';
import { useXp } from '../../hooks/useXp';

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
  const { getLastModule } = useLastModule();
  const navigate = useNavigate();
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

  const continueTo = getLastModule();
  const continueTarget = continueTo && continueTo !== '/alphabet' ? continueTo : '/learn';

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
      title: 'Aussprache',
      description: isDE ? 'Aussprachetraining' : 'Pronunciation practice',
      to: '/pronunciation',
      ...PRACTICE_ITEM_STYLES[2],
    },
  ];

  return (
    <div className={`${theme.page.container} w-full space-y-6 pb-8`}>
      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50 p-4 shadow-sm dark:border-slate-700 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 sm:p-5 md:p-8">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            {isAuthenticated && streakCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                <span aria-hidden="true">🔥</span>
                <span>{streakCount} {isDE ? 'Tage' : 'day streak'}</span>
              </span>
            )}
            {reviewCount === 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                <span aria-hidden="true">✅</span>
                <span>{isDE ? 'Alles erledigt' : 'All clear'}</span>
              </span>
            )}
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-600 dark:text-blue-400">
                {isDE ? 'MeroDeutsch' : 'MeroDeutsch'}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-5xl">
                {greeting}
              </h1>
              <p className="mt-3 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
                {isDE
                  ? 'Neue Wörter, schnelle Reviews und klare nächste Schritte — alles auf einer Seite.'
                  : 'New words, quick reviews, and the next best step — all in one place.'}
              </p>
            </div>

            <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                to={continueTarget}
                className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                {isDE ? 'Weiterlernen' : 'Continue learning'}
              </Link>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="inline-flex min-h-[48px] items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-700 transition hover:border-blue-400 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                {isDE ? 'Review starten' : 'Review now'}
                {reviewCount > 0 && (
                  <span className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-bold text-white">
                    {reviewCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-slate-950">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            {isDE ? 'Fortschritt' : 'Progress'}
          </div>
          <div className="mt-4 flex items-end justify-between gap-3">
            <span className="text-3xl font-semibold text-slate-950 dark:text-white">{progressPct}%</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">{progressCount}/26</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-slate-950">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            {isDE ? 'Genauigkeit' : 'Accuracy'}
          </div>
          <div className="mt-4 flex items-end justify-between gap-3">
            <span className="text-3xl font-semibold text-slate-950 dark:text-white">{quizPct}%</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">Quiz</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${quizPct}%` }} />
          </div>
        </div>

        <Link
          to="/dashboard"
          className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md sm:p-5 dark:border-slate-700 dark:bg-slate-950"
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            {isDE ? 'Review' : 'Review queue'}
          </div>
          <div className="mt-4 flex items-end justify-between gap-3">
            <span className={`text-3xl font-semibold ${reviewCount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
              {reviewCount}
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400">{isDE ? 'Wartend' : 'Queued'}</span>
          </div>
        </Link>

        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-slate-950">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            {isDE ? 'Level & XP' : 'Level & XP'}
          </div>
          <div className="mt-4 flex items-end justify-between gap-3">
            <span className="text-2xl font-semibold text-slate-950 dark:text-white">{level}</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">{totalXp} XP</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full rounded-full bg-violet-500" style={{ width: `${xpProgress}%` }} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {practiceItems.map(({ title, description, to, styles }) => (
          <Link
            key={title}
            to={to}
            className={`block rounded-[24px] border p-4 transition hover:-translate-y-0.5 sm:p-5 ${styles.card} ${styles.hover}`}
          >
            <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold ${styles.badge}`}>
              {title.charAt(0)}
            </div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>
          </Link>
        ))}
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950">
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
