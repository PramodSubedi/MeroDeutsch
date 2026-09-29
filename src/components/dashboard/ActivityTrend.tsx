/**
 * src/components/dashboard/ActivityTrend.tsx
 *
 * THIRTY DAYS OF REAL EFFORT, AS A SHAPE.
 *
 * WHY THIS IS NOT THE HEATMAP AGAIN
 * ---------------------------------
 * `ActivityHeatmap` already renders the same `{date, count}[]` series, and the
 * temptation is to call this redundant. It is not, because the two answer
 * different questions and a grid is structurally unable to answer one of them:
 *
 *   heatmap  -> "WHICH days did I show up?"   (presence; a 30x10 grid)
 *   this     -> "Is my effort RISING or falling?" (shape over time; a curve)
 *
 * A heatmap cannot show a trend. Twenty consecutive medium days and two huge
 * days surrounded by silence look similar at a glance; here the second is a
 * spike and the first is a plateau. A learner deciding whether to keep going
 * needs the shape.
 *
 * WHY THESE ARE COUNTS AND NOT XP
 * -------------------------------
 * `ActivityHeatmap` multiplies each day's count by a flat `XP_PER_EVENT = 10`
 * and presents the product as "XP earned". That is an ESTIMATE wearing a
 * number's clothes — the app records one engagement event per answered item,
 * but the XP actually awarded varies by tier, by mode and by streak
 * multiplier, so the figure is not any learner's real XP.
 *
 * This chart plots the RAW COUNT, which is what is genuinely stored. No
 * invented unit, and no number a learner could catch being wrong.
 *
 * THE MOVING AVERAGE IS THE POINT
 * -------------------------------
 * Daily counts are spiky — one long session can triple a day. A 7-day moving
 * average is drawn over the raw area so the trend is legible while the honest
 * daily spikes stay visible underneath rather than being smoothed away.
 */
import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { useChartTokens } from '../../hooks/useChartTokens';
import { denseActivitySeries } from '../../lib/activitySeries';

const WINDOW_DAYS = 30;
const MA_WINDOW = 7;

/** A dense day plus its trailing moving average. */
type Point = { date: string; count: number; average: number | null };

export function ActivityTrend({
  activities = [],
}: {
  activities?: { date: string; count: number }[];
}) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const t = useChartTokens();

  const { points, total, activeDays, dailyAverage } = useMemo(() => {
    // Shared with the stat-tile sparklines, so the trend chart and the tiles
    // can never disagree about which days had activity.
    const rows: Point[] = denseActivitySeries(activities, WINDOW_DAYS).map((d) => ({
      ...d,
      average: null,
    }));

    // Trailing mean. Requires a FULL window — a 3-day "average" at the left
    // edge would be noisier than the raw data it replaces.
    for (let i = MA_WINDOW - 1; i < rows.length; i++) {
      const slice = rows.slice(i - MA_WINDOW + 1, i + 1);
      rows[i].average = slice.reduce((s, r) => s + r.count, 0) / MA_WINDOW;
    }

    const sum = rows.reduce((s, r) => s + r.count, 0);
    return {
      points: rows,
      total: sum,
      activeDays: rows.filter((r) => r.count > 0).length,
      dailyAverage: Math.round((sum / WINDOW_DAYS) * 10) / 10,
    };
  }, [activities]);

  const hasData = total > 0;

  return (
    <section
      aria-labelledby="activity-trend-heading"
      className="overflow-hidden rounded-lg border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink-150 px-4 py-3 sm:px-5 dark:border-ink-850">
        <h2
          id="activity-trend-heading"
          className="flex items-center gap-2 text-micro font-extrabold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400"
        >
          <Activity className="h-3.5 w-3.5 shrink-0 text-accent-600 dark:text-accent-400" aria-hidden="true" />
          {isDE ? 'Lernverlauf' : 'Learning activity'}
        </h2>
        <p className="font-mono text-meta font-semibold tabular-nums text-ink-600 dark:text-ink-300">
          {activeDays}/{WINDOW_DAYS}
          <span className="ml-1 font-sans font-normal text-ink-500 dark:text-ink-400">
            {isDE ? 'aktive Tage' : 'active days'}
          </span>
        </p>
      </div>

      <div className="px-4 py-4 sm:px-5">
        {!hasData ? (
          // Same reasoning as the trajectory chart: a flat zero axis reads as
          // "you did nothing" rather than "no data yet".
          <p className="rounded-md border border-dashed border-ink-300 bg-ink-50 px-4 py-6 text-center text-body text-ink-500 dark:border-ink-700 dark:bg-ink-800/40 dark:text-ink-400">
            {isDE
              ? 'Noch keine Aktivität — dein Verlauf erscheint nach der ersten Übung.'
              : 'No activity yet — your trend appears after your first exercise.'}
          </p>
        ) : (
          <>
            <div className="h-48 w-full" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 6, right: 6, bottom: 0, left: -22 }}>
                  <defs>
                    <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={t.accent} stopOpacity={0.34} />
                      <stop offset="100%" stopColor={t.accent} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={t.grid} strokeOpacity={0.7} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: t.axis, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval={6}
                    tickMargin={8}
                    /* Recharts centres each tick on its data point, so the FIRST
                       and LAST ticks straddle the plot edges and roughly half of
                       each label is clipped. At 375px the final tick was cut to
                       `2026-09-`. This padding gives the edge ticks room to sit
                       fully inside the SVG. */
                    padding={{ left: 14, right: 14 }}
                  />
                  <YAxis
                    tick={{ fill: t.axis, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    width={40}
                  />
                  <ReferenceLine
                    y={dailyAverage}
                    stroke={t.axis}
                    strokeDasharray="4 4"
                    strokeOpacity={0.8}
                    label={{
                      value: isDE ? `Ø ${dailyAverage}` : `avg ${dailyAverage}`,
                      position: 'insideTopRight',
                      fill: t.axis,
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  />
                  <Tooltip
                    cursor={{ stroke: t.axis, strokeOpacity: 0.35 }}
                    contentStyle={{
                      borderRadius: 8,
                      border: `1px solid ${t.tooltipBorder}`,
                      background: t.tooltipBg,
                      color: t.tooltipText,
                      fontSize: 12,
                    }}
                    // The label MUST be sliced the same way the X axis slices it.
                    // Returning the raw key here showed a full `2026-09-29` in
                    // the tooltip header directly above an axis reading `09-29` —
                    // two different dates for the same point, on one screen.
                    labelFormatter={(label) => {
                      const d = new Date(String(label ?? ''));
                      return Number.isNaN(d.getTime())
                        ? String(label ?? '')
                        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }}
                    formatter={(value: unknown, _name: unknown, item: any) => {
                      const avg = item?.payload?.average;
                      const n = Number(value);
                      const main = isDE ? `${n} Aktivitäten` : `${n} activities`;
                      // The moving average is surfaced in the tooltip too,
                      // otherwise the dashed line is unexplained on hover.
                      if (avg == null) return [main, isDE ? 'Heute' : 'Total'];
                      return [
                        `${main} · ${isDE ? 'Ø 7T' : '7d avg'} ${Math.round(avg * 10) / 10}`,
                        isDE ? 'Tag' : 'Day',
                      ];
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={t.accent}
                    strokeWidth={1.75}
                    fill="url(#activityFill)"
                    dot={false}
                    activeDot={{ r: 3, fill: t.accent }}
                  />
                  {/* Drawn last so the trend sits ON the data it summarises. */}
                  <Area
                    type="monotone"
                    dataKey="average"
                    stroke={t.warning}
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    fill="none"
                    dot={false}
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <p className="mt-3 text-meta text-ink-500 dark:text-ink-400">
              {isDE
                ? `${total} Aktivitäten in ${WINDOW_DAYS} Tagen · Ø ${dailyAverage}/Tag`
                : `${total} activities over ${WINDOW_DAYS} days · ${dailyAverage}/day average`}
              <span className="ml-1.5 text-ink-400 dark:text-ink-500">
                {isDE
                  ? '· gestrichelt: gleitender 7-Tage-Durchschnitt'
                  : '· dashed line is the 7-day moving average'}
              </span>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
