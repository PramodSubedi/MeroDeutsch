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
import { EmptyState } from '../components/EmptyState';
import { ActivityHeatmap } from '../components/ActivityHeatmap';
import { ReviewSessionManager } from '../components/ReviewSessionManager';
import { MasteryIndicator } from '../components/MasteryIndicator';
import { Link } from 'react-router-dom';
import type { WrongAnswerItem } from '../types';

/** Locale-aware number formatter shared by dashboard stats + review queue counts. */
const numberFormatter = (locale: string) => new Intl.NumberFormat(locale);

export function DashboardPage() {
  usePageTitle('Dashboard');
  const { user, isAuthenticated } = useAuth();
  const { queue, markCorrect, markResolved, clearQueue } = useReviewQueue();
  const { progress } = useProgress();
  const { langMode } = useLang();
  const { streakCount, longestStreak } = useStreak();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  const quizPct = progress.quizTotal ? Math.round((progress.quizCorrect / progress.quizTotal) * 100) : 0;
  const greeting = isDE ? 'Willkommen zurück' : 'Welcome back';
  const dashboardTitle = isDE ? 'Dashboard' : 'Dashboard';
  const reviewTitle = isDE ? 'Review-Warteschlange' : 'Review queue';
  const reviewSubtitle = isDE ? 'Konzentriere dich auf deine häufigsten Fehler.' : 'Focus on your most frequent mistakes.';
  const clearAllLabel = isDE ? 'Alle löschen' : 'Clear all';
  const resolvedLabel = isDE ? 'Erledigt' : 'Resolved';
  const overallScore = isDE ? 'Gesamtpunktzahl' : 'Overall score';
  const quizAccuracy = isDE ? 'Quiz-Genauigkeit beim Alphabet-Training.' : 'Quiz accuracy across alphabet practice.';
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <BrandMark className="text-xl" />
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{dashboardTitle}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {user ? `${greeting}, ${user.username} 👋` : 'Your learning progress and review queue.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {queue.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-300">
              <span aria-hidden="true">⚠️</span>
              {formatCount.format(queue.length)} {isDE ? 'fehlende Einträge' : 'missed items'}
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

      {/* Compact stats grid — 2 columns on mobile, 4 on desktop */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950">
          <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{isDE ? 'Alphabet' : 'Alphabet'}</div>
          <div className="mt-2 flex items-end justify-between">
            <div className="text-2xl font-bold text-slate-950 dark:text-white">{lettersPct}%</div>
            <div className="text-xs text-slate-500">{progress.practiced.length}/26</div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${lettersPct}%` }} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950">
          <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{isDE ? 'Quiz' : 'Quiz'}</div>
          <div className="mt-2 flex items-end justify-between">
            <div className="text-2xl font-bold text-slate-950 dark:text-white">{quizPctBar}%</div>
            <div className="text-xs text-slate-500">{progress.quizCorrect}/{progress.quizTotal}</div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${quizPctBar}%` }} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950">
          <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{isDE ? 'Rechtschreibung' : 'Spelling'}</div>
          <div className="mt-2 flex items-end justify-between">
            <div className="text-2xl font-bold text-slate-950 dark:text-white">{spellingPct}%</div>
            <div className="text-xs text-slate-500">{progress.spellCompleted}/10</div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full rounded-full bg-amber-500 transition-all duration-500" style={{ width: `${spellingPct}%` }} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950">
          <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{overallScore}</div>
          <div className="mt-2 flex items-end justify-between">
            <div className="text-2xl font-bold text-blue-600">{formatCount.format(quizPct)}%</div>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{quizAccuracy}</div>
        </div>
      </div>

      {/* Streak + Progress details — wider cards */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-950">
          <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{streakLabel}</div>
          <div className="mt-2 flex items-baseline gap-3">
            <div className="text-3xl font-bold text-emerald-600">{formatCount.format(streakCount)}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {isDE ? 'Längste' : 'Longest'}: {formatCount.format(longestStreak)}
            </div>
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{streakSubtitle}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-950">
          <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{progressLabel}</div>
          <div className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
            <div>{lettersPracticed}: {formatCount.format(progress.practiced.length)}/26</div>
            <div>{spellingRounds}: {formatCount.format(progress.spellCompleted)}</div>
            <div>{quizAttempts}: {formatCount.format(progress.quizTotal)}</div>
          </div>
        </div>
      </div>

      {/* Activity Heatmap */}
      <div className="mt-4">
        <ActivityHeatmap activities={activities} />
      </div>

      <div className="mt-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition-[transform,box-shadow,border-color] duration-300 hover:border-blue-300 hover:shadow-xl dark:border-slate-700 dark:bg-slate-950 dark:hover:border-blue-500">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">{reviewTitle}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{reviewSubtitle}</p>
          </div>
          {queue.length > 0 && (
            <button type="button" onClick={clearQueue} className={theme.button.secondary}>
              {clearAllLabel}
            </button>
          )}
        </div>

        {/* SRS Review Session Manager (filter tabs + flashcard player + summary) — embedded, no nested card */}
        <ReviewSessionManager
          queue={queue}
          onMarkCorrect={markCorrect}
          embedded
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
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${item.moduleType === 'alphabet' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : item.moduleType === 'numbers' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' : item.moduleType === 'calendar' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : item.moduleType === 'articles' ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' : item.moduleType === 'greetings' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' : item.moduleType === 'grammar' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : item.moduleType === 'pronunciation' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' : item.moduleType === 'dictation' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                        {item.moduleType}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${isDue(item) ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                        {isDue(item) ? dueLabel : scheduledLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      {item.itemKey}
                      <MasteryIndicator boxLevel={item.boxLevel} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => markCorrect(item.id)} className={theme.button.primary}>
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