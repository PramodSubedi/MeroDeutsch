/** Global settings for the Mero companion. */
import { useCallback, useEffect, useState } from 'react';
import { Bot, RefreshCw } from 'lucide-react';
import { theme } from '../../config/theme';
import { KpiCard } from '../components/KpiCard';
import { runAdminAction, type AdminActionResult } from '../data/adminActions';
import { fetchChatbotConfig } from '../data/chatbotConfig';
import { CHATBOT_KEYS } from '../../data/chatbot/config';
import type { LanguageMix, PersonalityIntensity } from '../../types/chatbot';
import { AdminPageHeader } from '../components/AdminPageHeader';

const INTENSITIES: ReadonlyArray<{ id: PersonalityIntensity; label: string }> = [
  { id: 'serious', label: 'Serious — just the grammar' },
  { id: 'balanced', label: 'Balanced — a little cheeky' },
  { id: 'playful', label: 'Playful — maximum teasing' },
];

const LANGUAGE_MIXES: ReadonlyArray<{ id: LanguageMix; label: string }> = [
  { id: 'de_en', label: 'Deutsch + English' },
  { id: 'de_en_ne', label: 'Deutsch + English + नेपाली' },
];

/**
 * The editable draft, separate from the read model so a failed read cannot
 * silently overwrite what an admin has already typed.
 */
interface Draft {
  enabled: boolean;
  intensity: PersonalityIntensity;
  languageMix: LanguageMix;
  autoOpen: boolean;
}

const toggleClass = (on: boolean) => (on ? theme.button.toggleActive : theme.button.toggleInactive);

export function ChatbotSettingsPage() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [result, setResult] = useState<AdminActionResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const read = await fetchChatbotConfig();
    setReadError(read.error);
    setSeeded(read.seeded);
    if (!read.error) {
      const next: Draft = {
        enabled: read.current.enabled,
        intensity: read.current.intensity,
        languageMix: read.current.languageMix,
        autoOpen: read.current.autoOpenOnMistake,
      };
      setDraft(next);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !draft) {
    return <p className="py-10 text-center text-body text-ink-500 dark:text-ink-400">Loading…</p>;
  }

  if (!draft) {
    return (
      <div className="admin-page space-y-4">
        <AdminPageHeader eyebrow="Configuration / companion" title="Mero companion" description="The current companion configuration could not be read." />
        <div
          className="rounded-md border border-danger-200 bg-danger-50 p-4 text-body text-danger-800 dark:border-danger-900 dark:bg-danger-950/40 dark:text-danger-200"
          role="alert"
        >
          <p className="font-semibold">The current configuration could not be read</p>
          <p className="mt-1 text-meta">
            {readError ?? 'app_config did not answer.'} Nothing is editable until the current values
            are known — writing over a state you could not read is how a flag gets lost.
          </p>
          <button type="button" onClick={() => void load()} className={`${theme.button.secondary} mt-3`}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  const busy = busyKey !== null;

  /**
   * Write ONE key, then re-read.
   *
   * One key per action rather than a bulk "save all": the response vocabulary is
   * per-call, so a single write gives a single unambiguous outcome. A bulk write
   * that half-applies returns 207, and an operator who saves five fields and is
   * told "done" when two landed has no way to tell which two.
   */
  async function save(key: string, value: string | boolean, reason: string): Promise<void> {
    setBusyKey(key);
    setResult(null);
    const r = await runAdminAction({ action: 'config.set', config: { key, value }, reason });
    // Re-read on success only. On failure the draft on screen is still what the
    // admin intended, which is what they need in order to retry it.
    //
    // `busyKey` is cleared AFTER the re-read, not before. Clearing it first
    // re-enabled every control while `load()` was still in flight, so a second
    // click could be sent against a `saved` snapshot that had not been updated
    // yet — and the Save button would be comparing the draft against the
    // pre-write value it had just replaced.
    if (r.ok) await load();
    setBusyKey(null);
    setResult(r);
  }

  /* ── the availability switch ── */
  return (
    <div className="admin-page space-y-7">
      <AdminPageHeader
        eyebrow="Configuration / companion"
        title="Mero companion"
        description="Global defaults for Mero. These seed learners who have not overridden a value; they never overwrite personal settings."
        actions={<button
          type="button"
          onClick={() => void load()}
          className="admin-refresh-button"
          disabled={loading || busy}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          {loading ? 'Loading…' : 'Refresh'}
        </button>}
      />

      {!seeded && (
        <p
          className="rounded-md border border-ink-200 bg-ink-50 p-4 text-body text-ink-600 dark:border-ink-700 dark:bg-ink-800/50 dark:text-ink-300"
          role="status"
        >
          No <code className="font-mono">chatbot_*</code> rows exist yet, so the values below are the
          ones shipped in the app. Saving any of them creates its row.
        </p>
      )}

      <ResultBanner result={result} />

      <section aria-label="Current state" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Companion"
          value={draft.enabled ? 'Enabled' : 'Disabled'}
          hint={CHATBOT_KEYS.enabled}
          icon={Bot}
          loading={loading}
          tone={draft.enabled ? 'good' : 'bad'}
        />
      </section>

      <section className="rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
        <h2 className={theme.type.section}>Availability</h2>
        <p className="mt-1 text-meta text-ink-500 dark:text-ink-400">
          Turning this off hides the companion for everyone immediately. Each learner's own on/off
          choice is kept, so switching it back on restores what they had.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() =>
              void save(
                CHATBOT_KEYS.enabled,
                !draft.enabled,
                `Companion ${draft.enabled ? 'disabled' : 'enabled'}`,
              )
            }
            disabled={busy}
            className={toggleClass(draft.enabled)}
          >
            {busyKey === CHATBOT_KEYS.enabled
              ? 'Saving…'
              : draft.enabled
                ? 'Enabled for everyone'
                : 'Disabled for everyone'}
          </button>
          <span className="text-meta text-ink-500 dark:text-ink-400">
            <code className="font-mono">{CHATBOT_KEYS.enabled}</code>
          </span>
        </div>
      </section>

      {/* ── the defaults ── */}
      <section className="space-y-4 rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
        <h2 className={theme.type.section}>Defaults for new learners</h2>

        <Field label="Personality" code={CHATBOT_KEYS.intensity}>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {INTENSITIES.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => void save(CHATBOT_KEYS.intensity, o.id, `Default intensity set to ${o.id}`)}
                disabled={busy}
                className={toggleClass(draft.intensity === o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Helper language mix" code={CHATBOT_KEYS.languageMix}>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {LANGUAGE_MIXES.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => void save(CHATBOT_KEYS.languageMix, o.id, `Default language mix set to ${o.id}`)}
                disabled={busy}
                className={toggleClass(draft.languageMix === o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </Field>
        <Field
          label="Open itself after repeated mistakes"
          code={CHATBOT_KEYS.autoOpen}
          hint="Whether Mero offers help unprompted once a word has been missed several times."
        >
          <button
            type="button"
            onClick={() =>
              void save(
                CHATBOT_KEYS.autoOpen,
                !draft.autoOpen,
                `Auto-open ${draft.autoOpen ? 'disabled' : 'enabled'}`,
              )
            }
            disabled={busy}
            className={`mt-1.5 ${toggleClass(draft.autoOpen)}`}
          >
            {draft.autoOpen ? 'On by default' : 'Off by default'}
          </button>
        </Field>
      </section>

      <p className="text-meta text-ink-500 dark:text-ink-400">
        Every change is written to <code className="font-mono">app_config</code> and recorded in the
        audit log. Learners pick up the new defaults the next time they load the app.
      </p>
    </div>
  );
}

/* ── presentational pieces ─────────────────────────────────────────────────── */

function Field({
  label,
  hint,
  code,
  children,
}: {
  label: string;
  hint?: string;
  code: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-ink-100 pt-4 first:border-t-0 first:pt-0 dark:border-ink-800/60">
      <p className="text-body font-semibold text-ink-800 dark:text-ink-100">{label}</p>
      <p className="text-micro text-ink-400">
        <code className="font-mono">{code}</code>
      </p>
      {hint ? <p className="mt-1 text-meta text-ink-500 dark:text-ink-400">{hint}</p> : null}
      <div className="mt-1 max-w-xl">{children}</div>
    </div>
  );
}

/**
 * A save button that only appears when the field has actually been edited.
 *
 * Two reasons. A permanently-enabled Save writes a value identical to the stored
 * one, which fills the audit log with no-op rows and makes "who changed this, and
 * when" useless. And a button that is always there invites the assumption that a
 * draft is being held somewhere — which, without a dirty-tracking store, it is
 * not. The edited value IS the draft; nothing is buffered.
 */

/**
 * The action result, rendered honestly.
 *
 * `AdminActionResult` distinguishes applied / partial / refused / rejected /
 * not-implemented / failed / unreadable / unreachable, and `message` is
 * operator-facing by contract. Showing anything else — a generic "saved", or a
 * green tick derived from a truthy response — is exactly the failure the
 * interpreter's own documentation warns about.
 */
function ResultBanner({ result }: { result: AdminActionResult | null }) {
  if (!result) return null;
  return (
    <p
      role="status"
      className={`rounded-md border p-3 text-body ${
        result.ok
          ? 'border-success-200 bg-success-50 text-success-800 dark:border-success-900 dark:bg-success-950/30 dark:text-success-200'
          : 'border-danger-200 bg-danger-50 text-danger-800 dark:border-danger-900 dark:bg-danger-950/30 dark:text-danger-200'
      }`}
    >
      <span className="font-semibold">{result.ok ? 'Saved' : 'Not saved'}</span>{' '}
      <span className="text-meta">{result.message}</span>
    </p>
  );
}
