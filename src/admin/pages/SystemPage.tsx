/**
 * src/admin/pages/SystemPage.tsx
 *
 * Operational health: table row counts and feature flags.
 *
 * ── WHY ROW COUNTS COME FROM A FUNCTION, NOT `pg_class` ─────────────────────
 * Exact counts are reported by a SECURITY DEFINER database function rather than
 * estimated from `pg_class.reltuples`, which is a planner approximation that can
 * be wildly stale on a small database (and is -1 on a table never analysed). An
 * admin tool that says "about 1000" when the answer is 1062 is not worth the
 * screen space. SECURITY DEFINER lets it count every table while exposing nothing
 * else; RLS still gates WHICH admin may call it, and it only returns numbers.
 *
 * ── WHY FLAGS ARE READ-ONLY ────────────────────────────────────────────────
 * `app_config` is public-read (so the learner app can honour maintenance mode
 * before sign-in) and its writes are service-role only. Toggling a flag needs a
 * privileged function, same as ban/promote.
 */
import { useCallback, useEffect, useState } from 'react';
import { Activity, Database, Flag, RefreshCw, ScrollText, Megaphone, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { theme } from '../../config/theme';
import { KpiCard } from '../components/KpiCard';
import { runAdminAction, type AdminActionResult } from '../data/adminActions';
import {
  ANNOUNCEMENT_BANNER_KEY,
  CONFIG_KEYS,
  isBooleanConfigKey,
  readAnnouncementBanner,
  validateAnnouncementBanner,
  type AnnouncementBanner,
} from '../../shared/configKeys';

interface TableCount {
  table_name: string;
  row_count: number;
}

/** The tables the control centre watches, in the order an admin reads them. */
const WATCHED_TABLES = [
  'profiles',
  'user_xp',
  'user_streaks',
  'user_progress',
  'user_achievements',
  'user_activity_days',
  'a1_path_state',
  'review_queue',
  'vocabulary',
  'sentences',
  'content_items',
  'curriculum_versions',
  'admin_audit_log',
  'app_config',
];

interface AppFlag {
  key: string;
  value: unknown;
  updated_at: string | null;
}

export type { AnnouncementBanner };

/**
 * The banner's stored row, read into editor state.
 *
 * Previously this was inlined four times in the component as a
 * `value && typeof value === 'object' && value !== null` guard, which is exactly
 * the sort of repetition that lets a panel forget to handle the case at all.
 * The coercion itself lives in `shared/configKeys.ts` beside the validator, so
 * the reader and the writer are looking at the same definition of the shape.
 */
function bannerFromFlags(flags: AppFlag[]): AnnouncementBanner {
  return readAnnouncementBanner(flags.find((f) => f.key === ANNOUNCEMENT_BANNER_KEY)?.value);
}

/** Announcement banner editor. */
function AnnouncementBannerPanel({
  flags,
  loaded,
  onAction,
}: {
  flags: AppFlag[];
  loaded: boolean;
  onAction: (key: string, value: boolean, reason: string) => void;
}) {
  // ── WHY THE STATE IS A SYNCED DRAFT, NOT A SEED ─────────────────────────────
  // This panel used to seed four `useState` values from `flags` and nothing else.
  // It mounts while `flags` is still `[]` — the parent's `load()` is async — so
  // those states were permanently the DEFAULTS. The consequences were all silent:
  //
  //   · a live banner was never shown to the admin editing it
  //   · the button always read "Create banner"
  //   · "Clear" was gated on `text.trim()`, which was always empty, so an
  //     existing banner could not be removed
  //   · saving wrote the blank default over whatever was live
  //
  // The fix is the effect below, plus `loaded` — the panel does not enable its
  // write controls until the read has actually landed. An editor that allows a
  // write before it knows the current value is a data-loss control wearing an
  // editor's clothes.
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [severity, setSeverity] = useState<AnnouncementBanner['severity']>('info');
  const [dismissible, setDismissible] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AdminActionResult | null>(null);

  useEffect(() => {
    if (!loaded) return;
    const banner = bannerFromFlags(flags);
    setText(banner.text);
    setLink(banner.link ?? '');
    setSeverity(banner.severity);
    setDismissible(banner.dismissible);
  }, [loaded, flags]);

  const severityOptions: Array<{ value: AnnouncementBanner['severity']; label: string }> = [
    { value: 'info', label: 'Info' },
    { value: 'warning', label: 'Warning' },
    { value: 'danger', label: 'Danger' },
    { value: 'success', label: 'Success' },
  ];

  /** The exact payload `save` would send — built once, validated, then written. */
  function buildPayload(): AnnouncementBanner {
    const payload: AnnouncementBanner = { text: text.trim(), severity, dismissible };
    if (link.trim()) payload.link = link.trim();
    return payload;
  }

  // The SAME validator the Edge Function runs, imported rather than restated.
  // A rejected link or an over-long message is caught before the round trip, and
  // the operator sees which field is wrong without watching a 400 arrive.
  const payload = buildPayload();
  const problems = loaded ? validateAnnouncementBanner(payload) : ['The current banner has not loaded yet.'];

  async function save() {
    if (problems.length > 0) return;
    setBusy(true);
    setResult(null);
    const r = await runAdminAction({
      action: 'config.set',
      config: { key: ANNOUNCEMENT_BANNER_KEY, value: payload },
      reason: `Announcement banner ${text.trim() ? 'updated' : 'cleared'}`,
    });
    setBusy(false);
    setResult(r);
    if (r.ok) {
      onAction(ANNOUNCEMENT_BANNER_KEY, true, 'Banner updated');
    }
  }

  async function clear() {
    setBusy(true);
    setResult(null);
    const cleared: AnnouncementBanner = { text: '', severity: 'info', dismissible: true };
    const r = await runAdminAction({
      action: 'config.set',
      config: { key: ANNOUNCEMENT_BANNER_KEY, value: cleared },
      reason: 'Announcement banner cleared',
    });
    setBusy(false);
    setResult(r);
    if (r.ok) {
      setText('');
      setLink('');
      setSeverity('info');
      setDismissible(true);
      onAction(ANNOUNCEMENT_BANNER_KEY, true, 'Banner cleared');
    }
  }

  return (
    <section className="rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
      <div className="flex items-center justify-between gap-3">
        <h2 className={theme.type.section}>
          <Megaphone className="mr-1 inline h-5 w-5" aria-hidden="true" />
          Announcement banner
        </h2>
        <span className="text-micro text-ink-400">Public-read, visible before sign-in</span>
      </div>
      <p className="mt-1 text-meta text-ink-500 dark:text-ink-400">
        Show a global banner to all users. Set text to empty to hide.
      </p>
      <div className="mt-4 space-y-3">
        <label className="flex flex-col gap-1">
          <span className="text-label text-ink-600 dark:text-ink-300">Message</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Enter announcement text (Markdown supported by learner app)..."
            className={`min-h-[36px] rounded-md border border-ink-200 bg-white px-2 text-meta font-semibold text-ink-700 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-200 ${theme.input}`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label text-ink-600 dark:text-ink-300">Link (optional)</span>
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://example.com"
            className="min-h-[36px] rounded-md border border-ink-200 bg-white px-2 text-meta font-semibold text-ink-700 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-200"
          />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-label text-ink-600 dark:text-ink-300">Severity</span>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as AnnouncementBanner['severity'])}
              className="min-h-[36px] rounded-md border border-ink-200 bg-white px-2 text-meta font-semibold text-ink-700 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-200"
            >
              {severityOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={dismissible}
              onChange={(e) => setDismissible(e.target.checked)}
              className="h-4 w-4 rounded border-ink-300 text-accent-600 focus:ring-accent-500"
            />
            <span className="text-meta text-ink-700 dark:text-ink-200">Dismissible by users</span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy || !loaded || problems.length > 0}
            className={theme.button.primary}
          >
            {busy ? 'Saving…' : text.trim() ? 'Update banner' : 'Create banner'}
          </button>
          {text.trim() && (
            <button
              type="button"
              onClick={clear}
              disabled={busy}
              className="px-3 py-2 rounded-md border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-200"
            >
              <X className="mr-1 inline h-4 w-4" aria-hidden="true" />
              Clear
            </button>
          )}
        </div>
        {loaded && problems.length > 0 && (
          <p className="text-meta text-danger-700 dark:text-danger-300" role="alert">
            Fix before saving: {problems.join('; ')}
          </p>
        )}
        {result && (
          <p
            role="status"
            className={`text-meta ${
              result.ok
                ? 'text-success-700 dark:text-success-300'
                : 'text-danger-700 dark:text-danger-300'
            }`}
          >
            <span className="font-semibold">{result.ok ? 'Saved. ' : 'Not saved. '}</span>
            {result.message}
          </p>
        )}
      </div>
    </section>
  );
}

/** Inline toggle for a feature flag. */
function FlagToggle({
  flag,
  onAction,
}: {
  flag: AppFlag;
  onAction: (key: string, value: boolean, reason: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AdminActionResult | null>(null);

  // Only ever a boolean key reaches this component: `FlagsPanel` filters on the
  // same allow-list the server validates against. The `'true'` string form is
  // still accepted because a JSONB column unwraps `true`, but a hand-written row
  // can hold the quoted form.
  const currentValue = flag.value === true || flag.value === 'true';

  async function execute() {
    setBusy(true);
    setResult(null);
    const newValue = !currentValue;
    const r = await runAdminAction({
      action: 'config.set',
      config: { key: flag.key, value: newValue },
      reason: reason.trim() || `${flag.key} ${newValue ? 'enabled' : 'disabled'}`,
    });
    setBusy(false);
    setResult(r);
    if (r.ok) {
      setReason('');
      // The popover closes on success — so the RESULT banner is rendered outside
      // it, below. It used to live inside `{confirming && …}`, which meant a
      // successful write closed the only element that could report it and the
      // operator saw nothing at all.
      setConfirming(false);
      onAction(flag.key, newValue, reason);
    }
  }

  return (
    <div className="relative flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={busy}
        className={currentValue ? 'bg-accent-600 text-white' : 'bg-ink-200 text-ink-600 dark:bg-ink-700 dark:text-ink-300'}
        style={{ width: '56px', height: '28px', borderRadius: '9999px', display: 'flex', alignItems: 'center', padding: '0 2px', transition: 'all 0.2s', justifyContent: currentValue ? 'flex-end' : 'flex-start' }}
        aria-label={`${currentValue ? 'Disable' : 'Enable'} ${flag.key}`}
        aria-pressed={currentValue}
      >
        <span className="w-5 h-5 rounded-full bg-white shadow flex-shrink-0" aria-hidden="true" />
      </button>

      {confirming && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => { setConfirming(false); setReason(''); }}
            aria-hidden="true"
          />
          <div className="absolute right-0 z-20 mt-1 min-w-[16rem] rounded-md border border-ink-200 bg-white shadow-lg dark:border-ink-800 dark:bg-ink-900">
            <div className="border-b border-ink-100 p-2 dark:border-ink-800">
              <label className="flex flex-col gap-1">
                <span className="text-micro font-medium text-ink-600 dark:text-ink-400">Reason</span>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is this being changed?"
                  className="min-h-[36px] rounded-md border border-ink-200 bg-white px-2 text-meta font-semibold text-ink-700 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-200"
                />
              </label>
            </div>

            <ul className="py-1" role="menu">
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => execute()}
                  disabled={busy}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-body text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-50"
                >
                  {busy ? 'Saving…' : `Confirm ${currentValue ? 'disable' : 'enable'}`}
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setConfirming(false); setReason(''); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-body text-ink-500 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800"
                >
                  Cancel
                </button>
              </li>
            </ul>
          </div>
        </>
      )}

      {/* Outside the popover, because the popover closes on success. */}
      {result && (
        <p
          role="status"
          className={`max-w-[16rem] text-right text-micro ${
            result.ok ? 'text-success-700 dark:text-success-300' : 'text-danger-700 dark:text-danger-300'
          }`}
        >
          <span className="font-semibold">{result.ok ? 'Saved. ' : 'Not saved. '}</span>
          {result.message}
        </p>
      )}
    </div>
  );
}

export function SystemPage() {
  const [counts, setCounts] = useState<TableCount[]>([]);
  const [flags, setFlags] = useState<AppFlag[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [reloadToken, setReloadToken] = useState(0);

  const handleAction = useCallback((_key: string, _value: boolean, _reason: string) => {
    // Trigger a reload to get fresh data from the server
    setReloadToken((n) => n + 1);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const problems: string[] = [];

    // The RPC may not exist yet (it ships in the migration paired with this
    // page), so a failure degrades to "unavailable" rather than a blank screen.
    const [rpc, config] = await Promise.all([
      supabase.rpc('admin_table_counts' as never),
      supabase.from('app_config').select('key, value, updated_at').order('key'),
    ]);

    if (rpc.error) problems.push(`admin_table_counts: ${rpc.error.message}`);
    else setCounts((rpc.data ?? []) as unknown as TableCount[]);

    if (config.error) problems.push(`app_config: ${config.error.message}`);
    else setFlags((config.data ?? []) as unknown as AppFlag[]);

    setErrors(problems);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  const totalRows = counts.reduce((sum, c) => sum + (c.row_count ?? 0), 0);
  const byName = new Map(counts.map((c) => [c.table_name, c.row_count]));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={theme.type.kicker}>Operations</p>
          <h1 className={theme.page.heading}>System</h1>
          <p className={theme.page.description}>
            Row counts across the public schema, and the feature flags the app reads at boot.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className={theme.button.secondary}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      {errors.length > 0 && <ErrorsPanel errors={errors} />}

      <section aria-label="Totals" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Tables"
          value={String(counts.length)}
          hint="counted"
          icon={Database}
          loading={loading}
        />
        <KpiCard
          label="Total rows"
          value={totalRows.toLocaleString()}
          hint="across watched tables"
          loading={loading}
        />
        <KpiCard
          label="Learners"
          value={(byName.get('profiles') ?? 0).toLocaleString()}
          hint="rows in profiles"
          icon={Activity}
          loading={loading}
        />
        <KpiCard
          label="Flags"
          value={String(flags.length)}
          hint="rows in app_config"
          icon={Flag}
          loading={loading}
        />
      </section>

      <CountPanel counts={byName} />
      <SelfTestPanel />
      <FlagsPanel flags={flags} onAction={handleAction} />
      <AnnouncementBannerPanel flags={flags} loaded={!loading} onAction={handleAction} />
      <MigrationsPanel />
    </div>
  );
}

function ErrorsPanel({ errors }: { errors: string[] }) {
  return (
    <div
      className="rounded-md border border-warning-200 bg-warning-50 p-4 text-body text-warning-900 dark:border-warning-900 dark:bg-warning-950/40 dark:text-warning-200"
      role="status"
    >
      <p className="font-semibold">Some sources could not be read</p>
      <ul className="mt-1 list-inside list-disc text-meta">
        {errors.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
      {errors.some((e) => e.startsWith('admin_table_counts')) && (
        <p className="mt-2 text-meta">
          Row counts come from the <code className="font-mono">admin_table_counts()</code> function.
          Apply the migration that creates it to populate that table.
        </p>
      )}
    </div>
  );
}

function CountPanel({ counts }: { counts: Map<string, number> }) {
  const present = WATCHED_TABLES.filter((name) => counts.has(name));
  return (
    <section className="rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
      <h2 className={theme.type.section}>Table row counts</h2>
      {present.length === 0 ? (
        <p className="mt-3 text-meta text-ink-500 dark:text-ink-400">No counts available yet.</p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
          {present.map((name) => (
            <div
              key={name}
              className="flex items-baseline justify-between gap-3 border-b border-ink-100 py-1 dark:border-ink-800/60"
            >
              <code className="truncate text-meta text-ink-700 dark:text-ink-300">{name}</code>
              <span className="shrink-0 text-body font-semibold tabular-nums text-ink-900 dark:text-ink-50">
                {(counts.get(name) ?? 0).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * ── "IS THE PRIVILEGED PATH ACTUALLY REACHABLE?" ─────────────────────────────
 *
 * Every `admin-action` call this project has ever made returned
 * `401 unauthenticated`. That proves the auth wall works and nothing else —
 * ban, promote, `config.set`, `unit.publish` and `vocab.repair` are unit-tested
 * and deployed, but a deployment that 401s is indistinguishable from one that
 * would have worked. A key rotation, a bad redeploy, a revoked CORS origin or a
 * mis-set JWT secret would all look identical, from the outside, to a
 * correctly-protected system.
 *
 * This panel walks the real path — identify, `loadActor`,
 * `countActiveAdmins`, `evaluateAction`, audit — and reports each step. It
 * writes no user, no config and no curriculum; the only row it creates is its
 * own audit entry, which is deliberate: an operator must be able to see that
 * the probe ran.
 */
interface SelfTestStep {
  step: string;
  ok: boolean;
  detail: string;
}

function SelfTestPanel() {
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<SelfTestStep[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setSteps(null);
    setError(null);
    const r = await runAdminAction({
      action: 'system.selftest',
      reason: 'System page self-test',
    });
    setBusy(false);

    if (!r.ok) {
      setError(r.message);
      return;
    }
    // The per-step detail rides on `data`, not on the message. An absent list is
    // reported rather than treated as a pass, because a 200 carrying no detail is
    // exactly the shape of a probe that quietly did nothing.
    const checks = (r.data as { checks?: unknown } | undefined)?.checks;
    setSteps(Array.isArray(checks) ? (checks as SelfTestStep[]) : []);
  }

  const passed = steps?.filter((s) => s.ok).length ?? 0;
  const failed = steps ? steps.length - passed : 0;

  return (
    <section className="rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
      <h2 className={theme.type.section}>Self-test</h2>
      <p className="mt-1 text-meta text-ink-500 dark:text-ink-400">
        Walks the privileged write path from the session to the audit log and reports each step.
        Nothing is changed: no user, no flag, no curriculum. It writes one audit row, so the probe
        is itself visible in the log.
      </p>

      <button type="button" onClick={() => void run()} disabled={busy} className={`${theme.button.secondary} mt-3`}>
        <Activity className="h-4 w-4" aria-hidden="true" />
        {busy ? 'Running…' : steps ? 'Run again' : 'Run self-test'}
      </button>

      {error && (
        <p role="alert" className="mt-3 text-meta text-danger-700 dark:text-danger-300">
          The probe could not complete: {error}
        </p>
      )}

      {steps && (
        <div className="mt-3">
          <p
            role="status"
            className={`text-meta font-semibold ${
              failed === 0 ? 'text-success-700 dark:text-success-300' : 'text-danger-700 dark:text-danger-300'
            }`}
          >
            {failed === 0
              ? `All ${steps.length} steps passed.`
              : `${failed} of ${steps.length} steps failed — start at the first one below.`}
          </p>
          <ul className="mt-2 space-y-1">
            {steps.map((s) => (
              <li key={s.step} className="flex items-start gap-2 text-meta">
                <span
                  className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${
                    s.ok ? 'bg-success-500' : 'bg-danger-500'
                  }`}
                  aria-hidden="true"
                />
                <span className="font-mono font-semibold text-ink-800 dark:text-ink-200">{s.step}</span>
                <span className="text-ink-500 dark:text-ink-400">{s.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function FlagsPanel({ flags, onAction }: { flags: AppFlag[]; onAction: (key: string, value: boolean, reason: string) => void }) {  // ── WHY THE ROWS ARE SPLIT ──────────────────────────────────────────────────
  // This panel used to render a boolean `FlagToggle` for EVERY `app_config` row
  // and write `!currentValue` for any of them. `currentValue` was
  // `flag.value === true || flag.value === 'true'`, which is `false` for every
  // string and object key — so a control that looked live was permanently
  // off, and pressing it sent a boolean to a key whose spec only accepts a
  // string. `validateConfigWrite` refused it, correctly, and the operator got a
  // red `invalid-config` banner from a control that had no legal outcome.
  //
  // The worst instance: `curriculum_source` is this same product's switch for
  // which curriculum every learner is served, and one click here would have
  // attempted to overwrite it with `true`.
  //
  // So the split is by WRITABILITY, decided by the same allow-list the server
  // validates against. A key with a dedicated editor is shown read-only with a
  // link to it, rather than a control that can only fail.
  const booleanFlags = flags.filter((f) => isBooleanConfigKey(f.key));
  const otherFlags = flags.filter((f) => !isBooleanConfigKey(f.key));
  const loading = flags.length === 0;

  return (
    <section className="rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
      <h2 className={theme.type.section}>Feature flags</h2>
      <p className="mt-1 text-meta text-ink-500 dark:text-ink-400">
        Toggle a boolean flag to enable/disable it globally. Changes are written via the service-role
        function and recorded in the audit log.
      </p>
      {loading ? (
        <p className="mt-3 text-meta text-ink-500 dark:text-ink-400">Loading app_config…</p>
      ) : flags.length === 0 ? (
        <p className="mt-3 text-meta text-ink-500 dark:text-ink-400">No flags found.</p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {booleanFlags.map((flag) => (
              <li
                key={flag.key}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 pb-2 dark:border-ink-800/60"
              >
                <span className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-ink-400" aria-hidden="true" />
                  <code className="text-meta font-semibold text-ink-800 dark:text-ink-200">{flag.key}</code>
                </span>
                <span className="flex items-center gap-3">
                  <code className="rounded bg-ink-100 px-2 py-0.5 text-meta dark:bg-ink-800">
                    {String(flag.value)}
                  </code>
                  <FlagRowMeta flag={flag} />
                  <FlagToggle flag={flag} onAction={onAction} />
                </span>
              </li>
            ))}
          </ul>

          {otherFlags.length > 0 && (
            <>
              <h3 className={`${theme.type.section} mt-4 text-ink-600 dark:text-ink-300`}>
                Configured elsewhere
              </h3>
              <p className="mt-1 text-meta text-ink-500 dark:text-ink-400">
                These are not on/off switches, so they have no toggle here — a boolean is not a legal
                value for them and the server would refuse the write. Edit each one where it belongs.
              </p>
              <ul className="mt-2 space-y-2">
                {otherFlags.map((flag) => {
                  const spec = CONFIG_KEYS[flag.key];
                  return (
                    <li
                      key={flag.key}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 pb-2 dark:border-ink-800/60"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Flag className="h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />
                        <code className="text-meta font-semibold text-ink-700 dark:text-ink-300">
                          {flag.key}
                        </code>
                      </span>
                      <span className="flex items-center gap-3">
                        <code className="max-w-[22rem] truncate rounded bg-ink-100 px-2 py-0.5 text-meta dark:bg-ink-800">
                          {summariseConfigValue(flag.value)}
                        </code>
                        <FlagRowMeta flag={flag} />
                        {spec?.editAt ? (
                          <a
                            href={spec.editAt}
                            className="text-micro font-semibold uppercase tracking-wide text-accent-700 hover:underline dark:text-accent-300"
                          >
                            Edit
                          </a>
                        ) : (
                          <span className="text-micro text-ink-400">{spec?.types.join(' / ')}</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}

/** `updated_at` is nullable, so `String(null)` would render the word "null". */
function FlagRowMeta({ flag }: { flag: AppFlag }) {
  if (!flag.updated_at) return null;
  return <span className="text-micro text-ink-400">{flag.updated_at.slice(0, 10)}</span>;
}

/** One line for a value that may be a string, a boolean, or an object. */
function summariseConfigValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (value === null || value === undefined) return '(null)';
  if (typeof value === 'object') {
    const text = (value as { text?: unknown }).text;
    if (typeof text === 'string' && text.trim() !== '') return `"${text.slice(0, 60)}"`;
    return JSON.stringify(value).slice(0, 70);
  }
  return String(value);
}

/**
 * The applied-migration list is deliberately NOT fetched.
 *
 * `supabase_migrations.schema_migrations` has no select policy for any
 * application role, and granting one would expose migration internals for no
 * operational benefit — the same list is available in the Supabase dashboard
 * and via `npm run check-migrations`. Saying so beats a panel that silently
 * returns nothing.
 */
function MigrationsPanel() {
  return (
    <section className="rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
      <h2 className={theme.type.section}>Applied migrations</h2>
      <p className="mt-1 text-meta text-ink-500 dark:text-ink-400">
        <ScrollText className="mr-1 inline h-4 w-4" aria-hidden="true" />
        Read the applied list in the Supabase dashboard, or run{' '}
        <code className="font-mono">npm run check-migrations</code>. It is not exposed over REST:{' '}
        <code className="font-mono">supabase_migrations.schema_migrations</code> has no select
        policy for any application role.
      </p>
    </section>
  );
}
