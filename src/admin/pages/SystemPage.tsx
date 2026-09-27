/**
 * src/admin/pages/SystemPage.tsx
 *
 * Operational health: table row counts and feature flags.
 *
 * ── WHY ROW COUNTS COME FROM A FUNCTION, NOT `pg_class` ─────────────────────
 * Exact counts are reported by a SECURITY DEFINER database function rather than
 * estimated from `pg_class.reltuples`, which is a planner approximation that can
 * be wildly stale on a small database (and is -1 on a table never analysed). An
 * admin tool that says "about 1000" when the answer is 1062 is not worth the
 * screen space. SECURITY DEFINER lets it count every table while exposing nothing
 * else; RLS still gates WHICH admin may call it, and it only returns numbers.
 *
 * ── WHY FLAGS ARE READ-ONLY ────────────────────────────────────────────────
 * `app_config` is public-read (so the learner app can honour maintenance mode
 * before sign-in) and its writes are service-role only. Toggling a flag needs a
 * privileged function, same as ban/promote.
 */
import { useCallback, useEffect, useState } from 'react';
import { Activity, Database, Flag, RefreshCw, ScrollText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { theme } from '../../config/theme';
import { KpiCard } from '../components/KpiCard';

interface TableCount {
  table_name: string;
  row_count: number;
}

/** The tables the control centre watches, in the order an admin reads them. */
const WATCHED_TABLES = [
  'profiles',
  'user_xp',
  'user_streaks',
  'user_progress',
  'user_achievements',
  'user_activity_days',
  'a1_path_state',
  'review_queue',
  'vocabulary',
  'sentences',
  'content_items',
  'curriculum_versions',
  'admin_audit_log',
  'app_config',
];

interface AppFlag {
  key: string;
  value: unknown;
  updated_at: string;
}

export function SystemPage() {
  const [counts, setCounts] = useState<TableCount[]>([]);
  const [flags, setFlags] = useState<AppFlag[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const problems: string[] = [];

    // The RPC may not exist yet (it ships in the migration paired with this
    // page), so a failure degrades to "unavailable" rather than a blank screen.
    const [rpc, config] = await Promise.all([
      supabase.rpc('admin_table_counts' as never),
      supabase.from('app_config').select('key, value, updated_at').order('key'),
    ]);

    if (rpc.error) problems.push(`admin_table_counts: ${rpc.error.message}`);
    else setCounts((rpc.data ?? []) as unknown as TableCount[]);

    if (config.error) problems.push(`app_config: ${config.error.message}`);
    else setFlags((config.data ?? []) as unknown as AppFlag[]);

    setErrors(problems);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalRows = counts.reduce((sum, c) => sum + (c.row_count ?? 0), 0);
  const byName = new Map(counts.map((c) => [c.table_name, c.row_count]));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={theme.type.kicker}>Operations</p>
          <h1 className={theme.page.heading}>System</h1>
          <p className={theme.page.description}>
            Row counts across the public schema, and the feature flags the app reads at boot.
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

      {errors.length > 0 && <ErrorsPanel errors={errors} />}

      <section aria-label="Totals" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Tables"
          value={String(counts.length)}
          hint="counted"
          icon={Database}
          loading={loading}
        />
        <KpiCard
          label="Total rows"
          value={totalRows.toLocaleString()}
          hint="across watched tables"
          loading={loading}
        />
        <KpiCard
          label="Learners"
          value={(byName.get('profiles') ?? 0).toLocaleString()}
          hint="rows in profiles"
          icon={Activity}
          loading={loading}
        />
        <KpiCard
          label="Flags"
          value={String(flags.length)}
          hint="rows in app_config"
          icon={Flag}
          loading={loading}
        />
      </section>

      <CountPanel counts={byName} />
      <FlagsPanel flags={flags} />
      <MigrationsPanel />
    </div>
  );
}

function ErrorsPanel({ errors }: { errors: string[] }) {
  return (
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
      {errors.some((e) => e.startsWith('admin_table_counts')) && (
        <p className="mt-2 text-meta">
          Row counts come from the <code className="font-mono">admin_table_counts()</code> function.
          Apply the migration that creates it to populate that table.
        </p>
      )}
    </div>
  );
}

function CountPanel({ counts }: { counts: Map<string, number> }) {
  const present = WATCHED_TABLES.filter((name) => counts.has(name));
  return (
    <section className="rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
      <h2 className={theme.type.section}>Table row counts</h2>
      {present.length === 0 ? (
        <p className="mt-3 text-meta text-ink-500 dark:text-ink-400">No counts available yet.</p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
          {present.map((name) => (
            <div
              key={name}
              className="flex items-baseline justify-between gap-3 border-b border-ink-100 py-1 dark:border-ink-800/60"
            >
              <code className="truncate text-meta text-ink-700 dark:text-ink-300">{name}</code>
              <span className="shrink-0 text-body font-semibold tabular-nums text-ink-900 dark:text-ink-50">
                {(counts.get(name) ?? 0).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FlagsPanel({ flags }: { flags: AppFlag[] }) {
  return (
    <section className="rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
      <h2 className={theme.type.section}>Feature flags</h2>
      <p className="mt-1 text-meta text-ink-500 dark:text-ink-400">
        Read-only. Writes are service-role only, so toggling a flag needs a privileged function.
      </p>
      {flags.length === 0 ? (
        <p className="mt-3 text-meta text-ink-500 dark:text-ink-400">No flags found.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {flags.map((flag) => (
            <li
              key={flag.key}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 pb-2 dark:border-ink-800/60"
            >
              <span className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-ink-400" aria-hidden="true" />
                <code className="text-meta font-semibold text-ink-800 dark:text-ink-200">
                  {flag.key}
                </code>
              </span>
              <span className="flex items-center gap-3">
                <code className="rounded bg-ink-100 px-2 py-0.5 text-meta dark:bg-ink-800">
                  {JSON.stringify(flag.value)}
                </code>
                <span className="text-micro text-ink-400">{String(flag.updated_at).slice(0, 10)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The applied-migration list is deliberately NOT fetched.
 *
 * `supabase_migrations.schema_migrations` has no select policy for any
 * application role, and granting one would expose migration internals for no
 * operational benefit — the same list is available in the Supabase dashboard
 * and via `npm run check-migrations`. Saying so beats a panel that silently
 * returns nothing.
 */
function MigrationsPanel() {
  return (
    <section className="rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
      <h2 className={theme.type.section}>Applied migrations</h2>
      <p className="mt-1 text-meta text-ink-500 dark:text-ink-400">
        <ScrollText className="mr-1 inline h-4 w-4" aria-hidden="true" />
        Read the applied list in the Supabase dashboard, or run{' '}
        <code className="font-mono">npm run check-migrations</code>. It is not exposed over REST:{' '}
        <code className="font-mono">supabase_migrations.schema_migrations</code> has no select
        policy for any application role.
      </p>
    </section>
  );
}
