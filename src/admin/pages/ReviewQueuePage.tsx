/**
 * src/admin/pages/ReviewQueuePage.tsx
 *
 * Every queued review item across every learner.
 *
 * ── WHAT THIS PAGE IS FOR ──────────────────────────────────────────────────
 * The Users table carries a per-user `queueSize`, which answers "does this
 * learner have a backlog?" and nothing more. It hides the aggregate, and the
 * aggregate is the finding: on the live database 49 of 50 queued items are
 * overdue and 30 of those are more than a month late, with exactly ONE item
 * still inside a future window.
 *
 * That is uncollected review DEBT, not a database fault — the Leitner
 * transitions are demonstrably correct, since every `wrong` sits at box 1 /
 * interval 1 and every `correct` has graduated to interval 3–7. Nobody is
 * draining the queue. A per-learner count cannot show that; this page can, and
 * it leads with it.
 *
 * ── READ-ONLY, LIKE EVERY OTHER ADMIN SURFACE ───────────────────────────────
 * Draining or resetting a queue item is a write. The schema grants
 * `review_queue` to authenticated users for their OWN rows only, so an admin
 * acting outside that scope gets 42501 — again the escalation guard, not a gap.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, RefreshCw, Search } from 'lucide-react';
import { theme } from '../../config/theme';
import { KpiCard } from '../components/KpiCard';
import type { DueState } from '../data/userDetail';
import {
  DEFAULT_QUEUE_FILTERS,
  fetchReviewQueue,
  filterQueue,
  toCsv,
  type QueueFilters,
  type QueueItem,
  type QueueTotals,
} from '../data/reviewQueue';

type Decorated = QueueItem & { due: DueState; overdueDays: number };

const DUE_CLASS: Record<DueState, string> = {
  overdue: 'bg-danger-100 text-danger-800 dark:bg-danger-900/60 dark:text-danger-200',
  due: 'bg-warning-100 text-warning-800 dark:bg-warning-900/60 dark:text-warning-200',
  upcoming: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
  scheduled: 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400',
};

/**
 * The debt banner.
 *
 * Shown only when there is genuinely stale debt. A permanent "all clear" strip
 * would train an admin to stop reading it, so it appears when it has something
 * to say and stays silent otherwise.
 */
function DebtBanner({ total, overdue, stale, oldest }: { total: number; overdue: number; stale: number; oldest: string | null }) {
  if (total === 0 || stale === 0) return null;
  const share = Math.round((overdue / total) * 100);
  return (
    <div
      className="flex gap-3 rounded-md border border-warning-200 bg-warning-50 p-4 text-body text-warning-900 dark:border-warning-900 dark:bg-warning-950/40 dark:text-warning-200"
      role="status"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">Review debt is accumulating and not being cleared</p>
        <p className="mt-1 text-meta">
          {stale} of {total} queued item{stale === 1 ? '' : 's'} {stale === 1 ? 'is' : 'are'} more than 30
          days overdue ({share}% of the queue is overdue overall), and the oldest has been waiting since{' '}
          <strong>{oldest ?? 'unknown'}</strong>. The Leitner transitions themselves look healthy, so
          this is a retention signal rather than a scheduling fault.
        </p>
      </div>
    </div>
  );
}

/** Trigger a client-side download of the CURRENTLY FILTERED rows. */
function downloadCsv(items: Decorated[]): void {
  const blob = new Blob([toCsv(items)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `review-queue-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  // Revoking immediately can cancel the download in some browsers; one frame is
  // enough for the click to have been consumed.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const GRID =
  'grid grid-cols-[minmax(9rem,1.3fr)_7rem_5rem_4rem_4rem_4rem_minmax(7rem,1fr)] gap-3';

function QueueTable({ rows, loading }: { rows: Decorated[]; loading: boolean }) {
  if (loading && rows.length === 0) {
    return <p className="px-4 py-10 text-center text-body text-ink-500 dark:text-ink-400">Loading…</p>;
  }
  if (rows.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-body text-ink-500 dark:text-ink-400">
        No queued items match these filters.
      </p>
    );
  }
  return (
    <>
      <div className={`${GRID} border-b border-ink-200 px-4 py-2 text-micro font-extrabold uppercase tracking-[0.16em] text-ink-500 dark:border-ink-800 dark:text-ink-400`}>
        <span>Item</span>
        <span>Module</span>
        <span>Learner</span>
        <span className="text-right">Due</span>
        <span className="text-right">Late</span>
        <span className="text-right">Box</span>
        <span>Answer</span>
      </div>
      <div className="max-h-[34rem] overflow-auto">
        {rows.map((it) => (
          <div
            key={it.id}
            className={`${GRID} items-center border-b border-ink-100 px-4 py-2 text-meta dark:border-ink-800/60`}
          >
            <span className="truncate font-mono text-ink-800 dark:text-ink-100" title={it.itemKey ?? ''}>
              {it.itemKey ?? '—'}
            </span>
            <span className="truncate text-ink-600 dark:text-ink-300">{it.moduleType ?? '—'}</span>
            <span className="truncate text-ink-600 dark:text-ink-300">{it.username ?? it.userId.slice(0, 8)}</span>
            <span className="text-right">
              <span className={`rounded px-1.5 py-0.5 text-micro font-extrabold uppercase ${DUE_CLASS[it.due]}`}>
                {it.due}
              </span>
            </span>
            <span className={`text-right tabular-nums ${it.overdueDays > 30 ? 'font-semibold text-danger-600 dark:text-danger-400' : 'text-ink-600 dark:text-ink-300'}`}>
              {it.overdueDays > 0 ? `${it.overdueDays}d` : '—'}
            </span>
            <span className="text-right tabular-nums text-ink-600 dark:text-ink-300">{it.boxLevel ?? 0}</span>
            <span
              className="truncate text-ink-500 dark:text-ink-400"
              title={`${it.userAnswer ?? '—'} → ${it.correctAnswer ?? '—'}${it.errorTag ? ` (${it.errorTag})` : ''}`}
            >
              {it.userAnswer ?? '—'}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

const selectClass =
  'min-h-[36px] rounded-md border border-ink-200 bg-white px-2 text-meta font-semibold text-ink-700 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-200';

function QueueControls({
  filters,
  onSet,
  totals,
  shown,
  total,
}: {
  filters: QueueFilters;
  onSet: (f: QueueFilters) => void;
  totals: QueueTotals | null;
  shown: number;
  total: number;
}) {
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
      <div className="relative min-w-[15rem] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
        <input
          type="search"
          value={filters.search}
          onChange={(e) => onSet({ ...filters, search: e.target.value })}
          placeholder="Search item, module or learner…"
          aria-label="Search the review queue"
          className={`${theme.input} pl-9`}
        />
      </div>
      <select
        value={filters.due}
        onChange={(e) => onSet({ ...filters, due: e.target.value as QueueFilters['due'] })}
        aria-label="Filter by due state"
        className={selectClass}
      >
        <option value="all">Any due state</option>
        <option value="overdue">Overdue</option>
        <option value="due">Due today</option>
        <option value="upcoming">Upcoming</option>
      </select>
      <select
        value={filters.module}
        onChange={(e) => onSet({ ...filters, module: e.target.value })}
        aria-label="Filter by module"
        className={selectClass}
      >
        <option value="all">All modules</option>
        {(totals?.byModule ?? []).map((m) => (
          <option key={m.moduleType} value={m.moduleType}>
            {m.moduleType} ({m.overdue}/{m.total} late)
          </option>
        ))}
      </select>
      <select
        value={filters.user}
        onChange={(e) => onSet({ ...filters, user: e.target.value })}
        aria-label="Filter by learner"
        className={selectClass}
      >
        <option value="all">All learners</option>
        {(totals?.byUser ?? []).map((u) => (
          <option key={u.userId} value={u.userId}>
            {u.username ?? u.userId.slice(0, 8)} ({u.overdue} late)
          </option>
        ))}
      </select>
      <span className="text-meta text-ink-500 dark:text-ink-400">
        {shown} of {total} shown
      </span>
    </section>
  );
}

export function ReviewQueuePage() {
  const [items, setItems] = useState<Decorated[]>([]);
  const [totals, setTotals] = useState<QueueTotals | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<QueueFilters>(DEFAULT_QUEUE_FILTERS);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchReviewQueue();
    setItems(r.items);
    setTotals(r.totals);
    setErrors(r.errors);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => filterQueue(items, filters), [items, filters]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={theme.type.kicker}>Learning</p>
          <h1 className={theme.page.heading}>Review queue</h1>
          <p className={theme.page.description}>
            Every item waiting for spaced repetition, across all learners. Read-only — resetting or
            draining an item is a write.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadCsv(shown)}
            disabled={shown.length === 0}
            className={theme.button.secondary}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export {shown.length} row{shown.length === 1 ? '' : 's'}
          </button>
          <button type="button" onClick={() => void load()} className={theme.button.secondary} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </header>

      {totals && (
        <DebtBanner total={totals.total} overdue={totals.overdue} stale={totals.stale} oldest={totals.oldestDue} />
      )}

      {errors.length > 0 && (
        <div className="rounded-md border border-warning-200 bg-warning-50 p-4 text-body text-warning-900 dark:border-warning-900 dark:bg-warning-950/40 dark:text-warning-200" role="status">
          <p className="font-semibold">Some sources could not be read</p>
          <ul className="mt-1 list-inside list-disc text-meta">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <section aria-label="Totals" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Queued" value={String(totals?.total ?? '—')} hint="all learners" loading={loading} />
        <KpiCard
          label="Overdue"
          value={String(totals?.overdue ?? '—')}
          hint="past their due time"
          loading={loading}
          tone={(totals?.overdue ?? 0) > 0 ? 'bad' : 'good'}
        />
        <KpiCard
          label="Stale 30d+"
          value={String(totals?.stale ?? '—')}
          hint="more than a month late"
          loading={loading}
          tone={(totals?.stale ?? 0) > 0 ? 'warn' : 'good'}
        />
        <KpiCard label="Oldest" value={totals?.oldestDue ?? '—'} hint="still outstanding" loading={loading} />
      </section>

      <QueueControls
        filters={filters}
        onSet={setFilters}
        totals={totals}
        shown={shown.length}
        total={items.length}
      />

      <section className="overflow-hidden rounded-lg border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
        <QueueTable rows={shown} loading={loading} />
      </section>
    </div>
  );
}
