/**
 * src/admin/pages/UsersPage.tsx
 *
 * User management — searchable, virtualized, with privileged actions.
 *
 * ── WHY NOT READ-ONLY ───────────────────────────────────────────────────────
 * `role`, `plan` and `banned_at` are protected by `protect_profile_privilege()`
 * and `protect_profile_plan()` database triggers. A write from this client
 * raises SQLSTATE 42501 by design — that is the fix for the privilege-escalation
 * bug found earlier. Ban / promote / grant-premium therefore need a
 * service-role Edge Function, which is invoked via `runAdminAction`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Virtualizer } from '@tanstack/react-virtual';
import { AlertTriangle, ArrowDownUp, Download, RefreshCw, Search, MoreHorizontal, ShieldX, ShieldCheck, UserPlus, UserMinus } from 'lucide-react';
import { theme } from '../../config/theme';
import { KpiCard } from '../components/KpiCard';
import { UserDetailDrawer } from '../components/UserDetailDrawer';
import { downloadTextFile } from '../data/csv';
import { fetchUsers, usersToCsv, type AdminUserRow } from '../data/users';
import { runAdminAction, type AdminActionResult } from '../data/adminActions';
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

/** Fixed grid template shared by the header and every row, so columns align. */
const GRID = 'grid grid-cols-[3rem_minmax(9rem,1.4fr)_6rem_5rem_5rem_6rem_5rem_6rem_5rem] gap-3';

/** Simple cell renderer used in the virtualized table. */
function Cell({ value, title }: { value: string | number | null | undefined; title?: string }) {
  const display = value ?? '—';
  return title ? (
    <span title={title} className="text-meta text-ink-600 dark:text-ink-300">
      {display}
    </span>
  ) : (
    <span className="text-meta text-ink-600 dark:text-ink-300">{display}</span>
  );
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

/** Inline action menu for a single user row. */
function UserActionMenu({
  user,
  onAction,
}: {
  user: AdminUserRow;
  onAction: (action: 'user.ban' | 'user.unban' | 'user.promote' | 'user.demote', reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<'user.ban' | 'user.unban' | 'user.promote' | 'user.demote' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AdminActionResult | null>(null);

  const isAdmin = user.role === 'admin';
  const isBanned = user.bannedAt !== null;

  const actions = [
    { action: 'user.ban' as const, label: 'Ban', icon: ShieldX, danger: true, disabled: isBanned },
    { action: 'user.unban' as const, label: 'Unban', icon: ShieldCheck, danger: false, disabled: !isBanned },
    { action: 'user.promote' as const, label: 'Promote', icon: UserPlus, danger: false, disabled: isAdmin },
    { action: 'user.demote' as const, label: 'Demote', icon: UserMinus, danger: true, disabled: !isAdmin },
  ].filter((a) => !a.disabled);

  async function execute(action: 'user.ban' | 'user.unban' | 'user.promote' | 'user.demote') {
    setBusy(true);
    setResult(null);
    const r = await runAdminAction({ action, targetId: user.id, reason: reason.trim() || undefined });
    setBusy(false);
    setResult(r);
    if (r.ok) {
      setReason('');
      setOpen(false);
      onAction(action, reason);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-1.5 rounded hover:bg-ink-100 dark:hover:bg-ink-800"
        aria-label="User actions"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4 text-ink-500" aria-hidden="true" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 z-20 mt-1 min-w-[14rem] rounded-md border border-ink-200 bg-white shadow-lg dark:border-ink-800 dark:bg-ink-900">
            {isAdmin && (
              <div className="border-b border-ink-100 p-2 dark:border-ink-800">
                <label className="flex flex-col gap-1">
                  <span className="text-micro font-medium text-ink-600 dark:text-ink-400">Reason (required for admin)</span>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why is this being done?"
                    className="min-h-[36px] rounded-md border border-ink-200 bg-white px-2 text-meta font-semibold text-ink-700 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-200"
                  />
                </label>
              </div>
            )}

            <ul className="py-1" role="menu">
              {actions.map(({ action, label, icon: Icon, danger }) => (
                <li key={action} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      if (danger) setConfirming(action);
                      else execute(action);
                    }}
                    disabled={busy || confirming !== null}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-body ${
                      danger ? 'text-danger-600 dark:text-danger-400' : 'text-ink-700 dark:text-ink-200'
                    } hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-50`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {confirming === action ? `Confirm ${label}` : busy ? 'Working…' : label}
                  </button>
                </li>
              ))}
              {confirming && (
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => execute(confirming)}
                    disabled={busy}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-body text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/30 disabled:opacity-50"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Confirm {actions.find((a) => a.action === confirming)?.label}
                  </button>
                </li>
              )}
            </ul>

            {result && (
              <div className="border-t border-ink-100 p-2 dark:border-ink-800">
                <p
                  role="status"
                  className={`text-meta ${
                    result.ok
                      ? 'text-success-700 dark:text-success-300'
                      : 'text-danger-700 dark:text-danger-300'
                  }`}
                >
                  {result.message}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Satisfy noUnusedLocals — used as JSX in UsersTable
void UserActionMenu;

export function UsersPage() {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<UserFilters>(DEFAULT_FILTERS);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Which learner the 360 drawer is showing. The name is kept alongside the id
  // so the header can render it during the deep fetch, instead of "User".
  const [openId, setOpenId] = useState<string | null>(null);
  const [openName, setOpenName] = useState<string | null>(null);
  const openUser = useCallback((userId: string, name: string | null) => {
    setOpenId(userId);
    setOpenName(name);
  }, []);

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

  const [reloadToken, setReloadToken] = useState(0);

  const handleAction = useCallback((_action: string, _reason: string) => {
    // Trigger a reload to get fresh data from the server
    setReloadToken((n) => n + 1);
  }, []);

  // Re-run load when reloadToken changes
  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={theme.type.kicker}>People</p>
          <h1 className={theme.page.heading}>Users</h1>
          <p className={theme.page.description}>
            Use the actions menu (⋮) on each row to ban, unban, promote or demote. Plan, role and
            suspension are protected by database triggers and use the service-role function.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            // Exports the CURRENTLY SORTED + FILTERED set, not the whole table.
            // Re-querying here would quietly hand over rows the operator had
            // filtered out.
            onClick={() => downloadTextFile('users.csv', usersToCsv(sorted), 'text/csv;charset=utf-8')}
            className={theme.button.secondary}
            disabled={loading || sorted.length === 0}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            CSV ({sorted.length})
          </button>
          <button
            type="button"
            // Export ALL users (re-fetches full dataset)
            onClick={async () => {
              const result = await fetchUsers();
              downloadTextFile('users-all.csv', usersToCsv(result.rows), 'text/csv;charset=utf-8');
            }}
            className={theme.button.secondary}
            disabled={loading || rows.length === 0}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            CSV All ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className={theme.button.secondary}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
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
        onOpen={openUser}
        onAction={handleAction}
      />

      <UserDetailDrawer
        userId={openId}
        fallbackName={openName}
        onClose={() => {
          setOpenId(null);
          setOpenName(null);
        }}
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
        The affected columns show "—" rather than zero, so a missing value is never mistaken for a
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

function UsersTable({
  rows,
  loading,
  totalRows,
  scrollRef,
  virtualizer,
  onOpen,
  onAction,
}: {
  rows: AdminUserRow[];
  loading: boolean;
  totalRows: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  onOpen: (userId: string, name: string | null) => void;
  onAction: (action: 'user.ban' | 'user.unban' | 'user.promote' | 'user.demote', reason: string) => void;
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
        <span>Actions</span>
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
                  role="button"
                  tabIndex={0}
                  // Keyboard parity: a div-as-button that only responds to
                  // click is unreachable for a keyboard or screen-reader user,
                  // and this is the only way into the 360 view.
                  onClick={() => onOpen(u.id, u.username)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpen(u.id, u.username);
                    }
                  }}
                  aria-label={`Open details for ${u.username ?? u.id}`}
                  className={`${GRID} absolute left-0 w-full cursor-pointer items-center border-b border-ink-100 px-4 hover:bg-ink-50 focus-visible:bg-ink-50 focus-visible:outline-none dark:border-ink-800/60 dark:hover:bg-ink-800/40 dark:focus-visible:bg-ink-800/40`}
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
                  <span className="flex items-center justify-end">
                    <UserActionMenu user={u} onAction={onAction} />
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