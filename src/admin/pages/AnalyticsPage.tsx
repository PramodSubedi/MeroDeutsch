/**
 * src/admin/pages/AnalyticsPage.tsx
 *
 * Engagement charts. Recharts is already a dependency (the learner app's own
 * `Analytics.tsx` uses it), and the admin entry is a separate chunk, so this
 * adds nothing to the main app's bundle.
 *
 * Panels come from the shared primitives in `components/charts.tsx` so the
 * empty-data behaviour is identical everywhere — which matters here, because
 * this dataset is genuinely sparse and an empty chart must read as "no data
 * yet", never as a broken page.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RefreshCw } from 'lucide-react';
import { theme } from '../../config/theme';
import { KpiCard } from '../components/KpiCard';
import {
  AXIS_PROPS,
  BarList,
  ChartEmpty,
  ChartPanel,
  SERIES,
  TOOLTIP_PROPS,
} from '../components/charts';
import { fetchAnalytics, type AnalyticsData } from '../data/analytics';

/** Shared margins; -20 on the left recovers the Y-axis label gutter. */
const M = { top: 8, right: 8, bottom: 0, left: -20 };
const GRID = '#dde2e9';

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setData(await fetchAnalytics(30));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dauTotal = data ? data.dau.reduce((sum, d) => sum + d.active, 0) : 0;
  const peakDau = data ? Math.max(0, ...data.dau.map((d) => d.active)) : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={theme.type.kicker}>Engagement</p>
          <h1 className={theme.page.heading}>Analytics</h1>
          <p className={theme.page.description}>
            Read-only, aggregated in the browser from the learner tables.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className={theme.button.secondary}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      {data && data.errors.length > 0 && (
        <div
          className="rounded-md border border-warning-200 bg-warning-50 p-4 text-body text-warning-900 dark:border-warning-900 dark:bg-warning-950/40 dark:text-warning-200"
          role="status"
        >
          <p className="font-semibold">Some sources could not be read</p>
          <ul className="mt-1 list-inside list-disc text-meta">
            {data.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <section aria-label="Totals" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Learners"
          value={data ? String(data.totalLearners) : '—'}
          hint="rows in profiles"
          loading={loading}
        />
        <KpiCard
          label="On the spine"
          value={data ? String(data.onSpine) : '—'}
          hint="rows in a1_path_state"
          loading={loading}
        />
        <KpiCard
          label="Peak daily active"
          value={data ? String(peakDau) : '—'}
          hint={`${dauTotal} events over 30 days`}
          loading={loading}
        />
        <KpiCard
          label="Total XP"
          value={data ? data.totalXp.toLocaleString() : '—'}
          hint="awarded across all learners"
          loading={loading}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DauPanel data={data} peak={peakDau} />
        <RetentionPanel data={data} />
        <UnitFunnelPanel data={data} />
        <CheckpointPanel data={data} />
        <PlanPanel data={data} />
        <StreakPanel data={data} />
        <ContentPanel data={data} />
        <XpLevelPanel data={data} />
      </div>
    </div>
  );
}

function DauPanel({ data, peak }: { data: AnalyticsData | null; peak: number }) {
  return (
    <ChartPanel
      title="Daily active users"
      note="Last 30 days. Gaps are real zeros, not missing data."
    >
      {!data ? null : peak === 0 ? (
        <ChartEmpty what="daily activity" />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data.dau} margin={M}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis
              dataKey="date"
              tick={AXIS_PROPS}
              tickFormatter={(d: string) => d.slice(5)}
              minTickGap={24}
            />
            <YAxis tick={AXIS_PROPS} allowDecimals={false} />
            <Tooltip {...TOOLTIP_PROPS} />
            <Line
              type="monotone"
              dataKey="active"
              name="Active"
              stroke={SERIES[0]}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartPanel>
  );
}

function RetentionPanel({ data }: { data: AnalyticsData | null }) {
  if (!data || data.retention.length === 0) {
    return (
      <ChartPanel
        title="Weekly retention"
        note="Monday-start cohorts. Immature weeks are trimmed, never shown as churn."
      >
        <ChartEmpty what="cohort activity" />
      </ChartPanel>
    );
  }
  return (
    <ChartPanel
      title="Weekly retention"
      note="Monday-start cohorts. Immature weeks are trimmed, never shown as churn."
    >
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data.retention} margin={M}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis
            dataKey="cohort"
            tick={AXIS_PROPS}
            tickFormatter={(d: string) => d.slice(5)}
            minTickGap={16}
          />
          <YAxis tick={AXIS_PROPS} allowDecimals={false} />
          <Tooltip {...TOOLTIP_PROPS} />
          <Legend />
          {data.retention[0].weeks.map((_, n) => (
            <Line
              key={n}
              type="stepAfter"
              dataKey={`weeks.${n}`}
              name={`Week ${n}`}
              stroke={SERIES[n % SERIES.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}

function UnitFunnelPanel({ data }: { data: AnalyticsData | null }) {
  return (
    <ChartPanel
      title="A1 unit funnel"
      note="Highest unit whose checkpoint was passed — a stage marker, not a visit count."
    >
      {!data || data.unitFunnel.length === 0 ? (
        <ChartEmpty what="spine progress" />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.unitFunnel} margin={M}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="label" tick={AXIS_PROPS} />
            <YAxis tick={AXIS_PROPS} allowDecimals={false} />
            <Tooltip {...TOOLTIP_PROPS} />
            <Bar dataKey="value" name="Learners" fill={SERIES[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartPanel>
  );
}

function CheckpointPanel({ data }: { data: AnalyticsData | null }) {
  return (
    <ChartPanel
      title="Mean checkpoint score"
      note="Average best score per unit, 0–1. Pass mark is 0.8."
    >
      {!data || data.checkpointAverages.length === 0 ? (
        <ChartEmpty what="checkpoint attempts" />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.checkpointAverages} margin={M}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="label" tick={AXIS_PROPS} />
            <YAxis tick={AXIS_PROPS} domain={[0, 1]} />
            <Tooltip {...TOOLTIP_PROPS} />
            <Bar dataKey="value" name="Mean score" radius={[4, 4, 0, 0]}>
              {data.checkpointAverages.map((p) => (
                // Green at or above the pass mark, amber below it.
                <Cell key={p.label} fill={p.value >= 0.8 ? SERIES[1] : SERIES[2]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartPanel>
  );
}

/** A plain vertical bar chart, used by the four simple categorical panels. */
function SimpleBars({
  title,
  note,
  data,
  color,
  yDomain,
}: {
  title: string;
  note: string;
  data: { label: string; value: number }[];
  color: string;
  yDomain?: [number, number];
}) {
  return (
    <ChartPanel title={title} note={note}>
      {data.length === 0 ? (
        <ChartEmpty what="records" />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={M}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="label" tick={AXIS_PROPS} />
            <YAxis tick={AXIS_PROPS} allowDecimals={false} domain={yDomain} />
            <Tooltip {...TOOLTIP_PROPS} />
            <Bar dataKey="value" name={title} fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartPanel>
  );
}

function PlanPanel({ data }: { data: AnalyticsData | null }) {
  return (
    <SimpleBars
      title="Plan split"
      note="Entitlement tier across all accounts."
      data={data?.planSplit ?? []}
      color={SERIES[0]}
    />
  );
}

function StreakPanel({ data }: { data: AnalyticsData | null }) {
  return (
    <SimpleBars
      title="Streak distribution"
      note="0–9 individually; 10 and above collapsed."
      data={data?.streakBuckets ?? []}
      color={SERIES[1]}
    />
  );
}

function XpLevelPanel({ data }: { data: AnalyticsData | null }) {
  return (
    <SimpleBars
      title="XP by level"
      note="Learners bucketed by their recorded level."
      data={data?.xpByLevel ?? []}
      color={SERIES[2]}
    />
  );
}

function ContentPanel({ data }: { data: AnalyticsData | null }) {
  return (
    <ChartPanel
      title="Content pool usage"
      note="Rows in content_items by type — what the app can draw on."
    >
      {!data || data.contentTypes.length === 0 ? (
        <ChartEmpty what="content items" />
      ) : (
        // A bar LIST, not a chart: 15 categories with long labels are
        // unreadable as vertical columns at any sensible width.
        <BarList points={data.contentTypes} />
      )}
    </ChartPanel>
  );
}
