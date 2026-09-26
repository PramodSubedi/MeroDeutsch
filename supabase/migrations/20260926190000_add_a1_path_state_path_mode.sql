-- Migration: 20260926190000_add_a1_path_state_path_mode.sql
--
-- Adds the guided / self-guided learning-mode preference to public.a1_path_state.
--
-- WHY
-- ---
-- The A1 spine currently hard-codes one progression model: a module unlocks only
-- when the previous module's checkpoint is passed. That is right for a learner
-- who does not know where to start, and wrong for a learner who already speaks
-- some German or only needs, say, the travel module — they must grind through
-- unrelated gates first.
--
-- `path_mode` records the learner's CHOICE. It changes access, never scoring:
-- checkpoints are still taken, still scored, still stored, and still drive the
-- "Mastered" badge. It does not touch the >=80% gate logic itself.
--
-- SAFETY ON DEPLOY
-- ---------------
-- `NOT NULL DEFAULT 'guided'` backfills every existing row with the behaviour it
-- already had, so applying this migration cannot change anyone's course. A
-- learner has to actively opt in to 'self'.
--
-- The CHECK constraint is added in a separate statement because Postgres has no
-- `ADD CONSTRAINT IF NOT EXISTS`; it is wrapped in a DO block so re-running the
-- migration is a no-op rather than an error.
--
-- SCOPE
-- -----
-- This is a path-state column, NOT a curriculum/content migration. It adds no
-- content tables and changes no existing column, so it stays well clear of the
-- .clinerules Part H exclusion on curriculum Supabase migrations.

ALTER TABLE public.a1_path_state
  ADD COLUMN IF NOT EXISTS path_mode TEXT NOT NULL DEFAULT 'guided';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'a1_path_state_path_mode_check'
  ) THEN
    ALTER TABLE public.a1_path_state
      ADD CONSTRAINT a1_path_state_path_mode_check
      CHECK (path_mode IN ('guided', 'self'));
  END IF;
END $$;

COMMENT ON COLUMN public.a1_path_state.path_mode IS
  'Learner progression preference: guided (gated spine, default) or self (all modules open). Changes access only, never checkpoint scoring.';
