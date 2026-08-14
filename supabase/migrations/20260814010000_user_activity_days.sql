-- Migration: user_activity_days table for real activity heatmap
-- Adds a table to track per-day learning activity (engagement events).
-- Guests are never written here — only authenticated users via RLS.

CREATE TABLE IF NOT EXISTS user_activity_days (
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  event_count   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, activity_date)
);

-- Index for efficient date-range queries (dashboard / analytics last-30-day lookups)
CREATE INDEX IF NOT EXISTS idx_user_activity_days_user_date
  ON user_activity_days(user_id, activity_date DESC);

-- Row Level Security
ALTER TABLE user_activity_days ENABLE ROW LEVEL SECURITY;

-- Users can only see, insert, and update their own activity rows.
CREATE POLICY "Users can view their own activity"
  ON user_activity_days
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity"
  ON user_activity_days
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity"
  ON user_activity_days
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Keep updated_at fresh
DROP TRIGGER IF EXISTS update_user_activity_days_updated_at ON user_activity_days;
CREATE TRIGGER update_user_activity_days_updated_at
  BEFORE UPDATE ON user_activity_days
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();