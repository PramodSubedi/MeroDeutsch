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
import { resetFormatCache, resolveModel } from '../lib/ollamaClient';
import { AdminPanelLink } from '../components/debug/AdminPanelLink';
import {
  CHATBOT_ENABLED,
  INTENSITY_OPTIONS,
  LANGUAGE_MIX_OPTIONS,
  PREFERENCE_OPTIONS,
  normalizeBaseUrl,
} from '../config/chatbot';

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
  // The base URL is runtime-overridable rather than env-only: `import.meta.env`
  // is baked at build time, so a deployed build could never be re-pointed at a
  // learner's own machine without a rebuild.
  const chatSettings = useChatStore((s) => s.settings);
  const setChatSettings = useChatStore((s) => s.setSettings);
  const chatStatus = useChatStore((s) => s.status);
  const setChatStatus = useChatStore((s) => s.setStatus);
  const togglePreference = useChatStore((s) => s.togglePreference);
  const [urlDraft, setUrlDraft] = useState(chatSettings.baseUrl);
  const [probing, setProbing] = useState(false);

  const probeModels = async (rawUrl: string) => {
    setProbing(true);
    // A changed URL invalidates the negotiated wire format (Ollama vs
    // LM Studio), so the cache must be dropped before probing.
    resetFormatCache();
    const next = await healthCheck(rawUrl);
    setChatStatus(next);
    setChatSettings({
      baseUrl: rawUrl,
      // If the configured model is not installed, snap to one that is.
      ...(next.reachable && next.models.length
        ? { model: resolveModel(chatSettings.model, next.models) }
        : {}),
    });
    setProbing(false);
  };

  // Probe once on mount so the page opens with an accurate status instead of
  // an optimistic green dot the learner has to disprove.
  useEffect(() => {
    void (async () => {
      resetFormatCache();
      setChatStatus(await healthCheck(chatSettings.baseUrl));
    })();
    // Intentionally mount-only: re-probing on every settings change would
    // fire a request per keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

        {/* AI companion — local-first. The URL/model are editable at RUNTIME
            (not env-only) because a deployed build cannot be re-pointed at a
            learner's own machine without a rebuild. */}
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
                className={
                  chatSettings.enabled ? theme.button.toggleActive : theme.button.toggleInactive
                }
              >
                {chatSettings.enabled ? (isDE ? 'Aktiv' : 'On') : (isDE ? 'Aus' : 'Off')}
              </button>
            </div>

            {chatSettings.enabled && (
              <div className="mt-4 space-y-4">
                <div
                  className={`rounded-md border px-3 py-2 text-meta ${
                    chatStatus.reachable
                      ? 'border-success-200 bg-success-50 text-success-700 dark:border-success-900 dark:bg-success-900/30 dark:text-success-300'
                      : 'border-warning-200 bg-warning-50 text-warning-800 dark:border-warning-800/50 dark:bg-warning-950/40 dark:text-warning-200'
                  }`}
                >
                  <span className="font-semibold">{serverLabel(chatStatus)}</span> —{' '}
                  {statusHint(chatStatus)}
                </div>

                <div>
                  <label
                    htmlFor="mero-base-url"
                    className="block text-body font-semibold text-ink-700 dark:text-ink-300"
                  >
                    {isDE ? 'Server-Adresse' : 'Server URL'}
                  </label>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <input
                      id="mero-base-url"
                      type="text"
                      inputMode="url"
                      value={urlDraft}
                      onChange={(e) => setUrlDraft(e.target.value)}
                      placeholder="http://localhost:11434"
                      className="min-h-[44px] flex-1 rounded-md border border-ink-200 bg-white px-3 py-2 text-body text-ink-900 focus-visible:border-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/30 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-100"
                    />
                    <button
                      type="button"
                      onClick={() => void probeModels(normalizeBaseUrl(urlDraft))}
                      disabled={probing}
                      className={`${theme.button.secondary} disabled:opacity-50`}
                    >
                      {probing
                        ? (isDE ? 'Prüfe…' : 'Testing…')
                        : (isDE ? 'Verbindung testen' : 'Test connection')}
                    </button>
                  </div>
                </div>

                {chatStatus.models.length > 0 && (
                  <div>
                    <label
                      htmlFor="mero-model"
                      className="block text-body font-semibold text-ink-700 dark:text-ink-300"
                    >
                      {isDE ? 'Modell' : 'Model'}
                    </label>
                    <select
                      id="mero-model"
                      value={chatSettings.model}
                      onChange={(e) => setChatSettings({ model: e.target.value })}
                      className="mt-1.5 min-h-[44px] w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-body text-ink-900 focus-visible:border-accent-500 focus-visible:outline-none dark:border-ink-800 dark:bg-ink-900 dark:text-ink-100"
                    >
                      {chatStatus.models.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {/* personality */}
                <div>
                  <p className="text-body font-semibold text-ink-700 dark:text-ink-300">
                    {isDE ? 'Ton' : 'Tone'}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {INTENSITY_OPTIONS.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setChatSettings({ intensity: o.id })}
                        className={
                          chatSettings.intensity === o.id
                            ? theme.button.toggleActive
                            : theme.button.toggleInactive
                        }
                      >
                        {isDE ? o.de : o.en}
                      </button>
                    ))}
                  </div>
                </div>

                {/* language mix */}
                <div>
                  <p className="text-body font-semibold text-ink-700 dark:text-ink-300">
                    {isDE ? 'Sprachmix' : 'Language mix'}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {LANGUAGE_MIX_OPTIONS.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setChatSettings({ languageMix: o.id })}
                        className={
                          chatSettings.languageMix === o.id
                            ? theme.button.toggleActive
                            : theme.button.toggleInactive
                        }
                      >
                        {o.en}
                      </button>
                    ))}
                  </div>
                </div>

                {/* proactive nudge */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-body text-ink-500 dark:text-ink-400">
                    {isDE
                      ? 'Mero vorschlagen, wenn ein Wort 3+ Mal falsch war.'
                      : 'Suggest Mero when a word has been missed 3+ times.'}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setChatSettings({ autoOpenOnMistake: !chatSettings.autoOpenOnMistake })
                    }
                    className={
                      chatSettings.autoOpenOnMistake
                        ? theme.button.toggleActive
                        : theme.button.toggleInactive
                    }
                  >
                    {chatSettings.autoOpenOnMistake
                      ? (isDE ? 'An' : 'On')
                      : (isDE ? 'Aus' : 'Off')}
                  </button>
                </div>

                {/* Style preferences — injected into every system prompt. */}
                <div>
                  <p className="text-body font-semibold text-ink-700 dark:text-ink-300">
                    {isDE ? 'Stil-Vorlieben' : 'Style preferences'}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {PREFERENCE_OPTIONS.map((p) => {
                      const active = (chatSettings.preferences ?? []).includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePreference(p.id)}
                          aria-pressed={active}
                          title={p.hint}
                          className={
                            active ? theme.button.toggleActive : theme.button.toggleInactive
                          }
                        >
                          {isDE ? p.de : p.en}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* CORS — the #1 reason this does not work in production */}
                <p className="rounded-md bg-ink-50 px-3 py-2 text-meta text-ink-600 dark:bg-ink-800/50 dark:text-ink-400">
                  {isDE
                    ? 'Läuft die Seite über HTTPS, blockiert der Browser die Verbindung. Starte den Server dann mit: OLLAMA_ORIGINS="https://deine-domain" ollama serve'
                    : 'If the site is served over HTTPS, the browser blocks the connection. Start the server with: OLLAMA_ORIGINS="https://your-domain" ollama serve'}
                </p>
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

        {/* Support links */}
        <div className="flex flex-wrap gap-3 pt-2 text-body">
          <Link to="/help" className="text-accent-600 hover:text-accent-800 dark:text-accent-300 dark:hover:text-accent-200">
            {isDE ? 'Hilfe & FAQ' : 'Help & FAQ'}
          </Link>
          <Link to="/privacy" className="text-accent-600 hover:text-accent-800 dark:text-accent-300 dark:hover:text-accent-200">
            {isDE ? 'Datenschutz' : 'Privacy'}
          </Link>
          <Link to="/terms" className="text-accent-600 hover:text-accent-800 dark:text-accent-300 dark:hover:text-accent-200">
            {isDE ? 'Nutzungsbedingungen' : 'Terms'}
          </Link>
        </div>
      </div>
    </div>
  );
}