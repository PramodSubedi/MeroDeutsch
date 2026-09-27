/**
 * src/admin/hooks/useAdminAuth.tsx
 *
 * Admin session + authorization gate for the control center.
 *
 * WHY THIS IS SEPARATE FROM `src/hooks/useAuth.tsx`
 * --------------------------------------------------
 * The learner app and the control center are different ORIGINS (merodeutsch. and
 * admin.merodeutsch.), served by different deployments, with separate browser
 * storage. The learner hook maps a Supabase session to the narrow `AuthUser` and
 * never reads `profiles`; the control center must resolve `role` on every route.
 *
 * Keeping them apart means an admin lookup never enters the learner app's
 * critical path, and `.clinerules` C16 ("do not modify useAuth.tsx") holds —
 * that file is untouched.
 *
 * SESSION ISOLATION — WHAT ACTUALLY PROVIDES IT
 * ----------------------------------------------
 * The plan assumed cookie scoping. In this codebase `src/lib/supabase.ts` calls
 * `createClient(url, key)` with no `auth` options, so supabase-js v2 uses its
 * DEFAULT storage: `localStorage`. `localStorage` is partitioned by ORIGIN, so
 * `admin.merodeutsch.pramods.com.np` and `merodeutsch.pramods.com.np` already
 * hold entirely separate session jars with no configuration at all.
 *
 * Do NOT set a per-subdomain "cookie domain" in the Supabase dashboard: that
 * setting is a single global value for the project, not a per-app one, and
 * changing it affects both deployments. Isolation here is a consequence of the
 * origin split, which is exactly what the subdomain was for.
 *
 * FAIL-CLOSED
 * -----------
 * Every unresolved state — signed out, signed in but not an admin, suspended, or
 * a failed profile lookup — renders a gate, never the app.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { fetchAdminIdentity, type AdminIdentity, type AdminProfile } from '../../lib/adminRole';
import type { Session } from '@supabase/supabase-js';

type GateStatus = 'checking' | 'signed-out' | 'not-admin' | 'suspended' | 'ready';

interface AdminAuthContextValue {
  status: GateStatus;
  session: Session | null;
  profile: AdminProfile | null;
  identity: AdminIdentity | null;
  /** True only for a signed-in, non-suspended admin. */
  isAdmin: boolean;
  /** Human-readable reason the gate is closed (shown in the gate screens). */
  reason: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

const SIGNED_OUT: Omit<AdminAuthContextValue, 'signIn' | 'signOut'> = {
  status: 'signed-out',
  session: null,
  profile: null,
  identity: null,
  isAdmin: false,
  reason: null,
};

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [identity, setIdentity] = useState<AdminIdentity | null>(null);
  // True until the FIRST session+role resolution settles. Kept separate from
  // `session` so a late profile read cannot flash "not an admin" at a real admin.
  const [resolving, setResolving] = useState(true);

  // Resolve the role whenever the signed-in user changes.
  useEffect(() => {
    let cancelled = false;
    setResolving(true);

    if (!session?.user) {
      setIdentity(null);
      setResolving(false);
      return;
    }

    fetchAdminIdentity(session.user.id)
      .then((result) => {
        if (cancelled) return;
        setIdentity(result);
        setResolving(false);
      })
      .catch(() => {
        // fetchAdminIdentity already funnels errors into `error`; this is a
        // belt-and-braces guard so an unexpected throw cannot leave the gate
        // spinning forever.
        if (cancelled) return;
        setIdentity(null);
        setResolving(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, session]);

  // Track the Supabase session for this origin.
  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next ?? null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo<AdminAuthContextValue>(() => {
    if (!session) return { ...SIGNED_OUT, signIn, signOut };
    if (resolving) return { ...SIGNED_OUT, status: 'checking', signIn, signOut };

    if (identity?.error && !identity.profile) {
      // A lookup failure is reported, not treated as authorization.
      return {
        status: 'not-admin',
        session,
        profile: null,
        identity: null,
        isAdmin: false,
        reason: identity.error,
        signIn,
        signOut,
      };
    }

    if (identity?.isBanned) {
      return {
        status: 'suspended',
        session,
        profile: identity.profile,
        identity,
        isAdmin: false,
        reason: 'This administrator account is suspended.',
        signIn,
        signOut,
      };
    }

    if (!identity?.isAdmin) {
      return {
        status: 'not-admin',
        session,
        profile: identity?.profile ?? null,
        identity,
        isAdmin: false,
        reason: 'This account does not have the admin role.',
        signIn,
        signOut,
      };
    }

    return {
      status: 'ready',
      session,
      profile: identity.profile,
      identity,
      isAdmin: true,
      reason: null,
      signIn,
      signOut,
    };
  }, [session, resolving, identity, signIn, signOut]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return context;
}
