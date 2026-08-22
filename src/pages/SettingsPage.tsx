import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { theme } from '../config/theme';
import { useLang } from '../hooks/useLang';
import { useDarkMode } from '../hooks/useDarkMode';
import { useSpeechSpeed } from '../hooks/useSpeech';
import { useAuth } from '../hooks/useAuth';
import { usePageTitle } from '../hooks/usePageTitle';
import { scopedKey } from '../utils/userStorage';
import { removeItem } from '../utils/safeStorage';
import { supabase } from '../lib/supabase';

const RESET_SCOPED_KEYS = [
  'germanAlphabetProgress',
  'germanDailyStreak',
  'meroDeutschAchievements',
  'meroDeutschWrongAnswers',
  'mero_deutsch_xp',
  'meroDeutschA1Path',
];

const RESET_TABLES: { table: string; column: string }[] = [
  { table: 'user_progress', column: 'user_id' },
  { table: 'user_streaks', column: 'user_id' },
  { table: 'user_achievements', column: 'user_id' },
  { table: 'review_queue', column: 'user_id' },
  { table: 'user_xp', column: 'user_id' },
];

export function SettingsPage() {
  usePageTitle('Settings');
  const { langMode, setLangMode } = useLang();
  const { dark, toggle } = useDarkMode();
  const { speed, setSpeed } = useSpeechSpeed();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const isDE = langMode === 'german';
  const userId = user?.userId ?? null;

  const handleReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }

    setResetting(true);
    setResetMessage(null);

    // 1. Clear per-user scoped localStorage keys.
    for (const base of RESET_SCOPED_KEYS) {
      removeItem(scopedKey(base, userId));
    }
    // Also clear unscoped XP key in case it was written before scoping.
    removeItem('mero_deutsch_xp');

    // 2. Best-effort cloud clear for the current user. Track failures so we
    //    never claim success when cloud rows survived (they would re-sync and
    //    silently undo the reset on next login).
    let cloudFailures = 0;
    if (userId) {
      for (const t of RESET_TABLES) {
        try {
          const { error } = await supabase.from(t.table).delete().eq(t.column, userId);
          if (error) cloudFailures += 1;
        } catch {
          cloudFailures += 1;
        }
      }
    }

    setResetting(false);
    setConfirmReset(false);
    setResetMessage(
      cloudFailures > 0
        ? isDE
          ? 'Lokaler Fortschritt gelöscht. Einige Cloud-Daten konnten nicht entfernt werden — bitte erneut versuchen.'
          : 'Local progress cleared. Some cloud data could not be removed — please try again.'
        : isDE
          ? 'Dein Fortschritt wurde zurückgesetzt.'
          : 'Your progress has been reset.'
    );
    // Force a reload so all hooks re-read the cleared keys.
    window.setTimeout(() => window.location.reload(), 800);
  };

  const handleSignOut = async () => {
    try {
      await logout();
    } finally {
      navigate('/');
    }
  };

  const langLabel = isDE ? 'Deutsch' : 'English + Nepali';
  const ttsLabels = {
    slow: isDE ? 'Langsam' : 'Slow',
    normal: isDE ? 'Normal' : 'Normal',
    fast: isDE ? 'Schnell' : 'Fast',
  } as const;

  return (
    <div className={theme.page.container}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
          {isDE ? 'Einstellungen' : 'Settings'}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isDE
            ? 'Sprache, Design, Sprachgeschwindigkeit und deine Daten.'
            : 'Language, theme, speech speed, and your data.'}
        </p>
      </div>

      <div className="space-y-4">
        {/* Language */}
        <div className={theme.panel.surface}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                {isDE ? 'Sprache' : 'Language'}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {isDE
                  ? 'Nur Deutsch blendet englische & nepalesische Hilfetexte aus.'
                  : '“Nur Deutsch” hides English & Nepali helper text.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLangMode(isDE ? 'normal' : 'german')}
              className={theme.button.primary}
            >
              {isDE ? 'EN + NE einblenden' : 'Nur Deutsch (hide EN/NE)'}
            </button>
          </div>
          <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
            {isDE ? 'Aktuell: Deutsch' : 'Current: ' + langLabel}
          </p>
        </div>

        {/* Theme */}
        <div className={theme.panel.surface}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                {isDE ? 'Design' : 'Theme'}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {isDE ? 'Zwischen hellem und dunklem Design wechseln.' : 'Switch between light and dark mode.'}
              </p>
            </div>
            <button type="button" onClick={toggle} className={theme.button.secondary}>
              {dark ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </div>

        {/* TTS Speed */}
        <div className={theme.panel.surface}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                {isDE ? 'Sprachgeschwindigkeit' : 'Speech Speed'}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {isDE
                  ? 'Geschwindigkeit der Aussprache beim Vorlesen.'
                  : 'How fast words are pronounced aloud.'}
              </p>
            </div>
            <div className="flex gap-2">
              {(['slow', 'normal', 'fast'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  className={speed === s ? theme.button.toggleActive : theme.button.toggleInactive}
                >
                  {ttsLabels[s]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Reset progress */}
        <div className={`${theme.panel.surface} border-red-200 dark:border-red-900/40`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">
                {isDE ? 'Fortschritt zurücksetzen' : 'Reset Progress'}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {isDE
                  ? `Löscht alle Lernfortschrittsdaten für ${userId ? 'dein Konto' : 'diesen Gast'}. Diese Aktion kann nicht rückgängig gemacht werden.`
                  : `Clears all learning progress for ${userId ? 'your account' : 'this guest'}. This cannot be undone.`}
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className={`${theme.button.danger} disabled:opacity-50`}
            >
              {resetting
                ? (isDE ? 'Lösche…' : 'Clearing…')
                : confirmReset
                ? (isDE ? 'Wirklich löschen?' : 'Really reset?')
                : (isDE ? 'Fortschritt zurücksetzen' : 'Reset progress')}
            </button>
          </div>
          {resetMessage && (
            <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 dark:border-green-900 dark:bg-green-900/30 dark:text-green-300">
              {resetMessage}
            </div>
          )}
        </div>

        {/* Account */}
        <div className={theme.panel.surface}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                {isDE ? 'Konto' : 'Account'}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {user
                  ? (isDE ? `Angemeldet als ${user.username}` : `Signed in as ${user.username}`)
                  : (isDE ? 'Du lernst als Gast.' : 'You are learning as a guest.')}
              </p>
            </div>
            {user ? (
              <button type="button" onClick={handleSignOut} className={theme.button.secondary}>
                {isDE ? 'Abmelden' : 'Sign out'}
              </button>
            ) : (
              <Link to="/auth" className={theme.button.primary}>
                {isDE ? 'Anmelden / Registrieren' : 'Sign in / Register'}
              </Link>
            )}
          </div>
        </div>

        {/* Support links */}
        <div className="flex flex-wrap gap-3 pt-2 text-sm">
          <Link to="/help" className="text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200">
            {isDE ? 'Hilfe & FAQ' : 'Help & FAQ'}
          </Link>
          <Link to="/privacy" className="text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200">
            {isDE ? 'Datenschutz' : 'Privacy'}
          </Link>
          <Link to="/terms" className="text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200">
            {isDE ? 'Nutzungsbedingungen' : 'Terms'}
          </Link>
        </div>
      </div>
    </div>
  );
}