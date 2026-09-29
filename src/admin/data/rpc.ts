/**
 * src/admin/data/rpc.ts
 *
 * Capability detection for the admin RPCs.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The admin read models were moved from browser-side aggregation to
 * `SECURITY DEFINER` Postgres functions. That is the better design on every axis
 * that matters — exact counts, server-side filtering, and a refusal for a
 * non-admin where RLS could only return zero rows and make it look like "no
 * data".
 *
 * But it is a migration, and a migration has an order. The functions live in
 * `supabase/migrations/2026*.sql` and are applied by a human, through the
 * Management API, to a database this repository does not contain. Until that
 * happens, `supabase.rpc('admin_dashboard_kpis')` returns PostgREST error
 * `PGRST202` and every page that calls it throws.
 *
 * So each read model keeps its previous implementation as a FALLBACK, used only
 * when the function is ABSENT. That turns a breaking deploy into a visible
 * degradation: the admin can work, and can see that they are on the old path.
 *
 * ── ABSENT, NOT REFUSED — THE DISTINCTION IS THE WHOLE POINT ────────────────
 * Three outcomes, and conflating them would be a security regression:
 *
 *   `absent`    the function does not exist (PGRST202, 404). The migration has
 *               not been applied. Fall back — the old path works.
 *
 *   `refused`   the function exists and said no (42501, 403). The caller is not
 *               an active admin. DO NOT FALL BACK. The legacy path reads through
 *               RLS, which for a demoted or suspended admin returns zero rows —
 *               so falling back would replace a correct refusal with an empty
 *               page, which is the exact failure the RPCs were built to fix.
 *
 *   `error`     anything else: a network drop, a bad parameter, a 500. DO NOT
 *               FALL BACK. A fallback that also runs on a transient error turns
 *               a blip into a silent downgrade, and the operator has no way to
 *               tell which path produced the number in front of them.
 *
 * Only `absent` degrades. That is the whole design.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** How an RPC call ended. Only `absent` is allowed to fall back. */
export type RpcOutcome<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'absent'; message: string }
  | { kind: 'refused'; message: string }
  | { kind: 'error'; message: string };

/**
 * PostgREST's code for "function not found in the schema cache".
 *
 * `PGRST202` is the documented one. The 404 and the message check are belt and
 * braces, because a reverse proxy in front of Supabase can return a plain 404
 * with a HTML body, and misreading that as "absent" would be indistinguishable
 * from the real thing anyway — which is the correct interpretation.
 */
const ABSENT_CODES = new Set(['PGRST202', '42883', '404']);

function isAbsent(status: number | undefined, code: string | null, message: string): boolean {
  if (code && ABSENT_CODES.has(code)) return true;
  if (status === 404) return true;
  return /does not exist|not found in the schema cache|schema cache/i.test(message);
}

function isRefused(status: number | undefined, code: string | null): boolean {
  if (status === 403) return true;
  if (code === '42501') return true;
  return false;
}

/**
 * Call an admin RPC and classify the outcome.
 *
 * PURE with respect to the network decision — it takes the client and the
 * function name, and returns a discriminated union. That is what makes the
 * classification testable: `check:rpcfallback` drives it with a stub client and
 * asserts that a refusal does NOT degrade, which is the one behaviour that
 * matters and the one a human reviewer is least likely to re-read.
 */
export async function callAdminRpc<T>(
  supabase: SupabaseClient,
  fn: string,
  params: Record<string, unknown> = {},
): Promise<RpcOutcome<T>> {
  const { data, error } = await supabase.rpc(fn, params);

  if (error) {
    const message = error.message ?? String(error);
    // `PostgrestError` declares `code`, `message`, `details` and `hint` — but not
    // the HTTP status, which PostgREST does not always set and which a proxy in
    // front of it may never reach the client with. Read defensively rather than
    // asserting a field the type does not promise.
    const status = (error as { status?: number }).status;
    const code = (error as { code?: string }).code ?? null;
    if (isAbsent(status, code, message)) {
      return { kind: 'absent', message };
    }
    if (isRefused(status, code)) {
      return { kind: 'refused', message };
    }
    return { kind: 'error', message };
  }

  return { kind: 'ok', data: (data ?? null) as T };
}

/**
 * The notice an admin sees when the control centre is on the legacy read path.
 *
 * Not a shrug, and not silent. The legacy path is CORRECT — it is the code that
 * has been running — but it is bounded in ways the RPCs are not, and an operator
 * looking at a capped number deserves to know the number is capped.
 */
export const LEGACY_PATH_NOTICE =
  'The admin database functions have not been deployed yet, so this page is using the older ' +
  'browser-side read. Figures are correct but capped, and a demoted admin sees an empty page ' +
  'rather than a refusal. Apply the 2026* admin RPC migrations to fix both.';

/** True when an outcome should fall back to the legacy read. */
export function shouldFallBack<T>(outcome: RpcOutcome<T>): boolean {
  return outcome.kind === 'absent';
}
