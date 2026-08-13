import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../config/theme';
import { AuthGate } from '../components/AuthGate';
import { BrandMark } from '../components/BrandMark';
import { DailyChallenge } from '../components/DailyChallenge';
import { LearningPath } from '../components/learning/LearningPath';
import { PracticeToolsGrid } from '../components/PracticeToolsGrid';
import { XpWidget } from '../components/XpWidget';
import { useProgress } from '../hooks/useProgress';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { useLang } from '../hooks/useLang';
import { useStreak } from '../hooks/useStreak';
import { useAchievements } from '../hooks/useAchievements';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { useAuth } from '../hooks/useAuth';

// Main page component for MeroDeutsch German learning app
export function HomePage() {
  // Region: Hook initializations
  const { progress } = useProgress();
  const { queue } = useReviewQueue();
  const { langMode } = useLang();
  const { streakCount } = useStreak();
  const { unlockedBadges, lockedBadges, checkAndUnlock } = useAchievements();
  const { canInstall, promptInstall } = useInstallPrompt();
  const { isAuthenticated } = useAuth();
  const isDE = langMode === 'german';

  // Evaluate badge rules whenever progress data changes.
  useEffect(() => {
    if (progress) {
      checkAndUnlock(progress);
    }
  }, [progress, checkAndUnlock]);

  // Region: Computed values
  const progressCount = progress?.practiced?.length ?? 0;
  const progressPct = Math.min(100, Math.max(0, Math.round((progressCount / 26) * 100)));
  const quizPct = progress?.quizTotal
    ? Math.min(100, Math.max(0, Math.round(((progress.quizCorrect ?? 0) / progress.quizTotal) * 100)))
    : 0;
  const reviewCount = queue?.length ?? 0;

  // Region: Hero component with streak and CTAs
  const hero = (
    <div className="text-center py-6 lg:py-10">
      <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs uppercase tracking-[0.35em] text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <BrandMark className="text-sm" />
        {isAuthenticated && streakCount > 0 && (
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-400/15 dark:text-blue-300">
            <span>🔥</span> <span>{streakCount} day streak</span>
          </div>
        )}
      </div>

      <h1 className="mx-auto mt-6 max-w-4xl text-5xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white sm:text-6xl">
        {isDE ? 'Deutsch lernen' : 'Master German'}
      </h1>

      <p className="mx-auto mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
        {isDE ? 'A1 Deutsch für Nepali- & Englisch-Sprecher' : 'A1 German for Nepali & English Speakers'}
      </p>

      <p className="mx-auto mt-3 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
        {isDE
          ? 'Beginne mit den A1-Grundlagen: Alphabet, Zahlen, Artikel und Begrüßungen — dann nutze die adaptive Review-Praxis.'
          : 'Start with A1 essentials: alphabet, numbers, articles, and greetings — then unlock review practice that adapts to your mistakes.'}
      </p>

      {canInstall && (
        <div className="mx-auto mt-4 inline-flex flex-wrap items-center justify-center gap-3 rounded-full border border-blue-200/70 bg-blue-50/80 px-4 py-2 text-sm text-slate-700 shadow-sm dark:border-blue-800/50 dark:bg-blue-950/40 dark:text-slate-300">
          <span aria-hidden="true">📲</span>
          <span>{isDE ? 'Installiere MeroDeutsch für Offline-Lernen' : 'Install MeroDeutsch for offline learning'}</span>
          <button
            type="button"
            onClick={promptInstall}
            className="min-h-[44px] rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            {isDE ? 'Installieren' : 'Install'}
          </button>
        </div>
      )}

      <div className="mx-auto mt-6 flex flex-wrap justify-center gap-4">
        {isAuthenticated ? (
          <>
            <Link
              to="/learn"
              className={`${theme.button.primary} min-w-[180px] px-8 py-4 text-base font-semibold transition duration-300 hover:-translate-y-0.5 hover:shadow-lg`}
            >
              {isDE ? 'Weiterlernen' : 'Continue Learning'}
            </Link>
            {reviewCount > 0 && (
              <Link
                to="/dashboard"
                className={`${theme.button.secondary} min-w-[180px] px-8 py-4 text-base font-semibold transition duration-300 hover:-translate-y-0.5 hover:shadow-lg`}
              >
                {isDE ? 'Review starten' : 'Review Now'}
              </Link>
            )}
          </>
        ) : (
          <>
            <Link
              to="/alphabet"
              className={`${theme.button.primary} min-w-[180px] px-8 py-4 text-base font-semibold transition duration-300 hover:-translate-y-0.5 hover:shadow-lg`}
            >
              {isDE ? 'Jetzt starten' : 'Start Learning'}
            </Link>
            <Link
              to="/auth"
              className={`${theme.button.secondary} min-w-[180px] px-8 py-4 text-base font-semibold transition duration-300 hover:-translate-y-0.5 hover:shadow-lg`}
            >
              {isDE ? 'Anmelden' : 'Sign in / Register'}
            </Link>
          </>
        )}
      </div>
    </div>
  );

  // Region: At-a-glance stats component
  const atAGlance = (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:shadow-xl dark:border-slate-700 dark:bg-slate-950">
        <div className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">{isDE ? 'Fortschritt' : 'Progress'}</div>
        <div className="mt-4">
          <div className="flex items-end gap-3">
            <div className="text-4xl font-semibold text-slate-950 dark:text-white">{progressPct}%</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{progressCount}/26 letters</div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:shadow-xl dark:border-slate-700 dark:bg-slate-950">
        <div className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">{isDE ? 'Genauigkeit' : 'Accuracy'}</div>
        <div className="mt-4 flex items-end gap-3">
          <div className="text-4xl font-semibold text-slate-950 dark:text-white">{quizPct}%</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Quiz Score</div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${quizPct}%` }} />
        </div>
      </div>

      <div className={`rounded-[28px] ${reviewCount > 0 ? 'border-l-4 border-blue-600 dark:border-blue-500' : 'border border-slate-300 dark:border-slate-700'} bg-white p-6 shadow-sm transition duration-300 hover:shadow-xl dark:bg-slate-950`}>
        <div className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">{isDE ? 'Review' : 'Review Queue'}</div>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <div className={`text-4xl font-semibold ${reviewCount > 0 ? 'text-blue-600 dark:text-blue-600' : 'text-slate-400 dark:text-slate-500'}`}>{reviewCount}</div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{isDE ? 'Fehlerhafte Antworten' : 'Wrong answers queued'}</p>
          </div>
          <Link to="/dashboard" className={`${theme.button.secondary} px-4 py-2 text-sm`}>
            {isDE ? 'Review' : 'Review Now'}
          </Link>
        </div>
      </div>

      {/* XP Widget */}
      <XpWidget />
    </div>
  );

  // Region: Achievements component
  const achievements = (
    <div className="mb-8">
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{isDE ? 'Errungenschaften' : 'Achievements'}</h2>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
      </div>
      <div className="flex flex-wrap gap-4">
        {unlockedBadges.length > 0 &&
          unlockedBadges.map((badge) => (
            <div key={badge.id} className="flex min-w-[240px] items-start gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700 dark:bg-slate-950">
              <span className="text-3xl">{badge.icon}</span>
              <div>
                <div className="text-sm font-semibold text-slate-950 dark:text-white">{badge.label}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{badge.description}</div>
              </div>
            </div>
          ))}
        {lockedBadges.length > 0 && (
          <>
            {lockedBadges.map((badge) => (
              <div key={badge.id} className="flex min-w-[240px] items-start gap-4 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-5 opacity-70 dark:border-slate-700 dark:bg-slate-900">
                <span className="text-3xl grayscale" aria-hidden="true">🔒</span>
                <div>
                  <div className="text-sm font-semibold text-slate-400 dark:text-slate-500">{badge.label}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{badge.requirement}</div>
                </div>
              </div>
            ))}
          </>
        )}
        {unlockedBadges.length === 0 && lockedBadges.length === 0 && (
          <p className="text-slate-500 text-sm italic">{isDE ? 'Noch keine Abzeichen verfügbar.' : 'No badges available yet.'}</p>
        )}
      </div>
    </div>
  );

  // Region: Guest pitch component
  const guestPitch = (
    <div className="rounded-[32px] border border-blue-200/70 bg-blue-50/80 p-6 shadow-sm transition duration-300 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/50">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold text-slate-950 dark:text-white mb-2">{isDE ? 'Warum anmelden?' : 'Why sign in?'}</h2>
          <p className="text-base leading-8 text-slate-700 dark:text-slate-300">
            {isDE
              ? 'Registriere dich und sichere dir personalisierte Review-Listen, Fortschrittsspeicherung, tägliche Herausforderungen und Abzeichen.'
              : 'Sign in to unlock the daily challenge, personalized review, achievements, and progress reports.'}
          </p>
        </div>
        <Link to="/auth" className={`${theme.button.primary} px-7 py-3 text-base font-semibold`}>
          {isDE ? 'Jetzt registrieren' : 'Register now'}
        </Link>
      </div>
    </div>
  );

  // Region: Authenticated user layout
  // Dashboard summary + achievements + tools + Continue Learning → /learn
  // WOTD and A1 Learning Path live on /learn to avoid duplication.
  const authenticatedLayout = (
    <>
      {/* Hero section — Continue Learning now navigates to /learn */}
      {hero}

      {/* At-a-glance stats */}
      {atAGlance}

      {/* Achievements section */}
      {achievements}

      {/* Practice tools grid */}
      <PracticeToolsGrid />
    </>
  );

  // Region: Guest (not logged-in) layout
  // Guests keep access to WOTD + A1 Learning Path on the homepage.
  const guestLayout = (
    <>
      {/* Hero section */}
      {hero}

      {/* Word of the Day — visible to guests */}
      <DailyChallenge />

      {/* A1 Learning Path — visible to guests */}
      <LearningPath />

      {/* Guest pitch */}
      {guestPitch}
    </>
  );

  // Region: Render based on auth state
  return (
    <AuthGate>
      <div className={theme.page.container}>
        {isAuthenticated ? authenticatedLayout : guestLayout}
      </div>
    </AuthGate>
  );
}
