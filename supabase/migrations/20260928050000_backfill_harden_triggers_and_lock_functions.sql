-- 20260928050000_backfill_harden_triggers_and_lock_functions.sql
--
-- APPLIED OUT OF BAND to project uiwlioriubixerspdamx on 2026-09-27. Recorded
-- here as the canonical source (see docs/SUPABASE_MIGRATIONS.md).
--
-- PART 1 - the parts of 20260814000000 / 20260814010000 that never ran
-- ------------------------------------------------------------------
-- Both are recorded as APPLIED in supabase_migrations, but
-- `npm run check-migrations` proved them partial: the shared trigger function
-- and every trigger built on it were never created, and neither was
-- idx_user_activity_days_user_date. 20260814010000 failed hardest - it declared
-- a trigger that referenced update_updated_at_column(), which did not exist, so
-- the CREATE TRIGGER errored and rolled the rest of that migration back.
--
-- Consequence: nothing maintained updated_at server-side. The client happens to
-- send updated_at on every write it makes, which is why the drift stayed
-- invisible - but any future server-side UPDATE (an admin script, a SECURITY
-- DEFINER function, a new RPC) would silently leave a stale timestamp, and the
-- sync layer's "newest updatedAt wins" conflict resolution would trust the
-- wrong row.
--
-- a1_path_state keeps its own dedicated trigger from migration 008 and is
-- deliberately not double-triggered.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_profiles_updated_at      ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_progress_updated_at ON user_progress;
CREATE TRIGGER update_user_progress_updated_at
  BEFORE UPDATE ON user_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_streaks_updated_at  ON user_streaks;
CREATE TRIGGER update_user_streaks_updated_at
  BEFORE UPDATE ON user_streaks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_review_queue_updated_at  ON review_queue;
CREATE TRIGGER update_review_queue_updated_at
  BEFORE UPDATE ON review_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_xp_updated_at      ON user_xp;
CREATE TRIGGER update_user_xp_updated_at
  BEFORE UPDATE ON user_xp
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_activity_days_updated_at ON user_activity_days;
CREATE TRIGGER update_user_activity_days_updated_at
  BEFORE UPDATE ON user_activity_days
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_user_activity_days_user_date
  ON public.user_activity_days(user_id, activity_date DESC);

DO $$
DECLARE
  unguarded text;
BEGIN
  SELECT string_agg(guarded.table_name, ', ') INTO unguarded FROM (
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND EXISTS (SELECT 1 FROM pg_attribute a
                  WHERE a.attrelid = c.oid AND a.attname = 'updated_at'
                    AND a.attnum > 0 AND NOT a.attisdropped)
      AND NOT EXISTS (SELECT 1 FROM pg_trigger tg
                      WHERE tg.tgrelid = c.oid AND NOT tg.tgisinternal
                        AND tg.tgfoid IN (
                          'public.update_updated_at_column()'::regprocedure,
                          'public.update_a1_path_state_timestamp()'::regprocedure))
  ) guarded;
  IF unguarded IS NOT NULL THEN
    RAISE EXCEPTION 'tables with updated_at but no trigger: %', unguarded;
  END IF;
  RAISE NOTICE 'OK - every public table with updated_at is trigger-guarded';
END $$;

-- PART 2 - trigger functions must not be RPC-callable
-- ------------------------------------------------------------------
-- Postgres grants EXECUTE to PUBLIC by default and Supabase exposes every
-- public function at /rest/v1/rpc/<name>, so handle_new_user() and
-- protect_profile_plan() - both SECURITY DEFINER - were directly invocable by
-- an anonymous visitor. Neither is a legitimate RPC: each only ever runs as a
-- BEFORE/AFTER trigger. Revoking EXECUTE does not affect trigger firing, which
-- does not check EXECUTE privilege.
--
-- search_path is pinned on all of them: a SECURITY DEFINER function resolves
-- unqualified names through the CALLER's search_path, so a caller able to
-- create objects in an earlier schema can hijack its behaviour.

REVOKE EXECUTE ON FUNCTION public.handle_new_user()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_plan() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');

  INSERT INTO public.user_progress (user_id) VALUES (new.id);
  INSERT INTO public.user_streaks (user_id) VALUES (new.id);

  RETURN NEW;
END;
$$;

-- Re-assert the trigger: revoking EXECUTE must not have disturbed it.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_a1_path_state_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_activity(
  p_user_id uuid, p_date date, p_delta integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'increment_activity: not allowed for this user';
  END IF;

  INSERT INTO public.user_activity_days (user_id, activity_date, event_count)
  VALUES (p_user_id, p_date, p_delta)
  ON CONFLICT (user_id, activity_date)
  DO UPDATE SET event_count = public.user_activity_days.event_count + p_delta,
                updated_at = now();
END;
$$;

-- The read-only RPCs. Bodies are unchanged from migrations 010/011/017/018; only
-- SET search_path is added. They are not SECURITY DEFINER today, but pinning
-- them is free and prevents the trap if one is ever promoted.
CREATE OR REPLACE FUNCTION public.get_random_vocabulary(
  p_pos TEXT DEFAULT NULL, p_tag TEXT DEFAULT NULL, p_level TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL, p_limit INT DEFAULT 15
) RETURNS SETOF public.vocabulary
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT * FROM public.vocabulary
  WHERE (p_pos IS NULL OR part_of_speech = p_pos)
    AND (p_tag IS NULL OR p_tag = ANY(tags))
    AND (p_level IS NULL OR level = p_level)
    AND (p_category IS NULL OR p_category = ANY(tags))
    AND (p_pos IS DISTINCT FROM 'noun' OR article IN ('der', 'die', 'das'))
  ORDER BY random()
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 15), 1), 100);
$$;

CREATE OR REPLACE FUNCTION public.get_vocabulary_glossary(
  p_pos TEXT DEFAULT NULL, p_level TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL, p_limit INT DEFAULT 2000
) RETURNS SETOF public.vocabulary
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT * FROM public.vocabulary
  WHERE (p_pos IS NULL OR part_of_speech = p_pos)
    AND (p_level IS NULL OR level = p_level)
    AND (p_category IS NULL OR p_category = ANY(tags))
    AND (p_pos IS DISTINCT FROM 'noun' OR article IN ('der', 'die', 'das'))
    AND word ~ '^[^0-9/,_]+$' AND length(word) >= 2
  ORDER BY word ASC, part_of_speech ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 2000), 1), 2000);
$$;

CREATE OR REPLACE FUNCTION public.get_vocab_filter_options()
RETURNS TABLE (category text)
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT DISTINCT t
  FROM public.vocabulary, LATERAL unnest(tags) AS t
  WHERE btrim(t) <> '' AND length(t) >= 2 AND t NOT IN ('general')
    AND lower(t) NOT IN (
      'der','die','das','pl','plural','germany','verb','noun','adjective',
      'adverb','preposition','pronoun','conjunction','interjection','numeral',
      'particle','phrase','abbreviation','expression','questionword','modalverb',
      'auxiliary')
    AND lower(t) NOT LIKE '%a1%' AND lower(t) NOT LIKE '%a2%'
    AND lower(t) NOT LIKE '%b1%' AND lower(t) NOT LIKE '%b2%'
    AND t !~ '[0-9/,_]'
  ORDER BY t;
$$;

CREATE OR REPLACE FUNCTION public.get_random_sentences(
  p_grammar_focus TEXT DEFAULT NULL, p_limit INT DEFAULT 10
) RETURNS SETOF public.sentences
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT * FROM public.sentences
  WHERE (p_grammar_focus IS NULL OR grammar_focus = p_grammar_focus)
  ORDER BY random()
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100);
$$;

CREATE OR REPLACE FUNCTION public.get_content_items(
  p_content_type TEXT, p_limit INT DEFAULT 200, p_shuffle BOOLEAN DEFAULT true
) RETURNS SETOF public.content_items
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT * FROM public.content_items
  WHERE content_type = p_content_type
  ORDER BY CASE WHEN p_shuffle THEN random() ELSE 0 END, sort
  LIMIT GREATEST(LEAST(COALESCE(p_limit, 200), 1000), 1);
$$;

DO $$
DECLARE
  callable text;
  unpinned text;
BEGIN
  SELECT string_agg(p.proname, ', ') INTO callable
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('handle_new_user', 'protect_profile_plan')
    AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF callable IS NOT NULL THEN
    RAISE EXCEPTION 'trigger functions still callable by anon: %', callable;
  END IF;

  SELECT string_agg(p.proname, ', ') INTO unpinned
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proconfig IS NULL;
  IF unpinned IS NOT NULL THEN
    RAISE EXCEPTION 'functions with mutable search_path: %', unpinned;
  END IF;

  RAISE NOTICE 'OK - trigger functions not RPC-callable; search_path pinned everywhere';
END $$;

NOTIFY pgrst, 'reload schema';