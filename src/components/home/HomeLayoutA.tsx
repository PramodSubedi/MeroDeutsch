import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../../config/theme';
import { RefreshCw, Target, TrendingUp, Zap } from 'lucide-react';
import { LearningPath } from '../learning/LearningPath';
import { useAchievements, ALL_BADGES } from '../../hooks/useAchievements';
import { useAuth } from '../../hooks/useAuth';
import { useLang } from '../../hooks/useLang';
import { useProgress } from '../../hooks/useProgress';
import { useReviewQueue } from '../../hooks/useReviewQueue';
import { useStreak } from '../../hooks/useStreak';
import { useXp } from '../../hooks/useXp';
import { DailySession } from '../path/DailySession';
import { DailyChallenge } from '../DailyChallenge';
import { StatTile } from '../ui/StatTile';
import { DailyQuestsWidget } from '../DailyQuestsWidget';
import { useA1Path } from '../../hooks/useA1Path';

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
  {
    accent: 'sky',
    styles: {
      card: 'border-sky-200/70 bg-sky-50/60 dark:border-sky-900/50 dark:bg-sky-950/30',
      badge: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
      hover: 'hover:border-sky-300',
    },
  },
] as const;

export function HomeLayoutA() {
  const { langMode } = useLang();
  const { user, isAuthenticated } = useAuth();
  const { progress } = useProgress();
  const { queue, dueQueue } = useReviewQueue();
  const { streakCount } = useStreak();
  const { totalXp, level, xpProgress } = useXp();
  const { unlockedBadges, checkAndUnlock } = useAchievements();
  const { getPushNode } = useA1Path();
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
  const greeting = isAuthenticated
    ? `${timeGreeting}, ${displayName}`
    : isDE
      ? 'Willkommen bei MeroDeutsch'
      : 'Welcome to MeroDeutsch';

  // Push: first incomplete node of the unlocked A1 path (route or checkpoint).
  const pushNode = getPushNode();



  const practiceItems = [
    // "Continue the A1 path" — the Push card (next unlocked node). Hidden if
    // the whole path is complete so no dead card renders.
    ...(pushNode
      ? [
          {
            title: isDE ? 'A1-Pfad fortsetzen' : 'Continue A1 Path',
            description: isDE
              ? `Nächster Schritt: ${pushNode.label.de}`
              : `Next up: ${pushNode.label.en}`,
            to: pushNode.to,
            ...PRACTICE_ITEM_STYLES[3],
          },
        ]
      : []),
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

      {/* Practice tools — guest discovery only. Signed-in Home stays on the
          daily loop: DailySession + quests; tools live in the sidebar / /practice. */}
      {!isAuthenticated && (
      <section className="grid gap-4 md:grid-cols-3">
        {practiceItems.map(({ title, description, to, styles }) => (
          <Link
            key={title}
            to={to}
            className={`group block rounded-2xl border p-4 transition hover:-translate-y-0.5 sm:p-5 ${styles.card} ${styles.hover}`}
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

      )}
      {/* A1 module grid — guest discovery catalog. Signed-in learners use
          the linear campaign on /learn instead. */}
      {!isAuthenticated && <LearningPath />}

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
