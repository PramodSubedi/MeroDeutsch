/**
 * src/admin/pages/CurriculumPage.tsx
 *
 * The authored curriculum, as the APP SEES IT.
 *
 * ── WHY THIS IS A READER, NOT AN EDITOR ────────────────────────────────────
 * The curriculum is bundled JSON (`src/data/curriculum/units/*.json`), not
 * database rows — there is no `curriculum_units` table. An "editor" that wrote to
 * the database would be editing a copy the app never reads, the worst possible
 * outcome: an admin believes a change shipped and nothing changed. So this
 * surface is honest about what it is — validation, structure and version
 * history.
 *
 * To change content, the files are edited in the repo and checked by
 * `npm run curriculum:validate` — the same validator that runs at app boot, so a
 * broken edit is caught before it reaches a learner.
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, CheckCircle2, History, RefreshCw } from 'lucide-react';
import { theme } from '../../config/theme';
import { KpiCard } from '../components/KpiCard';
import { fetchCurriculum, issueCounts, type CurriculumData } from '../data/curriculum';

export function CurriculumPage() {
  const [data, setData] = useState<CurriculumData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setData(await fetchCurriculum());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const issues = issueCounts(data?.issues ?? []);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={theme.type.kicker}>Content</p>
          <h1 className={theme.page.heading}>Curriculum</h1>
          <p className={theme.page.description}>
            The authored spine, read from the same bundled JSON the app runs on.
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

      <section aria-label="Totals" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Units"
          value={data ? String(data.units.length) : '—'}
          hint="in the spine"
          icon={BookOpen}
          loading={loading}
        />
        <KpiCard
          label="Nodes"
          value={data ? String(data.totalNodes) : '—'}
          hint="learn + practice + checkpoint"
          loading={loading}
        />
        <KpiCard
          label="Checkpoints"
          value={data ? String(data.totalCheckpoints) : '—'}
          hint="gates at 80%"
          loading={loading}
        />
        <KpiCard
          label="Validation"
          value={data ? (data.hasErrors ? `${issues.errors} errors` : 'Clean') : '—'}
          hint={data ? `${issues.warnings} warnings` : ''}
          icon={data?.hasErrors ? AlertTriangle : CheckCircle2}
          loading={loading}
          tone={data?.hasErrors ? 'bad' : 'good'}
        />
      </section>

      {data && data.errors.length > 0 && <SourceErrors errors={data.errors} />}
      <ValidationPanel data={data} />
      <UnitsTable units={data?.units ?? []} />
      <VersionPanel versions={data?.versions ?? []} />
    </div>
  );
}

/**
 * The SAME validator that runs when the app boots, surfaced for an admin.
 *
 * `CURRICULUM_ISSUES` is computed once at module load by
 * `src/data/curriculum/index.ts`, so what an admin reads here is precisely what
 * the learner app validated against — not a second, weaker check that could pass
 * while the app fails.
 */
function ValidationPanel({ data }: { data: CurriculumData | null }) {
  const issues = data?.issues ?? [];
  if (!data) return null;

  if (issues.length === 0) {
    return (
      <section className="rounded-lg border border-success-200 bg-success-50 p-4 dark:border-success-900 dark:bg-success-950/30">
        <h2 className={`${theme.type.section} text-success-800 dark:text-success-300`}>
          Content validation passed
        </h2>
        <p className="mt-1 text-meta text-success-800 dark:text-success-300/80">
          The spine passed <code className="font-mono">validateCurriculum()</code> with no findings.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
      <h2 className={`${theme.type.section} px-4 pt-4`}>Content findings ({issues.length})</h2>
      <ul className="mt-3 space-y-1 px-4 pb-4">
        {issues.slice(0, 50).map((i, idx) => (
          <li key={`${i.where}-${idx}`} className="flex gap-2 text-meta">
            <span
              className={[
                'shrink-0 rounded px-1.5 py-0.5 text-micro font-extrabold uppercase tracking-wide',
                i.level === 'error'
                  ? 'bg-danger-100 text-danger-800 dark:bg-danger-900/60 dark:text-danger-200'
                  : 'bg-warning-100 text-warning-800 dark:bg-warning-900/60 dark:text-warning-200',
              ].join(' ')}
            >
              {i.level}
            </span>
            <code className="shrink-0 font-mono text-ink-500 dark:text-ink-400">{i.where}</code>
            <span className="text-ink-700 dark:text-ink-200">{i.message}</span>
          </li>
        ))}
        {issues.length > 50 && (
          <li className="text-meta text-ink-500 dark:text-ink-400">
            …and {issues.length - 50} more. Run{' '}
            <code className="font-mono">npm run curriculum:validate</code> for the full list.
          </li>
        )}
      </ul>
    </section>
  );
}

function SourceErrors({ errors }: { errors: string[] }) {
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
    </div>
  );
}

function UnitsTable({ units }: { units: CurriculumData['units'] }) {
  return (
    <section className="rounded-lg border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
      <h2 className={`${theme.type.section} px-4 pt-4`}>Units</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-meta">
          <thead>
            <tr className="border-y border-ink-200 text-micro font-extrabold uppercase tracking-[0.16em] text-ink-500 dark:border-ink-800 dark:text-ink-400">
              <th className="px-4 py-2">Unit</th>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2 text-right">Nodes</th>
              <th className="px-4 py-2 text-right">Gates</th>
              <th className="px-4 py-2 text-right">Bonus</th>
              <th className="px-4 py-2">Kind</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id} className="border-b border-ink-100 dark:border-ink-800/60">
                <td className="px-4 py-2 font-mono text-ink-500 dark:text-ink-400">{u.id}</td>
                <td className="px-4 py-2">
                  <span className="font-semibold text-ink-900 dark:text-ink-50">{u.title}</span>
                  <span className="block truncate text-micro text-ink-500 dark:text-ink-400">
                    {u.theme}
                  </span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{u.nodeCount}</td>
                <td className="px-4 py-2 text-right tabular-nums">{u.checkpointCount}</td>
                <td className="px-4 py-2 text-right tabular-nums">{u.bonusCount}</td>
                <td className="px-4 py-2">
                  <span
                    className={[
                      'rounded-full px-2 py-0.5 text-micro font-extrabold uppercase tracking-wide',
                      u.kind === 'core'
                        ? 'bg-accent-100 text-accent-800 dark:bg-accent-900/60 dark:text-accent-200'
                        : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
                    ].join(' ')}
                  >
                    {u.kind}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Snapshot history from `curriculum_versions` — append-only, service-role write
 * only, so a client can never forge its own "history".
 */
function VersionPanel({ versions }: { versions: CurriculumData['versions'] }) {
  return (
    <section className="rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
      <h2 className={theme.type.section}>
        <History className="mr-1 inline h-4 w-4" aria-hidden="true" />
        Version history
      </h2>
      <p className="mt-1 text-meta text-ink-500 dark:text-ink-400">
        Snapshots recorded on CMS saves. Writes are service-role only, so a client cannot add its own
        history. Content changes themselves are made in the repo JSON files.
      </p>
      {versions.length === 0 ? (
        <p className="mt-3 text-meta text-ink-500 dark:text-ink-400">No snapshots recorded yet.</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {versions.slice(0, 25).map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 pb-1 text-meta dark:border-ink-800/60"
            >
              <code className="font-mono text-ink-700 dark:text-ink-200">{v.unitId}</code>
              <span className="font-mono text-micro text-ink-400">
                {v.editorId.slice(0, 8)} · {v.createdAt.slice(0, 19).replace('T', ' ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
