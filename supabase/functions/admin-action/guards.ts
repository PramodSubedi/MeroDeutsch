/**
 * supabase/functions/admin-action/guards.ts
 *
 * LOCKOUT GUARDS — pure functions, deliberately free of any Supabase import.
 *
 * These decide whether a privileged action is ALLOWED. They are the part of
 * the admin write path that must be right, so they are kept here, pure, and
 * exhaustively tested rather than buried inside a request handler where a
 * missing `await` or an inverted condition is invisible until it locks the
 * last admin out of their own database.
 *
 * THE THREE HAZARDS WE ARE PREVENTING
 * 1. Self-ban / self-demote  — an admin removing their own access.
 * 2. Removing the last admin — orphaning the control centre permanently.
 * 3. Banning another admin   — allowed, but must be deliberate, with a
 *    written reason, because it strips a peer of their powers.
 *
 * Any one of them is a single-request self-inflicted outage.
 *
 * DENY BY DEFAULT: `evaluateAction` returns a decision object, never a
 * boolean, and an unknown action is a rejection rather than a fallthrough.
 */

// ── Inputs ──────────────────────────────────────────────────────────────────

export type AdminRole = 'user' | 'admin';

export interface Actor {
  id: string;
  role: AdminRole;
  banned: boolean;
}

export interface TargetUser {
  id: string;
  role: AdminRole;
  banned: boolean;
}

export type AdminAction =
  | 'user.ban'
  | 'user.unban'
  | 'user.demote'
  | 'user.promote'
  | 'vocab.repair'
  | 'config.set'
  | 'unit.publish';

export interface ActionRequest {
  action: AdminAction;
  actor: Actor;
  target?: TargetUser;
  /** Free-text justification. Required for some actions. */
  reason?: string | null;
  /**
   * Count of ACTIVE (non-banned) admins, counted by the caller from the
   * database. Injecting it keeps this function pure and testable, and forces
   * the handler to read it fresh rather than trusting a client-supplied number.
   */
  activeAdminCount: number;
  userAgent?: string | null;
}

export interface Decision {
  allowed: boolean;
  /** Stable machine-readable reason. Surfaced in the audit log. */
  code: DecisionCode;
  /** Operator-facing explanation, safe to show in the UI. */
  message: string;
  /** True when the action was refused but retrying after a fix is legitimate. */
  recoverable: boolean;
}

export type DecisionCode =
  | 'ok'
  | 'unknown-action'
  | 'actor-not-admin'
  | 'actor-banned'
  | 'target-required'
  | 'target-missing'
  | 'self-action'
  | 'last-admin'
  | 'reason-required'
  | 'invalid-transition';

// ── The guard ───────────────────────────────────────────────────────────────

const OK: Decision = { allowed: true, code: 'ok', message: 'Allowed.', recoverable: false };

const deny = (code: DecisionCode, message: string, recoverable = false): Decision => ({
  allowed: false,
  code,
  message,
  recoverable,
});

/** A reason must carry actual content, not whitespace. */
export function hasReason(reason: string | null | undefined): boolean {
  return typeof reason === 'string' && reason.trim().length > 0;
}

/** True when `action` operates on a specific user and therefore needs a target. */
export function requiresTarget(action: AdminAction): boolean {
  return (
    action === 'user.ban' || action === 'user.unban' || action === 'user.demote' || action === 'user.promote'
  );
}

/**
 * The complete set of recognised actions.
 *
 * This exists because `requiresTarget` returns FALSE for anything unrecognised,
 * so the "non-user actions need no further checks" shortcut would otherwise
 * ALLOW an action nobody has ever heard of. Membership is checked before that
 * shortcut, which is what makes the unknown-action branch below reachable and
 * the guard genuinely fail-closed.
 */
const KNOWN_ACTIONS: ReadonlySet<string> = new Set<AdminAction>([
  'user.ban',
  'user.unban',
  'user.demote',
  'user.promote',
  'vocab.repair',
  'config.set',
  'unit.publish',
]);

export function isKnownAction(action: string): action is AdminAction {
  return KNOWN_ACTIONS.has(action);
}

/** Shared precondition for the four user-targeted actions. */
function checkActorAndTarget(
  req: ActionRequest,
  needTarget: boolean,
): Decision | null {
  const { actor, target, activeAdminCount } = req;

  // The actor must be a live admin, checked before anything else so a stale UI
  // for a just-revoked admin fails immediately rather than half-applying.
  if (actor.banned) {
    return deny('actor-banned', 'Your own account is suspended, so you cannot perform admin actions.');
  }
  if (actor.role !== 'admin') {
    return deny('actor-not-admin', 'This action requires an active admin account.');
  }
  if (needTarget && !target) {
    return deny('target-required', 'No target user was supplied.');
  }
  if (target && activeAdminCount < 0) {
    // Guards the test double and any future caller: a negative count is a bug,
    // and treating it as 0 would silently trip the last-admin guard.
    return deny('target-missing', 'Active admin count was not supplied.');
  }
  return null;
}

export function evaluateAction(req: ActionRequest): Decision {
  const { action, actor, target, reason, activeAdminCount } = req;

  // Membership FIRST, before any "does this need a target?" shortcut. Skipping
  // this is what previously let an unrecognised action fall through to OK.
  if (!isKnownAction(action)) {
    return deny('unknown-action', 'That action is not recognised.');
  }

  const needTarget = requiresTarget(action);
  const precondition = checkActorAndTarget(req, needTarget);
  if (precondition) return precondition;

  // A recognised action with no user target carries no lockout risk, so the
  // guard is complete once the actor is known to be a live admin.
  if (!needTarget) return OK;
  const t = target!;

  switch (action) {
    case 'user.ban': {
      // GUARD 1 — self-ban. Locking yourself out is never the intent, and once
      // done the UI cannot undo it.
      if (t.id === actor.id) {
        return deny('self-action', 'You cannot ban your own account.');
      }
      // Re-banning is a no-op, not an error, and not worth an audit row.
      if (t.banned) {
        return deny('invalid-transition', 'That account is already suspended.');
      }
      // GUARD 3 — banning a peer admin needs a written reason on the record.
      if (t.role === 'admin' && !hasReason(reason)) {
        return deny('reason-required', 'Banning another admin requires a written reason.', true);
      }
      return OK;
    }

    case 'user.unban': {
      if (t.id === actor.id) {
        return deny('self-action', 'You cannot change your own suspension state.');
      }
      if (!t.banned) {
        return deny('invalid-transition', 'That account is not suspended.');
      }
      return OK;
    }

    case 'user.demote': {
      // GUARD 1 — self-demote.
      if (t.id === actor.id) {
        return deny('self-action', 'You cannot remove your own admin role.');
      }
      if (t.role !== 'admin') {
        return deny('invalid-transition', 'That user is not an admin.');
      }
      // GUARD 2 — the last admin. Demoting the final admin leaves nobody able to
      // promote anyone back: the control centre becomes unrecoverable without
      // direct database access. Counted over ACTIVE admins only, so a suspended
      // admin does not count as a safety net.
      if (activeAdminCount <= 1) {
        return deny('last-admin', 'You cannot remove the only active admin. Promote another admin first.');
      }
      if (t.banned && !hasReason(reason)) {
        return deny('reason-required', 'Demoting a suspended admin requires a written reason.', true);
      }
      return OK;
    }

    case 'user.promote': {
      if (t.banned) {
        return deny('invalid-transition', 'Unban the account before promoting it.', true);
      }
      if (t.role === 'admin') {
        return deny('invalid-transition', 'That user is already an admin.');
      }
      return OK;
    }

    // Fail closed. An action added to the union without a guard case lands
    // here rather than falling through to `OK`.
    default:
      return deny('unknown-action', 'That action is not recognised.');
  }
}
