/**
 * supabase/functions/admin-action/index.ts
 *
 * THE PRIVILEGE BOUNDARY for the admin control center.
 *
 * Everything privileged happens here and nowhere else. The browser holds the
 * ANON key and can read what RLS allows; it cannot write `profiles.role`,
 * `profiles.banned_at`, or the audit log. This function holds the SERVICE key,
 * so it can — which is exactly why it must never trust the caller.
 *
 * ── THE FOUR RULES, IN ORDER ────────────────────────────────────────────────
 * 1. The caller's identity comes from the JWT this function verifies with ITS
 *    OWN key. It is never read from the request body. A body `adminId` is the
 *    first thing an attacker changes.
 * 2. That identity is re-verified against `profiles` on EVERY request. The
 *    Edge Function is the boundary, not the subdomain: an admin revoked five
 *    seconds ago must lose access now, not when their session happens to end.
 * 3. `evaluateAction` runs before any write. The last-admin and self-action
 *    guards live in guards.ts as pure functions with their own test suite.
 * 4. Every attempt — allowed or refused — writes an audit row. A refusal that
 *    left no trace is indistinguishable from an attack that never happened.
 *
 * Fail closed throughout: any error returns a refusal, never a partial write.
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import {
  evaluateAction,
  isKnownAction,
  requiresTarget,
  type ActionRequest,
  type Actor,
  type AdminAction,
  type TargetUser,
} from './guards.ts';

const ALLOW_ORIGIN = Deno.env.get('ADMIN_ALLOWED_ORIGIN') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': ALLOW_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

/** Service-role client. Bypasses RLS — only for the privileged writes below. */
function admin(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

interface Body {
  action?: unknown;
  targetId?: unknown;
  reason?: unknown;
  payload?: unknown;
}

/**
 * Read the caller's identity from the Authorization header ONLY.
 *
 * `getUser()` re-validates the JWT against the auth server, so a token that
 * has been revoked or forged with a wrong secret fails here rather than being
 * trusted on its face.
 */
async function identify(req: Request): Promise<string | null> {
  const header = req.headers.get('Authorization') ?? '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

/** Re-read the actor's CURRENT privilege from `profiles`, never from the body. */
async function loadActor(db: SupabaseClient, id: string): Promise<Actor | null> {
  const { data, error } = await db
    .from('profiles')
    .select('id, role, banned_at')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id, role: (data.role as Actor['role']) ?? 'user', banned: data.banned_at !== null };
}

async function loadTarget(db: SupabaseClient, id: string): Promise<TargetUser | null> {
  const { data, error } = await db
    .from('profiles')
    .select('id, role, banned_at')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id, role: (data.role as TargetUser['role']) ?? 'user', banned: data.banned_at !== null };
}

/**
 * Count ACTIVE admins.
 *
 * `banned_at is null` is essential: a suspended admin cannot sign in, so they
 * are not a safety net. Counting them would let the guard pass on a false
 * premise and orphan the control centre.
 */
async function countActiveAdmins(db: SupabaseClient): Promise<number> {
  const { count, error } = await db
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .is('banned_at', null);
  if (error || count === null) return 0;
  return count;
}

/** Append-only. Records refusals as well as successes. */
async function audit(
  db: SupabaseClient,
  entry: { adminId: string; action: string; targetId: string | null; before: unknown; after: unknown; userAgent: string | null },
): Promise<void> {
  await db.from('admin_audit_log').insert({
    admin_id: entry.adminId,
    action: entry.action,
    target_type: entry.action.startsWith('user.') ? 'user' : 'system',
    target_id: entry.targetId,
    before: entry.before as Record<string, unknown> | null,
    after: entry.after as Record<string, unknown> | null,
    user_agent: entry.userAgent,
  });
}

/** Map a guarded action onto the concrete `profiles` write it performs. */
function profileWrite(action: AdminAction, target: TargetUser): { column: 'role' | 'banned_at'; value: string | null } {
  switch (action) {
    case 'user.ban':
      return { column: 'banned_at', value: new Date().toISOString() };
    case 'user.unban':
      return { column: 'banned_at', value: null };
    case 'user.promote':
      return { column: 'role', value: 'admin' };
    case 'user.demote':
      return { column: 'role', value: 'user' };
    default:
      throw new Error(`profileWrite called for non-user action: ${action}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { ok: false, code: 'method-not-allowed' });

  const userAgent = req.headers.get('user-agent');
  const db = admin();

  // ── 1. Identity from the verified token, never the body ───────────────────
  const actorId = await identify(req);
  if (!actorId) return json(401, { ok: false, code: 'unauthenticated' });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(400, { ok: false, code: 'bad-json' });
  }

  const action = typeof body.action === 'string' ? body.action : '';
  if (!isKnownAction(action)) {
    // Unauthenticated callers are rejected before this point, so there is no
    // audit row to attach the refusal to — nothing to record it against.
    return json(400, { ok: false, code: 'unknown-action', message: 'That action is not recognised.' });
  }

  // ── 2. Re-verify CURRENT privilege on every request ──────────────────────
  const actor = await loadActor(db, actorId);
  if (!actor) return json(403, { ok: false, code: 'actor-missing' });

  const targetId = typeof body.targetId === 'string' ? body.targetId : null;
  const reason = typeof body.reason === 'string' ? body.reason : null;

  let target: TargetUser | null = null;
  if (requiresTarget(action)) {
    if (!targetId) return json(400, { ok: false, code: 'target-required' });
    target = await loadTarget(db, targetId);
    if (!target) return json(404, { ok: false, code: 'target-missing' });
  }

  // ── 3. The pure guard, before any write ──────────────────────────────────
  const guardInput: ActionRequest = {
    action,
    actor,
    target: target ?? undefined,
    reason,
    activeAdminCount: await countActiveAdmins(db),
    userAgent,
  };
  const decision = evaluateAction(guardInput);

  if (!decision.allowed) {
    // A refusal is a compliance event: a client retrying a denied demote is
    // noise, whereas an attempt that hit the self/last-admin guard is exactly
    // the signal an audit exists to capture.
    await audit(db, {
      adminId: actorId,
      action: `${action}.denied`,
      targetId,
      before: { guardCode: decision.code },
      after: null,
      userAgent,
    });
    return json(403, { ok: false, code: decision.code, message: decision.message, recoverable: decision.recoverable });
  }

  // ── 4. The write ─────────────────────────────────────────────────────────
  if (requiresTarget(action) && target) {
    const { column, value } = profileWrite(action, target);
    const patch: Record<string, unknown> = { [column]: value };
    // A suspension carries its reason on the row, not only in the audit log, so
    // the reason is still readable if the audit table is ever queried apart from
    // this surface. `ban_reason` is added by 20260930000000_admin_ban_reason.sql.
    // Its length is capped here so a pasted paragraph cannot bloat the row.
    if (action === 'user.ban' && reason) patch.ban_reason = reason.slice(0, 500);
    if (action === 'user.unban') patch.ban_reason = null;

    const { error } = await db.from('profiles').update(patch).eq('id', target.id);
    if (error) {
      await audit(db, {
        adminId: actorId,
        action: `${action}.failed`,
        targetId: target.id,
        before: { error: error.message },
        after: null,
        userAgent,
      });
      // Fail closed: the write did not land, so report failure.
      return json(500, { ok: false, code: 'write-failed', message: 'The change could not be applied.' });
    }

    await audit(db, {
      adminId: actorId,
      action,
      targetId: target.id,
      before: { role: target.role, banned: target.banned },
      after: patch,
      userAgent,
    });
  }

  return json(200, { ok: true, action });
});
