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
  REPAIR_COLUMNS,
  validateRepair,
  type ActionRequest,
  type Actor,
  type AdminAction,
  type RepairEdit,
  type TargetUser,
} from './guards.ts';
import { checkPublishSet, checkRollback, checkUnitShape, validateConfigWrite } from './publish.ts';
import { ALLOW_ORIGIN_SECRET, corsHeaders } from './cors.ts';

// CORS is computed PER REQUEST because it echoes the caller's own Origin, so it
// can no longer be a module constant evaluated at import. `json` moves inside
// the handler as a closure over it, which is why all 22 existing `json(...)`
// call sites below are unchanged. The rules live in cors.ts, pure and tested —
// the original inline version read an unset secret into a blank header and no
// test could see it, which is exactly how every privileged action shipped
// unreachable from a browser.

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

/**
 * Apply a validated repair batch.
 *
 * PER-ROW, NOT BULK, ON PURPOSE: a single `.in()` update either lands or does
 * not, and a bulk write that partially matched would report success while
 * leaving some rows unrepaired. Each edit is applied and checked on its own, and
 * the response reports exactly which ids succeeded and which did not — so an
 * operator can retry the remainder without guessing.
 *
 * `before` is captured from the row as it actually is, so the audit log records
 * the real prior value rather than whatever the client believed it was.
 */
async function applyRepair(db: SupabaseClient, edits: RepairEdit[], actorId: string, reason: string | null, userAgent: string | null): Promise<{
  applied: number;
  failed: { id: string; field: string; reason: string }[];
}> {
  const applied: string[] = [];
  const failed: { id: string; field: string; reason: string }[] = [];

  for (const edit of edits) {
    const column = REPAIR_COLUMNS[edit.field];

    const { data: before, error: readErr } = await db
      .from('vocabulary')
      .select(`id, word, ${column}`)
      .eq('id', edit.id)
      .maybeSingle();

    if (readErr || !before) {
      failed.push({ id: edit.id, field: edit.field, reason: 'row not found' });
      continue;
    }

    const previous = (before as Record<string, unknown>)[column];
    if (typeof previous === 'string' && previous === edit.value) {
      // Already correct. Counting it as "applied" would inflate the repair
      // count and hide the fact that nothing needed doing.
      failed.push({ id: edit.id, field: edit.field, reason: 'value already matches' });
      continue;
    }

    const { error } = await db.from('vocabulary').update({ [column]: edit.value }).eq('id', edit.id);
    if (error) {
      failed.push({ id: edit.id, field: edit.field, reason: error.message });
      continue;
    }

    await audit(db, {
      adminId: actorId,
      action: 'vocab.repair',
      targetId: edit.id,
      before: { field: edit.field, value: previous ?? null, word: before.word ?? null },
      after: { field: edit.field, value: edit.value, reason },
      userAgent,
    });
    applied.push(edit.id);
  }

  return { applied: applied.length, failed };
}

Deno.serve(async (req: Request) => {
  // Per-request, because the grant depends on who is asking.
  const rawAllowlist = Deno.env.get(ALLOW_ORIGIN_SECRET);
  const CORS = corsHeaders(req.headers.get('Origin'), rawAllowlist);

  // A MISSING SECRET IS NOT SILENT. It used to be: the header came back blank,
  // the browser discarded every reply, and the control centre reported a vague
  // server failure for every privileged action. This deployment would look
  // perfectly healthy in every other respect. One line here turns that class of
  // outage into something visible in the function logs within a request.
  if (!rawAllowlist && req.method === 'POST') {
    console.error(
      `[admin-action] ${ALLOW_ORIGIN_SECRET} is NOT SET. No origin will be granted CORS, so every ` +
        'privileged action (ban/promote/demote/publish/repair) will be unreachable from a browser. ' +
        `Set it with: supabase secrets set ${ALLOW_ORIGIN_SECRET}="https://<admin-origin>"`,
    );
  }

  const json = (status: number, body: unknown): Response =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

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
  //
  // `vocab.repair` is handled FIRST and separately: it takes a validated batch
  // rather than a single user target, and it used to fall through this block
  // entirely — which returned 200 "ok" without changing anything. A success
  // response for a repair that never happened is worse than a missing feature.
  if (action === 'vocab.repair') {
    const repair = validateRepair(body.payload);
    if (!repair.ok) {
      // Nothing is written when any edit in the batch is invalid: a partially
      // applied repair across many rows is harder to reason about than none.
      await audit(db, {
        adminId: actorId,
        action: 'vocab.repair.rejected',
        targetId: null,
        before: { problems: repair.problems.slice(0, 20) },
        after: null,
        userAgent,
      });
      return json(400, {
        ok: false,
        code: 'invalid-repair',
        message: 'The repair payload was rejected; no rows were changed.',
        problems: repair.problems,
      });
    }
    const result = await applyRepair(db, repair.edits, actorId, reason, userAgent);
    // A batch where nothing landed is a failure, not a success.
    if (result.applied === 0) {
      return json(400, { ok: false, code: 'repair-applied-none', failed: result.failed });
    }
    // Partial success is reported as partial, never as a clean 200.
    return json(result.failed.length > 0 ? 207 : 200, {
      ok: result.failed.length === 0,
      applied: result.applied,
      failed: result.failed,
    });
  }

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

  // ── 5. config.set ───────────────────────────────────────────────────────
  //
  // `app_config` is read by the LEARNER APP on boot, so the writable key set is
  // closed: an arbitrary key is a channel for enabling something nobody
  // reviewed. Every value is checked against a spec before it is written.
  if (action === 'config.set') {
    const cfg = body.payload as { key?: unknown; value?: unknown } | undefined;
    const check = validateConfigWrite(cfg?.key, cfg?.value);

    if (!check.ok) {
      await audit(db, {
        adminId: actorId,
        action: 'config.set.rejected',
        targetId: typeof cfg?.key === 'string' ? cfg.key : null,
        before: { reason: check.message },
        after: null,
        userAgent,
      });
      return json(400, { ok: false, code: 'invalid-config', message: check.message });
    }

    const key = cfg!.key as string;
    // Normalise before storing, so `flagReader.ts` always unwraps to the same
    // shape `resolveSource` expects.
    const value: unknown =
      typeof cfg!.value === 'boolean' ? cfg!.value : String(cfg!.value).trim().toLowerCase();

    const { data: before } = await db.from('app_config').select('value').eq('key', key).maybeSingle();
    const { error } = await db
      .from('app_config')
      .upsert({ key, value, updated_by: actorId, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (error) {
      await audit(db, {
        adminId: actorId,
        action: 'config.set.failed',
        targetId: key,
        before: { error: error.message },
        after: null,
        userAgent,
      });
      return json(500, { ok: false, code: 'write-failed', message: 'The setting could not be saved.' });
    }

    await audit(db, {
      adminId: actorId,
      action: 'config.set',
      targetId: key,
      before: { value: before?.value ?? null },
      after: { value, reason },
      userAgent,
    });
    return json(200, { ok: true, action, key, value });
  }

  // ── 6. unit.publish ─────────────────────────────────────────────────────
  //
  // The most dangerous write in the system: it changes what every learner sees,
  // and the failure mode is invisible — content that passes a shape check and
  // then breaks `getNodeByRoute` mid-lesson, on someone else's device, with no
  // rollback except a redeploy. So the SET is validated first, and the currently
  // published state is snapshotted to `curriculum_versions` before the write.
  if (action === 'unit.publish') {
    const payload = body.payload as { unitIds?: unknown } | undefined;
    if (!Array.isArray(payload?.unitIds) || payload.unitIds.length === 0) {
      return json(400, { ok: false, code: 'target-required', message: 'Select at least one unit to publish.' });
    }
    const unitIds = (payload!.unitIds as unknown[]).filter((v): v is string => typeof v === 'string');

    const { data: rows, error: readErr } = await db
      .from('curriculum_units')
      .select('id, doc, is_published')
      .in('id', unitIds);

    if (readErr) return json(500, { ok: false, code: 'read-failed', message: 'The units could not be read.' });
    if (!rows || rows.length === 0) {
      return json(404, { ok: false, code: 'target-missing', message: 'Those units do not exist.' });
    }

    // The total count, so a SHORT publish warns instead of silently truncating
    // the course for everyone past that unit.
    const { count: totalUnits } = await db.from('curriculum_units').select('id', { count: 'exact', head: true });

    const combined = checkPublishSet(rows.map((r) => r.doc), { expectedCount: totalUnits ?? undefined });

    if (!combined.ok) {
      await audit(db, {
        adminId: actorId,
        action: 'unit.publish.rejected',
        targetId: null,
        before: { errors: combined.errors.slice(0, 20) },
        after: null,
        userAgent,
      });
      return json(400, {
        ok: false,
        code: 'invalid-publish',
        message: 'The unit set failed validation. Nothing was published.',
        errors: combined.errors,
      });
    }

    // Snapshot the CURRENT published state first, so a bad publish is rollback-
    // able from the database rather than needing a redeploy.
    const { data: current } = await db
      .from('curriculum_units')
      .select('id, doc')
      .in('id', unitIds)
      .eq('is_published', true);
    for (const c of current ?? []) {
      await db.from('curriculum_versions').insert({ unit_id: c.id, lesson_json: c.doc, editor_id: actorId });
    }

    const { error: writeErr } = await db
      .from('curriculum_units')
      .update({ is_published: true, updated_by: actorId, updated_at: new Date().toISOString() })
      .in('id', unitIds);

    if (writeErr) {
      await audit(db, {
        adminId: actorId,
        action: 'unit.publish.failed',
        targetId: null,
        before: { error: writeErr.message },
        after: null,
        userAgent,
      });
      return json(500, { ok: false, code: 'write-failed', message: 'The units could not be published.' });
    }

    await audit(db, {
      adminId: actorId,
      action: 'unit.publish',
      targetId: null,
      before: { alreadyPublished: (current ?? []).map((c) => c.id) },
      after: { published: unitIds, warnings: combined.warnings, reason },
      userAgent,
    });
    return json(200, { ok: true, action, published: unitIds, warnings: combined.warnings });
  }

  // ── 7. unit.rollback ────────────────────────────────────────────────────
  //
  // Restores a unit from `curriculum_versions`. The history has been written on
  // every publish since Phase 3b, but until now nothing read it back, so a bad
  // publish could only be undone by a redeploy.
  //
  // Order is not negotiable: VALIDATE the chosen snapshot against the CURRENT
  // peers first, and only then archive the live doc. Archiving first would
  // leave a rejected rollback in the history as though something had happened.
  if (action === 'unit.rollback') {
    const payload = body.payload as { unitId?: unknown; versionId?: unknown } | undefined;
    const rollbackUnitId = payload?.unitId;
    if (typeof rollbackUnitId !== 'string' || rollbackUnitId.length === 0) {
      return json(400, { ok: false, code: 'target-required', message: 'Which unit should be rolled back?' });
    }
    if (typeof payload?.versionId !== 'string' || payload.versionId.length === 0) {
      return json(400, { ok: false, code: 'target-required', message: 'Which saved version should be restored?' });
    }

    const { data: version, error: verErr } = await db
      .from('curriculum_versions')
      .select('id, unit_id, lesson_json')
      .eq('id', payload.versionId)
      .maybeSingle();

    if (verErr) {
      return json(500, { ok: false, code: 'read-failed', message: 'The saved version could not be read.' });
    }
    if (!version) {
      await audit(db, {
        adminId: actorId,
        action: 'unit.rollback.rejected',
        targetId: rollbackUnitId,
        before: { versionId: payload.versionId, error: 'no such version' },
        after: null,
        userAgent,
      });
      return json(404, { ok: false, code: 'target-missing', message: 'That saved version no longer exists.' });
    }

    // The set that must still hold together is the PUBLISHED spine — the units a
    // learner can actually reach. Unpublished drafts are not served, so a
    // malformed one cannot break anything, and including them here was wrong in a
    // way that looked correct: it made a rollback refuse for a defect in a draft
    // nobody can see, and the error named the wrong unit entirely. A draft with
    // no checkpoint (m16 today) would have blocked every rollback forever.
    const { data: peers, error: peerErr } = await db.from('curriculum_units').select('id, doc, is_published');
    if (peerErr) {
      return json(500, { ok: false, code: 'read-failed', message: 'The unit store could not be read.' });
    }

    const restored = version.lesson_json;
    // Swap the unit into the published set BEFORE validating, so the check sees
    // the spine as it WILL be, not as it is.
    const publishedPeers = (peers ?? []).filter((p) => p.is_published && p.id !== rollbackUnitId).map((p) => p.doc);
    const targetIsPublished = (peers ?? []).find((p) => p.id === rollbackUnitId)?.is_published === true;

    const rollbackCheck = checkRollback({
      unitId: rollbackUnitId,
      snapshot: restored,
      // A draft being rolled back does not enter the served spine, so it is not
      // part of the set — it is still shape-checked on its own inside
      // `checkRollback`, which is what protects the moment it is published.
      peers: targetIsPublished ? [...publishedPeers, restored] : publishedPeers,
      expectedCount: targetIsPublished ? publishedPeers.length + 1 : undefined,
    });

    if (!rollbackCheck.ok) {
      await audit(db, {
        adminId: actorId,
        action: 'unit.rollback.rejected',
        targetId: rollbackUnitId,
        before: { versionId: version.id, errors: rollbackCheck.errors.slice(0, 20) },
        after: null,
        userAgent,
      });
      return json(400, {
        ok: false,
        code: 'invalid-rollback',
        message: 'That version cannot be restored. Nothing was changed.',
        errors: rollbackCheck.errors,
      });
    }

    // The live doc is archived BEFORE the write, so this rollback can itself be
    // rolled back. Without it the operation is a one-way door.
    const { data: live } = await db
      .from('curriculum_units')
      .select('doc, is_published')
      .eq('id', rollbackUnitId)
      .maybeSingle();

    if (live) {
      await db.from('curriculum_versions').insert({
        unit_id: rollbackUnitId,
        lesson_json: live.doc,
        editor_id: actorId,
      });
    }

    // A rollback restores CONTENT, never publication state. If the unit was an
    // unpublished draft it stays one; publishing it here would be a side effect
    // the operator never asked for.
    const { error: writeErr } = await db
      .from('curriculum_units')
      .update({ doc: restored, updated_by: actorId, updated_at: new Date().toISOString() })
      .eq('id', rollbackUnitId);

    if (writeErr) {
      await audit(db, {
        adminId: actorId,
        action: 'unit.rollback.failed',
        targetId: rollbackUnitId,
        before: { versionId: version.id, error: writeErr.message },
        after: null,
        userAgent,
      });
      return json(500, { ok: false, code: 'write-failed', message: 'The unit could not be restored.' });
    }

    await audit(db, {
      adminId: actorId,
      action: 'unit.rollback',
      targetId: rollbackUnitId,
      before: { versionId: version.id, doc: live?.doc ?? null },
      after: { doc: restored, warnings: rollbackCheck.warnings, reason },
      userAgent,
    });
    return json(200, { ok: true, action, unitId: rollbackUnitId, versionId: version.id, warnings: rollbackCheck.warnings });
  }

  // ── 8. unit.save — author a DRAFT ───────────────────────────────────────
  //
  // The store could publish what the backfill imported but could not author
  // anything: there was no per-field editing anywhere in the control centre.
  //
  // It preserves `is_published` and NEVER sets it to true. That is the whole
  // safety argument of the action: a save is a draft edit, and `unit.publish` is
  // the only thing that can make content live. If a save could publish, "save my
  // edit" would become a live write to every learner with no publish step in
  // between — precisely the gap that made this panel safe to hand to an operator.
  if (action === 'unit.save') {
    const payload = body.payload as { unitId?: unknown; doc?: unknown } | undefined;
    const saveUnitId = payload?.unitId;
    if (typeof saveUnitId !== 'string' || !/^m\d{2}$/.test(saveUnitId)) {
      return json(400, { ok: false, code: 'target-required', message: 'A unit id is required.' });
    }
    if (payload?.doc === undefined) {
      return json(400, { ok: false, code: 'bad-json', message: 'No document was supplied.' });
    }

    // Same bar as publish: a draft that could never be published is not worth
    // storing, and discovering that at publish time wastes the operator's work.
    const shape = checkUnitShape(payload.doc);
    if (!shape.ok) {
      await audit(db, {
        adminId: actorId,
        action: 'unit.save.rejected',
        targetId: saveUnitId,
        before: { errors: shape.errors.slice(0, 20) },
        after: null,
        userAgent,
      });
      return json(400, {
        ok: false,
        code: 'invalid-unit',
        message: 'The draft is not a valid unit. Nothing was saved.',
        errors: shape.errors,
        warnings: shape.warnings,
      });
    }

    // The id inside the document must match the row it is being saved into, or
    // the store quietly grows two units claiming the same identity.
    if ((payload.doc as { id?: unknown }).id !== saveUnitId) {
      return json(400, {
        ok: false,
        code: 'unit-id-mismatch',
        message: `The document declares a different unit id than "${saveUnitId}". Nothing was saved.`,
      });
    }

    const { data: existing } = await db
      .from('curriculum_units')
      .select('doc, is_published')
      .eq('id', saveUnitId)
      .maybeSingle();

    // A new row is always a draft. An existing row keeps whatever publication
    // state it had — a save is not a publish, in either direction.
    //
    // `order` is a NOT NULL COLUMN, and it is duplicated from the document on
    // purpose: the backfill writes both, and the store's list ordering reads the
    // column. Omitting it here made every first save fail with a 500 that said
    // only "the draft could not be saved" — a schema fact the handler knew
    // nothing about, and one no unit test could catch because the column lives
    // in the database rather than in the payload.
    const { error: writeErr } = await db
      .from('curriculum_units')
      .upsert(
        {
          id: saveUnitId,
          order: (payload.doc as { order: number }).order,
          doc: payload.doc,
          is_published: existing?.is_published ?? false,
          updated_by: actorId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );

    if (writeErr) {
      await audit(db, {
        adminId: actorId,
        action: 'unit.save.failed',
        targetId: saveUnitId,
        before: { error: writeErr.message },
        after: null,
        userAgent,
      });
      return json(500, { ok: false, code: 'write-failed', message: 'The draft could not be saved.' });
    }

    await audit(db, {
      adminId: actorId,
      action: 'unit.save',
      targetId: saveUnitId,
      before: { doc: existing?.doc ?? null },
      after: { doc: payload.doc, warnings: shape.warnings, reason },
      userAgent,
    });
    return json(200, {
      ok: true,
      action,
      unitId: saveUnitId,
      published: existing?.is_published ?? false,
      warnings: shape.warnings,
    });
  }

  // ── 9. vocab.clear_flag — registered, still unbuilt ─────────────────────
  if (action === 'vocab.clear_flag') {
    await audit(db, {
      adminId: actorId,
      action: 'vocab.clear_flag.unimplemented',
      targetId,
      before: null,
      after: null,
      userAgent,
    });
    return json(501, {
      ok: false,
      code: 'not-implemented',
      message: 'vocab.clear_flag is not implemented yet. No change was made.',
    });
  }

  // Reached only by a fully-guarded, fully-applied user action.
  return json(200, { ok: true, action });
});
