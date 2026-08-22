-- Migration: 008_a1_path_state.sql
--
-- Cross-device sync for the A1 learning-path campaign state
-- (`useA1Path`: completedNodeIds / unlockedUnitIndex / checkpointBestByUnit).
-- Mirrors the existing user_xp / user_streaks infrastructure: one row per
-- user, RLS-restricted to owner-only access.
--
-- Local-first rule: Dexie (IndexedDB) remains the primary store; this table is
-- written via a debounced upsert when authenticated and read once on hydration
-- when no local row exists yet.

-- 1. Table — one row per user.
CREATE TABLE IF NOT EXISTS a1_path_state (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  unlocked_unit_index INTEGER NOT NULL DEFAULT 0,
  completed_node_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  checkpoint_best_by_unit JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Trigger to auto-update `updated_at` on every write.
CREATE OR REPLACE FUNCTION update_a1_path_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_a1_path_state_updated_at ON a1_path_state;
CREATE TRIGGER trg_a1_path_state_updated_at
BEFORE UPDATE ON a1_path_state
FOR EACH ROW
EXECUTE FUNCTION update_a1_path_state_timestamp();

-- 3. Row Level Security — users can only read/write their own row.
ALTER TABLE a1_path_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own A1 path" ON a1_path_state;
CREATE POLICY "Users can view their own A1 path"
  ON a1_path_state FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own A1 path" ON a1_path_state;
CREATE POLICY "Users can insert their own A1 path"
  ON a1_path_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own A1 path" ON a1_path_state;
CREATE POLICY "Users can update their own A1 path"
  ON a1_path_state FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Grants (match the role names used by migrations 003 / 005).
GRANT SELECT, INSERT, UPDATE ON a1_path_state TO authenticated;