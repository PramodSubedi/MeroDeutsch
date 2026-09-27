/**
 * src/admin/pages/UsersPage.tsx
 *
 * User management — read-only, searchable, virtualized.
 *
 * ── WHY READ-ONLY, AND WHY THAT IS NOT A GAP ───────────────────────────────
 * `role`, `plan` and `banned_at` are protected by `protect_profile_privilege()`
 * and `protect_profile_plan()` database triggers. A write from this client
 * raises SQLSTATE 42501 by design — that is the fix for the privilege-escalation
 * bug found earlier, and it is not something to work around. Ban / promote /
 * grant-premium therefore need a service-role Edge Function, which is separate
 * work. This page surfaces the current state of those columns so that work has a
 * verified read model to build on.
 *
 * ── WHY VIRTUALIZED ────────────────────────────────────────────────────────
 * `vocabulary` is ~1,000 rows and `review_queue` grows per learner, so this
 * table will pass what is comfortable to render as DOM. Row virtualization keeps
 * the node count constant regardless of user count, and
 * `@tanstack/react-virtual` is already a dependency.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Virtualizer } from '@tanstack/react-virtual';
import { AlertTriangle, ArrowDownUp, RefreshCw, Search } from 'lucide-react';
import { theme } from '../../config/theme';
import { KpiCard } from '../components/KpiCard';
import { fetchUsers, type AdminUserRow } from '../data/users';
import {
  DEFAULT_FILTERS,
  facetCounts,
  filterUsers,
  sortUsers,
  type PlanFilter,
  type RoleFilter,
  type SortKey,
  type StatusFilter,
  type UserFilters,
} from '../data/filterUsers';

const ROW_HEIGHT = 52;
const OVERSCAN = 8;

/**
 * A missing value renders as a muted dash — never as `0` or `null`.
 *
 * A learner with no `user_xp` row has earned nothing yet; showing `0` would be
 * a guess, and "0 XP" reads as a fact about their work. The dash says "no data".
 */
function Cell({ value, title }: { value: number | string | null; title?: string }) {
  if (value === null || value === '') {
    return (
      <span className="text-ink-300 dark:text-ink-600" title="No data">
        —
      </span>
    );
  }
  return <span title={title}>{value}</span>;
}

function PlanBadge({ plan }: { plan: string | null }) {
  const value = plan ?? 'free';
  return (
    <span
      className={[
        'inline-flex rounded-full px-2 py-0.5 text-micro font-extrabold uppercase tracking-wide',
        value === 'premium'
          ? 'bg-warning-100 text-warning-800 dark:bg-warning-900/60 dark:text-warning-200'
          : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
      ].join(' ')}
    >
      {value}
    </span>
  );
}

/** Only admins get a badge; "user" is the default and needs no label. */
function RoleBadge({ role }: { role: string | null }) {
  if (role !== 'admin') return null;
  return (
    <span className="ml-1.5 inline-flex rounded-full bg-accent-100 px-1.5 py-0.5 text-micro font-extrabold uppercase tracking-wide text-accent-800 dark:bg-accent-900/60 dark:text-accent-200">
      admin
    </span>
  );
}

const SORT_LABELS: Record<SortKey, string> = {
  createdAt: 'Newest',
  username: 'Name',
  xp: 'XP',
  streak: 'Streak',
  unit: 'Unit',
};

export function UsersPage() {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<UserFilters>(DEFAULT_FILTERS);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchUsers();
    setRows(result.rows);
    setErrors(result.errors);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => facetCounts(rows, filters.search), [rows, filters.search]);
  const filtered = useMemo(() => filterUsers(rows, filters), [rows, filters]);
  const sorted = useMemo(
    () => sortUsers(filtered.rows, filters.sort, filters.desc),
    [filtered.rows, filters.sort, filters.desc]
  );

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const set = <K extends keyof UserFilters>(key: K, value: UserFilters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  // Clicking the active column toggles direction; a new column starts
  // descending, which is the useful default for every numeric column here.
  const onSort = (key: SortKey) => {
    setFilters((prev) =>
      prev.sort === key ? { ...prev, desc: !prev.desc } : { ...prev, sort: key, desc: true }
    );
  };

  const kpis = useMemo(
    () => ({
      total: rows.length,
      premium: rows.filter((r) => r.plan === 'premium').length,
      admins: rows.filter((r) => r.role === 'admin').length,
      suspended: rows.filter((r) => r.bannedAt !== null).length,
    }),
    [rows]
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={theme.type.kicker}>People</p>
          <h1 className={theme.page.heading}>Users</h1>
          <p className={theme.page.description}>
            Read-only. Plan, role and suspension are protected by database triggers and need a
            service-role function to change.
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
        <KpiCard label="Users" value={String(kpis.total)} hint="rows in profiles" loading={loading} />
        <KpiCard label="Premium" value={String(kpis.premium)} hint="plan = premium" loading={loading} />
        <KpiCard label="Admins" value={String(kpis.admins)} hint="role = admin" loading={loading} />
        <KpiCard
          label="Suspended"
          value={String(kpis.suspended)}
          hint="banned_at is set"
          loading={loading}
          tone={kpis.suspended > 0 ? 'bad' : 'neutral'}
        />
      </section>

      <FilterBar
        filters={filters}
        counts={counts}
        onSet={set}
        onSort={onSort}
        shown={sorted.length}
        total={rows.length}
      />

      <UsersTable
        rows={sorted}
        loading={loading}
        totalRows={rows.length}
        scrollRef={scrollRef}
        virtualizer={virtualizer}
      />
    </div>
  );
}

/** Partial-failure panel. The table still renders; affected columns show "—". */
function ErrorsPanel({ errors }: { errors: string[] }) {
  return (
    <div
      className="rounded-md border border-warning-200 bg-warning-50 p-4 text-body text-warning-900 dark:border-warning-900 dark:bg-warning-950/40 dark:text-warning-200"
      role="status"
    >
      <p className="font-semibold">Some sources could not be read</p>
      <p className="mt-1 text-meta">
        The affected columns show “—” rather than zero, so a missing value is never mistaken for a
        real one.
      </p>
      <ul className="mt-1 list-inside list-disc text-meta">
        {errors.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </div>
  );
}

function Facet({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-micro font-extrabold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="min-h-[36px] rounded-md border border-ink-200 bg-white px-2 text-meta font-semibold text-ink-700 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-200"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterBar({
  filters,
  counts,
  onSet,
  onSort,
  shown,
  total,
}: {
  filters: UserFilters;
  counts: ReturnType<typeof facetCounts>;
  onSet: <K extends keyof UserFilters>(key: K, value: UserFilters[K]) => void;
  onSort: (key: SortKey) => void;
  shown: number;
  total: number;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => onSet('search', e.target.value)}
            placeholder="Search name or user id…"
            aria-label="Search users"
            className={`${theme.input} pl-9`}
          />
        </div>

        <Facet
          label="Plan"
          value={filters.plan}
          onChange={(v) => onSet('plan', v as PlanFilter)}
          options={[
            { value: 'all', label: `All (${counts.searched})` },
            { value: 'free', label: `Free (${counts.free})` },
            { value: 'premium', label: `Premium (${counts.premium})` },
          ]}
        />
        <Facet
          label="Role"
          value={filters.role}
          onChange={(v) => onSet('role', v as RoleFilter)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'user', label: `User (${counts.user})` },
            { value: 'admin', label: `Admin (${counts.admin})` },
          ]}
        />
        <Facet
          label="Status"
          value={filters.status}
          onChange={(v) => onSet('status', v as StatusFilter)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active (7d)' },
            { value: 'idle', label: 'Idle' },
            { value: 'suspended', label: `Suspended (${counts.suspended})` },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-micro font-extrabold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
          Sort
        </span>
        {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onSort(key)}
            aria-pressed={filters.sort === key}
            className={[
              'min-h-[36px] rounded-md border px-2.5 text-meta font-semibold transition',
              filters.sort === key
                ? 'border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-950/50 dark:text-accent-300'
                : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300',
            ].join(' ')}
          >
            {SORT_LABELS[key]}
            {filters.sort === key && <ArrowDownUp className="ml-1 inline h-3 w-3" aria-hidden="true" />}
          </button>
        ))}
        <span className="text-meta text-ink-500 dark:text-ink-400">
          {shown} of {total} shown
        </span>
      </div>
    </section>
  );
}

/** Fixed grid template shared by the header and every row, so columns align. */
const GRID = 'grid grid-cols-[minmax(9rem,1.4fr)_6rem_5rem_5rem_6rem_5rem_6rem] gap-3';

function UsersTable({
  rows,
  loading,
  totalRows,
  scrollRef,
  virtualizer,
}: {
  rows: AdminUserRow[];
  loading: boolean;
  totalRows: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /**
   * Typed to the concrete scroll element. `ReturnType<typeof useVirtualizer>`
   * erases the element generic to `Element`, which is not assignable from the
   * `ReactVirtualizer<HTMLDivElement, Element>` the call site actually produces.
   */
  virtualizer: Virtualizer<HTMLDivElement, Element>;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
      <div
        className={`${GRID} border-b border-ink-200 px-4 py-2 text-micro font-extrabold uppercase tracking-[0.16em] text-ink-500 dark:border-ink-800 dark:text-ink-400`}
      >
        <span>User</span>
        <span>Plan</span>
        <span className="text-right">XP</span>
        <span className="text-right">Level</span>
        <span className="text-right">Streak</span>
        <span className="text-right">Unit</span>
        <span className="text-right">Last seen</span>
      </div>

      {loading && totalRows === 0 ? (
        <p className="px-4 py-10 text-center text-body text-ink-500 dark:text-ink-400">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-body font-semibold text-ink-700 dark:text-ink-200">No users match</p>
          <p className="mt-1 text-meta text-ink-500 dark:text-ink-400">
            {totalRows === 0
              ? 'No profiles are readable. Check the admin RLS policies for your role.'
              : 'Try clearing the search or the filters above.'}
          </p>
        </div>
      ) : (
        // The scroll container is the virtualizer's measuring element, and the
        // inner spacer supplies the full scrollable height so rows far down the
        // list can be reached.
        <div ref={scrollRef} className="max-h-[32rem] overflow-auto">
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((item) => {
              const u = rows[item.index];
              return (
                <div
                  key={u.id}
                  className={`${GRID} absolute left-0 w-full items-center border-b border-ink-100 px-4 dark:border-ink-800/60`}
                  style={{ height: ROW_HEIGHT, transform: `translateY(${item.start}px)` }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {u.bannedAt && (
                      <AlertTriangle
                        className="h-4 w-4 shrink-0 text-danger-500"
                        aria-label="Suspended"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-body font-semibold text-ink-900 dark:text-ink-50">
                        {u.username ?? '(no username)'}
                        <RoleBadge role={u.role} />
                      </p>
                      <p className="truncate font-mono text-micro text-ink-400" title={u.id}>
                        {u.id}
                      </p>
                    </div>
                  </div>
                  <span>
                    <PlanBadge plan={u.plan} />
                  </span>
                  <span className="text-right text-meta">
                    <Cell value={u.totalXp} />
                  </span>
                  <span className="text-right text-meta">
                    <Cell value={u.level} />
                  </span>
                  <span className="text-right text-meta">
                    <Cell
                      value={u.currentStreak}
                      title={u.longestStreak !== null ? `Best streak ${u.longestStreak}` : undefined}
                    />
                  </span>
                  <span className="text-right text-meta">
                    {/* +1 because the stored index is 0-based; the column is 1-based. */}
                    <Cell
                      value={u.unlockedUnitIndex === null ? null : u.unlockedUnitIndex + 1}
                      title={u.pathMode ? `Path mode: ${u.pathMode}` : undefined}
                    />
                  </span>
                  <span className="truncate text-right text-meta">
                    <Cell value={u.lastActiveAt} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
