/**
 * src/data/lessonRender/flagReader.ts
 *
 * The concrete Supabase-backed reader for the `lesson_render` flag.
 *
 * Kept separate from `source.ts` so the resolution rules stay pure and
 * testable with no network and no Supabase import — the same split
 * `data/curriculum/flagReader.ts` uses, for the same reason.
 *
 * `app_config` is PUBLIC READ (a migration grants SELECT to anon), so this
 * works with the anon key. That matters here exactly as much as it does for
 * `curriculum_source`: the flag is read during boot, before anyone has signed
 * in, because a lesson must render the right way for a signed-out visitor too.
 */
import { supabase } from '../../lib/supabase';
import { LESSON_RENDER_KEY } from './source';

/**
 * Read the raw flag value. Returns `undefined` on any failure.
 *
 * Failing soft is correct here: an unreachable or absent flag means the legacy
 * renderer, which is what already works. A network error on a feature flag must
 * not stop a learner opening a lesson.
 */
export async function readLessonRenderFlag(): Promise<unknown> {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', LESSON_RENDER_KEY)
    .maybeSingle();

  if (error || !data) return undefined;
  // Stored as JSONB, so this may come back as the string "run" or as a bare
  // value depending on how it was written. Both are passed through unexamined;
  // `resolveLessonRender` is the single place that interprets it.
  return data.value;
}
