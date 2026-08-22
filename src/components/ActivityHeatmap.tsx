/**
 * src/components/ActivityHeatmap.tsx
 *
 * GitHub-style contribution heatmap showing user's 30-day learning activity —
 * UPGRADED from binary active/inactive to SESSION INTENSITY:
 *  - 4-tier color scale built from the BRAND BLUE (#2563eb family):
 *    darker squares = days with more XP earned (activity events proxy).
 *  - Hover tooltip shows the exact localized DATE and XP total for that day.
 *
 * Data source unchanged: `useActivityLog` ({date, count}[]), offline-first
 * (Dexie/localStorage + Supabase user_activity_days when authenticated).
 */

import { useMemo } from 'react';
import { useLang } from '../hooks/useLang';
import { toLocalDateKey, diffCalendarDays, parseLocalDateKey } from '../utils/dateUtils';

interface ActivityDay {
  date: string;
  count: number;
}

interface ActivityHeatmapProps {
  /** Array of activity data for the last N days */
  activities?: ActivityDay[];
  /** Number of days to display (default 30) */
  days?: number;
}

/** Intensity tiers on the brand-blue scale (locked #2563eb family). */
type IntensityTier = 0 | 1 | 2 | 3 | 4;

const TIER_CLASSES: Record<IntensityTier, string> = {
  0: 'bg-slate-100 dark:bg-slate-800',
  1: 'bg-blue-200 dark:bg-blue-900/50', // #bfdbfe
  2: 'bg-blue-400 dark:bg-blue-600/70', // #60a5fa
  3: 'bg-blue-600 dark:bg-blue-500/90', // #2563eb (brand)
  4: 'bg-blue-800 dark:bg-blue-300', // #1e40af (peak)
};

function tierFor(count: number): IntensityTier {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 10) return 3;
  return 4;
}

/**
 * Activity events -> XP estimate. Each logged engagement event corresponds to
 * one answered item (~10 XP quiz tier); used purely for tooltip display so the
 * heatmap speaks the learner's language ("XP earned") without changing the
 * underlying data contract.
 */
const XP_PER_EVENT = 10;

export function ActivityHeatmap({ activities = [], days = 30 }: ActivityHeatmapProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  // Generate last N days
  const heatmapData = useMemo(() => {
    const today = new Date();
    const data: ActivityDay[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      // Local YYYY-MM-DD key (not UTC) so "today" matches the user's timezone.
      const dateStr = toLocalDateKey(date);

      // Find activity for this date
      const activity = activities.find((a) => a.date === dateStr);
      data.push({
        date: dateStr,
        count: activity?.count || 0,
      });
    }

    return data;
  }, [activities, days]);

  // Get day label for tooltip
  const getDayLabel = (dateStr: string): string => {
    const date = parseLocalDateKey(dateStr);
    const diffDays = diffCalendarDays(date, new Date());

    if (diffDays === 0) return isDE ? 'Heute' : 'Today';
    if (diffDays === 1) return isDE ? 'Gestern' : 'Yesterday';
    return date.toLocaleDateString(isDE ? 'de-DE' : 'en-US', { month: 'short', day: 'numeric' });
  };

  const totalActivity = heatmapData.reduce((sum, day) => sum + day.count, 0);
  const activeDays = heatmapData.filter((day) => day.count > 0).length;
  const totalXp = totalActivity * XP_PER_EVENT;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            {isDE ? 'Aktivität' : 'Activity'}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isDE
              ? `${activeDays} aktive Tage in den letzten ${days} Tagen`
              : `${activeDays} active days in the last ${days} days`}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-950 dark:text-white">{totalXp}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">XP</div>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="grid grid-cols-10 gap-1.5 sm:grid-cols-[repeat(15,minmax(0,1fr))] md:grid-cols-[repeat(30,minmax(0,1fr))]">
        {heatmapData.map((day) => (
          <div
            key={day.date}
            className={`group relative aspect-square rounded transition-all duration-200 hover:scale-110 hover:shadow-lg ${TIER_CLASSES[tierFor(day.count)]}`}
            title={`${getDayLabel(day.date)}: ${day.count * XP_PER_EVENT} XP`}
          >
            {/* Tooltip on hover — exact date + XP earned */}
            <div className="pointer-events-none absolute -top-12 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:block group-hover:opacity-100 dark:bg-slate-700">
              <div>{getDayLabel(day.date)}</div>
              <div className="font-semibold">{day.count * XP_PER_EVENT} XP</div>
              <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-slate-900 dark:bg-slate-700"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Legend — brand-blue intensity scale */}
      <div className="mt-4 flex items-center justify-end gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>{isDE ? 'Weniger' : 'Less'}</span>
        <div className="flex gap-1">
          {(Object.keys(TIER_CLASSES) as unknown as string[])
            .map(Number)
            .sort((a, b) => a - b)
            .map((tier) => (
              <div
                key={tier}
                className={`h-3 w-3 rounded ${TIER_CLASSES[tier as IntensityTier]}`}
              ></div>
            ))}
        </div>
        <span>{isDE ? 'Mehr' : 'More'} XP</span>
      </div>
    </div>
  );
}