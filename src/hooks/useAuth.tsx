import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { migrateLocalStorageToDexie } from '../lib/db';
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
  }, []);

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(session),
      isLoading,
      register,
      login,
      logout,
      migrationResult,
    }),
    [session, user, isLoading, register, login, logout, migrationResult]
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
