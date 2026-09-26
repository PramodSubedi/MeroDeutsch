/**
 * src/hooks/usePremium.ts
 *
 * Read the account's entitlement tier.
 *
 * WHY A HOOK RATHER THAN A CALL TO `entitlementService` AT EACH SITE
 * Three things would otherwise be repeated, and each of them is a bug waiting
 * to happen:
 *   1. the fetch, so N components on one page would issue N identical reads
 *   2. the loading state, so the gate flashes a paywall before the answer lands
 *   3. the dev override, so nobody can test the premium tier without editing a
 *      database row
 *
 * THE DEV OVERRIDE
 * `localStorage['germanPremiumOverride']` = 'premium' | 'free' forces the tier
 * in the browser. It exists because there is no billing provider yet: without
 * it, verifying the paywall would mean writing to `profiles.plan` from the
 * dashboard, reloading, and undoing it by hand every time. It is a LOCAL
 * override only — it never writes to Supabase and it cannot grant anything
 * another device would also see. When billing lands, delete the override block
 * and nothing else changes.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { entitlementService, type Plan } from '../services/entitlementService';

const OVERRIDE_KEY = 'germanPremiumOverride';

/** Read the local override, tolerating private-mode storage failures. */
function readOverride(): Plan | null {
  try {
    const raw = window.localStorage.getItem(OVERRIDE_KEY);
    if (raw === 'premium') return 'premium';
    if (raw === 'free') return 'free';
    return null;
  } catch {
    return null;
  }
}

export interface PremiumState {
  plan: Plan;
  isPremium: boolean;
  /** True until the first read resolves. A gate should render nothing yet. */
  isLoading: boolean;
  /** True when the browser is forcing the tier for local testing. */
  isOverridden: boolean;
  /** Set / clear the local override. Pass `null` to return to the real plan. */
  setOverride: (plan: Plan | null) => void;
}

export function usePremium(): PremiumState {
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.userId ?? null;

  const [plan, setPlan] = useState<Plan>('free');
  const [isLoading, setIsLoading] = useState(true);
  const [override, setOverrideState] = useState<Plan | null>(() => readOverride());

  // Read the account's tier whenever the identity changes. `userId` is the whole
  // dependency: signing in, signing out, or switching account must all re-read,
  // and none of them should leave the previous account's tier on screen.
  useEffect(() => {
    if (override) {
      setPlan(override);
      setIsLoading(false);
      return;
    }
    if (authLoading) return;
    if (!userId) {
      // A guest has no profile row. Not an error, and not "loading forever".
      setPlan('free');
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    void entitlementService.getPlan(userId).then((next) => {
      if (cancelled) return;
      setPlan(next);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, authLoading, override]);

  const setOverride = useCallback((next: Plan | null) => {
    setOverrideState(next);
    try {
      if (next) window.localStorage.setItem(OVERRIDE_KEY, next);
      else window.localStorage.removeItem(OVERRIDE_KEY);
    } catch {
      // A blocked localStorage only costs us the persistence, not the override
      // itself — it still applies for this session.
    }
  }, []);

  return { plan, isPremium: plan === 'premium', isLoading, isOverridden: override !== null, setOverride };
}

/**
 * Whether this viewer gets THE A1 CAMPAIGN, as opposed to the free
 * learning-components roadmap.
 *
 * WHY THIS EXISTS RATHER THAN CALLING `usePremium()` AT EACH SITE
 * The campaign is not "a premium feature" in the abstract — it is a specific,
 * enumerable set of surfaces, and getting one of them wrong is a tier leak:
 *
 *   Premium   the campaign. 15-module spine (`UnitSpine`), 80% checkpoint
 *             gates, the per-unit lesson NOTES (`/lesson/:n/notes`), the
 *             sidebar waypoint, the Home push node, the Dashboard course tiles
 *             and band strip.
 *   Free      the roadmap. `LearningPath` rendered as a numbered path of the
 *             six existing lesson pages (alphabet, numbers, calendar, articles,
 *             greetings, stories). Real progress, real navigation, and it
 *             links only to pages a free learner may open.
 *   Guest     the same six modules as an unranked flat grid, because there is
 *             no account to carry a position with.
 *
 * Anything that renders campaign state must ask this hook, so the rule is
 * written down once and the next person adding a surface can find it. Note the
 * free roadmap still links to the same lesson ROUTES — the boundary is
 * presentation, not access, so no deep link 404s.
 */
export interface A1CampaignAccess {
  /** True only for Premium. Read this before rendering any campaign state. */
  hasCampaign: boolean;
  /** True until the plan read resolves. Render nothing rather than guess. */
  isLoading: boolean;
}

export function useHasA1Campaign(): A1CampaignAccess {
  const { isPremium, isLoading } = usePremium();
  return { hasCampaign: isPremium, isLoading };
}
