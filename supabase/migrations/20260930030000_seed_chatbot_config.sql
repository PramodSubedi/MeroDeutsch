-- ============================================================================
-- 20260930030000_seed_chatbot_config.sql
-- Register the seven global defaults for the AI companion in `app_config`.
-- ============================================================================
-- WHY
-- `config.set` UPSERTs, so none of these rows are REQUIRED for the feature to
-- work — an absent key reads as "unset" and the learner uses the shipped
-- default. Seeding exists for two reasons an absent row cannot serve:
--
--   1. VISIBILITY. `SystemPage` renders whatever is in `app_config`. An absent
--      flag is indistinguishable from a typo in the key name, so nobody poking
--      at the table can discover that these keys are switchable at all. This is
--      the identical argument as 20260930010000_seed_curriculum_source_flag.
--   2. DECLARATION. "Mero is on, with these defaults" is a decision. "Nothing is
--      set, so the constants in `src/config/chatbot.ts` happen to apply" is an
--      accident waiting to be read as intent.
--
-- Every value below is EXACTLY what `src/config/chatbot.ts` already ships, so
-- applying this migration changes nothing for any learner.
--
-- ON CONFLICT DO NOTHING, NOT DO UPDATE
-- An update would silently revert a deliberate admin choice back to the seeded
-- default every time this file is re-applied. These are live switches for a
-- user-facing feature; re-running a migration must not undo a decision made
-- since. Same rule as the curriculum flag, for the same reason.
--
-- VALUE SHAPES
-- The column is JSONB, so the scalars land as bare JSON values rather than
-- strings: `'x'::jsonb` is the string "x", `'true'::jsonb` is the boolean true.
-- `config.set` writes them the same way. The three free-text keys keep their
-- case on the way in and on the way out — a model name is an identifier, and
-- lowercasing `Qwen2.5:3b` would name a model that is not installed.
--
-- SAFE TO RUN TWICE, AND SAFE TO RUN AT ALL
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

INSERT INTO public.app_config (key, value, updated_at) VALUES
  ('chatbot_enabled',              'true'::jsonb,  now()),
  ('chatbot_base_url',             '"http://localhost:11434"'::jsonb, now()),
  ('chatbot_default_model',        '"qwen2.5:3b"'::jsonb, now()),
  ('chatbot_allowed_models',       '"qwen2.5:3b, llama3.2:3b, phi3.5:3.8b, gemma2:2b"'::jsonb, now()),
  ('chatbot_default_intensity',    '"balanced"'::jsonb, now()),
  ('chatbot_default_language_mix', '"de_en_ne"'::jsonb, now()),
  ('chatbot_default_auto_open',    'true'::jsonb,  now())
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.app_config IS
  'Feature flags and operational switches. Read by the learner app; written by service role. '
  'The chatbot_* keys are the global defaults for the AI companion: they seed NEW learners and '
  'anyone who has not overridden a value, and never overwrite a learner choice held in localStorage.';

COMMIT;

-- Assert the companion config is readable and shaped as the reader expects. A
-- wrong value here is SILENT — the learner simply gets a different default — so
-- it is worth failing loudly at apply time rather than discovering it later.
DO $$
DECLARE
  v_enabled jsonb;
  v_model   jsonb;
  v_count   int;
BEGIN
  SELECT value INTO v_enabled FROM public.app_config WHERE key = 'chatbot_enabled';
  IF v_enabled IS NULL THEN
    RAISE EXCEPTION 'chatbot_enabled did not seed';
  END IF;
  -- A hand-written row may hold the string "true" instead of a boolean; both are
  -- read as enabled by `src/data/chatbot/config.ts`.
  IF v_enabled #>> '{}' <> 'true' THEN
    RAISE NOTICE 'chatbot_enabled is currently "%" - the companion may be off for everyone', v_enabled #>> '{}';
  END IF;

  SELECT value INTO v_model FROM public.app_config WHERE key = 'chatbot_default_model';
  IF v_model IS NULL OR jsonb_typeof(v_model) <> 'string' THEN
    RAISE EXCEPTION 'chatbot_default_model did not seed as a JSON string (got %)', v_model;
  END IF;

  SELECT count(*) INTO v_count FROM public.app_config WHERE key LIKE 'chatbot%';
  IF v_count < 7 THEN
    RAISE EXCEPTION 'expected 7 chatbot config keys, found %', v_count;
  END IF;

  RAISE NOTICE 'OK - % chatbot config keys present; default model is "%"', v_count, v_model #>> '{}';
END $$;

NOTIFY pgrst, 'reload schema';