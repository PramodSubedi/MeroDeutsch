-- Migration: 003_add_daily_quests_and_high_scores_tables.sql
--
-- Add persistent storage for daily quests (auto-resetting 3-archetype system)
-- and high-score tracking for rapid-fire blitz rounds.
--
-- Changes from previous state:
--  - user_achievements already exists (created earlier in the project).
--  - New tables: daily_quests, high_scores
--

-- 1. daily_quests table — stores the per-user daily quest state
--    (progress, claimed status, last reset date). One row per user per day.
CREATE TABLE IF NOT EXISTS daily_quests (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_id TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  max_progress INTEGER NOT NULL DEFAULT 1,
  claimed BOOLEAN NOT NULL DEFAULT FALSE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  last_reset TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, quest_id)
);

-- Index for quick lookup of all quests per user.
CREATE INDEX IF NOT EXISTS idx_daily_quests_user_id ON daily_quests(user_id);

-- 2. high_scores table — stores top scores per user for rapid-fire blitz.
CREATE TABLE IF NOT EXISTS high_scores (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  blitz_rounds INTEGER NOT NULL DEFAULT 0,
  accuracy DECIMAL(5,2) NOT NULL DEFAULT 0.0,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id) -- one high-score record per user (upsert on new high)
);

-- Index for leaderboard queries.
CREATE INDEX IF NOT EXISTS idx_high_scores_score ON high_scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_high_scores_achieved_at ON high_scores(achieved_at DESC);

-- 3. Trigger to auto-update `updated_at` on daily_quests rows.
CREATE OR REPLACE FUNCTION update_daily_quests_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_daily_quests_updated_at
BEFORE UPDATE ON daily_quests
FOR EACH ROW
EXECUTE FUNCTION update_daily_quests_timestamp();

-- 4. Grant access (adjust if your Supabase project uses different role names).
GRANT ALL ON daily_quests TO authenticated;
GRANT ALL ON high_scores TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE high_scores_id_seq TO authenticated;