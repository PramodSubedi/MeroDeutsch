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
import { useSearchParams } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Virtualizer } from '@tanstack/react-virtual';
import { AlertTriangle, ArrowDownUp, Download, RefreshCw, Search, MoreHorizontal, ShieldX, ShieldCheck, UserPlus, UserMinus } from 'lucide-react';
import { theme } from '../../config/theme';
import { KpiCard } from '../components/KpiCard';
import { UserDetailDrawer } from '../components/UserDetailDrawer';
import { downloadTextFile } from '../data/csv';
import {
  fetchUsersPage,
  usersToCsv,
  USERS_PAGE_SIZE,
  type AdminUserRow,
  type UserFacets,
  EMPTY_USER_FACETS,
  type UsersCursor,
  type UsersResult,
} from '../data/users';
import { runAdminAction, type AdminActionResult } from '../data/adminActions';
import {
  DEFAULT_FILTERS,
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
    // Promote is marked `danger` so it takes the two-step confirm. It grants full
    // control-centre access — a role, a ban button, the ability to publish
    // curriculum to every learner — and it was previously the ONE privileged
    // action here that applied on a single click, with no confirm and (because
    // the reason field only renders for existing admins) no written reason.
    { action: 'user.promote' as const, label: 'Promote', icon: UserPlus, danger: true, disabled: isAdmin },
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
      setConfirming(null);
      onAction(action, reason);
    } else {
      // Only close the popover on success. A refusal is something an operator
      // needs to read, and closing the popover closed the only element that
      // could report it.
      setConfirming(null);
    }
  }

  return (
    <div className="relative flex flex-col items-end">
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
          {/* ── EVERY CLICK HERE MUST STOP PROPAGATING ──────────────────────────
              The whole menu lives inside the row's own click target, which opens
              the 360 drawer. Without `stopPropagation` on these two elements,
              pressing "Promote" wrote the privilege change AND navigated into
              the drawer, and dismissing the menu by clicking the backdrop did
              the same. Keyboard was worse: the row's `onKeyDown` fired on
              Enter, so activating a focused menu item ran both. */}
          <div
            className="fixed inset-0 z-10"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            onKeyDown={(e) => e.stopPropagation()}
            aria-hidden="true"
          />
          <div
            className="absolute right-0 z-20 mt-1 min-w-[14rem] rounded-md border border-ink-200 bg-white shadow-lg dark:border-ink-800 dark:bg-ink-900"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
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
                    onClick={(e) => {
                      e.stopPropagation();
                      if (danger) setConfirming(action);
                      else execute(action);
                    }}
                    disabled={busy || confirming !== null}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-body ${
                      danger ? 'text-danger-600 dark:text-danger-400' : 'text-ink-700 dark:text-ink-200'
                    } hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-50`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {busy ? 'Working…' : label}
                  </button>
                </li>
              ))}
              {confirming && (
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(e) => { e.stopPropagation(); void execute(confirming); }}
                    disabled={busy}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-body text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/30 disabled:opacity-50"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Confirm {actions.find((a) => a.action === confirming)?.label}
                  </button>
                </li>
              )}
            </ul>
          </div>
        </>
      )}

      {/* ── THE RESULT LIVES OUTSIDE `{open && …}` ──────────────────────────────
          The popover closed on success, and the banner used to live inside it —
          so a successful ban, promote or demote reported nothing at all, and
          `result.message` was only ever readable on failure. The operator's
          question after a privileged write is "did that work?", and the answer
          has to survive the UI deciding it is done. */}
      {result && (
        <p
          role="status"
          className={`mt-1 max-w-[16rem] text-right text-micro ${
            result.ok ? 'text-success-700 dark:text-success-300' : 'text-danger-700 dark:text-danger-300'
          }`}
        >
          <span className="font-semibold">{result.ok ? 'Done. ' : 'Not applied. '}</span>
          {result.message}
        </p>
      )}
    </div>
  );
}

// `UserActionMenu` is rendered as JSX in `UsersTable` below. The old
// `void UserActionMenu;` and its "satisfy noUnusedLocals" comment claimed the
// component was otherwise unused, which was false — it is referenced at the row
// level. The statement did nothing and the comment actively misled.

export function UsersPage() {
  // ── SERVER-SIDE FILTERING AND PAGINATION ───────────────────────────────────
  //
  // This used to pull every user into the browser (capped at 5,000, with no error
  // — so the table rendered "5,000 of 5,000" above a set that was quietly missing
  // everyone past the cap), then filter and sort the result in JavaScript. The
  // filter, the sort, the join and the total now happen in one RPC call.
  //
  // That is not only a performance change. It changes what the numbers MEAN:
  //
  //   · `total` is the exact matching population, so the count under the table
  //     is a fact rather than a cap
  //   · a filter is applied to the whole set, not to a page — filtering page 3
  //     answers a different question than filtering the table
  //   · a non-admin gets a REFUSAL. RLS can only exclude rows, so the old read
  //     handed a demoted or suspended admin an empty table with no error.
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<UserFacets>(EMPTY_USER_FACETS);
  const [cursor, setCursor] = useState<UsersCursor | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState<UsersResult['truncated']>([]);
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

  // ── ONE effect, ONE fetch ──────────────────────────────────────────────────
  // There were two effects here — `useEffect(load, [load])` and
  // `useEffect(load, [load, reloadToken])` — and both ran on mount. The read was
  // SIX queries, so every visit issued twelve, and whichever response landed last
  // won. The reload token is the only thing the first effect was missing.
  //
  // It is now ONE query, and it re-runs whenever a FILTER changes — which is the
  // behaviour that makes the filter correct rather than merely fast.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Guards a slow response from an earlier run overwriting a fresher one after
    // a manual refresh or a fast filter change.
    setLoading(true);
    void fetchUsersPage({
      search: filters.search,
      plan: filters.plan,
      role: filters.role,
      status: filters.status,
      sort: filters.sort,
      desc: filters.desc,
      limit: USERS_PAGE_SIZE,
    }).then((result) => {
      if (cancelled) return;
      setRows(result.rows);
      setErrors(result.errors);
      setTotal(result.total);
      setFacets(result.facets);
      setCursor(result.nextCursor);
      setTruncated(result.truncated);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // `filters` is the dependency, and `filters.search` is deliberately NOT
    // debounced here: the RPC is indexed, and a debounce would be the kind of
    // optimisation that makes a filter feel broken.
  }, [filters, reloadToken]);

  const load = useCallback(() => setReloadToken((n) => n + 1), []);
  const handleAction = useCallback(() => load(), [load]);

  // ── THE `?q=` DEEP LINK ─────────────────────────────────────────────────────
  // The ⌘K palette navigates to `/users?q=<id>` on the stated grounds that each
  // hit "navigates to the page that CAN filter for it". No admin page read the
  // parameter, so a palette result for a learner landed on the unfiltered table
  // and the search appeared to do nothing. `matchesSearch` deliberately PREFIX-
  // matches the id, so the id the palette carries is exactly what this expects.
  const [params, setParams] = useSearchParams();
  const deepLink = params.get('q');
  useEffect(() => {
    if (deepLink) setFilters((prev) => ({ ...prev, search: deepLink }));
  }, [deepLink]);

  const clearDeepLink = useCallback(() => {
    if (!deepLink) return;
    const next = new URLSearchParams(params);
    next.delete('q');
    setParams(next, { replace: true });
  }, [deepLink, params, setParams]);

  // ── NOTHING IS FILTERED OR SORTED HERE ANYMORE ─────────────────────────────
  // `counts` comes from the RPC's facets, which are computed over the SEARCH
  // result so the chips agree with each other. Computing them from the rows on
  // screen would make every count describe the visible page.
  const counts = facets;

  const kpis = useMemo(
    () => ({
      total: facets.total,
      premium: facets.premium,
      admins: facets.admin,
      suspended: facets.suspended,
    }),
    [facets]
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const loadMore = useCallback(() => {
    if (!cursor || loading) return;
    setLoading(true);
    void fetchUsersPage({
      search: filters.search,
      plan: filters.plan,
      role: filters.role,
      status: filters.status,
      sort: filters.sort,
      desc: filters.desc,
      limit: USERS_PAGE_SIZE,
      cursor,
    }).then((result) => {
      setLoading(false);
      if (result.errors.length > 0) {
        setErrors(result.errors);
        return;
      }
      // Append, and de-duplicate on id. A keyset cursor should make overlap
      // impossible; the Set makes a row that slipped through idempotent rather
      // than a duplicated key that crashes React's list rendering.
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...result.rows.filter((r) => !seen.has(r.id))];
      });
      setCursor(result.nextCursor);
    });
  }, [cursor, loading, filters]);

  const set = <K extends keyof UserFilters>(key: K, value: UserFilters[K]) => {
    // Typing in the search box retires the deep link, so a later re-render
    // cannot restore the palette's term over what the admin just replaced it
    // with.
    if (key === 'search') clearDeepLink();
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Clicking the active column toggles direction; a new column starts
  // descending, which is the useful default for every numeric column here.
  //
  // Changing the sort also drops the cursor. A keyset cursor is only valid for
  // the ordering it was taken from, so carrying it across a sort change would
  // page from a position that means nothing under the new order.
  const onSort = (key: SortKey) => {
    setFilters((prev) =>
      prev.sort === key ? { ...prev, desc: !prev.desc } : { ...prev, sort: key, desc: true }
    );
  };

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
            // Exports the rows currently LOADED, not the whole matching set.
            // "CSV All" below is the one that goes looking for more, and it says
            // so when it stops.
            onClick={() => downloadTextFile('users.csv', usersToCsv(rows), 'text/csv;charset=utf-8')}
            className={theme.button.secondary}
            disabled={loading || rows.length === 0}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            CSV ({rows.length})
          </button>
          <button
            type="button"
            // Exports the WHOLE matching set by paging the RPC. The busy guard is
            // local: `loading` is not set during this walk, so `disabled` covered
            // only the page's own load and a second click could start a second
            // read.
            onClick={async () => {
              setExporting(true);
              setExportError(null);
              const collected: AdminUserRow[] = [];
              let cursor: UsersCursor | null = null;
              for (;;) {
                const page = await fetchUsersPage({
                  search: filters.search,
                  plan: filters.plan,
                  role: filters.role,
                  status: filters.status,
                  sort: filters.sort,
                  desc: filters.desc,
                  limit: USERS_PAGE_SIZE,
                  cursor,
                });
                if (page.errors.length > 0) {
                  setExporting(false);
                  // Refuse rather than write a partial file, which would look
                  // exactly like a complete one to whoever opens it.
                  setExportError(`Refusing to export a partial table: ${page.errors.join('; ')}`);
                  return;
                }
                collected.push(...page.rows);
                cursor = page.nextCursor;
                // The ranked sorts return no cursor — they are the top N by
                // definition, and that N is the whole answer.
                if (!cursor) break;
              }
              setExporting(false);
              downloadTextFile('users-all.csv', usersToCsv(collected), 'text/csv;charset=utf-8');
            }}
            className={theme.button.secondary}
            disabled={loading || exporting || total === 0}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            CSV All ({total.toLocaleString()})
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
      {exportError && (
        <p
          role="alert"
          className="rounded-md border border-warning-200 bg-warning-50 p-3 text-meta text-warning-900 dark:border-warning-900 dark:bg-warning-950/40 dark:text-warning-200"
        >
          {exportError}
        </p>
      )}

      {/*
        NO CAPPED-READ BANNER, and that is a deletion rather than a deprecation.

        It existed because the read was capped at 5,000 with no error, so the
        table could not tell you it was missing anyone. The RPC returns an exact
        total, so the cap is gone — and the pagination footer below is the honest
        replacement, because "showing 50 of 3,214" is a better statement than
        either "5,000 of 5,000" or nothing at all.
      */}

      {/*
        THE CAPPED-READ BANNER, REINSTATED FOR THE FALLBACK ONLY.

        It is gone on the RPC path — `admin_users_page` returns an exact total,
        so the cap is a state the data cannot be in. It comes back on the legacy
        path, where the read IS capped, because "5,000 of 5,000" reads as
        complete and is not. The distinction between a failed read and a capped
        one is the whole reason this was ever written.
      */}
      {truncated.length > 0 && (
        <p
          role="status"
          className="rounded-md border border-ink-300 bg-ink-50 p-3 text-meta text-ink-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
        >
          <strong>Capped read.</strong> This table holds {rows.length.toLocaleString()} of{' '}
          {Math.max(...truncated.map((t) => t.total)).toLocaleString()} accounts:{' '}
          {truncated.map((t) => `${t.source} ${t.shown.toLocaleString()}/${t.total.toLocaleString()}`).join(', ')}.
          Counts below cover the rows on screen.
        </p>
      )}

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
        shown={rows.length}
        total={total}
      />

      <UsersTable
        rows={rows}
        loading={loading}
        totalRows={total}
        scrollRef={scrollRef}
        virtualizer={virtualizer}
        onOpen={openUser}
        onAction={handleAction}
      />

      {/* ── PAGINATION ───────────────────────────────────────────────────────
          A keyset cursor, not page numbers. There is no OFFSET anywhere in this
          system, and the reason is not fashion: an offset skips and repeats rows
          as the underlying set changes, so paging through a live table gives you
          duplicates and gaps for free.

          The footer states the real position — "showing 50 of 3,214" — because
          that number is now available, and it is the number the old table got
          wrong. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-meta text-ink-500 dark:text-ink-400" role="status">
          Showing <strong className="text-ink-800 dark:text-ink-100">{rows.length.toLocaleString()}</strong>{' '}
          of <strong className="text-ink-800 dark:text-ink-100">{total.toLocaleString()}</strong>{' '}
          matching {total === 1 ? 'account' : 'accounts'}
        </p>
        <button
          type="button"
          onClick={loadMore}
          disabled={!cursor || loading}
          className={theme.button.secondary}
        >
          {loading ? 'Loading…' : cursor ? 'Load more' : 'All loaded'}
        </button>
      </div>

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
  counts: UserFacets;
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