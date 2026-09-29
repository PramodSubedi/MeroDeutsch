/**
 * src/admin/pages/DashboardPage.tsx
 *
 * Phase 1 overview. Every figure is read live from the shared Supabase project
 * through the admin RLS policies — there are no sample numbers, and a panel
 * whose source failed renders a muted em dash rather than a zero.
 *
 * ── THE REVIEW-DEBT SECTION ──────────────────────────────────────────────────
 * This is where the standalone `/review-queue` page went. Its aggregate
 * finding — a large backlog that nobody is draining — is the part worth keeping
 * visible on an overview an admin actually opens, and the per-learner breakdown
 * it also offered is already served, more usefully, by the User 360 drawer.
 *
 * It reads ONE column through `fetchQueueKpis` rather than the old 13-column
 * loader with a `profiles` join. Four scalars do not justify that.
 */
import { useCallback, useEffect, useState } from 'react';
import { Activity, Crown, ListChecks, Sparkles, TrendingUp, UserCheck, UserX, Users } from 'lucide-react';
import { theme } from '../../config/theme';
import { KpiCard } from '../components/KpiCard';
import { useAdminData } from '../hooks/useAdminData';
import { A1_UNIT_COUNT } from '../../data/a1Path';
import { fetchQueueKpis, type DueSummary } from '../data/reviewQueue';

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

/**
 * The review-debt figures.
 *
 * Fetched independently of `useAdminData` so a denied or slow `review_queue`
 * cannot hold up the audience and learning panels, and cannot blank them. A
 * single figure set for the whole page would couple an overview's most-used
 * numbers to the least-important query on it.
 */
function useQueueKpis(refreshKey: number): {
  kpis: DueSummary | null;
  loading: boolean;
  error: string | null;
} {
  const [kpis, setKpis] = useState<DueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { kpis: next, error: err } = await fetchQueueKpis();
      if (cancelled) return;
      setKpis(next);
      setError(err);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return { kpis, loading, error };
}

export function DashboardPage() {
  const { kpis, loading, errors, refresh } = useAdminData();
  // `useAdminData` owns its own refresh counter internally, so the queue figures
  // are keyed off a local one the Refresh button advances. Without that the
  // queue section would silently keep showing its first load while the rest of
  // the page refreshed — two halves of one button that disagree.
  const [refreshKey, setRefreshKey] = useState(0);
  const { kpis: queue, loading: queueLoading, error: queueError } = useQueueKpis(refreshKey);
  const totalUsersLoaded = errors.length === 0;

  const onRefresh = useCallback(() => {
    refresh();
    setRefreshKey((n) => n + 1);
  }, [refresh]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={theme.type.kicker}>Overview</p>
          <h1 className={theme.page.heading}>Dashboard</h1>
          <p className={theme.page.description}>
            Live figures from the shared Supabase project.
          </p>
        </div>
        <button type="button" onClick={onRefresh} className={theme.button.secondary} disabled={loading || queueLoading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {/* Partial-failure banner: the dashboard degrades, it does not blank. */}
      {errors.length > 0 && (
        <div
          className="rounded-md border border-warning-200 bg-warning-50 p-4 text-body text-warning-900 dark:border-warning-900 dark:bg-warning-950/40 dark:text-warning-200"
          role="status"
        >
          <p className="font-semibold">Some sources could not be read</p>
          <ul className="mt-1 list-inside list-disc text-meta">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/*
        NO TRUNCATION BANNER, and that is a deletion rather than a deprecation.

        It existed because each KPI was a browser-side aggregate over a capped
        read, so a capped read could not tell you what it was missing. The KPIs
        are now exact COUNTs computed by `admin_dashboard_kpis`, so there is no
        cap to admit to. Keeping the banner would mean maintaining a
        "showing N of M" path for a condition the data can no longer be in — and
        the next person to read it would have to work out which of the two was
        true.
      */}

      <section aria-label="Audience" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total users"
          value={kpis.totalUsers.toLocaleString()}
          hint="rows in profiles"
          icon={Users}
          loading={loading}
        />
        <KpiCard
          label="Active today"
          value={kpis.activeToday.toLocaleString()}
          hint="distinct users with an activity row dated today"
          icon={UserCheck}
          loading={loading}
          tone={kpis.activeToday > 0 ? 'good' : 'neutral'}
        />
        <KpiCard
          label="Premium"
          value={totalUsersLoaded ? pct(kpis.premiumShare) : '—'}
          hint={`${kpis.premiumUsers.toLocaleString()} of ${kpis.totalUsers.toLocaleString()}`}
          icon={Crown}
          loading={loading}
        />
        <KpiCard
          label="Suspended"
          value={kpis.bannedCount.toLocaleString()}
          hint="banned_at is set"
          icon={UserX}
          loading={loading}
          tone={kpis.bannedCount > 0 ? 'bad' : 'neutral'}
        />
      </section>

      <section aria-label="Learning" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Active 7d"
          value={kpis.active7d.toLocaleString()}
          hint="weekly retained learners"
          icon={Activity}
          loading={loading}
        />
        <KpiCard
          label="Active 30d"
          value={kpis.active30d.toLocaleString()}
          hint="monthly active learners"
          icon={TrendingUp}
          loading={loading}
        />
        <KpiCard
          label="On the spine"
          value={kpis.pathEnrolled.toLocaleString()}
          hint="rows in a1_path_state"
          icon={Sparkles}
          loading={loading}
        />
        <KpiCard
          label="Avg unit reached"
          value={loading || kpis.pathEnrolled === 0 ? '—' : (kpis.avgUnitUnlocked + 1).toFixed(1)}
          hint={`of ${A1_UNIT_COUNT} units (1-based display)`}
          icon={Sparkles}
          loading={loading}
        />
      </section>

      <section aria-label="Review debt" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Queued"
          value={queue ? queue.total.toLocaleString() : '—'}
          hint="items waiting for review"
          icon={ListChecks}
          loading={queueLoading}
        />
        <KpiCard
          label="Overdue"
          value={queue ? queue.overdue.toLocaleString() : '—'}
          hint="past their due time"
          icon={ListChecks}
          loading={queueLoading}
          tone={queue && queue.overdue > 0 ? 'bad' : 'good'}
        />
        <KpiCard
          label="Stale 30d+"
          value={queue ? queue.stale.toLocaleString() : '—'}
          hint="more than a month late"
          icon={ListChecks}
          loading={queueLoading}
          tone={queue && queue.stale > 0 ? 'warn' : 'good'}
        />
        <KpiCard
          label="Oldest"
          value={queue?.oldestDue ?? '—'}
          hint="still outstanding"
          icon={ListChecks}
          loading={queueLoading}
        />
      </section>

      {queueError && (
        <p
          className="rounded-md border border-warning-200 bg-warning-50 p-3 text-meta text-warning-900 dark:border-warning-900 dark:bg-warning-950/40 dark:text-warning-200"
          role="status"
        >
          {queueError} The figures above are unavailable; the rest of this page is unaffected. Open a
          learner from <strong>Users</strong> to see their individual queue.
        </p>
      )}

      <section className="rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
        <h2 className={theme.type.section}>Platform</h2>
        <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Total XP awarded" value={loading ? '—' : kpis.totalXp.toLocaleString()} />
          <Stat label="Administrators" value={loading ? '—' : kpis.adminCount.toLocaleString()} />
          {/* The series length, not the active-user total — labelled for exactly
              what it is. It used to read "31" under "30d", because the builder
              emitted `days + 1` points; it is now exactly 30. */}
          <Stat
            label="Daily-active series"
            value={loading ? '—' : `${kpis.dauSeries.length} days`}
          />
          <Stat label="Unit count" value={String(A1_UNIT_COUNT)} />
        </dl>
        <p className="mt-4 text-meta text-ink-500 dark:text-ink-400">
          Daily-active series and per-unit funnel charts land with the Analytics phase. The 30-day
          series is already loaded above and is intentionally not drawn yet.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-micro font-extrabold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
        {label}
      </dt>
      <dd className="mt-1 text-title font-bold text-ink-900 dark:text-ink-50">{value}</dd>
    </div>
  );
}
