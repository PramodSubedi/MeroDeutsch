/**
 * src/data/chatbot/config.ts — the RULES for the companion's global config.
 *
 * PURE. No network, no Supabase import, no `import.meta.env`.
 *
 * ── WHY THIS IS A SEPARATE FILE ──────────────────────────────────────────────
 * `src/config/chatbot.ts` exports module-scope constants that `chatStore`
 * (store construction), `ollamaClient` and `promptBuilder` all read
 * synchronously. Putting the `app_config` fetch there would mean either a
 * top-level await — making every one of those importers async-evaluated — or a
 * network call at import time inside `npm run check:chatbot`, which runs under
 * tsx with no browser env. This repository already carries the scar tissue for
 * exactly that mistake: `data/curriculum/bootGate.ts` exists ONLY because an
 * import-time fetch broke the spine.
 *
 * So the split is the one the curriculum feature already uses, for the same
 * reason:
 *
 *   config.ts     this file — pure rules, exhaustively testable with no network
 *   flagReader.ts the only file that knows about the wire
 *   resolve.ts    the one invocation, called after mount from LearningContext
 *
 * The difference from the curriculum is that NO boot gate is needed here. The
 * spine must be resolved before the first `import('./App')` because ~50 modules
 * read it synchronously. The companion's config has no such dependency —
 * nothing a lesson renders depends on it — so resolving after mount costs
 * nothing and buys a working offline app.
 *
 * ── EVERY UNRECOGNISED VALUE FALLS BACK ──────────────────────────────────────
 * A flag that is missing, null, the wrong type, or a typo resolves to the
 * bundled default. A learner must never end up with a companion pointed at
 * `undefined` because an admin saved something odd: the network is an
 * enhancement, never a dependency.
 */
import type { LanguageMix, PersonalityIntensity } from '../../types/chatbot';

/** Every key this feature reads or writes, named once. */
export const CHATBOT_KEYS = {
  enabled: 'chatbot_enabled',
  baseUrl: 'chatbot_base_url',
  defaultModel: 'chatbot_default_model',
  allowedModels: 'chatbot_allowed_models',
  intensity: 'chatbot_default_intensity',
  languageMix: 'chatbot_default_language_mix',
  autoOpen: 'chatbot_default_auto_open',
} as const;

export type ChatbotConfigKey = (typeof CHATBOT_KEYS)[keyof typeof CHATBOT_KEYS];

/**
 * The complete, closed set — derived, so a key cannot be added to `CHATBOT_KEYS`
 * and forgotten here. `check:chatconfig` pins this list against the Edge
 * Function's `CHATBOT_CONFIG_KEYS`, so the two cannot drift apart in either
 * direction.
 */
export const CHATBOT_CONFIG_KEYS: readonly string[] = Object.freeze(
  Object.values(CHATBOT_KEYS),
);

/** The prefix the reader filters `app_config` on. */
export const CHATBOT_KEY_PREFIX = 'chatbot_';

/** The resolved global configuration an admin has published. */
export interface ChatbotDefaults {
  /** The global kill switch. A learner's personal toggle is ANDed with this. */
  enabled: boolean;
  baseUrl: string;
  model: string;
  /**
   * Models an admin permits as the default.
   *
   * An EMPTY list means "unrestricted" — the shipped state, and the only correct
   * one when an admin has expressed no preference. It never hides anything from
   * a learner (the personal picker reads the learner's OWN installed models);
   * it constrains what an admin may choose as the fleet-wide default.
   */
  allowedModels: string[];
  intensity: PersonalityIntensity;
  languageMix: LanguageMix;
  autoOpenOnMistake: boolean;
}

/**
 * What ships when nothing has been configured.
 *
 * These MUST equal the seed migration `20260930030000_seed_chatbot_config.sql`.
 * `check:chatconfig` asserts the two agree, because drift between them means the
 * admin page shows one value while a fresh learner gets another — a bug that
 * stays invisible until somebody compares the table against the code.
 */
export const BUNDLED_CHATBOT_DEFAULTS: ChatbotDefaults = {
  enabled: true,
  baseUrl: 'http://localhost:11434',
  model: 'qwen2.5:3b',
  // The same four `CHATBOT_CONFIG.fallbackModels` the client already falls back
  // through, so a default that is not installed locally still resolves to
  // something the learner has.
  allowedModels: ['qwen2.5:3b', 'llama3.2:3b', 'phi3.5:3.8b', 'gemma2:2b'],
  intensity: 'balanced',
  languageMix: 'de_en_ne',
  autoOpenOnMistake: true,
};


/* ── Tolerant parsers ─────────────────────────────────────────────────────────
 * Each returns `null` for anything it does not recognise, rather than throwing
 * or coercing. That is the whole contract: a bad flag yields the shipped
 * default and the learner never sees the bad value.
 */

/**
 * Booleans arrive as real JSON booleans, but a hand-written row may hold the
 * strings "true"/"false". Anything else — 1, 0, "yes", {}, null — is not a
 * boolean and falls back.
 */
export function parseBool(raw: unknown): boolean | null {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return null;
}

/** A non-empty string, or null. Never returns whitespace. */
export function parseText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  return v === '' ? null : v;
}

/** Comma-separated → trimmed, non-empty entries. Order is preserved. */
export function parseModelList(raw: unknown): string[] | null {
  const text = parseText(raw);
  if (text === null) return null;
  const parts = text
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
  // ",,," is text containing no models. Treat it as absent rather than as an
  // empty allow-list: empty means "unrestricted", which would quietly mean the
  // opposite of what the admin typed.
  return parts.length === 0 ? null : parts;
}

/** One of a closed vocabulary, or null. */
function parseOneOf<T extends string>(raw: unknown, allowed: readonly T[]): T | null {
  const text = parseText(raw);
  if (text === null) return null;
  const v = text.toLowerCase();
  return (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

export function parseIntensity(raw: unknown): PersonalityIntensity | null {
  return parseOneOf<PersonalityIntensity>(raw, ['serious', 'balanced', 'playful']);
}

export function parseLanguageMix(raw: unknown): LanguageMix | null {
  return parseOneOf<LanguageMix>(raw, ['de_en', 'de_en_ne']);
}

/* ── Resolution ────────────────────────────────────────────────────────────── */

/**
 * Fold a raw `app_config` record over the bundled defaults.
 *
 * PURE, so the whole tolerance surface is testable without a database — which
 * matters because "the flag was unreadable" and "the flag said something
 * unexpected" are the two states that are hardest to reproduce live and easiest
 * to get wrong.
 *
 * Note the ORDER the two layers merge in, which is the point of the module: a
 * learner's own saved settings are laid ON TOP of this by
 * `chatStore.hydrateChat`, never underneath it. An admin sets the floor; the
 * learner decides above it.
 */
export function resolveChatbotConfig(
  raw: Record<string, unknown> | null | undefined,
  bundled: ChatbotDefaults = BUNDLED_CHATBOT_DEFAULTS,
): ChatbotDefaults {
  const row = raw ?? {};

  return {
    enabled: parseBool(row[CHATBOT_KEYS.enabled]) ?? bundled.enabled,
    baseUrl: parseText(row[CHATBOT_KEYS.baseUrl]) ?? bundled.baseUrl,
    // Case is preserved deliberately: a model name is an identifier, and
    // `Qwen2.5:3b` lowercased names a model the learner does not have.
    model: parseText(row[CHATBOT_KEYS.defaultModel]) ?? bundled.model,
    allowedModels: parseModelList(row[CHATBOT_KEYS.allowedModels]) ?? bundled.allowedModels,
    intensity: parseIntensity(row[CHATBOT_KEYS.intensity]) ?? bundled.intensity,
    languageMix: parseLanguageMix(row[CHATBOT_KEYS.languageMix]) ?? bundled.languageMix,
    autoOpenOnMistake: parseBool(row[CHATBOT_KEYS.autoOpen]) ?? bundled.autoOpenOnMistake,
  };
}

/**
 * Is `model` a model this configuration permits?
 *
 * CROSS-KEY, and therefore NOT enforceable in the Edge Function: it validates
 * one key against one spec and cannot see the current state of another. The
 * admin UI calls this and refuses the save; `validateConfigWrite` cannot. An
 * empty list means unrestricted.
 */
export function isModelAllowed(model: string, allowedModels: readonly string[]): boolean {
  if (allowedModels.length === 0) return true;
  return allowedModels.includes(model.trim());
}
