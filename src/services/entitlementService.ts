/**
 * src/services/entitlementService.ts — the premium seam
 *
 * THE PRODUCT DECISION THIS ENCODES
 * The curriculum ships in two tiers:
 *
 *   FREE     the learning-components path. Six existing lesson surfaces
 *            (alphabet, numbers, calendar, articles, greetings, stories) plus
 *            the practice tools - an open grid for guests, a designed ordered
 *            path for signed-in free learners. See
 *            `components/learning/LearningPath`.
 *   PREMIUM  the A1 curriculum. The 16-unit spine with its 80%
 *            checkpoint gates, the per-unit lesson documents, and the guided
 *            vs self-guided mode. See `components/path/UnitSpine`.
 *
 * THIS CHANGED ON 2026-09-27. The previous split put the interactive lesson
 * surface AND the checkpoint on free and sold only the document-style "notes"
 * deep-dive; Premium is now the whole campaign, so the free tier no longer
 * promises checkpoints. Any copy elsewhere claiming "checkpoints are free" is
 * stale. The lesson and checkpoint routes use the same presentation gate as
 * notes, so bookmarks still resolve and show the account's available action.
 *
 * WHY A SERVICE AND NOT A HOOK-ONLY READ
 * The tier is a property of the ACCOUNT, not of the session, so it is read from
 * `profiles.plan` (see migration 20260927120000). That column is protected by a
 * database trigger so a client cannot write its own plan — RLS alone does not
 * help, because the table already has an own-row UPDATE policy that would
 * otherwise permit a self-upgrade from the browser console.
 *
 * THERE IS NO BILLING PROVIDER YET
 * Nothing in this file talks to Stripe, and nothing should until one does. The
 * plan is granted manually (Supabase dashboard or SQL). `isPremium` is
 * therefore a plain read of the column — not a subscription check, and not a
 * cache of one. Whoever wires billing up should replace `getPlan` and leave
 * every call site alone.
 *
 * OFFLINE / GUEST
 * A guest has no profile row, so a guest is always `free`. A failed read is
 * unavailable, not free: a network blip must not grant premium or silently
 * present a paid learner with the free product. The hook exposes that state so
 * the UI can offer a retry.
 */
import { supabase } from '../lib/supabase';

export type Plan = 'free' | 'premium';

export interface EntitlementRead {
  plan: Plan | null;
  error: string | null;
}

/** Coerce whatever came back off the wire into a real plan. */
function coercePlan(value: unknown): Plan {
  return value === 'premium' ? 'premium' : 'free';
}

const pendingPlans = new Map<string, Promise<EntitlementRead>>();

async function fetchPlan(userId: string): Promise<EntitlementRead> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .maybeSingle();
    if (error) return { plan: null, error: error.message };
    if (!data) return { plan: 'free', error: null };
    return { plan: coercePlan(data.plan), error: null };
  } catch (error) {
    return {
      plan: null,
      error: error instanceof Error ? error.message : 'Entitlement read failed',
    };
  }
}

export const entitlementService = {
  /** Share simultaneous reads from navigation, gates, and the dashboard. */
  async readPlan(userId: string | null): Promise<EntitlementRead> {
    if (!userId) return { plan: 'free', error: null };
    const pending = pendingPlans.get(userId);
    if (pending) return pending;
    const request = fetchPlan(userId).finally(() => pendingPlans.delete(userId));
    pendingPlans.set(userId, request);
    return request;
  },

  /**
   * The signed-in user's plan. Returns `'free'` for a guest, for a missing row,
   * and for a read error. Callers that need to distinguish an unavailable read
   * should use `readPlan`.
   */
  async getPlan(userId: string | null): Promise<Plan> {
    const result = await this.readPlan(userId);
    return result.plan ?? 'free';
  },
};
