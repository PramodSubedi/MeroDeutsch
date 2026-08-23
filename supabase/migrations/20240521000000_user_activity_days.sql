-- Migration: 003b_user_activity_days.sql
--
-- Creates the user_activity_days table for the Dashboard activity heatmap.
-- Fixes the 404 REST API error: relation "user_activity_days" does not exist.

CREATE TABLE IF NOT EXISTS public.user_activity_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    event_count INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, activity_date)
);

ALTER TABLE public.user_activity_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own activity days"
    ON public.user_activity_days FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';