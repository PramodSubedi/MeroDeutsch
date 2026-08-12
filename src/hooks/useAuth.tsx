import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getItem, removeItem, setItem } from '../utils/safeStorage';
import type { AuthUser } from '../types';

const STORAGE_USER_KEY = 'meroDeutschAuthUser';
const STORAGE_ACCOUNTS_KEY = 'meroDeutschAuthAccounts';

interface StoredAccount {
  userId: string;
  username: string;
  passwordHash: string;
}

function hashPassword(password: string): Promise<string> {
  if (typeof crypto !== 'undefined' && 'subtle' in crypto) {
    const encoder = new TextEncoder();
    return crypto.subtle.digest('SHA-256', encoder.encode(password)).then((buffer) => {
      return Array.from(new Uint8Array(buffer))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    });
  }
  return Promise.resolve(password);
}

function loadUser(): AuthUser | null {
  try {
    const raw = getItem(STORAGE_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function saveUser(user: AuthUser | null) {
  if (user) {
    setItem(STORAGE_USER_KEY, JSON.stringify(user));
  } else {
    removeItem(STORAGE_USER_KEY);
  }
}

function loadAccounts(): StoredAccount[] {
  try {
    const raw = getItem(STORAGE_ACCOUNTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredAccount[];
  } catch {
    return [];
  }
}

function saveAccounts(accounts: StoredAccount[]) {
  setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  register: (username: string, password: string) => Promise<AuthUser>;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadUser);

  useEffect(() => {
    saveUser(user);
  }, [user]);

  const register = useCallback(async (username: string, password: string) => {
    const normalized = username.trim().toLowerCase();
    if (!normalized || !password) {
      throw new Error('Username and password are required.');
    }

    const accounts = loadAccounts();
    if (accounts.some((account) => account.username === normalized)) {
      throw new Error('This username is already taken.');
    }

    const passwordHash = await hashPassword(password);
    const userId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `user-${Date.now()}`;

    const nextAccount: StoredAccount = {
      userId,
      username: normalized,
      passwordHash,
    };

    saveAccounts([...accounts, nextAccount]);

    const nextUser: AuthUser = { userId, username: normalized };
    setUser(nextUser);
    return nextUser;
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const normalized = username.trim().toLowerCase();
    if (!normalized || !password) {
      throw new Error('Username and password are required.');
    }

    const accounts = loadAccounts();
    const account = accounts.find((candidate) => candidate.username === normalized);
    if (!account) {
      throw new Error('No account found for this username.');
    }

    const passwordHash = await hashPassword(password);
    if (passwordHash !== account.passwordHash) {
      throw new Error('Incorrect password.');
    }

    const nextUser: AuthUser = { userId: account.userId, username: account.username };
    setUser(nextUser);
    return nextUser;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      register,
      login,
      logout,
    }),
    [login, logout, register, user]
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
