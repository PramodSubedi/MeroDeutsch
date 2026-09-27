-- ============================================================================
-- 20260929010000_admin_tables.sql
-- Admin control center — curriculum version history, audit log, app config.
-- ============================================================================
-- PAIRED WITH 20260929000000_add_profiles_role_and_banned.sql (run it first):
-- every RLS policy below calls `public.is_active_admin()`, which that migration
-- creates.
--
-- ── A DEVIATION FROM THE ORIGINAL SPEC, AND WHY ─────────────────────────────
-- The plan specified:
--
--   curriculum_versions.unit_id TEXT NOT NULL REFERENCES curriculum_units(id)
--
-- There IS NO `curriculum_units` TABLE. Verified across all 31 migrations in
-- this repo: the curriculum is AUTHORED CONTENT, not database rows. It lives in
-- `src/data/curriculum/units/m01.json … m15.json`, is checked by the hand-written
-- validator in `src/data/curriculum/schema.ts`, and is bundled into the app at
-- build time by `src/data/curriculum/index.ts`. (`.clinerules` Part H also puts a
-- Supabase curriculum migration explicitly out of scope.)
--
-- A foreign key to a non-existent table makes the whole migration fail to apply.
-- So `unit_id` is a plain TEXT column keyed by the same permanent `mNN` ids the
-- JSON files and `completedNodeIds` already use. Nothing is lost: the referential
-- integrity a FK would provide is impossible to have against files that ship in
-- the bundle, and an orphaned version row is harmless — it is a snapshot.
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

-- ── 1. Curriculum version history ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.curriculum_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id     TEXT NOT NULL,                       -- 'm01' … 'm15' (no FK: see header)
  lesson_json JSONB NOT NULL,                      -- full snapshot of units/<id>.json
  editor_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_curriculum_versions_unit_created
  ON public.curriculum_versions (unit_id, created_at DESC);

COMMENT ON TABLE public.curriculum_versions IS
  'Append-only snapshots of src/data/curriculum/units/<unit_id>.json taken on every CMS save, enabling rollback.';

ALTER TABLE public.curriculum_versions ENABLE ROW LEVEL SECURITY;

-- Admins may read history. Writes are service-role ONLY: a snapshot must be
-- trustworthy, and a client that could insert its own "history" could launder a
-- bad edit into looking canonical. The CMS write path is a privileged operation.
DROP POLICY IF EXISTS "Admins can read curriculum versions" ON public.curriculum_versions;
CREATE POLICY "Admins can read curriculum versions"
  ON public.curriculum_versions
  FOR SELECT
  USING (public.is_active_admin());

REVOKE INSERT, UPDATE, DELETE ON public.curriculum_versions FROM anon, authenticated;

-- ── 2. Admin audit log ─────────────────────────────────────────────────────
-- Compliance record of privileged actions: 'user.ban', 'user.unban',
-- 'vocab.import', 'unit.update', 'auth.denied', …
--
-- BEFORE/AFTER are stored so a rollback or a dispute can be settled from the log
-- alone. `admin_id` is ON DELETE RESTRICT rather than CASCADE: an audit trail
-- that silently disappears when the admin's account is deleted is not a trail.
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action      TEXT NOT NULL,
  target_type TEXT,                       -- 'user' | 'unit' | 'lesson' | 'vocab' | 'system'
  target_id   TEXT,
  before      JSONB,
  after       JSONB,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created
  ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target
  ON public.admin_audit_log (target_type, target_id);

COMMENT ON TABLE public.admin_audit_log IS
  'Append-only record of privileged admin actions. Admin read; service-role insert only.';

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read audit log" ON public.admin_audit_log;
CREATE POLICY "Admins can read audit log"
  ON public.admin_audit_log
  FOR SELECT
  USING (public.is_active_admin());

-- No INSERT policy is created on purpose. An admin who can write the audit log
-- can forge it. Entries are written by the service role (Edge Function / SQL).
REVOKE INSERT, UPDATE, DELETE ON public.admin_audit_log FROM anon, authenticated;

-- ── 3. App config — feature flags + maintenance mode ────────────────────────
-- One row per key, value as JSONB so a flag can be a bool, a number or a
-- structured payload without a schema change per flag.
CREATE TABLE IF NOT EXISTS public.app_config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT 'false'::jsonb,
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.app_config IS
  'Feature flags and operational switches (e.g. maintenance mode). Read by the learner app; written by service role.';

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ: the learner app must be able to honour maintenance mode BEFORE
-- anyone signs in, so this is intentionally world-readable like `vocabulary`.
DROP POLICY IF EXISTS "Public read access for app_config" ON public.app_config;
CREATE POLICY "Public read access for app_config"
  ON public.app_config
  FOR SELECT
  USING (true);

GRANT SELECT ON public.app_config TO anon, authenticated;

-- Writes are service-role only: a learner must not be able to switch
-- maintenance mode off, or flip a rollout flag, from a console.
REVOKE INSERT, UPDATE, DELETE ON public.app_config FROM anon, authenticated;

-- ── 4. Seed the flags the control center expects to exist ───────────────────
INSERT INTO public.app_config (key, value) VALUES
  ('maintenance_mode', 'false'::jsonb),
  ('registration_open', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- Invariant: the two compliance tables must be append-only from a client's
-- point of view. If a future migration grants a client INSERT on either, this
-- raises at apply time instead of silently making the audit log forgeable.
DO $$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(format('%s(%s)', tablename, policyname), ', ') INTO bad
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('admin_audit_log', 'curriculum_versions')
    AND cmd IN ('INSERT', 'UPDATE', 'DELETE');

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'admin compliance tables must stay service-role-only for writes: %', bad;
  END IF;
  RAISE NOTICE 'OK - audit log + version history are service-role-only for writes';
END $$;

NOTIFY pgrst, 'reload schema';
