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
import { Activity, ArrowUpRight, BookOpen, Crown, ListChecks, Settings2, Sparkles, TrendingUp, UserCheck, UserX, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { theme } from '../../config/theme';
import { KpiCard } from '../components/KpiCard';
import { useAdminData } from '../hooks/useAdminData';
import { A1_UNIT_COUNT } from '../../data/a1Path';
import { fetchQueueKpis, type DueSummary } from '../data/reviewQueue';

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function todayLabel(): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
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
  const kpiUnavailable = !loading && errors.length > 0 && !kpis.degraded;
  const kpiValueLoading = loading || kpiUnavailable;
  const hasReadProblem = errors.length > 0 || Boolean(queueError);
  const healthLabel = hasReadProblem ? 'Attention needed' : loading || queueLoading ? 'Reading live data' : 'Control plane is live';

  const onRefresh = useCallback(() => {
    refresh();
    setRefreshKey((n) => n + 1);
  }, [refresh]);

  return (
    <div className="admin-page space-y-7">
      <header className="admin-hero flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="admin-eyebrow">{todayLabel()}</p>
          <h1 className="admin-hero-title mt-2">The day, at a glance.</h1>
          <p className="admin-hero-copy">A live read on learners, content, and the work waiting for the team.</p>
        </div>
        <button type="button" onClick={onRefresh} className="admin-refresh-button" disabled={loading || queueLoading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <section className="admin-signal-strip" aria-label="Operations signal">
        <div className="flex items-center gap-3">
          <span className={`admin-signal-dot ${hasReadProblem ? 'admin-signal-dot-warning' : ''}`} aria-hidden="true" />
          <div>
            <p className="text-body font-extrabold">{healthLabel}</p>
            <p className="text-meta text-[#716f67] dark:text-[#aaa59c]">
              {hasReadProblem
                ? 'One or more dashboard sources could not be verified. Review the notices before acting on these figures.'
                : 'Reads are coming from the shared project. Check the audit trail before retrying a failed write.'}
            </p>
          </div>
        </div>
        <Link to="/audit-log" className="admin-inline-link">Open audit log <ArrowUpRight className="h-4 w-4" /></Link>
      </section>

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

      <section aria-label="Audience" className="admin-metric-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total users"
          value={kpiValueLoading ? '—' : kpis.totalUsers.toLocaleString()}
          hint="rows in profiles"
          icon={Users}
          loading={false}
        />
        <KpiCard
          label="Active today"
          value={kpiValueLoading ? '—' : kpis.activeToday.toLocaleString()}
          hint="distinct users with an activity row dated today"
          icon={UserCheck}
          loading={false}
          tone={kpis.activeToday > 0 ? 'good' : 'neutral'}
        />
        <KpiCard
          label="Premium"
          value={kpiValueLoading ? '—' : pct(kpis.premiumShare)}
          hint={`${kpis.premiumUsers.toLocaleString()} of ${kpis.totalUsers.toLocaleString()}`}
          icon={Crown}
          loading={false}
        />
        <KpiCard
          label="Suspended"
          value={kpiValueLoading ? '—' : kpis.bannedCount.toLocaleString()}
          hint="banned_at is set"
          icon={UserX}
          loading={false}
          tone={kpis.bannedCount > 0 ? 'bad' : 'neutral'}
        />
      </section>

      <section aria-label="Learning" className="admin-metric-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Active 7d"
          value={kpiValueLoading ? '—' : kpis.active7d.toLocaleString()}
          hint="weekly retained learners"
          icon={Activity}
          loading={false}
        />
        <KpiCard
          label="Active 30d"
          value={kpiValueLoading ? '—' : kpis.active30d.toLocaleString()}
          hint="monthly active learners"
          icon={TrendingUp}
          loading={false}
        />
        <KpiCard
          label="On the spine"
          value={kpiValueLoading ? '—' : kpis.pathEnrolled.toLocaleString()}
          hint="rows in a1_path_state"
          icon={Sparkles}
          loading={false}
        />
        <KpiCard
          label="Avg unit reached"
          value={kpiValueLoading || kpis.pathEnrolled === 0 ? '—' : (kpis.avgUnitUnlocked + 1).toFixed(1)}
          hint={`of ${A1_UNIT_COUNT} units (1-based display)`}
          icon={Sparkles}
          loading={false}
        />
      </section>

      <section aria-label="Review debt" className="admin-metric-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <section aria-label="Launchpad" className="admin-launchpad">
        <div>
          <p className="admin-eyebrow">Launchpad</p>
          <h2 className="mt-1 text-section font-extrabold">Move the work forward</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <QuickLink to="/users" icon={Users} title="Find a learner" detail="Inspect progress and activity" />
          <QuickLink to="/curriculum" icon={BookOpen} title="Review curriculum" detail="Validate, diff, and publish" />
          <QuickLink to="/system" icon={Settings2} title="Check the system" detail="Flags, config, and self-test" />
        </div>
      </section>

      <section className="admin-data-panel">
        <h2 className={theme.type.section}>Platform</h2>
        <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Total XP awarded" value={kpiValueLoading ? '—' : kpis.totalXp.toLocaleString()} />
          <Stat label="Administrators" value={kpiValueLoading ? '—' : kpis.adminCount.toLocaleString()} />
          {/* The series length, not the active-user total — labelled for exactly
              what it is. It used to read "31" under "30d", because the builder
              emitted `days + 1` points; it is now exactly 30. */}
          <Stat
            label="Daily-active series"
            value={kpiValueLoading ? '—' : `${kpis.dauSeries.length} days`}
          />
          <Stat label="Unit count" value={String(A1_UNIT_COUNT)} />
        </dl>
        <p className="mt-4 text-meta text-ink-500 dark:text-ink-400">
          The full activity series and unit funnel are available in <Link className="admin-inline-link" to="/analytics">Analytics <ArrowUpRight className="h-3.5 w-3.5" /></Link>.
        </p>
      </section>
    </div>
  );
}

function QuickLink({
  to,
  icon: Icon,
  title,
  detail,
}: {
  to: string;
  icon: typeof Users;
  title: string;
  detail: string;
}) {
  return (
    <Link to={to} className="admin-quick-link group">
      <span className="admin-quick-icon"><Icon className="h-5 w-5" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-extrabold">{title}</span>
        <span className="mt-0.5 block text-meta text-[#716f67] dark:text-[#aaa59c]">{detail}</span>
      </span>
      <ArrowUpRight className="h-4 w-4 text-[#aaa59c] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
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
