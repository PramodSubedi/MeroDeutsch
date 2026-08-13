-- Phase 5: Database hardening migration
-- Adds missing columns, indexes, triggers, and policies

-- 1. Add missing columns to review_queue
ALTER TABLE review_queue 
  ADD COLUMN IF NOT EXISTS last_result TEXT CHECK (last_result IN ('correct', 'wrong')),
  ADD COLUMN IF NOT EXISTS box_level INTEGER DEFAULT 1 CHECK (box_level >= 1 AND box_level <= 5);

-- 2. Add composite index on review_queue for efficient due item queries
CREATE INDEX IF NOT EXISTS idx_review_queue_user_due 
  ON review_queue(user_id, due_at);

-- 3. Create updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Add updated_at triggers to tables that are missing them
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_progress_updated_at ON user_progress;
CREATE TRIGGER update_user_progress_updated_at
  BEFORE UPDATE ON user_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_streaks_updated_at ON user_streaks;
CREATE TRIGGER update_user_streaks_updated_at
  BEFORE UPDATE ON user_streaks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_review_queue_updated_at ON review_queue;
CREATE TRIGGER update_review_queue_updated_at
  BEFORE UPDATE ON review_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Add INSERT policy on profiles (fallback if signup trigger fails)
-- This allows users to create their own profile if the auth trigger didn't fire
CREATE POLICY "Users can insert their own profile" 
  ON profiles 
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Note: We're NOT moving curriculum data (alphabet/numbers) into Postgres
-- as per Phase 5 requirements. Curriculum remains in the client code.
