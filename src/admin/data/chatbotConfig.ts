/**
 * src/admin/data/chatbotConfig.ts
 *
 * Read model for the companion's global configuration in `app_config`.
 *
 * ── WHY IT READS DIRECTLY RATHER THAN THROUGH THE EDGE FUNCTION ──────────────
 * `app_config` is public-read (migration `20260929010000_admin_tables.sql`), and
 * `SystemPage`'s flags panel already reads it the same way. A read model that
 * needed the service-role function would be a read model that renders an empty
 * page until the function is deployed — and the point of this file is to SHOW an
 * admin the current state, including "no row exists yet".
 *
 * The WRITE goes the other way, through `runAdminAction({action:'config.set'})`,
 * because writes are service-role only. So this file never writes.
 *
 * ── "OFF" AND "UNREADABLE" ARE NOT THE SAME ANSWER ───────────────────────────
 * A failed read returns the bundled defaults AND an `error`. Rendering a
 * confident "the companion is on" from a failed read would be a lie an admin
 * acts on; so the page shows the controls, flags the failure, and never
 * pretends to know the current state.
 */
import { supabase } from '../../lib/supabase';
import { isModelAllowed, resolveChatbotConfig, BUNDLED_CHATBOT_DEFAULTS, type ChatbotDefaults } from '../../data/chatbot/config';

export interface ChatbotConfigRead {
  /** Folded over the bundled defaults, so every field always has a value. */
  current: ChatbotDefaults;
  /** True when at least one `chatbot_*` row exists in the table. */
  seeded: boolean;
  /** Null when the read succeeded; a message when it did not. */
  error: string | null;
  loading: boolean;
}

const INITIAL: ChatbotConfigRead = {
  current: BUNDLED_CHATBOT_DEFAULTS,
  seeded: false,
  error: null,
  loading: true,
};

export async function fetchChatbotConfig(): Promise<ChatbotConfigRead> {
  const { data, error } = await supabase
    .from('app_config')
    .select('key, value')
    .like('key', 'chatbot%');

  if (error) {
    return { ...INITIAL, loading: false, error: `app_config: ${error.message}` };
  }

  const rows = (data ?? []) as unknown as Array<{ key: string; value: unknown }>;
  const raw: Record<string, unknown> = {};
  for (const row of rows) raw[row.key] = row.value;

  return {
    // The SAME resolver the learner app runs, imported rather than
    // reimplemented. Two copies of "what does a bad flag mean" is exactly how an
    // admin page and a learner's companion start disagreeing about the state.
    current: resolveChatbotConfig(raw),
    seeded: rows.length > 0,
    error: null,
    loading: false,
  };
}

/**
 * Validate a proposed default model against the proposed allow-list.
 *
 * CROSS-KEY, so it cannot live in the Edge Function — `validateConfigWrite` sees
 * one key and one spec and has no access to the current state of another. This
 * is the UI-level rail that stands in for it, which is why the Save button says
 * WHY it is disabled rather than just greying out.
 *
 * An empty allow-list means unrestricted, matching `isModelAllowed`.
 */
export function validateDefaultModel(
  model: string,
  allowedModels: readonly string[],
): { ok: true } | { ok: false; message: string } {
  const trimmed = model.trim();
  if (trimmed === '') {
    return { ok: false, message: 'A default model name is required.' };
  }
  if (isModelAllowed(trimmed, allowedModels)) return { ok: true };
  return {
    ok: false,
    message: `"${trimmed}" is not in the allowed model list. Add it there first, or clear the list to allow any model.`,
  };
}

/** Split a raw comma-separated row into a list, tolerating stray separators. */
export function parseAllowedModelsField(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

/** The inverse, for loading the editor from a stored list. */
export function formatAllowedModelsField(models: readonly string[]): string {
  return models.join(', ');
}
