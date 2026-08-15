-- Migration: 005_repair_sync_tables.sql
--
-- Complete repair for the DevTools backend failures:
--   * HTTP 404: `user_activity_days` and `user_xp` tables missing
--   * HTTP 400: `review_queue` column schema mismatch
--
-- Creates/repairs the tables, enables Row-Level Security, adds per-user
-- policies, and refreshes the PostgREST schema cache so all queries return
-- 200 OK after this runs.

-- 1. Create / Repair review_queue Table
CREATE TABLE IF NOT EXISTS public.review_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_key VARCHAR(100) NOT NULL,
    module_type VARCHAR(50) NOT NULL DEFAULT 'articles',
    box INT NOT NULL DEFAULT 1 CHECK (box BETWEEN 1 AND 4),
    error_count INT NOT NULL DEFAULT 0,
    success_count INT NOT NULL DEFAULT 0,
    last_reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    due_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, item_key, module_type)
);

-- 1b. Add the columns the client (useReviewQueue.ts) queries, so the existing
--     REST queries return 200 OK without any client changes.
ALTER TABLE public.review_queue
  ADD COLUMN IF NOT EXISTS user_answer TEXT,
  ADD COLUMN IF NOT EXISTS correct_answer TEXT,
  ADD COLUMN IF NOT EXISTS ease DOUBLE PRECISION DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS interval_days INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS repetitions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_result TEXT CHECK (last_result IN ('correct', 'wrong')),
  ADD COLUMN IF NOT EXISTS box_level INTEGER DEFAULT 1 CHECK (box_level BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Create user_xp Table
CREATE TABLE IF NOT EXISTS public.user_xp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    total_xp INT NOT NULL DEFAULT 0,
    level INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create user_activity_days Table
CREATE TABLE IF NOT EXISTS public.user_activity_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    event_count INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, activity_date)
);

-- 4. Enable RLS on all tables
ALTER TABLE public.review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_xp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_days ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies for Authenticated Users
CREATE POLICY "Manage own review_queue" ON public.review_queue
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Manage own user_xp" ON public.user_xp
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Manage own user_activity_days" ON public.user_activity_days
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Reload Schema Cache
NOTIFY pgrst, 'reload schema';