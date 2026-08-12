import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../config/theme';
import { useAuth } from '../hooks/useAuth';
import { BrandMark } from '../components/BrandMark';

export function AuthPage() {
  const navigate = useNavigate();
  const { register, login } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!username.trim() || !password) {
      setError('Both username and password are required.');
      return;
    }

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      try {
        await register(username, password);
        setMessage('Your account is ready! Redirecting to dashboard...');
        window.setTimeout(() => navigate('/dashboard'), 600);
      } catch (registerError: unknown) {
        setError(registerError instanceof Error ? registerError.message : 'Registration failed.');
      }
      return;
    }

    try {
      await login(username, password);
      setMessage('Welcome back! Redirecting to dashboard...');
      window.setTimeout(() => navigate('/dashboard'), 600);
    } catch (loginError: unknown) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed.');
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
            Username
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className={theme.input}
              placeholder="e.g. learner123"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={theme.input}
              placeholder="Enter a secure password"
            />
          </label>

          {mode === 'register' && (
            <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              Confirm Password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className={theme.input}
                placeholder="Re-enter password"
              />
            </label>
          )}

          {error && <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {message && <div className="rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-700">{message}</div>}

          <button type="submit" className={theme.button.primary}>
            {mode === 'register' ? 'Register account' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
