/**
 * src/admin/data/auditLog.ts
 *
 * Read model for the Audit Log — the compliance record of privileged actions.
 *
 * ── WHY DENIALS ARE FIRST-CLASS, NOT NOISE ──────────────────────────────────
 * `admin_audit_log` records allowed actions AND refusals. The function writes
 * `user.ban.denied`, `vocab.repair.rejected` and `.unimplemented` alongside the
 * successes, because a refused attempt to demote the last admin is exactly the
 * event an audit exists to surface — and a log that only shows successes cannot
 * distinguish "nothing happened" from "something was tried and stopped".
 *
 * ── WHY BEFORE/AFTER ARE RENDERED AS TEXT ──────────────────────────────────
 * Both are JSONB written by whatever action ran, so their shape is not fixed by
 * a schema. They are stored as-is and rendered defensively: a malformed entry
 * must render as something, never crash the page — losing the ability to read
 * the log because one row is odd is the wrong trade.
 */
import { supabase } from '../../lib/supabase';
import { callAdminRpc, LEGACY_PATH_NOTICE } from './rpc';
import { csvDocument } from './csv';

export type AuditOutcome = 'allowed' | 'denied' | 'failed' | 'unimplemented';

export interface AuditEntry {
  id: string;
  adminId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  before: unknown;
  after: unknown;
  userAgent: string | null;
  createdAt: string | null;
  /** Resolved from a second read; the anon key cannot embed `auth.users`. */
  adminName: string | null;
}

export interface AuditResult {
  entries: AuditEntry[];
  errors: string[];
}

export interface AuditFilters {
  search: string;
  outcome: AuditOutcome | 'all';
  action: string;
  targetType: string;
}

/**
 * Classify an action string into an outcome.
 *
 * Derived from the suffix the handler writes rather than from a stored column,
 * so the classification cannot drift out of step with what the writer emits.
 */
export function outcomeOf(action: string): AuditOutcome {
  if (action.endsWith('.denied') || action.endsWith('.rejected')) return 'denied';
  if (action.endsWith('.failed')) return 'failed';
  if (action.endsWith('.unimplemented')) return 'unimplemented';
  return 'allowed';
}

/** The base action, with any outcome suffix removed. */
export function baseAction(action: string): string {
  return action.replace(/\.(denied|rejected|failed|unimplemented)$/, '');
}

/** Render a JSONB value for display without ever throwing on a bad shape. */
export function safeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    // Circular or otherwise unserialisable. The entry still has a timestamp and
    // an action, so a placeholder beats losing the row.
    return '(unrenderable)';
  }
}

export function auditToCsv(entries: AuditEntry[]): string {
  return csvDocument(
    ['created_at', 'admin', 'admin_id', 'action', 'outcome', 'target_type', 'target_id', 'before', 'after', 'user_agent'],
    entries.map((e) => [
      e.createdAt,
      e.adminName,
      e.adminId,
      e.action,
      outcomeOf(e.action),
      e.targetType,
      e.targetId,
      safeText(e.before),
      safeText(e.after),
      e.userAgent,
    ]),
  );
}

export function filterAuditEntries(entries: AuditEntry[], f: AuditFilters): AuditEntry[] {
  const q = f.search.trim().toLowerCase();
  return entries.filter((e) => {
    if (f.outcome !== 'all' && outcomeOf(e.action) !== f.outcome) return false;
    if (f.action && baseAction(e.action) !== f.action) return false;
    if (f.targetType && (e.targetType ?? 'none') !== f.targetType) return false;
    if (!q) return true;
    // The search box is the fastest way to answer "did anyone touch THIS user",
    // so the target id is searched alongside the action and the admin.
    return [e.action, e.targetId ?? '', e.adminId, e.adminName ?? '', safeText(e.before), safeText(e.after)]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
}

export interface AuditSummary {
  total: number;
  allowed: number;
  denied: number;
  failed: number;
  /** Distinct admins who appear in the window. */
  admins: number;
  /** Denials + failures, the number worth looking at first. */
  needsAttention: number;
}

export function summariseAudit(entries: AuditEntry[]): AuditSummary {
  let allowed = 0;
  let denied = 0;
  let failed = 0;
  const admins = new Set<string>();
  for (const e of entries) {
    admins.add(e.adminId);
    const o = outcomeOf(e.action);
    if (o === 'allowed') allowed += 1;
    else if (o === 'denied') denied += 1;
    else if (o === 'failed') failed += 1;
  }
  return {
    total: entries.length,
    allowed,
    denied,
    failed,
    admins: admins.size,
    needsAttention: denied + failed,
  };
}

/** Distinct base actions present, for the action filter. */
export function actionFacets(entries: AuditEntry[]): string[] {
  return [...new Set(entries.map((e) => baseAction(e.action)))].sort();
}

export function targetTypeFacets(entries: AuditEntry[]): string[] {
  return [...new Set(entries.map((e) => e.targetType ?? 'none'))].sort();
}

/** A keyset cursor into the log. */
export interface AuditCursor {
  createdAt: string;
  id: string;
}

export interface AuditPageResult {
  entries: AuditEntry[];
  errors: string[];
  /** Exact number of rows matching, not "however many arrived". */
  total: number;
  nextCursor: AuditCursor | null;
}

/** The page size the log asks for. The RPC clamps to 500. */
export const AUDIT_PAGE_SIZE = 100;

/**
 * ONE page of the log, newest first, filtered in the database.
 *
 * The read was a capped 500 rows with the filter applied in the BROWSER. That is
 * only correct while the filter runs over the whole set — the moment the read is
 * paged, "user.ban" means "user.ban, among the 500 most recent audit rows", which
 * is a different and much weaker claim than an operator thinks they are making.
 * The filters came with the pagination, or the pagination is a lie.
 *
 * Admin names are still resolved SEPARATELY, and deliberately not joined: the
 * RPC runs with the service role and a nested select there would work, but this
 * read is the one place a NULL name must be LOUD rather than silent, and an
 * explicit read that can fail visibly is how that is guaranteed.
 */
export async function fetchAuditPage(args: {
  search?: string;
  action?: string;
  targetId?: string;
  adminId?: string | null;
  limit?: number;
  cursor?: AuditCursor | null;
} = {}): Promise<AuditPageResult> {
  const outcome = await callAdminRpc<{ entries: AuditEntry[]; total: number; next_cursor: AuditCursor | null }[]>(
    supabase,
    'admin_audit_page',
    {
      p_search: args.search ?? '',
      p_action: args.action ?? '',
      p_target_id: args.targetId ?? '',
      p_admin_id: args.adminId ?? null,
      p_limit: args.limit ?? AUDIT_PAGE_SIZE,
      p_cursor_created_at: args.cursor?.createdAt ?? null,
      p_cursor_id: args.cursor?.id ?? null,
    },
  );

  if (outcome.kind === 'absent') {
    // The RPC is not deployed. The old read — a capped prefix with the filter
    // applied in the browser — is correct only while the filter runs over the
    // whole set, so the fallback filters what it actually holds and reports how
    // much that was.
    const legacy = await fetchAuditLegacy(args);
    return { ...legacy, errors: [LEGACY_PATH_NOTICE, ...legacy.errors] };
  }
  if (outcome.kind !== 'ok') {
    return { entries: [], errors: [`admin_audit_page: ${outcome.message}`], total: 0, nextCursor: null };
  }

  const row = (outcome.data as { entries: AuditEntry[]; total: number; next_cursor: AuditCursor | null }[] | null)?.[0];
  const rows = Array.isArray(row?.entries) ? row.entries : [];

  return {
    entries: await attachAdminNames(rows),
    errors: [],
    total: typeof row?.total === 'number' ? row.total : rows.length,
    nextCursor: row?.next_cursor ?? null,
  };
}

/**
 * The previous read: a capped prefix, filtered in the browser.
 *
 * Kept as a fallback for when `admin_audit_page` is not deployed. The browser
 * filter is the ONLY correct option here — the log is append-only, so the newest
 * rows are the ones an admin is looking at — and the cap is stated rather than
 * assumed.
 */
async function fetchAuditLegacy(args: {
  search?: string;
  action?: string;
  targetId?: string;
  adminId?: string | null;
  limit?: number;
}): Promise<AuditPageResult> {
  const errors: string[] = [];
  const limit = args.limit ?? AUDIT_PAGE_SIZE;
  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('id, admin_id, action, target_type, target_id, before, after, user_agent, created_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);
  if (error) return { entries: [], errors: [`admin_audit_log: ${error.message}`], total: 0, nextCursor: null };

  // Snake-case from PostgREST, camel-case for the shared filter. Typed as
  // `unknown` because the query's inferred row type is not `AuditEntry` — the
  // mapping is deliberate, not a coercion.
  const raw = (data ?? []) as unknown as Array<Record<string, unknown>>;
  const mapped: AuditEntry[] = raw.map((r) => ({
    id: r.id as string,
    adminId: r.admin_id as string,
    action: r.action as string,
    targetType: (r.target_type as string | null) ?? null,
    targetId: (r.target_id as string | null) ?? null,
    before: (r.before ?? null) as AuditEntry['before'],
    after: (r.after ?? null) as AuditEntry['after'],
    userAgent: (r.user_agent as string | null) ?? null,
    createdAt: (r.created_at as string | null) ?? null,
    adminName: null,
  }));

  // `filterAuditEntries` takes only the four facets it declares; `search`
  // already covers the target id and the admin name, so the caller's separate
  // `targetId`/`adminId` are applied here as explicit pre-filters rather than
  // being smuggled into a filter shape that does not have those fields.
  let rows = filterAuditEntries(mapped, {
    action: args.action ?? '',
    targetType: '',
    outcome: 'all',
    search: args.search ?? '',
  });
  if (args.targetId) rows = rows.filter((r) => r.targetId === args.targetId);
  if (args.adminId) rows = rows.filter((r) => r.adminId === args.adminId);

  return {
    entries: await attachAdminNames(rows),
    errors: rows.length === limit ? [`Showing the ${limit} most recent audit rows.`] : errors,
    total: rows.length,
    // No keyset cursor on this path: it is a single capped read with no stable
    // position to resume from.
    nextCursor: null,
  };
}

/** Resolve `adminName` from `profiles`, since the FK targets `auth.users`. */
async function attachAdminNames(rows: AuditEntry[]): Promise<AuditEntry[]> {
  const adminIds = [...new Set(rows.map((r) => r.adminId).filter(Boolean))];
  const names = new Map<string, string>();
  if (adminIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, full_name')
      .in('id', adminIds);
    for (const p of profiles ?? []) {
      const label = (p.full_name as string | null) || (p.username as string | null);
      if (label) names.set(p.id as string, label);
    }
  }
  return rows.map((r) => ({ ...r, adminName: names.get(r.adminId) ?? null }));
}
export async function fetchAuditLog(limit = 200): Promise<AuditResult> {
  const page = await fetchAuditPage({ limit });
  return { entries: page.entries, errors: page.errors };
}
