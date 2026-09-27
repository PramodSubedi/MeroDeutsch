-- ============================================================================
-- 20260930020000_curriculum_units.sql
-- The authored curriculum as database rows, behind a flag that defaults OFF.
-- ============================================================================
-- WHY THIS TABLE, WHEN `curriculum_versions` ALREADY EXISTS
-- `curriculum_versions` (20260929010000) is an append-only SNAPSHOT history: one
-- row per save, kept so a rollback can be settled. It is not a source of
-- content - nothing reads it to build the spine.
--
-- This table is the actual editable unit store. The two are used together: a
-- publish writes here AND appends to `curriculum_versions`, so "what is live"
-- and "what did it used to be" are separable.
--
-- EMPTY ON PURPOSE
-- This migration creates the table and NOTHING else. There is no backfill in
-- it, deliberately: the bundle files are being actively edited, and importing a
-- moving target produces a database that disagrees with the code - the exact
-- drift the `curriculum_source` flag exists to prevent. The backfill is
-- `scripts/curriculum/backfillUnits.ts`, a separate, reviewable step that is
-- dry-run by default.
--
-- The flag stays at its seeded default of "bundle" (20260930010000), so no
-- learner sees any of this. An empty table behind an off flag is inert.
--
-- WHY THE PRIMARY KEY IS TEXT, NOT A UUID
-- The unit ids are the permanent `mNN` strings the JSON files, the A1 path and
-- every learner's `completedNodeIds` already use. A surrogate UUID would need a
-- permanent translation table to stay joinable with the bundle. The id is the
-- contract.
--
-- WHY `doc JSONB` AND NOT ONE COLUMN PER FIELD
-- The unit schema has a `pedagogy` object with nested rows that vary by unit. A
-- relational layout would need a table per nested shape and a migration per new
-- field; the point of the control centre is that an author can change content
-- without a deploy. The exact shape is enforced by `validateCurriculum` at
-- publish time, which is stronger than a CHECK constraint can be.
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.curriculum_units (
  id           TEXT PRIMARY KEY,                      -- 'm01' … 'm15'
  "order"      INTEGER NOT NULL,                      -- 1..N, contiguous from 1
  doc          JSONB NOT NULL,                        -- full units/<id>.json
  is_published BOOLEAN NOT NULL DEFAULT FALSE,        -- draft vs live
  updated_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Mirrors the authored invariant. A CHECK is the last line of defence, not the
  -- first: the real validation is `validateCurriculum`, run by the publisher.
  CONSTRAINT curriculum_units_id_format CHECK (id ~ '^m[0-9]{2}$'),
  CONSTRAINT curriculum_units_order_positive CHECK ("order" >= 1)
);

COMMENT ON TABLE public.curriculum_units IS
  'The authored curriculum as editable rows. Empty until a deliberate backfill; the app reads the bundled JSON unless curriculum_source = ''db''.';
COMMENT ON COLUMN public.curriculum_units.doc IS
  'Full contents of src/data/curriculum/units/<id>.json, validated by validateCurriculum before any write is accepted.';
COMMENT ON COLUMN public.curriculum_units.is_published IS
  'FALSE for drafts. Only published rows are candidates for serving when curriculum_source = db.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_curriculum_units_order
  ON public.curriculum_units ("order");

CREATE INDEX IF NOT EXISTS idx_curriculum_units_published
  ON public.curriculum_units (is_published, "order");

ALTER TABLE public.curriculum_units ENABLE ROW LEVEL SECURITY;

-- Admins may READ the store so the control centre can show it. This mirrors
-- `curriculum_versions`, which is admin-readable and service-write-only.
DROP POLICY IF EXISTS "Admins can read curriculum units" ON public.curriculum_units;
CREATE POLICY "Admins can read curriculum units"
  ON public.curriculum_units
  FOR SELECT
  USING (public.is_active_admin());

-- No INSERT/UPDATE/DELETE policy, on purpose. An admin who could write this
-- table could publish content the build's validator would have rejected. The
-- ONLY write path is the `admin-action` Edge Function, which validates before it
-- writes and records every attempt in the audit log.
REVOKE INSERT, UPDATE, DELETE ON public.curriculum_units FROM anon, authenticated;

COMMIT;

-- Assert the table is still service-write-only, and that it is EMPTY. A non-empty
-- table here would mean something backfilled it without review, which is exactly
-- what this migration is designed to prevent.
DO $$
DECLARE
  bad text;
  n bigint;
BEGIN
  SELECT string_agg(format('%s(%s)', tablename, policyname), ', ') INTO bad
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'curriculum_units'
    AND cmd IN ('INSERT', 'UPDATE', 'DELETE');

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'curriculum_units must stay service-role-only for writes: %', bad;
  END IF;

  SELECT count(*) INTO n FROM public.curriculum_units;
  IF n <> 0 THEN
    RAISE EXCEPTION 'curriculum_units has % row(s); this migration must create it EMPTY', n;
  END IF;

  RAISE NOTICE 'OK - curriculum_units created empty, service-write-only, flag still bundle';
END $$;

NOTIFY pgrst, 'reload schema';
