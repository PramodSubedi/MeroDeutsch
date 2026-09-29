/**
 * src/admin/pages/ChatbotSettingsPage.tsx
 *
 * The global configuration for the AI companion.
 *
 * ── WHAT THIS PAGE IS AND IS NOT ─────────────────────────────────────────────
 * It sets the DEFAULTS every learner starts from, and one global on/off. It does
 * not set any individual's companion: a learner's own choices live in their
 * per-user localStorage and are never overwritten by anything written here.
 *
 * That distinction is why the page says so in its header. An admin who believes
 * this page reaches into a learner's settings will reasonably expect a change to
 * apply to everyone immediately, and will be right about everything except that.
 *
 * ── THE WRITE IS AN ESCALATED ONE ────────────────────────────────────────────
 * `app_config` is public-read and service-role-write, so saving goes through
 * `runAdminAction({action:'config.set'})` like ban and promote. The result is
 * rendered through `AdminActionResult.message`, which is deliberately explicit
 * about partial application and unreadable responses — a config write that
 * reports success when it 400'd, or failure when the browser merely blocked the
 * reply, sends an operator to entirely the wrong layer.
 *
 * ── WHY ONE CROSS-KEY RULE LIVES HERE ────────────────────────────────────────
 * "The default model must appear in the allowed list" cannot be enforced by
 * `validateConfigWrite`, which sees one key and one spec and has no access to the
 * current state of another. It is enforced here instead, and the disabled Save
 * button says which rule was broken rather than going silently dead.
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bot, RefreshCw, Save } from 'lucide-react';
import { theme } from '../../config/theme';
import { KpiCard } from '../components/KpiCard';
import { runAdminAction, type AdminActionResult } from '../data/adminActions';
import {
  fetchChatbotConfig,
  formatAllowedModelsField,
  parseAllowedModelsField,
  validateDefaultModel,
} from '../data/chatbotConfig';
import { CHATBOT_KEYS, UNRESTRICTED_MODELS_SENTINEL } from '../../data/chatbot/config';
import type { LanguageMix, PersonalityIntensity } from '../../types/chatbot';

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
  baseUrl: string;
  model: string;
  allowedModelsField: string;
  intensity: PersonalityIntensity;
  languageMix: LanguageMix;
  autoOpen: boolean;
}

/**
 * The text fields that are EDITED and SAVED, as opposed to chosen from a fixed
 * set.
 *
 * This is the second half of the `SaveButton` contract, and it is the half that
 * was missing. `SaveButton` renders only when `draftValue !== savedValue`, so a
 * caller has to be able to say what the LAST SAVED value was — not what the form
 * currently shows. Every call site passed `draft.<field>` for both props, which
 * is trivially equal, so the button returned `null` on every render and
 * `chatbot_base_url`, `chatbot_allowed_models` and `chatbot_default_model` could
 * not be saved at all. The values below are written ONLY by `load()` and by a
 * successful save, which is what makes the comparison mean "edited".
 */
type TextDraftKey = 'baseUrl' | 'allowedModelsField' | 'model';
type SavedText = Record<TextDraftKey, string>;

const EMPTY_TEXT: SavedText = { baseUrl: '', allowedModelsField: '', model: '' };

function textOf(draft: Draft): SavedText {
  return {
    baseUrl: draft.baseUrl,
    allowedModelsField: draft.allowedModelsField,
    model: draft.model,
  };
}

const toggleClass = (on: boolean) => (on ? theme.button.toggleActive : theme.button.toggleInactive);

export function ChatbotSettingsPage() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [result, setResult] = useState<AdminActionResult | null>(null);
  // The last values known to be STORED. Distinct from `draft`, which is what the
  // form currently shows. See `SavedText`.
  const [saved, setSaved] = useState<SavedText>(EMPTY_TEXT);

  const load = useCallback(async () => {
    setLoading(true);
    const read = await fetchChatbotConfig();
    setReadError(read.error);
    setSeeded(read.seeded);
    if (!read.error) {
      const next: Draft = {
        enabled: read.current.enabled,
        baseUrl: read.current.baseUrl,
        model: read.current.model,
        allowedModelsField: formatAllowedModelsField(read.current.allowedModels),
        intensity: read.current.intensity,
        languageMix: read.current.languageMix,
        autoOpen: read.current.autoOpenOnMistake,
      };
      setDraft(next);
      // A successful read IS the definition of "saved" — the form was just
      // populated from storage, so nothing is edited.
      setSaved(textOf(next));
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
      <div className="space-y-4">
        <h1 className={theme.page.heading}>Chatbot</h1>
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

  const allowed = parseAllowedModelsField(draft.allowedModelsField);
  const modelCheck = validateDefaultModel(draft.model, allowed);
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
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={theme.type.kicker}>Configuration</p>
          <h1 className={theme.page.heading}>Chatbot</h1>
          <p className={theme.page.description}>
            Global defaults for Mero, the AI companion. These seed every learner and anyone who has
            not overridden a value — they never overwrite a choice someone has already made.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className={theme.button.secondary}
          disabled={loading || busy}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

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
        <KpiCard
          label="Default model"
          value={draft.model}
          hint="seeded for new learners"
          loading={loading}
        />
        <KpiCard
          label="Allowed models"
          value={allowed.length === 0 ? 'Any' : String(allowed.length)}
          hint={allowed.length === 0 ? 'unrestricted' : allowed.join(', ')}
          loading={loading}
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

        <Field label="Server URL" code={CHATBOT_KEYS.baseUrl} hint="Where the companion looks for Ollama or LM Studio.">
          <input
            type="text"
            inputMode="url"
            value={draft.baseUrl}
            onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
            disabled={busy}
            className={`${theme.input} mt-1.5`}
          />
          <SaveButton
            busyKey={busyKey}
            currentKey={CHATBOT_KEYS.baseUrl}
            draftValue={draft.baseUrl}
            savedValue={saved.baseUrl}
            disabled={draft.baseUrl.trim() === ''}
            onSave={(v) => void save(CHATBOT_KEYS.baseUrl, v, `Default server URL set to ${v}`)}
          />
        </Field>

        <Field
          label="Allowed models"
          code={CHATBOT_KEYS.allowedModels}
          hint="Comma-separated. Empty means any model is permitted. It constrains what may be chosen as the default below — it does not filter the models a learner sees, because those come from their own machine."
        >
          <input
            type="text"
            value={draft.allowedModelsField}
            onChange={(e) => setDraft({ ...draft, allowedModelsField: e.target.value })}
            disabled={busy}
            placeholder="qwen2.5:3b, llama3.2:3b"
            className={`${theme.input} mt-1.5`}
          />
          <SaveButton
            busyKey={busyKey}
            currentKey={CHATBOT_KEYS.allowedModels}
            draftValue={draft.allowedModelsField}
            savedValue={saved.allowedModelsField}
            disabled={false}
            onSave={(v) => {
              const list = parseAllowedModelsField(v);
              // An empty list is a legitimate value meaning "unrestricted", but
              // `validateConfigWrite` refuses a blank string for every string
              // key. Writing an explicit sentinel is the honest way to express it
              // without teaching the validator a special case — and the reader
              // recognises that sentinel, in `src/data/chatbot/config.ts`.
              //
              // The previous comment here claimed "the reader treats a single
              // unrecognised entry as unrestricted anyway". That was false:
              // `isModelAllowed` compares against the list, so a stored `any`
              // restricted every learner to a model literally named `any`, and
              // the admin's own default-model save then refused every real model.
              void save(
                CHATBOT_KEYS.allowedModels,
                list.length === 0 ? UNRESTRICTED_MODELS_SENTINEL : list.join(', '),
                list.length === 0
                  ? 'Model allow-list cleared (any model permitted)'
                  : `Allowed models set to ${list.join(', ')}`,
              );
            }}
          />
        </Field>

        <Field
          label="Default model"
          code={CHATBOT_KEYS.defaultModel}
          hint="Must appear in the allowed list above, unless that list is empty."
        >
          <input
            type="text"
            value={draft.model}
            onChange={(e) => setDraft({ ...draft, model: e.target.value })}
            disabled={busy}
            className={`${theme.input} mt-1.5`}
          />
          {/* The cross-key rule, enforced here because the server cannot be. */}
          {!modelCheck.ok && (
            <p
              className="mt-1.5 flex items-start gap-1.5 text-meta text-warning-700 dark:text-warning-300"
              role="status"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {modelCheck.message}
            </p>
          )}
          <SaveButton
            busyKey={busyKey}
            currentKey={CHATBOT_KEYS.defaultModel}
            draftValue={draft.model}
            savedValue={saved.model}
            disabled={!modelCheck.ok}
            onSave={(v) => void save(CHATBOT_KEYS.defaultModel, v, `Default model set to ${v}`)}
          />
        </Field>

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
function SaveButton({
  busyKey,
  currentKey,
  draftValue,
  savedValue,
  disabled,
  onSave,
}: {
  busyKey: string | null;
  currentKey: string;
  draftValue: string;
  savedValue: string;
  disabled: boolean;
  onSave: (value: string) => void;
}) {
  if (draftValue === savedValue) return null;
  return (
    <button
      type="button"
      onClick={() => onSave(draftValue)}
      disabled={disabled || busyKey !== null}
      title={disabled ? 'Fix the problem above before saving' : undefined}
      className={`mt-1.5 ${theme.button.primary} disabled:opacity-50`}
    >
      <Save className="h-4 w-4" aria-hidden="true" />
      {busyKey === currentKey ? 'Saving…' : 'Save'}
    </button>
  );
}

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
