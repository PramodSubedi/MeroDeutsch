/**
 * src/components/dashboard/CheckpointTrajectory.tsx
 *
 * THE LEARNER'S SCORE LINE — best checkpoint score per unit, in course order.
 *
 * WHY THIS CHART, AND WHY IT DIDN'T EXIST
 * ---------------------------------------
 * The Dashboard showed *how many* gates you passed (`CoursePosition`), the skill
 * radar showed *which skill* is weak, and the heatmap showed *when* you were
 * active. Nothing showed the thing a learner working through a course actually
 * wants to know: **"am I getting better, or am I just getting further?"**
 *
 * The data for that has been persisted the whole time — `useA1Path().attemptsByUnit`
 * carries `{ attempts, best, lastScore }` per unit, and `best` is the same figure
 * `gateAveragePct` averages — but no surface ever plotted it. It was a column
 * summed into a single number and thrown away.
 *
 * WHY BEST AND NOT LAST
 * ---------------------
 * `lastScore` is the score of the most recent attempt, which on a course with no
 * cooldown means a learner who re-takes a gate after a bad day draws a line that
 * looks like decline. `best` is monotonic, so the line only ever reflects real
 * progress. Attempt count is shown as a label, so the "just grind until it
 * passes" behaviour is visible rather than hidden.
 *
 * THE 80% RULE IS DRAWN, NOT STATED
 * ---------------------------------
 * `CHECKPOINT_PASS_THRESHOLD` in `useA1Path` is the contract: a gate passes at
 * 80%. Rendering that as a horizontal reference line means every bar above or
 * below it is self-explanatory, and the same number cannot drift from the rule
 * because it is imported from the rule's own module — not retyped here.
 *
 * A BAR CHART, NOT A LINE
 * -----------------------
 * A line implies continuity between units — that unit 4 "leads into" unit 5.
 * These are independent assessments, some retaken many times, and the gaps for
 * not-yet-reached units are absences rather than zeroes. Bars with a
 * `ReferenceLine` at the pass mark say exactly that and nothing more.
 */
import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { useA1Path } from '../../hooks/useA1Path';
import { A1_CURRICULUM, CHECKPOINT_PASS_THRESHOLD } from '../../data/a1Path';
import { useChartTokens } from '../../hooks/useChartTokens';

const PASS_PCT = Math.round(CHECKPOINT_PASS_THRESHOLD * 100);

interface Row {
  code: string;
  /** Best score 0..100, or null when the learner has not attempted it. */
  best: number | null;
  attempts: number;
}


export function CheckpointTrajectory() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { attemptsByUnit } = useA1Path();
  const t = useChartTokens();

  // Every unit, in course order — INCLUDING unattempted ones, as `best: null`.
  // Omitting them would compress the x-axis and make unit 3 look adjacent to
  // unit 14.
  const rows = useMemo<Row[]>(
    () =>
      A1_CURRICULUM.units.map((unit) => {
        const record = attemptsByUnit[unit.index];
        return {
          code: unit.code,
          best: record ? Math.round(record.best * 100) : null,
          attempts: record?.attempts ?? 0,
        };
      }),
    [attemptsByUnit],
  );

  const attempted = rows.filter((r) => r.best !== null);
  const hasData = attempted.length > 0;
  const attemptsTotal = rows.reduce((sum, r) => sum + r.attempts, 0);

  // "Am I getting better, or just further?" — first half of what was actually
  // attempted vs the second half. Needs >= 3 attempts, because a 1-vs-1
  // "trend" is noise presented as insight.
  const trend = useMemo(() => {
    if (attempted.length < 3) return null;
    const mid = Math.floor(attempted.length / 2);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const early = mean(attempted.slice(0, mid).map((r) => r.best as number));
    const late = mean(attempted.slice(mid).map((r) => r.best as number));
    return Math.round(late - early);
  }, [attempted]);

  return (
    <section
      aria-labelledby="trajectory-heading"
      className="overflow-hidden rounded-lg border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink-150 px-4 py-3 sm:px-5 dark:border-ink-850">
        <h2
          id="trajectory-heading"
          className="flex items-center gap-2 text-micro font-extrabold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400"
        >
          <TrendingUp className="h-3.5 w-3.5 shrink-0 text-accent-600 dark:text-accent-400" aria-hidden="true" />
          {isDE ? 'Prüfungsverlauf' : 'Checkpoint trajectory'}
        </h2>
        {trend !== null && (
          <p className="font-mono text-meta font-semibold tabular-nums text-ink-600 dark:text-ink-300">
            {trend > 0 ? `+${trend}` : trend}
            <span className="ml-1 font-sans font-normal text-ink-500 dark:text-ink-400">
              {isDE ? 'Punkte Trend' : 'pts trend'}
            </span>
          </p>
        )}
      </div>


      <div className="px-4 py-4 sm:px-5">
        {!hasData ? (
          // An empty chart is worse than no chart: a flat zero axis reads as
          // "you scored nothing" rather than "there is nothing yet".
          <p className="rounded-md border border-dashed border-ink-300 bg-ink-50 px-4 py-6 text-center text-body text-ink-500 dark:border-ink-700 dark:bg-ink-800/40 dark:text-ink-400">
            {isDE
              ? 'Noch keine Prüfung absolviert — dein Verlauf erscheint nach dem ersten Gate.'
              : 'No checkpoint attempted yet — your score line appears after your first gate.'}
          </p>
        ) : (
          <>
            {/* Decorative for AT: every value drawn here is also in the table
                below. Sixteen unlabelled bars are noise to a screen reader. */}
            <div className="h-56 w-full" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barCategoryGap="22%">
                  <CartesianGrid stroke={t.grid} strokeOpacity={0.7} vertical={false} />
                  <XAxis
                    dataKey="code"
                    tick={{ fill: t.axis, fontSize: 10, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: t.axis, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                  />
                  <ReferenceLine
                    y={PASS_PCT}
                    stroke={t.success}
                    strokeDasharray="4 4"
                    strokeOpacity={0.9}
                    label={{
                      value: `${PASS_PCT}%`,
                      position: 'insideTopRight',
                      fill: t.success,
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  />

                  <Tooltip
                    cursor={{ fill: t.grid, fillOpacity: 0.35 }}
                    contentStyle={{
                      borderRadius: 8,
                      border: `1px solid ${t.tooltipBorder}`,
                      background: t.tooltipBg,
                      color: t.tooltipText,
                      fontSize: 12,
                    }}
                    formatter={(_v: unknown, _n: unknown, item: { payload?: Row }) => {
                      const row = item?.payload;
                      if (!row || row.best === null) return ['—', isDE ? 'Bestwert' : 'Best'];
                      const tries = isDE
                        ? `${row.attempts} ${row.attempts === 1 ? 'Versuch' : 'Versuche'}`
                        : `${row.attempts} ${row.attempts === 1 ? 'attempt' : 'attempts'}`;
                      return [`${row.best}% · ${tries}`, isDE ? 'Bestwert' : 'Best'];
                    }}
                    // recharts types `label` as ReactNode, not string, even though
                    // for this x-axis (a unit code) it always receives one.
                    labelFormatter={(label) => String(label ?? '')}
                  />
                  <Bar dataKey="best" radius={[3, 3, 0, 0]} maxBarSize={26}>
                    {/* Colour carries meaning: at/above the gate reads as passed,
                        below as not yet. Unattempted stays TRANSPARENT rather than
                        drawing a zero-height sliver at the baseline. */}
                    {rows.map((row) => (
                      <Cell
                        key={row.code}
                        fill={row.best === null ? 'transparent' : row.best >= PASS_PCT ? t.success : t.accent}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* THE ACCESSIBLE EQUIVALENT — every number in the chart, as text.
                A 16-bar chart is unreadable with a screen reader; this is the
                same data, and it also answers "which unit am I worst at"
                without hunting for the shortest bar. */}
            <details className="group mt-3">
              <summary className="cursor-pointer list-none text-meta font-medium text-accent-600 dark:text-accent-400">
                <span className="group-open:hidden">{isDE ? 'Werte anzeigen' : 'Show values'}</span>
                <span className="hidden group-open:inline">
                  {isDE ? 'Werte ausblenden' : 'Hide values'}
                </span>
              </summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-meta tabular-nums">
                  <caption className="sr-only">
                    {isDE
                      ? 'Bester Prüfungswert und Versuche pro Einheit'
                      : 'Best checkpoint score and attempt count per unit'}
                  </caption>
                  <thead>
                    <tr className="text-micro uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
                      <th scope="col" className="py-1 pr-3 font-semibold">
                        {isDE ? 'Einheit' : 'Unit'}
                      </th>
                      <th scope="col" className="py-1 pr-3 text-right font-semibold">
                        {isDE ? 'Bestwert' : 'Best'}
                      </th>
                      <th scope="col" className="py-1 text-right font-semibold">
                        {isDE ? 'Versuche' : 'Attempts'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.code} className="border-t border-ink-150 dark:border-ink-850">
                        <th
                          scope="row"
                          className="py-1 pr-3 font-mono font-semibold text-ink-700 dark:text-ink-200"
                        >
                          {row.code}
                        </th>
                        <td className="py-1 pr-3 text-right text-ink-600 dark:text-ink-300">
                          {row.best === null ? '—' : `${row.best}%`}
                        </td>
                        <td className="py-1 text-right text-ink-600 dark:text-ink-300">{row.attempts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}

        <p className="mt-3 text-meta text-ink-500 dark:text-ink-400">
          {attemptsTotal === 0
            ? isDE
              ? `Gate bestehen ab ${PASS_PCT}%.`
              : `Gates pass at ${PASS_PCT}%.`
            : isDE
              ? `${attemptsTotal} ${attemptsTotal === 1 ? 'Versuch' : 'Versuche'} insgesamt · Gate ab ${PASS_PCT}%`
              : `${attemptsTotal} ${attemptsTotal === 1 ? 'attempt' : 'attempts'} total · gates pass at ${PASS_PCT}%`}
        </p>
      </div>
    </section>
  );
}
