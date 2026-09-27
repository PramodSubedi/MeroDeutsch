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

/**
 * Load the log newest-first, with admin names resolved separately.
 *
 * `admin_audit_log.admin_id` references `auth.users`, which the anon key cannot
 * traverse. A nested select would return NULL names SILENTLY, so this reads
 * the matching profile rows explicitly and fails loudly instead.
 */
export async function fetchAuditLog(limit = 500): Promise<AuditResult> {
  const errors: string[] = [];

  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('id, admin_id, action, target_type, target_id, before, after, user_agent, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return { entries: [], errors: [`admin_audit_log: ${error.message}`] };
  }

  const rows = data ?? [];
  const adminIds = [...new Set(rows.map((r) => r.admin_id as string).filter(Boolean))];

  const names = new Map<string, string>();
  if (adminIds.length > 0) {
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, username, full_name')
      .in('id', adminIds);
    if (pErr) {
      // Not fatal: the log is still readable by id, so this degrades rather
      // than blanking the page.
      errors.push(`admin names: ${pErr.message}`);
    } else {
      for (const p of profiles ?? []) {
        const label = (p.full_name as string | null) || (p.username as string | null);
        if (label) names.set(p.id as string, label);
      }
    }
  }

  const entries: AuditEntry[] = rows.map((r) => ({
    id: r.id as string,
    adminId: r.admin_id as string,
    action: r.action as string,
    targetType: (r.target_type as string | null) ?? null,
    targetId: (r.target_id as string | null) ?? null,
    before: r.before,
    after: r.after,
    userAgent: (r.user_agent as string | null) ?? null,
    createdAt: (r.created_at as string | null) ?? null,
    adminName: names.get(r.admin_id as string) ?? null,
  }));

  return { entries, errors };
}
