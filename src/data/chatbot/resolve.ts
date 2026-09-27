/**
 * src/data/chatbot/resolve.ts
 *
 * THE ONE CALL THAT MAKES THE FLAGS REAL.
 *
 * `config.ts` defines the rules and `flagReader.ts` reads the wire, but until
 * something calls both, every `chatbot_*` key is inert — the mechanism exists
 * and nothing invokes it. This module is that invocation, and the single place
 * the resolved values are held.
 *
 * ── WHY IT IS NOT CALLED AT IMPORT TIME ──────────────────────────────────────
 * Deliberately post-mount, exactly like `startCurriculumResolution`. An
 * import-time fetch would make every synchronous importer of
 * `config/chatbot.ts` async-evaluated, and would fire a network request inside
 * `npm run check:chatbot`, which runs under tsx with no browser environment.
 *
 * ── WHY IT MUST COMPLETE BEFORE `hydrateChat` ────────────────────────────────
 * `hydrateChat` merges the resolved defaults UNDER the learner's saved settings
 * and then early-returns for the rest of the session. Resolving after it means
 * the merge has already happened and the admin default is silently discarded —
 * a flag that looks like it works and does not. The caller awaits this.
 */
import { resolveChatbotConfig, BUNDLED_CHATBOT_DEFAULTS, type ChatbotDefaults } from './config';
import { readAllChatbotConfig } from './flagReader';

let current: ChatbotDefaults = BUNDLED_CHATBOT_DEFAULTS;
let started = false;
/** Why the current values are what they are. Surfaced in the admin page. */
let reason: 'bundled' | 'db' | 'db-unreadable' = 'bundled';

/**
 * The wire reader, replaceable for tests.
 *
 * Defaulting to the real reader keeps production behaviour the default rather
 * than something a test opts INTO — a seam that defaults to a stub is a seam
 * that can be left in by accident. `curriculum/resolveActive.ts` made the same
 * choice for the same reason.
 */
let readFlags: () => Promise<Record<string, unknown>> = readAllChatbotConfig;

export function __setReaderForTest(read: () => Promise<Record<string, unknown>>): void {
  readFlags = read;
}

/** The current global configuration. Always safe to call, never null. */
export function getChatbotDefaults(): ChatbotDefaults {
  return current;
}

export function getChatbotResolutionReason(): typeof reason {
  return reason;
}

/**
 * Read the flags and fold them over the bundled defaults.
 *
 * Never rejects. A rejected promise here would surface as an unhandled
 * rejection during a lesson, which is a far worse outcome than a companion
 * running on its shipped defaults.
 */
export async function resolveChatbotDefaults(): Promise<ChatbotDefaults> {
  let raw: Record<string, unknown>;
  try {
    raw = await readFlags();
  } catch {
    // `readAllChatbotConfig` already swallows its own errors, so reaching here
    // means the wiring itself broke. Degrade to the bundled defaults rather
    // than let a feature flag take the app down.
    current = BUNDLED_CHATBOT_DEFAULTS;
    reason = 'db-unreadable';
    return current;
  }

  // An empty record is indistinguishable from "no rows yet" — a normal state
  // before the seed migration is applied, not an error.
  current = resolveChatbotConfig(raw);
  reason = Object.keys(raw).length > 0 ? 'db' : 'bundled';
  return current;
}

/**
 * Kick off resolution once.
 *
 * Idempotent: a later call is a no-op, so a component that mounts twice cannot
 * race two fetches against each other or overwrite fresher state.
 */
export async function startChatbotConfigResolution(): Promise<ChatbotDefaults> {
  if (started) return current;
  started = true;
  return resolveChatbotDefaults();
}

/** Test seam: forget that resolution already started, and restore the real reader. */
export function __resetChatbotResolution(): void {
  started = false;
  current = BUNDLED_CHATBOT_DEFAULTS;
  reason = 'bundled';
  readFlags = readAllChatbotConfig;
}
