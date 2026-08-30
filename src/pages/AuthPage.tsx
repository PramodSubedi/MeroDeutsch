import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cloud, Map, RefreshCw } from 'lucide-react';
import { theme } from '../config/theme';
import { useAuth } from '../hooks/useAuth';
import { Logo } from '../components/common/Logo';
import { usePageTitle } from '../hooks/usePageTitle';

export function AuthPage() {
  usePageTitle('Sign in');
  const navigate = useNavigate();
  const { register, login } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    if (!email.trim() || !password) {
      setError('Both email and password are required.');
      setIsLoading(false);
      return;
    }

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        setIsLoading(false);
        return;
      }
      try {
        await register(email, password, username);
        setMessage('Check your email for a confirmation link!');
      } catch (registerError: unknown) {
        setError(registerError instanceof Error ? registerError.message : 'Registration failed.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      await login(email, password);
      setMessage('Welcome back! Redirecting to your home...');
      window.setTimeout(() => navigate('/home'), 600);
    } catch (loginError: unknown) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10">
        <div className="grid w-full items-center gap-10 lg:grid-cols-2">
          {/* Brand panel — desktop only (value props, no app chrome) */}
          <div className="hidden lg:block">
            <div className="rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 p-10 text-white shadow-2xl">
              <Logo size="md" variant="on-dark" />
              <h2 className="mt-8 text-3xl font-bold tracking-tight">Everything a beginner needs.</h2>
              <p className="mt-3 max-w-sm text-blue-100">One free account, three lasting benefits.</p>
              <ul className="mt-8 space-y-5">
                <li className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                    <Cloud className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-semibold">Progress saved &amp; synced</p>
                    <p className="mt-0.5 text-sm text-blue-100">Pick up on any device where you left off.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                    <Map className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-semibold">Guided A1 path</p>
                    <p className="mt-0.5 text-sm text-blue-100">
                      Units in a fixed order with checkpoints that gate real progress.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                    <RefreshCw className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-semibold">Smart review queue</p>
                    <p className="mt-0.5 text-sm text-blue-100">Missed items come back on purpose until they stick.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Card */}
          <div className="mx-auto w-full max-w-md">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
              <Logo size="sm" />
              <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {mode === 'register'
                  ? 'Save your progress, unlock your guided A1 path, and review mistakes smartly.'
                  : 'Sign in to continue where you left off.'}
              </p>

              {/* Mode tabs */}
              <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  role="tab"
                  aria-selected={mode === 'login'}
                  className={`min-h-[44px] rounded-lg px-3 text-sm font-semibold transition ${
                    mode === 'login'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  role="tab"
                  aria-selected={mode === 'register'}
                  className={`min-h-[44px] rounded-lg px-3 text-sm font-semibold transition ${
                    mode === 'register'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  Create account
                </button>
              </div>

            <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
          <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={theme.input}
              placeholder="e.g. learner@example.com"
              disabled={isLoading}
            />
          </label>

          {mode === 'register' && (
            <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              Username
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className={theme.input}
                placeholder="e.g. learner123"
                disabled={isLoading}
              />
            </label>
          )}


          <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            Password
            <span className="relative block">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={`${theme.input} pr-11`}
                placeholder="Enter a secure password"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-slate-500 transition hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </span>
          </label>

          {mode === 'register' && (
            <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              Confirm Password
              <span className="relative block">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className={`${theme.input} pr-11`}
                  placeholder="Re-enter password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-slate-500 transition hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showConfirmPassword}
                >
                  {showConfirmPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </span>
            </label>
          )}

          {error && <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {message && <div className="rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-700">{message}</div>}

          <button type="submit" className={theme.button.primary} disabled={isLoading}>
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {mode === 'register' ? 'Registering...' : 'Signing in...'}
              </span>
            ) : (
              mode === 'register' ? 'Register account' : 'Sign in to continue'
            )}
          </button>
        </form>
            </div>

            {/* Legal - minimal, under the card */}
            <p className="mt-4 text-center text-xs leading-5 text-slate-500 dark:text-slate-400">
              By continuing you agree to our{' '}
              <Link to="/terms" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">Terms</Link>{' '}
              and{' '}
              <Link to="/privacy" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">Privacy Policy</Link>
              . No credit card needed - A1 is free.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}