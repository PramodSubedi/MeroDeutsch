import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useRapidFireGame } from '../hooks/useRapidFireGame';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDailyQuests } from '../hooks/useDailyQuests';
import { useAchievements } from '../hooks/useAchievements';
import { useSyncBridge } from '../hooks/useSyncBridge';
import { speakGerman } from '../utils/audioService';
import { theme } from '../config/theme';
import { GetReadyCountdown } from '../components/common/GetReadyCountdown';

/**
 * Rapid-Fire Blitz — 60 seconds of der/die/das at speed.
 *
 * Game state lives in `useRapidFireGame` (timer, combo, XP, SRS misses,
 * high-score persistence). This page is pure UI: idle intro, fast-play
 * screen with zero-delay card transitions, and an end-of-blitz summary.
 */
export function RapidFirePage() {
  usePageTitle('Rapid Fire | MeroDeutsch');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { quests, reportBlitzPlayed, reportReview, reportAccuracy, claimReward } = useDailyQuests();
  const { unlockBadge } = useAchievements();
  const { queueAchievementUnlock } = useSyncBridge();

  const {
    status,
    currentItem,
    secondsLeft,
    score,
    combo,
    multiplier,
    wpm,
    accuracy,
    missedWords,
    xpEarned,
    bestScore,
    bestWpm,
    lastRun,
    answer,
    startGame,
    startPlaying,
    isLoading,
  } = useRapidFireGame();

  const t = {
    title: isDE ? '⚡ Schnellfeuer-Blitz' : '⚡ Rapid-Fire Blitz',
    subtitle: isDE
      ? '60 Sekunden. Der, Die, Das. So schnell du kannst!'
      : '60 seconds. Der, Die, Das. As fast as you can!',
    start: isDE ? 'Blitz starten ⚡' : 'Start Blitz ⚡',
    rules: isDE
      ? 'Richtig = +10 XP (1.5× bei Combo 3, 2× bei Combo 5). Falsch = Combo-Reset + Review-Eintrag.'
      : 'Correct = +10 XP (1.5× at combo 3, 2× at combo 5). Wrong = combo reset + review entry.',
    best: isDE ? 'Rekord' : 'Best',
    bestWpm: isDE ? 'Rekord-WPM' : 'Best WPM',
    time: isDE ? 'Zeit' : 'Time',
    scoreLabel: isDE ? 'Punkte' : 'Score',
    comboLabel: isDE ? 'Combo' : 'Combo',
    multiplierLabel: isDE ? 'Multiplikator' : 'Multiplier',
    wpmLabel: 'WPM',
    accuracyLabel: isDE ? 'Genauigkeit' : 'Accuracy',
    finishedTitle: isDE ? 'Blitz vorbei! 🎉' : 'Blitz Complete! 🎉',
    xpEarned: isDE ? 'Erhaltene XP' : 'XP Earned',
    missed: isDE ? 'Verpasste Wörter' : 'Words Missed',
    noneMissed: isDE ? 'Perfekt — nichts verpasst!' : 'Perfect — nothing missed!',
    playAgain: isDE ? 'Nochmal spielen' : 'Play Again',
    backPractice: isDE ? 'Zurück zur Übung' : 'Back to Practice',
    loading: isDE ? 'Wörter werden geladen…' : 'Loading words…',
    newBest: isDE ? '🎉 Neuer Rekord!' : '🎉 New Best!',
  };

  // Auto-speak only the noun (not the article) to avoid spoiling the answer.
  // User must choose the article first, then can hear/verify the full phrase.
  useEffect(() => {
    if (!currentItem) return;
    speakGerman(currentItem.noun);
  }, [currentItem]);

  // Daily quest + achievement wiring on game finish:
  //   - Accuracy Master quest gets the final accuracy ratio.
  //   - The ≥80% accuracy badge unlocks and is queued for cloud sync.
  //   - Any completed quests are claimed for XP.
  useEffect(() => {
    if (status !== 'finished') return;

    if (accuracy >= 80) {
      reportAccuracy(accuracy / 100);
      unlockBadge('accuracy-master');
      queueAchievementUnlock('accuracy-master');
    }

    const completed = quests.find((q) => q.completed && !q.claimed);
    if (completed) {
      claimReward(completed.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, accuracy]);

  if (isLoading) {
    return (
      <div className={`${theme.page.container} flex min-h-[60vh] items-center justify-center`}>
        <div className="text-center text-slate-500 dark:text-slate-400">{t.loading}</div>
      </div>
    );
  }

  // ── Idle / ready state ────────────────────────────────────────
  if (status === 'idle') {
    return (
      <div className={theme.page.container}>
        <div className="mx-auto w-full max-w-xl px-2 sm:px-0">
          <div className={theme.panel.surface}>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">{t.title}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t.subtitle}</p>

            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-700 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-slate-300">
              {t.rules}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.best}</div>
                <div className="mt-1 text-2xl font-bold text-blue-600">{bestScore}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.bestWpm}</div>
                <div className="mt-1 text-2xl font-bold text-emerald-600">{bestWpm}</div>
              </div>
            </div>

            {lastRun && (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                {isDE ? 'Letzter Lauf' : 'Last run'}: {lastRun.score} XP · {lastRun.wpm} WPM · {lastRun.accuracy}%
              </div>
            )}

            <button
              type="button"
              onClick={startGame}
              className={`${theme.button.primary} mt-6 w-full text-lg`}
            >
              {t.start}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Countdown (3→2→1→GO!) ─────────────────────────────────────
  if (status === 'countdown') {
    return (
      <div className={theme.page.container}>
        <div className="mx-auto flex min-h-[80vh] w-full max-w-xl items-center justify-center px-2 sm:px-0">
          <div className="text-center">
            <GetReadyCountdown onDone={startPlaying} title={t.title} />
          </div>
        </div>
      </div>
    );
  }

  // ── Playing state ─────────────────────────────────────────────
  if (status === 'playing') {
    const comboActive = combo >= 3;
    return (
      <div className={theme.page.container}>
        <div className="mx-auto w-full max-w-xl px-2 sm:px-0">
          <div className={theme.panel.surface}>
            {/* Timer bar */}
            <div className="mb-4">
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>{t.time}</span>
                <span>{secondsLeft}s</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-1000"
                  style={{ width: `${(secondsLeft / 60) * 100}%` }}
                />
              </div>
            </div>

            {/* HUD */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
              <span className="text-slate-700 dark:text-slate-200">
                {t.scoreLabel}: <span className="text-blue-600">{score}</span>
              </span>
              <span className="text-slate-700 dark:text-slate-200">
                {t.wpmLabel}: <span className="text-emerald-600">{wpm}</span>
              </span>
              <span className="text-slate-700 dark:text-slate-200">
                {t.accuracyLabel}: <span className="text-amber-600">{accuracy}%</span>
              </span>
              {/* Combo fire indicator */}
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold ${comboActive ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                🔥 {combo} {t.comboLabel} · {multiplier}×
              </span>
            </div>

            {/* Current card — big + centered */}
            {currentItem && (
              <div className="rounded-3xl border-2 border-blue-200 bg-blue-50 p-8 text-center dark:border-blue-800 dark:bg-blue-950/40">
                <div className="text-5xl font-extrabold text-slate-900 dark:text-white">{currentItem.noun}</div>
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{currentItem.meaning}</div>
              </div>
            )}

            {/* Article buttons — zero-delay answers */}
            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
              {(['der', 'die', 'das'] as const).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => {
                    answer(choice);
                    // Daily quest hooks — triggered by real gameplay actions:
                    //   Speed Demon = +1 blitz round played,
                    //   SRS Scholar = +1 review progress per answer.
                    reportBlitzPlayed();
                    reportReview(1);
                  }}
                  className={`min-h-[72px] rounded-3xl text-xl font-extrabold text-white shadow-lg transition-colors ${
                    choice === 'der'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : choice === 'die'
                      ? 'bg-pink-600 hover:bg-pink-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {choice.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Finished / summary modal ──────────────────────────────────
  const isNewBest = lastRun !== undefined && score >= lastRun.score;
  return (
    <div className={theme.page.container}>
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div className="relative mt-[5%] w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800 dark:text-slate-100">
          <div className="text-center">
            <div className="text-4xl font-extrabold text-slate-900 dark:text-white">{t.finishedTitle}</div>
            {isNewBest && <div className="mt-2 text-sm font-bold text-emerald-600">{t.newBest}</div>}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/40">
              <div className="text-xs uppercase tracking-wider text-slate-500">{t.xpEarned}</div>
              <div className="mt-1 text-2xl font-bold text-blue-600">+{xpEarned}</div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
              <div className="text-xs uppercase tracking-wider text-slate-500">{t.wpmLabel}</div>
              <div className="mt-1 text-2xl font-bold text-emerald-600">{wpm}</div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
              <div className="text-xs uppercase tracking-wider text-slate-500">{t.accuracyLabel}</div>
              <div className="mt-1 text-2xl font-bold text-amber-600">{accuracy}%</div>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-950/40">
              <div className="text-xs uppercase tracking-wider text-slate-500">{t.missed}</div>
              <div className="mt-1 text-2xl font-bold text-rose-600">{missedWords.length}</div>
            </div>
          </div>

          {missedWords.length > 0 && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-2 font-semibold text-slate-700 dark:text-slate-200">{t.missed}:</div>
              <div className="flex flex-wrap gap-1.5">
                {[...new Set(missedWords)].map((w) => (
                  <span key={w} className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2">
            <button type="button" onClick={startGame} className={theme.button.primary}>
              {t.playAgain}
            </button>
            <Link to="/practice" className={`${theme.button.secondary} text-center`}>
              {t.backPractice}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
