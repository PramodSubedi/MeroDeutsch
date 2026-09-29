/**
 * src/shared/configKeys.ts
 *
 * THE SINGLE AUTHORITY ON WRITABLE CONFIG. Imported by the Edge Function's
 * validator AND by the admin control centre that drives it.
 *
 * ── WHY THIS FILE EXISTS AT ALL ───────────────────────────────────────────────
 * `CONFIG_KEYS` used to live only in `supabase/functions/admin-action/publish.ts`,
 * where no browser code can import it. The admin pages therefore typed their own
 * idea of which flags were writable, and the two lists drifted:
 *
 *   · `SystemPage.tsx` wrote `announcement_banner` through `config.set`. The key
 *     was not in the allow-list, so `validateConfigWrite` refused it and every
 *     save returned `400 invalid-config`. The whole Announcement Banner feature
 *     was non-functional from the day it shipped, and nothing noticed.
 *   · `SystemPage.tsx` also rendered a BOOLEAN toggle for every `app_config` row,
 *     including string and object keys, so those controls could only ever 400.
 *
 * Neither was visible to 1 267 passing checks, because the list the tests covered
 * was not the list the UI used.
 *
 * So the list moves here — to a module with NO runtime imports, importable from
 * both a Deno Edge Function and a Vite browser bundle. The repo's existing
 * convention (`adminActions.ts`) was "the browser never imports from the Deno
 * function's source"; that convention is what made the drift invisible, and it
 * only holds while the browser has its own copy. A shared source is the fix that
 * survives a second author.
 *
 * `scripts/ci/adminConfigWrites.check.ts` is the backstop: it asserts every key any
 * admin page writes actually appears in `CONFIG_KEYS` below. Extraction removes
 * the drift; the check means a future hand-written key cannot reintroduce it.
 *
 * ── WHY NO RUNTIME IMPORTS ───────────────────────────────────────────────────
 * The same rule `data/curriculum/dbSeed.ts` follows. This module is imported by
 * the earliest-possible code in a Deno request handler, so anything it pulled in
 * would run there too. Types only.
 */

export type ConfigValueType = 'boolean' | 'string' | 'object';

export interface ConfigKeySpec {
  types: ConfigValueType[];
  /**
   * For string keys: the complete set of legal values.
   *
   * PRESENCE IS LOAD-BEARING. A key with `values` declares a closed vocabulary
   * that comparison is case-insensitive over, which is what lets
   * `normalizeConfigValue` fold case for storage. A key WITHOUT `values` is a
   * case-sensitive identifier (`Qwen2.5:3b`, `/v1/Models`) and must be stored
   * verbatim. Adding `values` to an identifier key is how a model name gets
   * lowercased into one no local runtime recognises.
   *
   * Object keys must never declare it.
   */
  values?: readonly string[];
  /**
   * Shape validator for `object` keys. Returns human-readable problems; an empty
   * array means the value is acceptable.
   */
  validate?: (raw: unknown) => string[];
  description: string;
  /**
   * Where an admin edits this key, when a dedicated control exists. The generic
   * flags panel on `/system` uses it to point at the real editor instead of
   * rendering a toggle that could only fail.
   */
  editAt?: string;
}

export const ANNOUNCEMENT_SEVERITIES = ['info', 'warning', 'danger', 'success'] as const;
export type AnnouncementSeverity = (typeof ANNOUNCEMENT_SEVERITIES)[number];

export interface AnnouncementBanner {
  text: string;
  severity: AnnouncementSeverity;
  dismissible: boolean;
  link?: string;
}

const MAX_BANNER_TEXT = 500;

const isBlank = (v: unknown): boolean => typeof v !== 'string' || v.trim() === '';

/**
 * Validate an announcement banner.
 *
 * The link is constrained to an absolute `http(s)` URL rather than merely
 * "a non-empty string", because it is rendered as a real anchor on the learner
 * app's pre-sign-in surface — `javascript:` there is a stored-XSS vector aimed
 * at every visitor, delivered by an admin action an audit log would record as
 * an ordinary "update the banner".
 */
export function validateAnnouncementBanner(raw: unknown): string[] {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return ['announcement_banner must be a JSON object'];
  }
  const b = raw as Record<string, unknown>;
  const problems: string[] = [];

  if (isBlank(b.text)) problems.push('text is required and must be a non-empty string');
  else if ((b.text as string).length > MAX_BANNER_TEXT) {
    problems.push(`text exceeds ${MAX_BANNER_TEXT} characters`);
  }

  if (b.link !== undefined && b.link !== null && b.link !== '') {
    if (typeof b.link !== 'string') problems.push('link must be a string when present');
    else if (!/^https?:\/\/[^\s]+$/i.test(b.link.trim())) {
      problems.push('link must be an absolute http(s) URL');
    }
  }

  if (typeof b.severity !== 'string' || !ANNOUNCEMENT_SEVERITIES.includes(b.severity as AnnouncementSeverity)) {
    problems.push(`severity must be one of ${ANNOUNCEMENT_SEVERITIES.join(', ')}`);
  }

  if (typeof b.dismissible !== 'boolean') problems.push('dismissible must be true or false');

  return problems;
}

/**
 * READ-SIDE ONLY: coerce a stored row into editor state, tolerantly.
 *
 * ── NAMED FOR WHAT IT IS, BECAUSE THE NAME IS THE SAFEGUARD ───────────────────
 * `normalizeConfigValue` stores object payloads UNCHANGED. A banner that passed
 * `validateAnnouncementBanner` is already the shape above, so transforming it on
 * the way in could only make the stored bytes differ from the validated ones.
 *
 * This helper is for the opposite direction — turning a stored row into form
 * state. It deliberately REPAIRS, which is what makes it wrong for a write:
 *
 *   · a missing or unrecognised `severity` becomes `info`
 *   · a non-boolean `dismissible` becomes `true`
 *   · a missing `text` becomes `''`  ← and stays `''`, so it still FAILS
 *     validation. Text is the entire content of a public banner, and inventing
 *     or preserving-by-accident one is the only repair that could silently put
 *     the wrong words in front of every visitor. Every other field has a safe
 *     default; this one has no default that is better than showing nothing.
 *
 * So: never call this before `validateAnnouncementBanner`. The write path does
 * not, and the check below pins that it cannot launder `text`.
 *
 * A row seeded by migration `20260930160000`, or hand-edited in the dashboard
 * before this validator existed, may be malformed — and the admin editor still
 * has to render it rather than crash. An editor that starts from a blank form for
 * a LIVE banner is how a banner gets silently overwritten with nothing.
 */
export function readAnnouncementBanner(raw: unknown): AnnouncementBanner {
  const b = (raw ?? {}) as Record<string, unknown>;
  const rawText = b.text;
  const out: AnnouncementBanner = {
    text: typeof rawText === 'string' ? rawText.trim() : '',
    severity: ANNOUNCEMENT_SEVERITIES.includes(b.severity as AnnouncementSeverity)
      ? (b.severity as AnnouncementSeverity)
      : 'info',
    // `!== false` rather than `=== true`: a legacy row that omitted the key is
    // more likely to predate a "dismissible" default than to have meant `false`.
    dismissible: b.dismissible !== false,
  };
  if (typeof b.link === 'string' && b.link.trim() !== '') out.link = b.link.trim();
  return out;
}

export const ANNOUNCEMENT_BANNER_KEY = 'announcement_banner';

export const CONFIG_KEYS: Readonly<Record<string, ConfigKeySpec>> = {
  curriculum_source: {
    types: ['string'],
    values: ['bundle', 'db'],
    description: 'Which curriculum the app serves. db is only safe with a verified backfill.',
    editAt: '/curriculum',
  },
  maintenance_mode: {
    types: ['boolean'],
    description: 'Blocks learners out of the app while you work on it.',
  },
  // ── The lesson renderer rollout switch ────────────────────────────────────
  //
  // `legacy` = today's document + tab lesson page. `run` = the step-flow
  // renderer. It exists so the step-flow can be piloted against real learners
  // and reverted by editing one row, rather than by a deploy.
  //
  // `values` is load-bearing: it declares a CLOSED vocabulary, so
  // `normalizeConfigValue` folds case on the way in and `validateConfigWrite`
  // refuses anything else. Without it a typo would store verbatim and the
  // reader would have to decide what a stranger meant.
  //
  // It is removed together with the legacy branch once the rollout completes, in
  // one step. A flag left behind with only one meaningful value is a control
  // that lies: an operator would flip it and see nothing happen, and the next
  // person to read it would assume a fallback that no longer exists. The
  // rollback window is the rollout; when it closes, so does the switch.
  lesson_render: {
    types: ['string'],
    values: ['legacy', 'run'],
    description:
      'Which lesson renderer /lesson/:n uses. legacy = the current document + tab page, run = the step-flow. Flip to legacy to roll back.',
    editAt: '/curriculum',
  },
  registration_open: {
    types: ['boolean'],
    description: 'Whether new signups are accepted.',
  },

  // ── The announcement banner ─────────────────────────────────────────────────
  //
  // The ONLY object-valued config key, and the reason `types` grew an `object`
  // member: the payload is structured, not a string. It is public-read — the
  // learner app renders it before sign-in — so the shape validator below is the
  // whole of its validation, and it exists here rather than in the page that
  // builds the value.
  [ANNOUNCEMENT_BANNER_KEY]: {
    types: ['object'],
    validate: validateAnnouncementBanner,
    description: 'Global banner shown to every visitor, including signed-out learners.',
    editAt: '/system',
  },

  // ── The AI companion (Mero) ───────────────────────────────────────────────
  //
  // Global defaults only. A learner's own choices stay in per-user localStorage
  // (`meroDeutschChatbot:<userId>`); these are the values a NEW user starts from
  // and the values an admin can change for everyone who has not overridden them.
  chatbot_enabled: {
    types: ['boolean'],
    description: 'Global on/off for the AI companion. Overrides every learner personal toggle.',
    editAt: '/chatbot',
  },
  chatbot_base_url: {
    types: ['string'],
    description: 'Default Ollama/LM Studio base URL seeded for learners who have not set one.',
    editAt: '/chatbot',
  },
  chatbot_default_model: {
    types: ['string'],
    // NO `values` — model names are case-sensitive identifiers, not a fixed
    // vocabulary. That single omission is what stops normalisation lowercasing
    // `Qwen2.5:3b` into a name no local runtime recognises.
    description: 'Default model name. Must appear in chatbot_allowed_models when that key is set.',
    editAt: '/chatbot',
  },
  chatbot_allowed_models: {
    types: ['string'],
    description: 'Comma-separated models an admin may set as the default. Case is preserved.',
    editAt: '/chatbot',
  },
  chatbot_default_intensity: {
    types: ['string'],
    values: ['serious', 'balanced', 'playful'],
    description: 'Default personality intensity for new learners.',
    editAt: '/chatbot',
  },
  chatbot_default_language_mix: {
    types: ['string'],
    values: ['de_en', 'de_en_ne'],
    description: 'Default helper language mix for new learners.',
    editAt: '/chatbot',
  },
  chatbot_default_auto_open: {
    types: ['boolean'],
    description: 'Whether Mero opens itself unprompted after repeated mistakes, by default.',
    editAt: '/chatbot',
  },
};

/**
 * The companion keys, as a set.
 *
 * Derived from `CONFIG_KEYS` by PREFIX rather than typed out a second time, so a
 * key cannot be added to the allow-list and forgotten here — which would leave
 * the admin page unable to show a control for a flag that is genuinely writable.
 * The learner app asserts the same list in `src/data/chatbot/config.ts`; the two
 * are pinned to each other by `check:chatconfig`.
 */
export const CHATBOT_CONFIG_KEYS: readonly string[] = Object.freeze(
  Object.keys(CONFIG_KEYS).filter((k) => k.startsWith('chatbot_')),
);

/** True when this key may be edited with an on/off control. */
export function isBooleanConfigKey(key: string): boolean {
  return CONFIG_KEYS[key]?.types.includes('boolean') === true;
}
