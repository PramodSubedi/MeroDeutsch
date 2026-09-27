/**
 * src/admin/pages/AuditLogPage.tsx
 *
 * The read side of the compliance trail. `admin-action` writes every privileged
 * attempt here; this is where an operator reads it back.
 *
 * Denials are shown FIRST and coloured distinctly, because a refused attempt to
 * demote the last admin is the single most important row this page can contain.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { theme } from '../../config/theme';
import { KpiCard } from '../components/KpiCard';
import { downloadTextFile } from '../data/csv';
import {
  actionFacets,
  auditToCsv,
  fetchAuditLog,
  filterAuditEntries,
  outcomeOf,
  safeText,
  summariseAudit,
  targetTypeFacets,
  type AuditEntry,
  type AuditFilters,
  type AuditOutcome,
} from '../data/auditLog';

const OUTCOME_STYLE: Record<AuditOutcome, { label: string; cls: string }> = {
  allowed: { label: 'Applied', cls: 'bg-success-100 text-success-800 dark:bg-success-900/60 dark:text-success-200' },
  denied: { label: 'Denied', cls: 'bg-danger-100 text-danger-800 dark:bg-danger-900/60 dark:text-danger-200' },
  failed: { label: 'Failed', cls: 'bg-warning-100 text-warning-800 dark:bg-warning-900/60 dark:text-warning-200' },
  unimplemented: { label: 'Not implemented', cls: 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200' },
};

function Row({ entry }: { entry: AuditEntry }) {
  const outcome = outcomeOf(entry.action);
  const style = OUTCOME_STYLE[outcome];
  const Icon = outcome === 'allowed' ? ShieldCheck : outcome === 'denied' ? ShieldX : ShieldAlert;
  return (
    <li className="border-b border-ink-100 px-3 py-2.5 last:border-0 dark:border-ink-800">
      <div className="flex flex-wrap items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-ink-500 dark:text-ink-400" aria-hidden="true" />
        <span className="font-mono text-body text-ink-900 dark:text-ink-50">{entry.action}</span>
        <span className={`rounded-full px-2 py-0.5 text-micro font-extrabold uppercase ${style.cls}`}>
          {style.label}
        </span>
        <span className="ml-auto text-meta tabular-nums text-ink-500 dark:text-ink-400">
          {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '—'}
        </span>
      </div>
      <p className="mt-1 text-meta text-ink-600 dark:text-ink-300">
        by <span className="font-medium">{entry.adminName ?? entry.adminId}</span>
        {entry.targetId && (
          <>
            {' → '}
            <span className="font-mono">{entry.targetId}</span>
            {entry.targetType && <span className="text-ink-500 dark:text-ink-400"> ({entry.targetType})</span>}
          </>
        )}
      </p>
      {(safeText(entry.before) || safeText(entry.after)) && (
        <details className="mt-1 text-meta">
          <summary className="cursor-pointer text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200">
            before / after
          </summary>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded bg-ink-50 p-2 font-mono text-micro text-ink-700 dark:bg-ink-900/60 dark:text-ink-200">
            {`before: ${safeText(entry.before) || '(none)'}\nafter:  ${safeText(entry.after) || '(none)'}`}
          </pre>
        </details>
      )}
    </li>
  );
}

function AuditFilters({
  filters,
  setFilters,
  actions,
  targetTypes,
}: {
  filters: AuditFilters;
  setFilters: React.Dispatch<React.SetStateAction<AuditFilters>>;
  actions: string[];
  targetTypes: string[];
}) {
  return (
    <section aria-label="Filters" className="flex flex-wrap items-end gap-3">
      <label className="flex min-w-56 flex-1 flex-col gap-1">
        <span className="text-label text-ink-600 dark:text-ink-300">Search</span>
        <input
          type="search"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder="Action, target id, admin, or any value…"
          aria-label="Search the audit log"
          className={theme.input}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-label text-ink-600 dark:text-ink-300">Outcome</span>
        <select
          value={filters.outcome}
          onChange={(e) => setFilters((f) => ({ ...f, outcome: e.target.value as AuditFilters['outcome'] }))}
          aria-label="Filter by outcome"
          className={theme.input}
        >
          <option value="all">All</option>
          <option value="allowed">Applied</option>
          <option value="denied">Denied</option>
          <option value="failed">Failed</option>
          <option value="unimplemented">Not implemented</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-label text-ink-600 dark:text-ink-300">Action</span>
        <select value={filters.action} onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))} aria-label="Filter by action" className={theme.input}>
          <option value="">All</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-label text-ink-600 dark:text-ink-300">Target</span>
        <select value={filters.targetType} onChange={(e) => setFilters((f) => ({ ...f, targetType: e.target.value }))} aria-label="Filter by target type" className={theme.input}>
          <option value="">All</option>
          {targetTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
    </section>
  );
}

export function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AuditFilters>({ search: '', outcome: 'all', action: '', targetType: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchAuditLog();
    setEntries(r.entries);
    setErrors(r.errors);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => filterAuditEntries(entries, filters), [entries, filters]);
  const summary = useMemo(() => summariseAudit(filtered), [filtered]);
  const actions = useMemo(() => actionFacets(entries), [entries]);
  const targetTypes = useMemo(() => targetTypeFacets(entries), [entries]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={theme.type.kicker}>Compliance</p>
          <h1 className={theme.page.heading}>Audit log</h1>
          <p className={theme.page.description}>
            Every privileged action, allowed or refused. Denials are recorded too — a refused
            attempt is the event worth seeing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => downloadTextFile('audit-log.csv', auditToCsv(filtered), 'text/csv;charset=utf-8')}
            className={theme.button.secondary}
            disabled={filtered.length === 0}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            CSV ({filtered.length})
          </button>
          <button type="button" onClick={() => void load()} className={theme.button.secondary} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </header>

      {errors.length > 0 && (
        <div className="rounded-md border border-danger-200 bg-danger-50 p-4 text-body text-danger-900 dark:border-danger-900 dark:bg-danger-950/40 dark:text-danger-200" role="status">
          <p className="font-semibold">The log could not be read in full</p>
          <ul className="mt-1 list-inside list-disc text-meta">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}

      <section aria-label="Totals" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Entries" value={String(summary.total)} hint="in this view" loading={loading} />
        <KpiCard label="Applied" value={String(summary.allowed)} hint="succeeded" loading={loading} tone={summary.allowed > 0 ? 'good' : undefined} />
        <KpiCard label="Refused" value={String(summary.denied)} hint="guard stopped it" loading={loading} tone={summary.denied > 0 ? 'bad' : 'good'} />
        <KpiCard label="Admins active" value={String(summary.admins)} hint={`${summary.failed} failed`} loading={loading} tone={summary.failed > 0 ? 'warn' : undefined} />
      </section>

      <AuditFilters filters={filters} setFilters={setFilters} actions={actions} targetTypes={targetTypes} />

      {loading && entries.length === 0 ? (
        <p className="py-10 text-center text-body text-ink-500 dark:text-ink-400">Loading the log…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-ink-200 bg-ink-50 p-8 text-center dark:border-ink-800 dark:bg-ink-800/40">
          <p className="text-section font-bold text-ink-900 dark:text-ink-50">
            {entries.length === 0 ? 'No privileged actions recorded yet' : 'No entries match these filters'}
          </p>
          <p className="mt-1 text-meta text-ink-600 dark:text-ink-300">
            {entries.length === 0
              ? 'Rows appear here the moment an admin bans, promotes, repairs vocabulary, or is refused.'
              : 'Try clearing the search or the filters above.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200 bg-white dark:divide-ink-800 dark:border-ink-800 dark:bg-ink-900">
          {filtered.map((e) => <Row key={e.id} entry={e} />)}
        </ul>
      )}
    </div>
  );
}
