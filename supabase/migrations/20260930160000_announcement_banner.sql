-- ============================================================================
-- 20260930160000_announcement_banner.sql
-- Announcement banner for global user communication.
-- ============================================================================
-- WHY THIS EXISTS
-- Admins need a way to reach all users: maintenance notices, feature
-- announcements, policy changes. The banner is:
--   - Public-read (visible before sign-in)
--   - Dismissible per-user (stored in announcement_dismissals)
--   - Structured JSON: { text, link?, severity, dismissible }
-- ============================================================================

BEGIN;

-- Add the announcement banner key to app_config
INSERT INTO public.app_config (key, value) VALUES
  ('announcement_banner', '{"text":"","severity":"info","dismissible":true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Per-user dismissal tracking
CREATE TABLE IF NOT EXISTS public.announcement_dismissals (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banner_id   UUID NOT NULL DEFAULT gen_random_uuid(),
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, banner_id)
);

COMMENT ON TABLE public.announcement_dismissals IS
  'Tracks which users have dismissed which announcement banner. Allows re-showing when banner content changes.';

ALTER TABLE public.announcement_dismissals ENABLE ROW LEVEL SECURITY;

-- Users can read their own dismissals
DROP POLICY IF EXISTS "Users can read own dismissals" ON public.announcement_dismissals;
CREATE POLICY "Users can read own dismissals"
  ON public.announcement_dismissals
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own dismissals
DROP POLICY IF EXISTS "Users can dismiss announcements" ON public.announcement_dismissals;
CREATE POLICY "Users can dismiss announcements"
  ON public.announcement_dismissals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can read all dismissals
DROP POLICY IF EXISTS "Admins can read all dismissals" ON public.announcement_dismissals;
CREATE POLICY "Admins can read all dismissals"
  ON public.announcement_dismissals
  FOR SELECT
  USING (public.is_active_admin());

-- Service role can clean up old dismissals when banner changes
REVOKE DELETE ON public.announcement_dismissals FROM anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';