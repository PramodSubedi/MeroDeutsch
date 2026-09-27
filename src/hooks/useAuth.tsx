import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { migrateLocalStorageToDexie } from '../lib/db';
import { getDebugMode, setDebugMode, subscribeDebugMode, type DebugMode } from '../lib/debugMode';
import type { AuthUser, MigrationResult } from '../types';
import type { Session, User } from '@supabase/supabase-js';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  register: (email: string, password: string, username?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Result of the one-time localStorage -> IndexedDB migration (Phase 1). */
  migrationResult: MigrationResult | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  // The QA simulator's mode, held in STATE rather than read inside `useMemo`.
  // Reading it inline would compute the override once and then never recompute,
  // so flipping to `guest` would leave every consumer showing the old identity
  // until something unrelated forced a re-render.
  const [debugMode, setDebugModeState] = useState<DebugMode>(() => getDebugMode());

  // Keep the mode live: same-tab subscribers plus `storage` events from other
  // tabs of this origin.
  useEffect(() => {
    setDebugModeState(getDebugMode());
    const sync = () => setDebugModeState(getDebugMode());
    const unsubscribe = subscribeDebugMode(sync);
    window.addEventListener('storage', sync);
    window.addEventListener('mero-debug-mode', sync);
    return () => {
      unsubscribe();
      window.removeEventListener('storage', sync);
      window.removeEventListener('mero-debug-mode', sync);
    };
  }, []);

  // Map Supabase User to our AuthUser type
  const mapUser = (sbUser: User | null): AuthUser | null => {
    if (!sbUser) return null;
    return {
      userId: sbUser.id,
      username: sbUser.user_metadata?.username || sbUser.email?.split('@')[0] || 'User',
      avatarUrl: sbUser.user_metadata?.avatar_url,
    };
  };

  useEffect(() => {
    // Check active sessions
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(mapUser(session?.user ?? null));
      setIsLoading(false);
    });

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(mapUser(session?.user ?? null));
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Phase 1.1 — one-time localStorage -> IndexedDB migration, fired once an
  // identity (authenticated user or 'guest') is established. The per-user
  // `mero_dexie_migrated_v1_<uid>` flag (checked inside the helper) makes this
  // idempotent. copy-only by default: legacy review-queue keys are preserved
  // until the existing useReviewQueue hook is migrated to Dexie (no data-loss
  // window).
  useEffect(() => {
    const userId = user?.userId ?? 'guest';
    void migrateLocalStorageToDexie(userId, { cleanup: true })
      .then((res) => setMigrationResult(res))
      .catch((err) => {
        console.warn('[dexie] migration failed:', err);
        setMigrationResult({
          migrated: 0,
          skipped: 0,
          alreadyMigrated: false,
          message: err instanceof Error ? err.message : String(err),
        });
      });
  }, [user?.userId]);

  const register = useCallback(async (email: string, password: string, username?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username,
        },
      },
    });

    if (error) throw error;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // A REAL sign-in is proof that the visitor is not a guest, so any leftover
    // guest simulation is now stale and must be cleared.
    //
    // WHY: the guest override lives in per-origin localStorage and survives
    // reloads. If an admin left the simulator on `guest` — via the navbar, the
    // bridge, or a `?adminmode=guest` link — then later reloaded the app
    // normally, `isAuthenticated` stayed forced to false and every sign-in
    // silently appeared to do nothing. Clearing here means sign-in can ALWAYS
    // break out of a stuck simulation, so the tool can never leave someone
    // locked out of their own account.
    if (getDebugMode() === 'guest') {
      setDebugMode('real');
    }
  }, []);

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo(
    () => {
      // ── QA simulator integration (the only change in this file) ──────────
      // In `guest` mode the app must behave as if nobody is signed in. `user`
      // is nulled as well as flipping the flag, because ~14 components branch
      // on `user` and several MORE resolve a per-user storage scope from
      // `user?.userId` (see `scopedKey`, `useA1Path`, `useProgress`). Flipping
      // `isAuthenticated` alone would leave the UI signed-out while progress,
      // XP and streak writes still landed in the REAL account's bucket — the
      // exact failure a simulator exists to prevent.
      //
      // The real session is deliberately left intact underneath: it is still in
      // `session`, Supabase still holds it, and returning to `real` restores
      // everything with no re-login. That is what makes this a view override
      // rather than a sign-out.
      const isGuestSimulation = debugMode === 'guest';
      const effectiveUser = isGuestSimulation ? null : user;

      return {
        user: effectiveUser,
        isAuthenticated: Boolean(session) && !isGuestSimulation,
        isLoading,
        register,
        login,
        logout,
        migrationResult,
      };
    },
    [session, user, isLoading, debugMode, register, login, logout, migrationResult]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
