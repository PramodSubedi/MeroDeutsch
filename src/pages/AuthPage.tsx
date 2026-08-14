import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../config/theme';
import { useAuth } from '../hooks/useAuth';
import { BrandMark } from '../components/BrandMark';
import { usePageTitle } from '../hooks/usePageTitle';

export function AuthPage() {
  usePageTitle('Auth');
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
      setMessage('Welcome back! Redirecting to dashboard...');
      window.setTimeout(() => navigate('/dashboard'), 600);
    } catch (loginError: unknown) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed.');
      setIsLoading(false);
    }
  };

  return (
    <div className={theme.page.container}>
      <div className={theme.panel.surface}>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <BrandMark className="text-2xl" />
            <p className="mt-1 text-sm uppercase tracking-[0.25em] text-blue-600">Account</p>
            <h1 className="text-3xl font-bold">{mode === 'register' ? 'Create your account' : 'Sign in'}</h1>
            <p className="mt-2 max-w-xl text-slate-600 dark:text-slate-300">
              {mode === 'register'
                ? 'Register once to save your progress and unlock your personal review queue.'
                : 'Sign in to continue where you left off.'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('register')}
              className={mode === 'register' ? theme.button.primary : theme.button.secondary}
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => setMode('login')}
              className={mode === 'login' ? theme.button.primary : theme.button.secondary}
            >
              Login
            </button>
          </div>
        </div>

                <form onSubmit={handleSubmit} className="grid gap-4">
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
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 transition hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                tabIndex={-1}
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 transition hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showConfirmPassword}
                  tabIndex={-1}
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
              mode === 'register' ? 'Register account' : 'Login'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
