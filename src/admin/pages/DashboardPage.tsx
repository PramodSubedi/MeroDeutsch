/**
 * src/admin/pages/DashboardPage.tsx
 *
 * Phase 1 overview. Every figure is read live from the shared Supabase project
 * through the admin RLS policies — there are no sample numbers, and a panel
 * whose source failed renders a muted em dash rather than a zero.
 */
import { Activity, Crown, Sparkles, TrendingUp, UserCheck, UserX, Users } from 'lucide-react';
import { theme } from '../../config/theme';
import { KpiCard } from '../components/KpiCard';
import { useAdminData } from '../hooks/useAdminData';
import { A1_UNIT_COUNT } from '../../data/a1Path';

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

export function DashboardPage() {
  const { kpis, loading, errors, refresh } = useAdminData();
  const totalUsersLoaded = errors.length === 0;

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
        <button type="button" onClick={refresh} className={theme.button.secondary} disabled={loading}>
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

      <section aria-label="Audience" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total users"
          value={kpis.totalUsers.toLocaleString()}
          hint="rows in profiles"
          icon={Users}
          loading={loading}
        />
        <KpiCard
          label="Active 24h"
          value={kpis.active24h.toLocaleString()}
          hint="distinct user_activity_days"
          icon={UserCheck}
          loading={loading}
          tone={kpis.active24h > 0 ? 'good' : 'neutral'}
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

      <section className="rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
        <h2 className={theme.type.section}>Platform</h2>
        <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Total XP awarded" value={loading ? '—' : kpis.totalXp.toLocaleString()} />
          <Stat label="Administrators" value={loading ? '—' : kpis.adminCount.toLocaleString()} />
          <Stat label="Daily actives · 30d" value={loading ? '—' : kpis.dauSeries.length.toString()} />
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
