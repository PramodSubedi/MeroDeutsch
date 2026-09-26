import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { useProgress } from '../hooks/useProgress';
import { useProgressMetrics } from '../hooks/useProgressMetrics';
import { useStreak } from '../hooks/useStreak';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { useXp } from '../hooks/useXp';
import { useActivityLog } from '../hooks/useActivityLog';
import { theme } from '../config/theme';
import { BrandMark } from '../components/BrandMark';
import { ActivityHeatmap } from '../components/ActivityHeatmap';
import { EmptyState } from '../components/EmptyState';
import { useA1Path } from '../hooks/useA1Path';
import { useHasA1Campaign } from '../hooks/usePremium';
import { A1_UNITS } from '../data/a1Path';
import { useVocabularyStatus } from '../hooks/useVocabularyStatus';
import { useSkillAccuracy, useWeakItems, skillLabel } from '../hooks/useSkillAccuracy';

/** Build a last-30-day activity series from the activity log entries. */
function buildDailySeries(activities: { date: string; count: number }[], days: number = 30) {
  const today = new Date();
  const series: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const match = activities.find((a) => a.date === dateStr);
    series.push({ date: dateStr, count: match?.count ?? 0 });
  }
  return series;
}

/** Format a short date label for chart tooltips. */
function shortDate(dateStr: string, isDE: boolean): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(isDE ? 'de-DE' : 'en-US', { month: 'short', day: 'numeric' });
}

function ChartDataTable({
  rows,
  isDE,
}: {
  rows: Array<{ label: string; value: number | string }>;
  isDE: boolean;
}) {
  return (
    <details className="mt-3 text-body">
      <summary className="cursor-pointer rounded-sm py-1 font-medium text-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-accent-300">
        {isDE ? 'Datentabelle anzeigen' : 'View data table'}
      </summary>
      <div className="mt-2 max-h-48 overflow-auto rounded-sm border border-ink-200 dark:border-ink-700">
        <table className="w-full text-left text-meta">
          <thead className="sticky top-0 bg-ink-100 dark:bg-ink-800">
            <tr>
              <th scope="col" className="px-3 py-2">{isDE ? 'Kategorie' : 'Category'}</th>
              <th scope="col" className="px-3 py-2">{isDE ? 'Wert' : 'Value'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-ink-100 dark:border-ink-800">
                <th scope="row" className="px-3 py-2 font-medium">{row.label}</th>
                <td className="px-3 py-2">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function AnalyticsPage() {
  usePageTitle('Analytics');
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  const { progress } = useProgress();
  const { streakCount, longestStreak } = useStreak();
  const { queue } = useReviewQueue();
  const { totalXp, level, rank, xpProgress } = useXp();
  const { activities } = useActivityLog();
  const { attemptsByUnit, isCheckpointComplete } = useA1Path();
  const { hasCampaign } = useHasA1Campaign();

  // --- Real chart data ---

  // Daily activity for the last 30 days (from activity log)
  const dailyActivity = useMemo(() => buildDailySeries(activities, 30), [activities]);

  // Shared progress percentages (single source — see useProgressMetrics).
  const { quizPct: alphabetAccuracy, spellingPct: spellingAccuracy } = useProgressMetrics();

  // Module accuracy bar chart data (from useProgress)
  const moduleAccuracy = useMemo(
    () => [
      { name: isDE ? 'Alphabet-Quiz' : 'Alphabet Quiz', value: alphabetAccuracy },
      { name: isDE ? 'Rechtschreibung' : 'Spelling', value: spellingAccuracy },
    ],
    [alphabetAccuracy, spellingAccuracy, isDE],
  );

  /* ── Course-scoped analytics (Wave 4) ────────────────────────────────
   * Everything above is Alphabet-era: two percentages derived from a single
   * module's counters. It describes a page's worth of one optional side track
   * while the page itself is called "Learning Analytics" and the learner's
   * actual course is six bands and five gates.
   *
   * These four panels are what the page was always being asked for:
   *   1. how far through the COURSE am I, and how did each gate go?
   *   2. how many words do I actually know?
   *   3. which SKILL is weak (vs. which module)?
   *   4. which specific ITEMS keep costing me points?
   * All four read state the app already stores — nothing new is tracked.
   */

  // 1. Per-band gate history from the A1 path state.
  const bandRows = useMemo(() => {
    return A1_UNITS.filter((band) => band.kind === 'core').map((band) => {
      const attempt = attemptsByUnit[band.index];
      return {
        code: band.code,
        name: isDE ? band.title.de : band.title.en,
        attempts: attempt?.attempts ?? 0,
        bestPct: attempt ? Math.round(attempt.best * 100) : null,
        passed: isCheckpointComplete(band.index),
      };
    });
  }, [attemptsByUnit, isCheckpointComplete, isDE]);

  // 2. Vocabulary coverage — known/mastered vs new, from the per-word status
  //    store every drill already writes into Dexie `vocabStats`.
  const { knownCount, newCount, statsByWord } = useVocabularyStatus();
  const learnedCount = Object.keys(statsByWord).length;
  const vocabularyRows = useMemo(
    () => [
      { label: isDE ? 'Gewusst / gemeistert' : 'Known / mastered', value: knownCount },
      { label: isDE ? 'Im Lernen' : 'Learning', value: Math.max(0, learnedCount - newCount - knownCount) },
      { label: isDE ? 'Neu' : 'New', value: newCount },
    ],
    [knownCount, newCount, learnedCount, isDE]
  );

  // 3. Per-skill accuracy — the radar's numbers, as a table, so the page is
  //    readable without a chart and without colour.
  const { skills } = useSkillAccuracy();
  const skillRows = useMemo(
    () => skills.map((s) => ({ label: skillLabel(s.category, isDE), value: s.total > 0 ? `${s.accuracy}%` : '—' })),
    [skills, isDE]
  );

  // 4. The specific items that keep costing points, worst first.
  const weakItems = useWeakItems(8);

  // Wrong answers by module type (from review queue)
  const errorsByModule = useMemo(() => {
    const counts: Record<string, number> = {};
    queue.forEach((item) => {
      counts[item.moduleType] = (counts[item.moduleType] || 0) + item.errorCount;
    });
    return Object.entries(counts).map(([module, count]) => ({ module, count }));
  }, [queue]);

  // Summary stats (real values)
  const totalActiveDays = useMemo(
    () => activities.filter((a) => a.count > 0).length,
    [activities],
  );

  // Empty state check: has the user done anything yet?
  const hasAnyData =
    totalXp > 0 || progress.quizTotal > 0 || progress.spellCompleted > 0 || queue.length > 0 || activities.some((a) => a.count > 0);

  const title = isDE ? 'Lernanalytik' : 'Learning Analytics';
  const description = isDE
    ? 'Verfolge deinen Fortschritt und Lernroutinen.'
    : 'Track your progress and learning habits.';

  const chartColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

  return (
    <div className={theme.page.container}>
      <div className="mb-4 flex items-center gap-3">
        <BrandMark linked light className="text-lg" />
        <span className="text-body text-ink-500 dark:text-ink-400">Analytics</span>
      </div>
      <h1 className={theme.page.heading}>{title}</h1>
      <p className={theme.page.description}>{description}</p>

      {!hasAnyData ? (
        <div className="mt-8">
          <EmptyState
            icon="📊"
            title={isDE ? 'Noch keine Daten' : 'No data yet'}
            description={
              isDE
              ? 'Übe ein paar Vokabeln oder absolviere Quizze, um deine Lernanalytik hier zu sehen. Deine Aktivität wird Schritt für Schritt aufgezeichnet.'
              : 'Complete a few lessons or quizzes to see your learning analytics here. Your activity will be recorded day by day.'}
            actionLabel={isDE ? 'Zum Alphabet →' : 'Go to Alphabet →'}
            actionTo="/alphabet"
          />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* ── COURSE PROGRESS — A1 CAMPAIGN, so Premium only.
              Every number comes from `useA1Path`, the same state the spine
              renders, so for a Premium learner this panel and /learn can never
              disagree. For a free learner it would be five permanently
              unattempted gates — a course they are not enrolled in — so the
              whole panel is omitted rather than shown as zeroes. Their
              course position lives on /learn. */}
          {hasCampaign && (
            <section className={theme.panel.surface}>
              <h2 className="mb-1 text-lg font-semibold text-ink-950 dark:text-white">
                {isDE ? 'Dein A1-Kurs' : 'Your A1 course'}
              </h2>
              <p className="mb-4 text-meta text-ink-500 dark:text-ink-400">
                {isDE
                  ? 'Jedes Band wird mit einem Tor freigeschaltet (mindestens 80 %).'
                  : 'Each band unlocks with a gate (80% or better).'}
              </p>
              {bandRows.every((b) => b.attempts === 0) ? (
                <p className="text-body text-ink-500 dark:text-ink-400">
                  {isDE ? 'Noch kein Tor versucht.' : 'No gate attempted yet.'}
                </p>
              ) : (
                <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                  {bandRows.map((b) => (
                    <li key={b.code} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                      <span
                        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-meta font-bold ${
                          b.passed
                            ? 'bg-success-100 text-success-700 dark:bg-success-900/40'
                            : b.attempts > 0
                              ? 'bg-warning-100 text-warning-700 dark:bg-warning-900/40'
                              : 'bg-ink-100 text-ink-500 dark:bg-ink-800'
                        }`}
                      >
                        {b.code}
                      </span>
                      <span className="font-medium text-ink-800 dark:text-ink-200">{b.name}</span>
                      <span className="ml-auto text-meta text-ink-500 dark:text-ink-400">
                        {b.attempts === 0
                          ? isDE ? 'Nicht versucht' : 'Not attempted'
                          : `${b.bestPct}% · ${b.attempts} ${isDE ? 'Versuche' : b.attempts === 1 ? 'try' : 'tries'}`}
                      </span>
                      {b.passed && (
                        <span className="text-meta font-semibold text-success-700 dark:text-success-300">
                          {isDE ? 'bestanden' : 'passed'}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          <div className="grid gap-6 lg:grid-cols-1 xl:grid-cols-2">
            {/* ── VOCABULARY COVERAGE ──────────────────────────────────
                "How many words do I actually know?" was unanswerable before:
                `useVocabularyStatus` has tracked new → learning → known →
                mastered per word all along, but nothing surfaced it. */}
            <section className={theme.panel.surface}>
              <h2 className="mb-4 text-lg font-semibold text-ink-950 dark:text-white">
                {isDE ? 'Wortschatz-Abdeckung' : 'Vocabulary coverage'}
              </h2>
              {learnedCount === 0 ? (
                <p className="text-body text-ink-500 dark:text-ink-400">
                  {isDE ? 'Noch keine Wörter geübt.' : 'No words practised yet.'}
                </p>
              ) : (
                <>
                  <ul className="space-y-2">
                    {vocabularyRows.map((r) => (
                      <li key={r.label} className="flex items-center justify-between text-body">
                        <span className="text-ink-700 dark:text-ink-300">{r.label}</span>
                        <span className="font-semibold text-ink-900 dark:text-white">{r.value}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-meta text-ink-500 dark:text-ink-400">
                    {isDE
                      ? `${learnedCount} Wörter bisher bearbeitet.`
                      : `${learnedCount} words encountered so far.`}
                  </p>
                </>
              )}
            </section>

            {/* ── SKILL ACCURACY ───────────────────────────────────────
                The radar's numbers as plain rows, readable without colour
                or a chart. Same `useSkillAccuracy` the Dashboard uses. */}
            <section className={theme.panel.surface}>
              <h2 className="mb-4 text-lg font-semibold text-ink-950 dark:text-white">
                {isDE ? 'Genauigkeit nach Fähigkeit' : 'Accuracy by skill'}
              </h2>
              <ChartDataTable rows={skillRows} isDE={isDE} />
            </section>
          </div>

          {/* ── WEAKEST ITEMS ───────────────────────────────────────────
              The items costing the most points, straight from the SRS rows.
              This is the actionable end of the page: every drill now
              front-loads exactly these keys. */}
          <section className={theme.panel.surface}>
            <h2 className="mb-1 text-lg font-semibold text-ink-950 dark:text-white">
              {isDE ? 'Deine schwächsten Items' : 'Your weakest items'}
            </h2>
            <p className="mb-4 text-meta text-ink-500 dark:text-ink-400">
              {isDE
                ? 'Diese Items werden in deinen Übungen zuerst wiederholt.'
                : 'These are front-loaded in your drills.'}
            </p>
            {weakItems.length === 0 ? (
              <p className="text-body text-ink-500 dark:text-ink-400">
                {isDE ? 'Noch keine Fehler erfasst — alles läuft.' : 'No mistakes recorded — nothing to fix yet.'}
              </p>
            ) : (
              <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                {weakItems.map((w) => (
                  <li key={`${w.moduleType}:${w.itemKey}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <span className="min-w-0 flex-1 truncate font-medium text-ink-800 dark:text-ink-200">
                      {w.correctAnswer || w.itemKey}
                    </span>
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-micro font-semibold text-ink-600 dark:bg-ink-800 dark:text-ink-300">
                      {w.moduleType}
                    </span>
                    <span className="text-meta font-semibold text-danger-700 dark:text-danger-300">
                      {w.errorCount}×
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Legacy Alphabet-era charts, kept but demoted below the
              course-scoped panels: they still measure the optional
              letter-practice track, they just shouldn't be the story on a
              page called "Learning Analytics". */}
          <div className="grid gap-6 lg:grid-cols-1 xl:grid-cols-2">
          <div className={theme.panel.surface}>
            <h2 className="mb-4 text-lg font-semibold text-ink-950 dark:text-white">
              {isDE ? 'Aktivität in den letzten 30 Tagen' : 'Activity (Last 30 Days)'}
            </h2>
            {dailyActivity.every((d) => d.count === 0) ? (
              <div className="text-center py-8 text-body text-ink-500 dark:text-ink-400">
                {isDE ? 'Keine Aktivität aufgezeichnet.' : 'No activity recorded yet.'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyActivity} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => shortDate(d, isDE)}
                    stroke="#64748b"
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis stroke="#64748b" />
                  <Tooltip
                    labelFormatter={(d) => shortDate(d as string, isDE)}
                    formatter={(value) => [value, isDE ? 'Aktivitäten' : 'activities']}

                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
            <ChartDataTable
              isDE={isDE}
              rows={dailyActivity.map((day) => ({ label: shortDate(day.date, isDE), value: day.count }))}
            />
          </div>

          {/* Module Accuracy - Bar Chart */}
          <div className={theme.panel.surface}>
            <h2 className="mb-4 text-lg font-semibold text-ink-950 dark:text-white">
              {isDE ? 'Modulgenauigkeit' : 'Module Accuracy'}
            </h2>
            {moduleAccuracy.every((m) => m.value === 0) ? (
              <div className="text-center py-8 text-body text-ink-500 dark:text-ink-400">
                {isDE ? 'Noch keine Quizze absolviert.' : 'No quizzes completed yet.'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={moduleAccuracy} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                  <XAxis dataKey="name" stroke="#64748b" />
                  <YAxis domain={[0, 100]} stroke="#64748b" />
                    <Tooltip formatter={(value) => [`${value ?? 0}%`, isDE ? 'Genauigkeit' : 'Accuracy']} />

                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <ChartDataTable
              isDE={isDE}
              rows={moduleAccuracy.map((item) => ({ label: item.name, value: `${item.value}%` }))}
            />
          </div>

          {/* Errors by Module - Bar Chart */}
          <div className={theme.panel.surface}>
            <h2 className="mb-4 text-lg font-semibold text-ink-950 dark:text-white">
              {isDE ? 'Fehler pro Modul' : 'Errors by Module'}
            </h2>
            {errorsByModule.length === 0 ? (
              <div className="text-center py-8 text-body text-ink-500 dark:text-ink-400">
                {isDE ? 'Keine Fehler in der Review-Warteschlange.' : 'No errors in the review queue.'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={errorsByModule} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                  <XAxis dataKey="module" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                    <Tooltip formatter={(value) => [value, isDE ? 'Fehler' : 'errors']} />

                  <Bar dataKey="count" fill={chartColors[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <ChartDataTable
              isDE={isDE}
              rows={errorsByModule.map((item) => ({ label: item.module, value: item.count }))}
            />
          </div>

          {/* Summary Stats */}
          <div className="space-y-4">
            <div className={theme.panel.accent}>
              <h3 className="text-body font-semibold text-ink-600 dark:text-ink-400">
                {isDE ? 'Übersicht' : 'Overview'}
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold text-accent-600 dark:text-accent-400">{streakCount}</div>
                  <div className="text-meta text-ink-500 dark:text-ink-400">
                    {isDE ? 'Aktuelle Serie (Tage)' : 'Current Streak (days)'}
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-success-600 dark:text-success-400">{longestStreak}</div>
                  <div className="text-meta text-ink-500 dark:text-ink-400">
                    {isDE ? 'Längste Serie (Tage)' : 'Longest Streak (days)'}
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-warning-600 dark:text-warning-400">{totalXp}</div>
                  <div className="text-meta text-ink-500 dark:text-ink-400">
                    {isDE ? 'Gesamt-XP' : 'Total XP'}
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-accent-600 dark:text-accent-400">{level}</div>
                  <div className="text-meta text-ink-500 dark:text-ink-400">{rank}</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-accent-600 dark:text-accent-400">{queue.length}</div>
                  <div className="text-meta text-ink-500 dark:text-ink-400">
                    {isDE ? 'Review-Einträge' : 'Review Items'}
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-success-600 dark:text-success-400">{totalActiveDays}</div>
                  <div className="text-meta text-ink-500 dark:text-ink-400">
                    {isDE ? 'Aktive Tage (30d)' : 'Active Days (30d)'}
                  </div>
                </div>
              </div>
            </div>

            {/* Progress details */}
            <div className={theme.panel.surface}>
              <h3 className="text-body font-semibold text-ink-600 dark:text-ink-400 mb-2">
                {isDE ? 'Lernfortschritt' : 'Progress'}
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-body">
                    <span className="text-ink-500 dark:text-ink-400">
                      {isDE ? 'Quiz-Genauigkeit' : 'Quiz Accuracy'}
                    </span>
                    <span className="font-medium text-ink-900 dark:text-white">
                      {progress.quizTotal
                        ? `${Math.round((progress.quizCorrect / progress.quizTotal) * 100)}%`
                        : isDE ? 'Keine Daten' : 'No data'}
                    </span>
                  </div>
                  {progress.quizTotal > 0 && (
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                      <div
                        className="h-full rounded-full bg-accent-500"
                        style={{ width: `${Math.round((progress.quizCorrect / progress.quizTotal) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex justify-between text-body">
                    <span className="text-ink-500 dark:text-ink-400">
                      {isDE ? 'Buchstaben geübt' : 'Letters Practiced'}
                    </span>
                    <span className="font-medium text-ink-900 dark:text-white">
                      {progress.practiced.length}/26
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-body">
                    <span className="text-ink-500 dark:text-ink-400">
                      {isDE ? 'Rechtschreibung abgeschlossen' : 'Spelling Completed'}
                    </span>
                    <span className="font-medium text-ink-900 dark:text-white">
                      {progress.spellCompleted}/10
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-body">
                    <span className="text-ink-500 dark:text-ink-400">
                      {isDE ? 'XP-Fortschritt' : 'XP Progress'}
                    </span>
                    <span className="font-medium text-ink-900 dark:text-white">{xpProgress}%</span>
                  </div>
                  {totalXp > 0 && (
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                      <div className="h-full rounded-full bg-warning-500" style={{ width: `${xpProgress}%` }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Activity Heatmap (reuse the component) */}
          <div className="mt-4">
            <ActivityHeatmap activities={activities} />
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
