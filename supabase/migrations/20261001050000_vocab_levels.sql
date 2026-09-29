-- ============================================================================
-- 20261001050000_vocab_levels.sql
--
-- A `DISTINCT` over one column, in the database.
--
-- ── WHAT THIS REPLACES ───────────────────────────────────────────────────────
-- `supabaseCurriculumService.ts:686-688`:
--
--   supabase.from('vocabulary').select('level')
--
-- Unfiltered. Unlimited. Every row of the dictionary, to read one column, in
-- order to build a filter dropdown.
--
-- It is cached for 15 minutes, so it is not a hot path — but it is the only
-- UNCONDITIONAL full-table scan in the learner app, and it is the only read
-- there with no error guard: a failure silently yields an empty level list, so
-- the dropdown comes up short and the learner sees "this app has fewer levels",
-- which is indistinguishable from a content problem.
--
-- `vocabulary` is ~1,062 rows today, so the cost is currently trivial. It is
-- written as a full scan because it is one, and it will stay a full scan at
-- 100,000 rows. `SELECT DISTINCT` is not a smaller query, it is the same query
-- with the answer computed on the side that has an index.
--
-- This table is PUBLIC READ (`USING (true)`, 004:24), so the function needs no
-- admin check — and must NOT have one, or it would break the learner app it
-- exists to serve. It is granted to `anon` deliberately, which is the opposite
-- of every other function in this series and is called out so a future pass does
-- not "fix" it.
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.vocab_levels()
RETURNS TABLE (level text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT v.level
    FROM public.vocabulary v
   WHERE v.level IS NOT NULL AND btrim(v.level) <> ''
   ORDER BY v.level;
$$;

-- Granted to `anon` ON PURPOSE. `vocabulary` is public-read content the learner
-- app fetches before sign-in; a function that requires an admin session to
-- return the CEFR levels would be a regression dressed as hardening.
REVOKE ALL ON FUNCTION public.vocab_levels() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vocab_levels() TO anon, authenticated;

COMMIT;

-- ============================================================================
-- Post-COMMIT verification
-- ============================================================================

DO $$
DECLARE
  cfg text[];
BEGIN
  IF to_regprocedure('public.vocab_levels()') IS NULL THEN
    RAISE EXCEPTION 'vocab_levels() was not created';
  END IF;

  SELECT p.proconfig INTO cfg
    FROM pg_proc p
   WHERE p.oid = 'public.vocab_levels()'::regprocedure;

  IF cfg IS NULL OR NOT (cfg @> ARRAY['search_path=public']) THEN
    RAISE EXCEPTION 'vocab_levels() does not have search_path pinned to public (proconfig = %)', coalesce(cfg::text, 'NULL');
  END IF;

  -- The whole point: DISTINCT, in the database. A function that selects the
  -- column without DISTINCT returns one row per dictionary entry and the
  -- dropdown grows without bound.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.oid = 'public.vocab_levels()'::regprocedure
       AND pg_get_functiondef(p.oid) ILIKE '%DISTINCT%'
  ) THEN
    RAISE EXCEPTION 'vocab_levels() does not SELECT DISTINCT — it would return one row per vocabulary entry';
  END IF;

  -- And it MUST be reachable by anon, or the learner filter dropdown silently
  -- empties. Asserted because the instinct to tighten a SECURITY DEFINER
  -- function is strong and this one is the exception.
  IF NOT has_function_privilege('public.vocab_levels()'::regprocedure, 'anon', 'EXECUTE') THEN
    RAISE EXCEPTION 'vocab_levels() is not executable by anon — the learner app calls it before sign-in';
  END IF;
END $$;
