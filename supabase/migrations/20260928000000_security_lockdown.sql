
-- 20260928000000_security_lockdown.sql
--
-- APPLIED OUT OF BAND to project uiwlioriubixerspdamx on 2026-09-27 via the
-- Management API (see the runbook in docs/SUPABASE_MIGRATIONS.md). It is
-- recorded here as the canonical source so a future `supabase db push` does not
-- try to replay it.
--
-- WHY
--   `vocabulary` is public-read BY DESIGN - the Glossary, Vocab Trainer, article
--   drill and checkpoint all read it with the anon key before sign-in - but two
--   ad-hoc policies made it anon-WRITABLE:
--       temp_anon_insert_vocab  INSERT TO anon WITH CHECK true
--       temp_anon_update_vocab  UPDATE TO anon USING  true
--   The anon key ships in the client bundle (VITE_SUPABASE_ANON_KEY), so any
--   unauthenticated visitor could rewrite the whole 1000+ row dictionary -
--   translations, articles (gender), plurals, CEFR levels - from a browser
--   console. `anon` also held table-level ALL grants on every public table
--   (Supabase's default for SQL-editor-created tables), so a single accidental
--   DISABLE ROW LEVEL SECURITY would have exposed everything at once.
--
--   Seeding is unaffected: scripts/seedCurriculum.ts, scripts/seedVocab.ts and
--   scripts/importNotebookLm.ts all use SUPABASE_SERVICE_ROLE_KEY, which
--   bypasses RLS.

BEGIN;

DROP POLICY IF EXISTS temp_anon_insert_vocab ON public.vocabulary;
DROP POLICY IF EXISTS temp_anon_update_vocab ON public.vocabulary;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.vocabulary, public.sentences, public.content_items FROM anon;
GRANT SELECT ON public.vocabulary, public.sentences, public.content_items TO anon;

REVOKE ALL
  ON public.review_queue, public.profiles, public.a1_path_state,
     public.user_progress, public.user_streaks, public.user_achievements,
     public.user_xp, public.user_activity_days
  FROM anon;

COMMIT;

-- Invariant: every write policy must be scoped to the caller's own row via
-- auth.uid(), and anon must hold no write GRANT on any public table.
DO $$
DECLARE
  unguarded_writes text;
  bad_grants       text;
BEGIN
  SELECT string_agg(bad, ', ') INTO unguarded_writes FROM (
    SELECT format('%s.%s (%s TO %s) qual=%s check=%s', schemaname, tablename,
                  policyname, roles::text, coalesce(qual,'NULL'),
                  coalesce(with_check,'NULL')) AS bad
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
      AND coalesce(qual,'') NOT ILIKE '%auth.uid()%'
      AND coalesce(with_check,'') NOT ILIKE '%auth.uid()%'
  ) s;

  SELECT string_agg(g, ', ') INTO bad_grants FROM (
    SELECT format('%s (privileges: %s)', table_name,
                  string_agg(privilege_type, ',' ORDER BY privilege_type)) AS g
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND grantee = 'anon'
      AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')
    GROUP BY table_name
  ) s;

  IF unguarded_writes IS NOT NULL THEN
    RAISE EXCEPTION 'write policies not scoped to auth.uid(): %', unguarded_writes;
  END IF;
  IF bad_grants IS NOT NULL THEN
    RAISE EXCEPTION 'anon still holds write grants: %', bad_grants;
  END IF;
  RAISE NOTICE 'OK - anon: read-only on curriculum, denied on user tables';
END $$;

NOTIFY pgrst, 'reload schema';
