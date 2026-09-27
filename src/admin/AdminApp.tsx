/**
 * src/admin/AdminApp.tsx
 *
 * Root component: the authorization gate, then the router.
 *
 * GATE ORDER MATTERS
 * ------------------
 *   checking    → neutral spinner (session or role still resolving)
 *   signed-out  → sign-in form
 *   suspended   → locked, with the only useful action being sign-out
 *   not-admin   → locked, with the reason
 *   ready       → the router
 *
 * `AdminLayout` is only ever mounted in the `ready` branch, so no screen inside
 * it can render without a verified admin role. The gate is a UX affordance —
 * the real boundary is RLS, and a tampered client still reads nothing.
 */
import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { theme } from '../config/theme';
import { AdminLayout } from './AdminLayout';
import { DashboardPage } from './pages/DashboardPage';
import { DebugPage } from './pages/DebugPage';
import { UsersPage } from './pages/UsersPage';
import { SystemPage } from './pages/SystemPage';
import { CurriculumPage } from './pages/CurriculumPage';
import { VocabularyPage } from './pages/VocabularyPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { useAdminAuth } from './hooks/useAdminAuth';
import { useDarkMode } from '../hooks/useDarkMode';

function CheckingGate() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 dark:bg-ink-950">
      <div className="flex flex-col items-center gap-3 text-ink-500 dark:text-ink-400">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        <p className="text-body">Checking your access…</p>
      </div>
    </div>
  );
}

interface SignInGateProps {
  onSignIn: (email: string, password: string) => Promise<void>;
}

function SignInGate({ onSignIn }: SignInGateProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 dark:bg-ink-950">
      <div className="w-full max-w-sm">
        <div className="rounded-lg border border-ink-200 bg-white p-6 dark:border-ink-800 dark:bg-ink-900">
          <p className={theme.type.kicker}>Restricted</p>
          <h1 className="mt-1 text-title font-bold text-ink-900 dark:text-ink-50">Admin sign-in</h1>
          <p className="mt-2 text-meta text-ink-500 dark:text-ink-400">
            Requires an account with <code className="font-mono">role = 'admin'</code> on this project.
          </p>

          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              onSignIn(email, password)
                .catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : 'Sign-in failed.');
                })
                .finally(() => setBusy(false));
            }}
          >
            <div>
              <label
                htmlFor="admin-email"
                className="block text-meta font-semibold text-ink-700 dark:text-ink-300"
              >
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={theme.input}
              />
            </div>
            <div>
              <label
                htmlFor="admin-password"
                className="block text-meta font-semibold text-ink-700 dark:text-ink-300"
              >
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={theme.input}
              />
            </div>

            {error ? (
              <p className="text-meta text-danger-600 dark:text-danger-400" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" className={`${theme.button.primary} w-full`} disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-meta text-ink-500 dark:text-ink-400">
          The session on this origin is independent of the learner app.
        </p>
      </div>
    </div>
  );
}

function LockedGate({ title, message, onSignOut }: { title: string; message: string; onSignOut: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 dark:bg-ink-950">
      <div className="w-full max-w-md rounded-lg border border-ink-200 bg-white p-6 text-center dark:border-ink-800 dark:bg-ink-900">
        <ShieldAlert className="mx-auto h-8 w-8 text-warning-500" aria-hidden="true" />
        <h1 className="mt-3 text-title font-bold text-ink-900 dark:text-ink-50">{title}</h1>
        <p className="mt-2 text-body text-ink-600 dark:text-ink-400">{message}</p>
        <button type="button" onClick={onSignOut} className={`${theme.button.secondary} mt-5`}>
          Sign out
        </button>
      </div>
    </div>
  );
}

export function AdminApp() {
  const { status, reason, signIn, signOut } = useAdminAuth();
  // Mount the dark-mode effect before the gate renders, so the sign-in screen
  // honours the stored preference instead of flashing light.
  useDarkMode();

  if (status === 'checking') return <CheckingGate />;
  if (status === 'signed-out') return <SignInGate onSignIn={signIn} />;
  if (status === 'suspended') {
    return <LockedGate title="Account suspended" message={reason ?? ''} onSignOut={() => void signOut()} />;
  }
  if (status === 'not-admin') {
    return <LockedGate title="Not authorized" message={reason ?? ''} onSignOut={() => void signOut()} />;
  }

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="debug" element={<DebugPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="curriculum" element={<CurriculumPage />} />
        <Route path="vocabulary" element={<VocabularyPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="system" element={<SystemPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
