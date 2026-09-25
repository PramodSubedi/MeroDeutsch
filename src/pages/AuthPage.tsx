import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cloud, Map, RefreshCw } from 'lucide-react';
import { theme } from '../config/theme';
import { useAuth } from '../hooks/useAuth';
import { Logo } from '../components/common/Logo';
import { usePageTitle } from '../hooks/usePageTitle';
import { useLang } from '../hooks/useLang';

export function AuthPage() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  usePageTitle(isDE ? 'Anmelden' : 'Sign in');
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
      setError(isDE ? 'E-Mail-Adresse und Passwort sind erforderlich.' : 'Both email and password are required.');
      setIsLoading(false);
      return;
    }

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError(isDE ? 'Die Passwörter stimmen nicht überein.' : 'Passwords do not match.');
        setIsLoading(false);
        return;
      }
      try {
        await register(email, password, username);
        setMessage(isDE ? 'Prüfe deine E-Mails auf den Bestätigungslink.' : 'Check your email for a confirmation link!');
      } catch (registerError: unknown) {
        setError(registerError instanceof Error ? registerError.message : isDE ? 'Registrierung fehlgeschlagen.' : 'Registration failed.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      await login(email, password);
      setMessage(isDE ? 'Willkommen zurück! Weiterleitung zur Startseite…' : 'Welcome back! Redirecting to your home...');
      window.setTimeout(() => navigate('/home'), 600);
    } catch (loginError: unknown) {
      setError(loginError instanceof Error ? loginError.message : isDE ? 'Anmeldung fehlgeschlagen.' : 'Login failed.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-50 dark:bg-ink-950">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10">
        <div className="grid w-full items-center gap-10 lg:grid-cols-2">
          {/* Brand panel — desktop only (value props, no app chrome) */}
          <div className="hidden lg:block">
            <div className="rounded-lg bg-gradient-to-br from-accent-600 via-accent-700 to-accent-900 p-10 text-white shadow-2xl">
              <Logo size="md" variant="on-dark" />
              <h2 className="mt-8 text-3xl font-bold tracking-tight">{isDE ? 'Alles für deinen Start.' : 'Everything a beginner needs.'}</h2>
              <p className="mt-3 max-w-sm text-accent-100">{isDE ? 'Ein kostenloses Konto, drei Vorteile.' : 'One free account, three lasting benefits.'}</p>
              <ul className="mt-8 space-y-5">
                <li className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/15">
                    <Cloud className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-semibold">{isDE ? 'Fortschritt gespeichert und synchronisiert' : 'Progress saved & synced'}</p>
                    <p className="mt-0.5 text-body text-accent-100">{isDE ? 'Lerne auf jedem Gerät dort weiter, wo du aufgehört hast.' : 'Pick up on any device where you left off.'}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/15">
                    <Map className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-semibold">{isDE ? 'Geführter A1-Lernpfad' : 'Guided A1 path'}</p>
                    <p className="mt-0.5 text-body text-accent-100">
                      {isDE ? 'Einheiten in fester Reihenfolge mit Fortschrittsprüfungen.' : 'Units in a fixed order with checkpoints that gate real progress.'}
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/15">
                    <RefreshCw className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-semibold">{isDE ? 'Intelligente Wiederholung' : 'Smart review queue'}</p>
                    <p className="mt-0.5 text-body text-accent-100">{isDE ? 'Falsch beantwortete Aufgaben kommen gezielt wieder.' : 'Missed items come back on purpose until they stick.'}</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Card */}
          <div className="mx-auto w-full max-w-md">
            <div className="rounded-lg border border-ink-200 bg-white p-8 shadow-xl dark:border-ink-800 dark:bg-ink-900">
              <Logo size="sm" />
              <p className="mt-4 text-body leading-6 text-ink-600 dark:text-ink-300">
                {mode === 'register'
                  ? isDE ? 'Speichere deinen Fortschritt, folge dem A1-Lernpfad und wiederhole Fehler gezielt.' : 'Save your progress, unlock your guided A1 path, and review mistakes smartly.'
                  : isDE ? 'Melde dich an, um dort weiterzulernen, wo du aufgehört hast.' : 'Sign in to continue where you left off.'}
              </p>

              {/* Mode tabs */}
              <div className="mt-6 grid grid-cols-2 gap-1 rounded-md bg-ink-100 p-1 dark:bg-ink-800" role="tablist">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  role="tab"
                  aria-selected={mode === 'login'}
                  className={`min-h-[44px] rounded-sm px-3 text-body font-semibold transition ${
                    mode === 'login'
                      ? 'border border-ink-200 bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:border-ink-800 dark:text-white'
                      : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200'
                  }`}
                >
                  {isDE ? 'Anmelden' : 'Sign in'}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  role="tab"
                  aria-selected={mode === 'register'}
                  className={`min-h-[44px] rounded-sm px-3 text-body font-semibold transition ${
                    mode === 'register'
                      ? 'border border-ink-200 bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:border-ink-800 dark:text-white'
                      : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200'
                  }`}
                >
                  {isDE ? 'Konto erstellen' : 'Create account'}
                </button>
              </div>

            <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
          <label className="space-y-2 text-body font-medium text-ink-700 dark:text-ink-200">
            {isDE ? 'E-Mail' : 'Email'}
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={theme.input}
              placeholder={isDE ? 'z. B. name@beispiel.de' : 'e.g. learner@example.com'}
              disabled={isLoading}
            />
          </label>

          {mode === 'register' && (
            <label className="space-y-2 text-body font-medium text-ink-700 dark:text-ink-200">
              {isDE ? 'Benutzername' : 'Username'}
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className={theme.input}
                placeholder={isDE ? 'z. B. lernender123' : 'e.g. learner123'}
                disabled={isLoading}
              />
            </label>
          )}


          <label className="space-y-2 text-body font-medium text-ink-700 dark:text-ink-200">
            {isDE ? 'Passwort' : 'Password'}
            <span className="relative block">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={`${theme.input} pr-11`}
                placeholder={isDE ? 'Sicheres Passwort eingeben' : 'Enter a secure password'}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm p-2 text-ink-500 transition hover:text-accent-600 dark:text-ink-400 dark:hover:text-accent-300"
                aria-label={showPassword ? (isDE ? 'Passwort verbergen' : 'Hide password') : (isDE ? 'Passwort anzeigen' : 'Show password')}
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
            <label className="space-y-2 text-body font-medium text-ink-700 dark:text-ink-200">
              {isDE ? 'Passwort bestätigen' : 'Confirm Password'}
              <span className="relative block">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className={`${theme.input} pr-11`}
                  placeholder={isDE ? 'Passwort erneut eingeben' : 'Re-enter password'}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm p-2 text-ink-500 transition hover:text-accent-600 dark:text-ink-400 dark:hover:text-accent-300"
                  aria-label={showConfirmPassword ? (isDE ? 'Passwort verbergen' : 'Hide password') : (isDE ? 'Passwort anzeigen' : 'Show password')}
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

          {error && <div role="alert" className="rounded-md border border-danger-300 bg-danger-50 p-4 text-body text-danger-700">{error}</div>}
          {message && <div role="status" aria-live="polite" className="rounded-md border border-success-300 bg-success-50 p-4 text-body text-success-700">{message}</div>}

          <button type="submit" className={theme.button.primary} disabled={isLoading}>
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {mode === 'register' ? (isDE ? 'Konto wird erstellt…' : 'Registering…') : (isDE ? 'Anmeldung läuft…' : 'Signing in…')}
              </span>
            ) : (
              mode === 'register'
                ? isDE ? 'Konto erstellen' : 'Register account'
                : isDE ? 'Anmelden und fortfahren' : 'Sign in to continue'
            )}
          </button>
        </form>
            </div>

            {/* Legal - minimal, under the card */}
            <p className="mt-4 text-center text-meta leading-5 text-ink-500 dark:text-ink-400">
              {isDE ? 'Mit deiner Anmeldung stimmst du unseren ' : 'By continuing you agree to our '}
              <Link to="/terms" className="font-semibold text-accent-600 hover:underline dark:text-accent-400">{isDE ? 'Nutzungsbedingungen' : 'Terms'}</Link>{' '}
              {isDE ? 'und der ' : 'and '}
              <Link to="/privacy" className="font-semibold text-accent-600 hover:underline dark:text-accent-400">{isDE ? 'Datenschutzerklärung' : 'Privacy Policy'}</Link>
              {isDE ? '. Keine Kreditkarte nötig – A1 ist kostenlos.' : '. No credit card needed - A1 is free.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}