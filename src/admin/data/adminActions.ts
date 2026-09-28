/**
 * src/admin/data/adminActions.ts
 *
 * THE CLIENT for the `admin-action` Edge Function.
 *
 * Until this existed, the function was deployed and completely unreachable: no
 * code in the app invoked it, so the Audit Log had no possible source and an
 * admin had no way to ban, promote, or repair anything.
 *
 * ── WHY THE CALLS GO THROUGH HERE, NOT DIRECTLY FROM A COMPONENT ───────────
 * The response vocabulary is subtle and getting it wrong is how a UI lies to an
 * operator:
 *
 *   200 {ok:true}                        → everything applied
 *   207 {ok:false, applied, failed}      → PARTIAL. Some rows changed, some did not.
 *   400 {ok:false, code}                 → nothing applied (rejected payload)
 *   403 {ok:false, code, message}        → a guard refused. Nothing applied.
 *   501 {ok:false, not-implemented}      → registered but unbuilt. Nothing applied.
 *   500 {ok:false, write-failed}         → nothing applied (fails closed).
 *
 * The dangerous mistakes are treating 207 as success, or reading `ok` without
 * reading the status. `interpretAdminResponse` is the single place that maps
 * these to one honest outcome, and it is PURE so it is testable exhaustively.
 *
 * ── WHY THE IDENTITY IS NEVER SENT ─────────────────────────────────────────
 * The body carries a target id, never an actor. The function derives the actor
 * from the verified JWT and re-reads their privileges on every call.
 */
import { supabase } from '../../lib/supabase';

/** Mirrors the guard's action union. Kept local so the browser never imports
 *  from the Deno function's source. */
export type AdminActionName =
  | 'user.ban'
  | 'user.unban'
  | 'user.demote'
  | 'user.promote'
  | 'vocab.repair'
  | 'config.set'
  | 'unit.publish'
  | 'unit.rollback'
  | 'unit.save';

export interface RepairEditInput {
  id: string;
  field: string;
  value: string;
}

export interface ConfigWritePayload {
  key: string;
  value: unknown;
}

export interface PublishPayload {
  unitIds: string[];
}

/**
 * A rollback names BOTH the unit and the version to restore.
 *
 * Naming only the unit would mean "the most recent snapshot", and that is the
 * wrong default: the most recent snapshot is the state a bad publish replaced,
 * not the state before it. Restoring it is a no-op that reads like a success.
 */
export interface RollbackPayload {
  unitId: string;
  versionId: string;
}

export interface SaveUnitPayload {
  unitId: string;
  /** The full document, not a patch — the server validates the whole unit. */
  doc: unknown;
}

export interface AdminActionRequest {
  action: AdminActionName;
  targetId?: string;
  reason?: string;
  /** `vocab.repair` edits, `config.set` key/value, or `unit.publish` unit ids. */
  edits?: RepairEditInput[];
  config?: ConfigWritePayload;
  publish?: PublishPayload;
  rollback?: RollbackPayload;
  save?: SaveUnitPayload;
}

export type AdminOutcome =
  | 'applied'
  | 'partial'
  | 'refused'
  | 'rejected'
  | 'not-implemented'
  | 'failed'
  | 'unreadable'
  | 'unreachable';

export interface AdminActionResult {
  ok: boolean;
  outcome: AdminOutcome;
  /** Operator-facing. Never an empty string. */
  message: string;
  code?: string;
  /** True when retrying after a fix is legitimate. */
  recoverable?: boolean;
  applied?: number;
  failed?: { id: string; field: string; reason: string }[];
}

const isStr = (v: unknown): v is string => typeof v === 'string';

/**
 * Append the "nothing changed" reassurance to a server message.
 *
 * The function's own messages are written for a log, not a screen: "You cannot
 * remove the only active admin" is accurate but leaves an operator wondering
 * whether it half-applied. Every non-success outcome MUST be unambiguous about
 * having changed nothing, because that is the question the operator actually
 * has — so the guarantee is enforced here rather than trusted to every message
 * the server might write.
 */
function withNoChange(message: string): string {
  return /nothing (was )?changed|no change was made|no rows were changed/i.test(message)
    ? message
    : `${message} Nothing was changed.`;
}

/**
 * Map an HTTP status + body onto one honest outcome.
 *
 * PURE and exported, so the whole response contract is testable with no network
 * and no Supabase client. The component layer only renders the result.
 */
export function interpretAdminResponse(status: number, body: unknown): AdminActionResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const code = isStr(b.code) ? b.code : undefined;
  const msg = isStr(b.message) ? b.message : undefined;

  if (status === 207) {
    // The case that is easiest to get wrong. It is NOT ok, and it must say
    // exactly how many landed, or an operator retries the whole batch and
    // double-applies the rows that already worked.
    const applied = typeof b.applied === 'number' ? b.applied : 0;
    const failed: { id: string; field: string; reason: string }[] = Array.isArray(b.failed)
      ? (b.failed as { id: string; field: string; reason: string }[])
      : [];
    return {
      ok: false,
      outcome: 'partial',
      applied,
      failed,
      message: `Applied ${applied}, but ${failed.length} did not change. Review the failures before retrying.`,
    };
  }

  if (status === 200) return { ok: true, outcome: 'applied', message: msg ?? 'Applied.' };

  if (status === 403) {
    return {
      ok: false,
      outcome: 'refused',
      code,
      message: withNoChange(msg ?? 'That action was refused.'),
      recoverable: b.recoverable === true,
    };
  }

  if (status === 400) {
    return { ok: false, outcome: 'rejected', code, message: withNoChange(msg ?? 'The request was rejected.') };
  }

  if (status === 501) {
    return {
      ok: false,
      outcome: 'not-implemented',
      code,
      message: withNoChange(msg ?? 'That action is not available yet.'),
    };
  }

  if (status === 401) {
    return {
      ok: false,
      outcome: 'refused',
      code: code ?? 'unauthenticated',
      // The ONLY non-success path that used to skip `withNoChange`. A 401 is
      // returned by `identify()`, before any write is attempted — so nothing
      // changed, and saying so is the whole point of this function. Without it an
      // operator cannot tell whether their ban landed and has to guess.
      message: withNoChange('Your session has expired. Sign in again.'),
    };
  }

  return {
    ok: false,
    outcome: 'failed',
    code,
    // 500 means the function failed CLOSED, so nothing changed. The Audit Log
    // entry with a `.failed` action is where that is confirmed.
    message: withNoChange(msg ?? 'The action could not be completed.'),
  };
}

/**
 * Invoke a privileged action.
 *
 * Never throws: every failure resolves to a result object, because a rejected
 * promise in a click handler is how a button ends up doing nothing visible and
 * an operator concludes it worked.
 */
/**
 * The result of a response whose STATUS we could see but whose BODY we could not
 * read — which is exactly what a CORS failure looks like to JavaScript.
 *
 * ── WHY THIS IS NOT THE `failed` BRANCH ─────────────────────────────────────
 * A blank `Access-Control-Allow-Origin` once made every privileged action look
 * like a server-side failure. `interpretAdminResponse(status, null)` cannot tell
 * that apart from a genuine 500, so it fabricated a message — "The action could
 * not be completed" — for what was actually an unreadable response. An operator
 * debugging that is sent to the wrong layer entirely: the database, the guards,
 * the write, none of which were involved.
 *
 * So the two are reported separately. This one names the real cause and says
 * explicitly that the outcome is UNKNOWN: the action may or may not have been
 * applied, and the only way to know is the audit log. Overstating certainty in
 * either direction is what makes an incident take hours instead of minutes.
 */
export function unreadableResponse(status: number): AdminActionResult {
  return {
    ok: false,
    outcome: 'unreadable',
    code: 'response-unreadable',
    message:
      `The server replied (${status}) but the browser blocked the reply, so its explanation could not be read. ` +
      'This is a cross-origin (CORS) problem, not a failed action. The outcome is UNKNOWN — check the audit log before retrying.',
  };
}

export async function runAdminAction(req: AdminActionRequest): Promise<AdminActionResult> {
  const body: Record<string, unknown> = { action: req.action };
  if (req.targetId) body.targetId = req.targetId;
  // An empty reason is omitted rather than sent as "", so the guard's own
  // `hasReason` check is what decides — not a client-side filter.
  if (req.reason && req.reason.trim().length > 0) body.reason = req.reason.trim();
  if (req.edits) body.payload = req.edits;
  if (req.config) body.payload = { key: req.config.key, value: req.config.value };
  if (req.publish) body.payload = { unitIds: req.publish.unitIds };
  if (req.rollback) body.payload = { unitId: req.rollback.unitId, versionId: req.rollback.versionId };
  if (req.save) body.payload = { unitId: req.save.unitId, doc: req.save.doc };

  try {
    const { data, error } = await supabase.functions.invoke('admin-action', { body });

    // supabase-js surfaces a non-2xx as an `error` rather than returning the
    // body, so the status has to be read from the error's response context.
    if (error) {
      const ctx = error as unknown as { context?: Response };
      const status = typeof ctx.context?.status === 'number' ? ctx.context.status : 500;

      let parsed: unknown = null;
      let readFailed = false;
      try {
        parsed = await ctx.context?.json?.();
      } catch {
        // A body we cannot read is NOT a body with no `message` field. Treating
        // the two alike is what produced a fabricated failure message.
        readFailed = true;
      }

      // No `context` at all means the request never produced a response object
      // — indistinguishable from a network failure, so say exactly that.
      if (!ctx.context || readFailed) return unreadableResponse(status);

      return interpretAdminResponse(status, parsed);
    }

    return interpretAdminResponse(200, data);
  } catch (err) {
    return {
      ok: false,
      outcome: 'unreachable',
      message: err instanceof Error ? `Could not reach the admin-action service: ${err.message}` : 'Could not reach the admin-action service.',
    };
  }
}
