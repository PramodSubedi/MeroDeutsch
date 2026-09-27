-- ============================================================================
-- 20260930010000_seed_curriculum_source_flag.sql
-- Register the `curriculum_source` switch in `app_config`.
-- ============================================================================
-- WHY
-- The resolver in `src/data/curriculum/resolveActive.ts` reads this key. Until
-- it exists as a ROW, the read returns undefined, which the resolver treats as
-- "flag unreadable" and falls back to the bundle. That is the correct
-- behaviour, but it is indistinguishable from a typo in the key name, and the
-- flag is invisible to anyone poking at `app_config` to find out what can be
-- switched.
--
-- Seeding it as an explicit `"bundle"` makes the current behaviour declared
-- rather than implied, and gives the control centre something to show and flip.
--
-- VALUE SHAPE
-- Stored as the JSONB string `"bundle"`, so the value column reads
-- '"bundle"' — the same shape `resolveSource` expects. A bare `false` or a
-- number would not parse, which is the point: only a string can be a source.
--
-- SAFE TO RUN TWICE, AND SAFE TO RUN AT ALL
-- `ON CONFLICT DO NOTHING` never overwrites an existing choice, so re-running
-- cannot silently revert a deliberate switch back to `db`. The default matches
-- today's behaviour exactly, so applying this changes nothing for learners.
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

INSERT INTO public.app_config (key, value, updated_at)
VALUES ('curriculum_source', '"bundle"'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

COMMENT ON COLUMN public.app_config.value IS
  'JSONB. `curriculum_source` is the string "bundle" or "db"; any other value (or a missing row) resolves to the bundled curriculum.';

COMMIT;

-- Assert the flag is readable and currently OFF. This is the state that must
-- hold for a learner to see the shipped curriculum.
DO $$
DECLARE
  v jsonb;
BEGIN
  SELECT value INTO v FROM public.app_config WHERE key = 'curriculum_source';

  IF v IS NULL THEN
    RAISE EXCEPTION 'curriculum_source did not seed';
  END IF;
  IF v #>> '{}' <> 'bundle' THEN
    RAISE NOTICE 'curriculum_source is currently "%" - not the safe default', v #>> '{}';
  ELSE
    RAISE NOTICE 'OK - curriculum_source is "bundle" (learners see the shipped curriculum)';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
