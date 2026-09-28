import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { theme } from '../config/theme';
import { useLang } from '../hooks/useLang';
import { useDarkMode } from '../hooks/useDarkMode';
import { useSpeechSpeed } from '../hooks/useSpeech';
import { useAuth } from '../hooks/useAuth';
import { usePageTitle } from '../hooks/usePageTitle';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { useA1Path } from '../hooks/useA1Path';
import { scopedKey } from '../utils/userStorage';
import { removeItem } from '../utils/safeStorage';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';
import { useChatStore } from '../lib/chatStore';
import { healthCheck, serverLabel, statusHint } from '../lib/ollamaHealth';
import { resetFormatCache } from '../lib/ollamaClient';
import { AdminPanelLink } from '../components/debug/AdminPanelLink';
// Only the build-time kill switch is needed here. The intensity, language-mix,
// preference and URL helpers moved to the control centre's Chatbot page, which
// owns them as global defaults; this page keeps the personal on/off toggle.
import { CHATBOT_ENABLED } from '../config/chatbot';

/**
 * Per-user localStorage base keys cleared by "Reset progress".
 *
 * 'meroDeutschA1Path' used to be listed here. It no longer belongs: useA1Path
 * migrated that key into Dexie `a1PathState` + Supabase `a1_path_state` and
 * deletes the legacy entry after a successful copy, so clearing it was a no-op
 * — and it hid the real defect, which is that the A1 course survived a
 * "reset everything" entirely. The course now lives in the Dexie loop below.
 */
const RESET_SCOPED_KEYS = [
  'germanAlphabetProgress',
  'germanDailyStreak',
  'meroDeutschAchievements',
  'meroDeutschWrongAnswers',
  'mero_deutsch_xp',
  'meroDeutschDailyQuests',
  'meroDeutschLastDailyChallenge',
];

const RESET_TABLES: { table: string; column: string }[] = [
  { table: 'user_progress', column: 'user_id' },
  { table: 'user_streaks', column: 'user_id' },
  { table: 'user_achievements', column: 'user_id' },
  { table: 'review_queue', column: 'user_id' },
  { table: 'user_xp', column: 'user_id' },
  // The A1 spine. Without this row the course (completed nodes, unlocked
  // band, checkpoint best scores) survived the reset and immediately
  // re-hydrated from the cloud on the next load.
  { table: 'a1_path_state', column: 'user_id' },
];

/**
 * Clear the OFFLINE-FIRST half of the user's data. Cloud rows are deleted
 * separately below; Dexie is the primary store for the A1 path and the
 * per-word mastery stats, so skipping it left both intact.
 *
 * Guests still own Dexie rows, keyed 'guest' (the same id useA1Path and
 * scopedKey use), so this runs for signed-out visitors too.
 */
async function clearDexieUserData(dexieUserId: string): Promise<number> {
  if (!db) return 0;
  let failures = 0;
  try {
    await db.a1PathState.delete(dexieUserId);
  } catch {
    failures += 1;
  }
  try {
    await db.vocabStats.where('userId').equals(dexieUserId).delete();
  } catch {
    failures += 1;
  }
  return failures;
}

export function SettingsPage() {
  usePageTitle('Settings');
  const { langMode, setLangMode } = useLang();
  const { dark, toggle } = useDarkMode();
  const { speed, setSpeed } = useSpeechSpeed();
  const { user, logout } = useAuth();
  const { canInstall, promptInstall } = useInstallPrompt();
  const { resetPath } = useA1Path();
  const navigate = useNavigate();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [confirmResetCourse, setConfirmResetCourse] = useState(false);
  const [resettingCourse, setResettingCourse] = useState(false);
  const [resetCourseMessage, setResetCourseMessage] = useState<string | null>(null);

  /* ── AI companion (Mero) ────────────────────────────────────────────── */
  // PERSONAL ONLY. The base URL, model, personality, language mix and the
  // proactive nudge are global defaults now, owned by the control centre and
  // published through `app_config` (`src/data/chatbot/`). What is left here is
  // the one thing that is genuinely per-learner: whether THIS person wants the
  // companion at all. It is stored per user in localStorage and is ANDed with
  // the admin's global switch, so turning the feature off globally overrides
  // this toggle without overwriting it.
  const chatSettings = useChatStore((s) => s.settings);
  const setChatSettings = useChatStore((s) => s.setSettings);
  const chatStatus = useChatStore((s) => s.status);
  const setChatStatus = useChatStore((s) => s.setStatus);
  const adminEnabled = useChatStore((s) => s.adminEnabled);
  const companionActive = adminEnabled && chatSettings.enabled;

  // Probe once when the panel becomes active, so it opens with an accurate
  // status instead of an optimistic green dot the learner has to disprove.
  // Read-only: it reports whether the configured server answers, and nothing
  // here can change that configuration.
  useEffect(() => {
    if (!companionActive) return;
    void (async () => {
      resetFormatCache();
      setChatStatus(await healthCheck(chatSettings.baseUrl));
    })();
    // Intentionally keyed on the active flag only: re-probing on every settings
    // change would fire a request per keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companionActive]);

  /**
   * Restart the A1 course only — XP, streak, badges and the review queue stay.
   *
   * Delegates to `useA1Path.resetPath()` rather than re-implementing the writes:
   * that already writes through Dexie (primary) and debounces the Supabase
   * mirror, so this button cannot leave the course half-cleared the way the old
   * full-reset did.
   */
  const handleResetCourse = () => {
    if (!confirmResetCourse) {
      setConfirmResetCourse(true);
      return;
    }
    setResettingCourse(true);
    resetPath();
    setResettingCourse(false);
    setConfirmResetCourse(false);
    setResetCourseMessage(
      isDE
        ? 'Kurs zurückgesetzt — du beginnst wieder bei Band A. XP und Serie sind erhalten.'
        : 'Course reset — you are back at Band A. Your XP and streak are untouched.'
    );
  };

  const isDE = langMode === 'german';
  const userId = user?.userId ?? null;

  const handleReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }

    setResetting(true);
    setResetMessage(null);

    // 0. Clear the A1 course through its own owner FIRST. This resets the
    //    in-memory path state as well as persisting; without it the running app
    //    still believes the learner is on Band D, and any node completion would
    //    write that stale course straight back to Dexie — which is exactly how
    //    the course survived a "reset everything" before.
    resetPath();

    // 1. Clear per-user scoped localStorage keys.
    for (const base of RESET_SCOPED_KEYS) {
      removeItem(scopedKey(base, userId));
    }
    // Also clear unscoped XP key in case it was written before scoping.
    removeItem('mero_deutsch_xp');

    // 2. Clear the offline-first Dexie store (A1 path + per-word mastery).
    //    Dexie is the PRIMARY store for both, so a reset that only touched
    //    localStorage + Supabase left the whole course standing. Guests own
    //    'guest'-keyed rows, so this is not auth-gated.
    let cloudFailures = 0;
    cloudFailures += await clearDexieUserData(userId ?? 'guest');

    // 3. Best-effort cloud clear for the current user. Track failures so we
    //    never claim success when cloud rows survived (they would re-sync and
    //    silently undo the reset on next login).
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
        <h1 className="text-2xl font-bold tracking-tight text-ink-950 dark:text-white">
          {isDE ? 'Einstellungen' : 'Settings'}
        </h1>
        <p className="mt-1 text-body text-ink-500 dark:text-ink-400">
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
              <h2 className="text-lg font-semibold text-ink-950 dark:text-white">
                {isDE ? 'Sprache' : 'Language'}
              </h2>
              <p className="mt-1 text-body text-ink-500 dark:text-ink-400">
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
          <p className="mt-3 text-body font-medium text-ink-600 dark:text-ink-300">
            {isDE ? 'Aktuell: Deutsch' : 'Current: ' + langLabel}
          </p>
        </div>

        {/* Theme */}
        <div className={theme.panel.surface}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink-950 dark:text-white">
                {isDE ? 'Design' : 'Theme'}
              </h2>
              <p className="mt-1 text-body text-ink-500 dark:text-ink-400">
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
              <h2 className="text-lg font-semibold text-ink-950 dark:text-white">
                {isDE ? 'Sprachgeschwindigkeit' : 'Speech Speed'}
              </h2>
              <p className="mt-1 text-body text-ink-500 dark:text-ink-400">
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

        {/* Install app (PWA) — only offered when the browser allows it */}
        {canInstall && (
          <div className={theme.panel.surface}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink-950 dark:text-white">
                  {isDE ? 'App installieren' : 'Install App'}
                </h2>
                <p className="mt-1 text-body text-ink-500 dark:text-ink-400">
                  {isDE
                    ? 'MeroDeutsch als App auf deinem Gerät installieren — funktioniert auch offline.'
                    : 'Install MeroDeutsch on your device — works offline too.'}
                </p>
              </div>
              <button type="button" onClick={() => void promptInstall()} className={theme.button.primary}>
                {isDE ? '📲 Installieren' : '📲 Install'}
              </button>
            </div>
          </div>
        )}

        {/* AI companion — PERSONAL toggle only.
            The server URL, model, personality, language mix and the proactive
            nudge are global defaults now, published through `app_config` by the
            control centre's Chatbot page and read at boot by
            `src/data/chatbot/`. This panel keeps exactly the one decision that is
            genuinely per-learner. */}
        {CHATBOT_ENABLED && (
          <div className={theme.panel.surface}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink-950 dark:text-white">
                  {isDE ? 'KI-Begleiter (Mero)' : 'AI Companion (Mero)'}
                </h2>
                <p className="mt-1 text-body text-ink-500 dark:text-ink-400">
                  {isDE
                    ? 'Läuft vollständig auf deinem Rechner über Ollama oder LM Studio. Nichts wird hochgeladen.'
                    : 'Runs entirely on your own machine via Ollama or LM Studio. Nothing is uploaded.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChatSettings({ enabled: !chatSettings.enabled })}
                aria-pressed={chatSettings.enabled}
                className={
                  chatSettings.enabled ? theme.button.toggleActive : theme.button.toggleInactive
                }
              >
                {chatSettings.enabled ? (isDE ? 'Aktiv' : 'On') : (isDE ? 'Aus' : 'Off')}
              </button>
            </div>

            {/* The admin's global switch, stated plainly rather than shown as a
                dead control. This toggle still holds the learner's own choice, so
                it is not overwritten — the companion returns when the admin
                re-enables it, without the learner having touched anything. */}
            {!adminEnabled && (
              <p
                className="mt-4 rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-meta text-ink-600 dark:border-ink-700 dark:bg-ink-800/50 dark:text-ink-300"
                role="status"
              >
                {isDE
                  ? 'Mero ist derzeit für alle deaktiviert. Deine Einstellung bleibt gespeichert.'
                  : 'Mero is currently switched off for everyone. Your own setting is saved and will be used again.'}
              </p>
            )}

            {/* A read-only status line, so a lone toggle is not a black box. It
                reports whether the configured server answers; nothing here can
                change the configuration. */}
            {companionActive && (
              <div
                className={`mt-4 rounded-md border px-3 py-2 text-meta ${
                  chatStatus.reachable
                    ? 'border-success-200 bg-success-50 text-success-700 dark:border-success-900 dark:bg-success-900/30 dark:text-success-300'
                    : 'border-warning-200 bg-warning-50 text-warning-800 dark:border-warning-800/50 dark:bg-warning-950/40 dark:text-warning-200'
                }`}
              >
                <span className="font-semibold">{serverLabel(chatStatus)}</span> —{' '}
                {statusHint(chatStatus)}
              </div>
            )}
          </div>
        )}

        {/* Reset the A1 COURSE only.
            Distinct from the full reset below because "restart the course but
            keep my XP and streak" is a real request — the full reset throws
            away the streak and badges that motivate someone to retry. Uses the
            path hook's own resetPath(), which writes through Dexie AND the
            cloud, so it cannot half-happen. */}
        <div className={theme.panel.surface}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink-950 dark:text-white">
                {isDE ? 'A1-Kurs neu starten' : 'Restart the A1 course'}
              </h2>
              <p className="mt-1 text-body text-ink-500 dark:text-ink-400">
                {isDE
                  ? 'Setzt Module, Prüfungen und Modul-Bestwerte zurück — XP, Serie und Abzeichen bleiben erhalten.'
                  : 'Resets your modules, checkpoints and module scores. XP, streak and badges are kept.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetCourse}
              disabled={resettingCourse}
              className={`${theme.button.secondary} disabled:opacity-50`}
            >
              {resettingCourse
                ? (isDE ? 'Setze zurück…' : 'Resetting…')
                : confirmResetCourse
                ? (isDE ? 'Wirklich neu starten?' : 'Really restart?')
                : (isDE ? 'Kurs neu starten' : 'Restart course')}
            </button>
          </div>
          {resetCourseMessage && (
            <div className="mt-3 rounded-md border border-success-200 bg-success-50 px-4 py-2 text-body font-medium text-success-700 dark:border-success-900 dark:bg-success-900/30 dark:text-success-300">
              {resetCourseMessage}
            </div>
          )}
        </div>

        {/* Reset progress */}
        <div className={`${theme.panel.surface} border-danger-200 dark:border-danger-900/40`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-danger-600 dark:text-danger-400">
                {isDE ? 'Fortschritt zurücksetzen' : 'Reset Progress'}
              </h2>
              <p className="mt-1 text-body text-ink-500 dark:text-ink-400">
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
            <div className="mt-3 rounded-md border border-success-200 bg-success-50 px-4 py-2 text-body font-medium text-success-700 dark:border-success-900 dark:bg-success-900/30 dark:text-success-300">
              {resetMessage}
            </div>
          )}
        </div>

        {/* Account */}
        <div className={theme.panel.surface}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink-950 dark:text-white">
                {isDE ? 'Konto' : 'Account'}
              </h2>
              <p className="mt-1 text-body text-ink-500 dark:text-ink-400">
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

        {/* Administrator entry. Self-gates on `profiles.role` and renders
            NOTHING for a non-admin, so it is absent from the DOM rather than
            merely hidden. In guest simulation it disappears too, because
            `useAuth` reports no user and the role cannot be resolved. */}
        <AdminPanelLink />

        {/* NOTE: the QA mode simulator is NOT here. It lives in the control center
            (`admin.merodeutsch…`) and reaches this app through `?adminmode=` plus
            a `postMessage` bridge, both of which verify `profiles.role` first.
            Putting a tier override in learner Settings would expose a
            premium/guest switch to every account. See `src/lib/debugModeLink.ts`
            and `src/lib/qaBridge.ts`. */}

        {/* Support links.
            `inline-flex min-h-11 items-center` on each link: these measured 24px
            tall on a phone, and an inline run of three text links is exactly the
            pattern where adjacent tap targets are hard to hit without a 44px
            box. The row keeps `flex-wrap` so nothing reflows when a German
            label runs long. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-body">
          <Link
            to="/help"
            className="inline-flex min-h-11 items-center text-accent-600 hover:text-accent-800 dark:text-accent-300 dark:hover:text-accent-200"
          >
            {isDE ? 'Hilfe & FAQ' : 'Help & FAQ'}
          </Link>
          <Link
            to="/privacy"
            className="inline-flex min-h-11 items-center text-accent-600 hover:text-accent-800 dark:text-accent-300 dark:hover:text-accent-200"
          >
            {isDE ? 'Datenschutz' : 'Privacy'}
          </Link>
          <Link
            to="/terms"
            className="inline-flex min-h-11 items-center text-accent-600 hover:text-accent-800 dark:text-accent-300 dark:hover:text-accent-200"
          >
            {isDE ? 'Nutzungsbedingungen' : 'Terms'}
          </Link>
        </div>
      </div>
    </div>
  );
}