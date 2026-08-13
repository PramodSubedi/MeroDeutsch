import { useMemo } from 'react';
import { useLang } from '../hooks/useLang';

interface ActivityDay {
  date: string;
  count: number;
}

interface ActivityHeatmapProps {
  /** Array of activity data for the last 30 days */
  activities?: ActivityDay[];
  /** Number of days to display (default 30) */
  days?: number;
}

/**
 * GitHub-style contribution heatmap showing user's 30-day activity.
 * Visualizes learning streak and engagement patterns.
 */
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
      const dateStr = date.toISOString().split('T')[0];
      
      // Find activity for this date
      const activity = activities.find(a => a.date === dateStr);
      data.push({
        date: dateStr,
        count: activity?.count || 0,
      });
    }
    
    return data;
  }, [activities, days]);

  // Determine color intensity based on activity count
  const getColorClass = (count: number): string => {
    if (count === 0) return 'bg-slate-100 dark:bg-slate-800';
    if (count <= 2) return 'bg-emerald-200 dark:bg-emerald-900/40';
    if (count <= 5) return 'bg-emerald-400 dark:bg-emerald-700/60';
    if (count <= 10) return 'bg-emerald-600 dark:bg-emerald-600/80';
    return 'bg-emerald-700 dark:bg-emerald-500';
  };

  // Get day label for tooltip
  const getDayLabel = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return isDE ? 'Heute' : 'Today';
    if (diffDays === 1) return isDE ? 'Gestern' : 'Yesterday';
    return date.toLocaleDateString(isDE ? 'de-DE' : 'en-US', { month: 'short', day: 'numeric' });
  };

  const totalActivity = heatmapData.reduce((sum, day) => sum + day.count, 0);
  const activeDays = heatmapData.filter(day => day.count > 0).length;

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-950">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            {isDE ? 'Aktivität' : 'Activity'}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isDE ? `${activeDays} aktive Tage in den letzten ${days} Tagen` : `${activeDays} active days in the last ${days} days`}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-950 dark:text-white">{totalActivity}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isDE ? 'Aktivitäten' : 'activities'}
          </div>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="grid grid-cols-10 gap-1.5 sm:grid-cols-15 md:grid-cols-30">
        {heatmapData.map((day, index) => (
          <div
            key={day.date}
            className={`group relative aspect-square rounded transition-all duration-200 hover:scale-110 hover:shadow-lg ${getColorClass(day.count)}`}
            title={`${getDayLabel(day.date)}: ${day.count} ${isDE ? 'Aktivitäten' : 'activities'}`}
          >
            {/* Tooltip on hover */}
            <div className="pointer-events-none absolute -top-12 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:block group-hover:opacity-100 dark:bg-slate-700">
              <div>{getDayLabel(day.date)}</div>
              <div className="font-semibold">{day.count} {isDE ? 'Aktivitäten' : 'activities'}</div>
              <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-slate-900 dark:bg-slate-700"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-end gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>{isDE ? 'Weniger' : 'Less'}</span>
        <div className="flex gap-1">
          <div className="h-3 w-3 rounded bg-slate-100 dark:bg-slate-800"></div>
          <div className="h-3 w-3 rounded bg-emerald-200 dark:bg-emerald-900/40"></div>
          <div className="h-3 w-3 rounded bg-emerald-400 dark:bg-emerald-700/60"></div>
          <div className="h-3 w-3 rounded bg-emerald-600 dark:bg-emerald-600/80"></div>
          <div className="h-3 w-3 rounded bg-emerald-700 dark:bg-emerald-500"></div>
        </div>
        <span>{isDE ? 'Mehr' : 'More'}</span>
      </div>
    </div>
  );
}
