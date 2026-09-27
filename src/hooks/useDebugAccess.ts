/**
 * src/hooks/useDebugAccess.ts
 *
 * Who may see the QA simulator, and what mode is currently simulated.
 *
 * ── WHY ACCESS IS A SERVER-READ, NOT A UI FLAG ─────────────────────────────
 * The simulator only forces the VIEW locally (see `src/lib/debugMode.ts`), so a
 * bypassed check would cost a learner nothing real — but it would still let any
 * visitor see premium UI they have not paid for, and would make this tool
 * useless as a signal ("does the paywall hold for non-admins?" is a question
 * worth being able to answer).
 *
 * So the flag comes from `profiles.role`, which only an admin's own row can
 * report and which RLS protects. `lazy` mode exists because most sessions are
 * NOT admins: the read is skipped entirely unless something asks for it, so the
 * simulator costs an ordinary learner zero queries.
 *
 * There is deliberately no cached-forever behaviour here. The read is cheap,
 * and a stale "you're an admin" would be worse than a re-read.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { getDebugMode, subscribeDebugMode, type DebugMode } from '../lib/debugMode';
import type { AdminRole } from '../lib/adminRole';

export interface DebugAccess {
  /** True only for a signed-in account whose `profiles.role` is 'admin'. */
  isAdmin: boolean;
  /** False until the first role read resolves. Render nothing, never guess. */
  isLoading: boolean;
  /** The active simulation mode, kept live across tabs. */
  mode: DebugMode;
  /** True when anything is being simulated — drives the warning banner. */
  isSimulating: boolean;
}

interface UseDebugAccessOptions {
  /**
   * When false, no role query is issued at all. Callers that render the panel
   * for everyone pass `lazy: false`; the Settings page passes `true` so the cost
   * lands only on an already-signed-in user.
   */
  lazy?: boolean;
}

export function useDebugAccess({ lazy = true }: UseDebugAccessOptions = {}): DebugAccess {
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.userId ?? null;

  const [role, setRole] = useState<AdminRole | null>(null);
  const [isLoading, setIsLoading] = useState(!lazy);
  const [mode, setMode] = useState<DebugMode>(() => getDebugMode());

  // Resolve the role. Skipped entirely for guests and for lazy callers that
  // have not asked yet.
  useEffect(() => {
    if (lazy || authLoading) return;
    if (!userId) {
      setRole(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    // `supabase.from(...).select()` returns a PostgrestFilterBuilder, which is a
    // PromiseLike rather than a real Promise — it has no `.catch`. Awaiting it
    // inside try/catch is the correct way to handle a transport failure, as
    // opposed to the `{ error }` a resolved-but-refused query returns. Both
    // paths must fail closed, and they fail for different reasons.
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle();
        if (cancelled) return;
        setRole(error || !data ? null : ((data.role as AdminRole) ?? null));
      } catch {
        if (!cancelled) setRole(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lazy, userId, authLoading]);

  // Track the mode, including changes made in another tab.
  useEffect(() => {
    setMode(getDebugMode());
    const onChange = () => setMode(getDebugMode());
    const unsubscribe = subscribeDebugMode(onChange);
    window.addEventListener('storage', onChange);
    window.addEventListener('mero-debug-mode', onChange);
    return () => {
      unsubscribe();
      window.removeEventListener('storage', onChange);
      window.removeEventListener('mero-debug-mode', onChange);
    };
  }, []);

  // A guest can never be an admin, whatever the role column says.
  const isAdmin = Boolean(userId) && role === 'admin';

  return { isAdmin, isLoading: isLoading || authLoading, mode, isSimulating: mode !== 'real' };
}
