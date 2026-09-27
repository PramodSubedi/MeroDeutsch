/**
 * The concrete Supabase-backed reader for the `curriculum_source` flag.
 *
 * Kept SEPARATE from `source.ts` so the resolution rules stay pure and testable
 * with no network and no Supabase import — the same split as the Edge
 * Function's guards. This file is the only part that knows about the wire.
 *
 * `app_config` is PUBLIC READ (a migration grants SELECT to anon), so this
 * works with the anon key. That is deliberate: maintenance mode has to be
 * readable before anyone signs in, and the flag is read during boot.
 */
import { supabase } from '../../lib/supabase';
import { CURRICULUM_SOURCE_KEY } from './source';

/**
 * Read the raw flag value. Returns `undefined` on any failure.
 *
 * Failing soft is correct here: `resolveSource` turns anything unrecognised into
 * the bundle, and a network error on a feature flag must not stop the app
 * booting. The learner still gets a working curriculum.
 */
export async function readCurriculumSourceFlag(): Promise<unknown> {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', CURRICULUM_SOURCE_KEY)
    .maybeSingle();

  if (error || !data) return undefined;
  // Stored as JSONB, so the flag may come back as the string "db" or as a bare
  // value depending on how it was written. Both are passed through unexamined;
  // `resolveSource` is the single place that interprets it.
  return data.value;
}

/**
 * Fetch the published curriculum document, when one exists.
 *
 * Returns `null` — not a throw — when there is nothing published, because "no
 * DB content yet" is a normal state during the rollout, not an error.
 */
export async function fetchDbCurriculum(): Promise<unknown> {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'curriculum_document')
    .maybeSingle();

  if (error || !data) return null;
  return data.value;
}
