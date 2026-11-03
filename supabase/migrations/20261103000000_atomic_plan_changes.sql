-- Atomic premium entitlement changes.
-- The service-role admin action is the only caller; the function updates the
-- protected plan and its audit record in one transaction.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_change_user_plan(
  p_actor_id uuid,
  p_target_id uuid,
  p_action text,
  p_expected_plan text,
  p_reason text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_plan text;
  next_plan text;
BEGIN
  IF session_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    RAISE EXCEPTION 'admin_change_user_plan requires a privileged session'
      USING ERRCODE = '42501';
  END IF;

  IF p_action = 'user.grant_premium' THEN
    next_plan := 'premium';
  ELSIF p_action = 'user.revoke_premium' THEN
    next_plan := 'free';
  ELSE
    RAISE EXCEPTION 'unsupported plan action: %', p_action
      USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(plan, 'free')
    INTO current_plan
    FROM public.profiles
   WHERE id = p_target_id
   FOR UPDATE;

  IF current_plan IS NULL THEN
    RAISE EXCEPTION 'target profile does not exist'
      USING ERRCODE = 'P0002';
  END IF;

  IF p_expected_plan IS DISTINCT FROM current_plan THEN
    RAISE EXCEPTION 'target plan changed before this request was applied'
      USING ERRCODE = '40001';
  END IF;

  UPDATE public.profiles
     SET plan = next_plan
   WHERE id = p_target_id;

  INSERT INTO public.admin_audit_log (
    admin_id,
    action,
    target_type,
    target_id,
    before,
    after,
    user_agent
  ) VALUES (
    p_actor_id,
    p_action,
    'user',
    p_target_id::text,
    jsonb_build_object('plan', current_plan),
    jsonb_build_object('plan', next_plan, 'reason', nullif(trim(p_reason), '')),
    p_user_agent
  );

  RETURN jsonb_build_object('before', current_plan, 'after', next_plan);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_change_user_plan(uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_change_user_plan(uuid, uuid, text, text, text, text) TO service_role;

COMMIT;
