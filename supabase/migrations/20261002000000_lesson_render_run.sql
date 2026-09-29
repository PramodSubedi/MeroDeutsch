-- ============================================================================
-- 20261002000000_lesson_render_run.sql
-- Register the `lesson_render` switch and turn the step-flow lesson renderer ON.
-- ============================================================================
-- WHY
-- `/lesson/:n` has two renderers. `legacy` is the long-standing document + tab
-- page (`LessonModulePage`). `run` is the step-flow (`LessonRunPage`): one
-- exercise at a time, immediate feedback, auto-advance.
--
-- The unit spine's `learn` nodes were repointed from shared tool pages to
-- `/lesson/:n`, so this flag decides what a learner actually gets when they click
-- through the path. Until it is set, every one of those clicks lands on `legacy`.
--
-- The exercises are the reason to turn it on. The 16 authored lessons carry 192
-- scored check steps, all validated by `npm run check:steps`; the legacy page
-- renders the same lessons as a document. The 100 typed steps each declare an
-- `ask`, so the renderer never has to infer the instruction — the other 92 check
-- steps (mcq, arrange, match, dictation) have no `ask` field and do not need one.
-- The reading stays on the legacy renderer, at `/lesson/:n/notes`, linked from
-- the end of the run.
--
-- ALREADY APPLIED, VIA A SINGLE STATEMENT
-- The row is live in production (`value #>> '{}' = 'run'`, `jsonb_typeof = string`).
-- It was written through the Management API rather than `db push`, so nothing was
-- recorded in `supabase_migrations.schema_migrations` (31 rows before and after).
-- That was deliberate — see the history note below — and it means THIS FILE still
-- needs to run when the history is reconciled. `ON CONFLICT DO UPDATE` converges
-- on `run`, so it is a no-op today and correct later.
--
-- ── MIGRATION HISTORY HAS DIVERGED — RECONCILE BEFORE ANY `db push` ──────────
-- As of 2026-09-29 the local `supabase/migrations/` directory and the production
-- `supabase_migrations.schema_migrations` table disagree in BOTH directions:
--
--   · ~15 local files were already applied to production under different
--     filenames. Confirmed against the live schema — `profiles.role`,
--     `banned_at`, `ban_reason`, `is_active_admin()`, and a `curriculum_units`
--     table with 16 rows all exist. Nothing was lost; the work is duplicated.
--   · 17 production entries have no local file at all.
--
-- So a `db push` today would RE-RUN those ~15, which is mostly harmless upserts
-- but also re-runs `20260826000000_review_queue_id_text.sql` (an ALTER on
-- `review_queue`), a security lockdown, and four `harden_*` files.
--
-- The three `seed_uhrzeit_conversation_pools` files are among the duplicated
-- ones and must NOT be re-run blind: `content_items` already holds `uhrzeit-item`
-- (21), `conversation-def` (25) and `conversation-vocab` (219) under the
-- production names, and their `ON CONFLICT DO UPDATE SET payload` would replace
-- live payloads with the older copies in these files.
--
-- Reconciling this is its own decision about which history is authoritative. It
-- is not a step to fold into a content rollout.
--
-- VALUE SHAPE
-- Stored as the JSONB string `"run"`, so the column reads `'"run"'` — the shape
-- `resolveLessonRender` expects. A bare boolean would not parse, which is the
-- point: `legacy` and `run` are the only two answers, and anything else resolves
-- to `legacy` rather than to a third behaviour nobody has tested.
--
-- ROLLBACK — one statement, no deploy
--   UPDATE public.app_config SET value = '"legacy"'::jsonb, updated_at = now()
--    WHERE key = 'lesson_render';
-- The resolver reads this key on boot and caches it per browser, so a rolled-back
-- learner picks the change up on their next full page load. `?render=run` and
-- `?render=legacy` override it in dev only — the override is compiled out of a
-- production build, so this row is the only production control.
--
-- NOT a `DO NOTHING` seed, deliberately
-- The `curriculum_source` migration seeded its CURRENT value, because seeding
-- `db` would have changed what every learner saw. This one seeds a CHANGE, so
-- `ON CONFLICT DO UPDATE` is the honest clause: re-running converges on `run`
-- rather than silently leaving a deliberate rollback in place. If that is not what
-- you want after a rollback, do not re-run it.
--
-- SAFE TO RUN TWICE.
-- ============================================================================

BEGIN;

INSERT INTO public.app_config (key, value, updated_at)
VALUES ('lesson_render', '"run"'::jsonb, now())
ON CONFLICT (key) DO UPDATE
  SET value = excluded.value, updated_at = now();

COMMENT ON COLUMN public.app_config.value IS
  'JSONB. `lesson_render` is the string "legacy" or "run"; any other value (or a missing row) resolves to the document lesson page.';

COMMIT;

-- Assert the flag landed on the value the renderer will read. A typo in the key
-- would otherwise leave every lesson on the legacy page with no error anywhere,
-- which is the failure mode `source.check.ts` warns about for `curriculum_source`.
DO $$
DECLARE
  v jsonb;
BEGIN
  SELECT value INTO v FROM public.app_config WHERE key = 'lesson_render';

  IF v IS NULL THEN
    RAISE EXCEPTION 'lesson_render did not seed';
  END IF;

  IF v #>> '{}' <> 'run' THEN
    RAISE EXCEPTION 'lesson_render is "%", not "run" — learners stay on the legacy lesson page', v #>> '{}';
  END IF;

  RAISE NOTICE 'OK - lesson_render is "run" (/lesson/:n renders the step-flow)';
  RAISE NOTICE 'Rollback: UPDATE public.app_config SET value = ''"legacy"'', updated_at = now() WHERE key = ''lesson_render'';';
END $$;

NOTIFY pgrst, 'reload schema';
