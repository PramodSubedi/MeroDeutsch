/**
 * src/data/chatbot/flagReader.ts
 *
 * The only file in this feature that knows about the wire.
 *
 * Kept separate from `config.ts` so the resolution rules stay pure and testable
 * with no network and no Supabase import — the same split the curriculum
 * feature uses, and the reason `bootGate.ts` exists over there.
 *
 * `app_config` is PUBLIC READ (migration `20260929010000_admin_tables.sql`
 * grants SELECT to anon and creates a `USING (true)` policy), so this works
 * with the anon key and resolves before anyone signs in — the companion is
 * readable by guests too, so there is nothing to wait for authentication.
 */
import { supabase } from '../../lib/supabase';
import { CHATBOT_KEY_PREFIX } from './config';

/**
 * Read every `chatbot_*` row as a plain record.
 *
 * Returns `{}` on ANY failure — network down, table missing, RLS changed, a
 * malformed response. Failing soft is correct rather than merely convenient: a
 * learner opening the app on the subway must get a working companion with the
 * shipped defaults, and an unreadable feature flag must never stop the app
 * booting. The caller folds this over the defaults.
 *
 * The pattern is `'chatbot%'`, not `'chatbot_%'`: in SQL `LIKE`, `_` is a
 * single-character wildcard, so an underscore would also match `chatbotX…`. It
 * happens to be harmless here, but the prefix is a literal, not a pattern, and
 * writing it as a pattern invites the next reader to trust it as one.
 */
export async function readAllChatbotConfig(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from('app_config')
    .select('key, value')
    .like('key', `${CHATBOT_KEY_PREFIX}%`);

  if (error || !data) return {};

  const out: Record<string, unknown> = {};
  for (const row of data as unknown as Array<{ key?: unknown; value?: unknown }>) {
    // A row without a string key is not addressable, so it cannot be a flag.
    if (typeof row.key !== 'string') continue;
    out[row.key] = row.value;
  }
  return out;
}
