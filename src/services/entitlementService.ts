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
 *   PREMIUM  the A1 curriculum. The 15-module linear spine with its 80%
 *            checkpoint gates, the per-unit lesson documents, and the guided
 *            vs self-guided mode. See `components/path/UnitSpine`.
 *
 * THIS CHANGED ON 2026-09-27. The previous split put the interactive lesson
 * surface AND the checkpoint on free and sold only the document-style "notes"
 * deep-dive; Premium is now the whole campaign, so the free tier no longer
 * promises checkpoints. Any copy elsewhere claiming "checkpoints are free" is
 * stale. The boundary is presentation-tier gating only: the lesson and
 * checkpoint routes still deep-link for everyone (no 404s, no broken
 * bookmarks) and simply do not appear in free navigation.
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
 * also treated as `free`: a network blip must not flash a paywall at someone
 * who has paid, and must not grant premium either. The caller decides how to
 * present that — `usePremium` exposes `isLoading` for exactly this.
 */
import { supabase } from '../lib/supabase';

export type Plan = 'free' | 'premium';

/** Coerce whatever came back off the wire into a real plan. */
function coercePlan(value: unknown): Plan {
  return value === 'premium' ? 'premium' : 'free';
}

export const entitlementService = {
  /**
   * The signed-in user's plan. Returns `'free'` for a guest, for a missing row,
   * and for any read error — the gate fails CLOSED, and the UI layer decides
   * whether to show a paywall or a retry.
   */
  async getPlan(userId: string | null): Promise<Plan> {
    if (!userId) return 'free';
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', userId)
        .maybeSingle();
      if (error || !data) return 'free';
      return coercePlan(data.plan);
    } catch {
      // A thrown network error is indistinguishable from "no row" as far as the
      // gate is concerned, and must not become an implicit grant.
      return 'free';
    }
  },
};
