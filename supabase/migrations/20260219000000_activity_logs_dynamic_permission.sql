-- Update activity_logs RLS policy to use dynamic permission system
-- Instead of hardcoded admin/manager roles, use has_permission() function
-- so any role with 'logs.view' permission can read activity logs

DO $$
BEGIN
  IF to_regclass('public.activity_logs') IS NULL THEN
    RAISE NOTICE 'Skipping activity_logs policy updates: table public.activity_logs does not exist';
    RETURN;
  END IF;

  IF to_regprocedure('public.has_permission(uuid,text)') IS NULL THEN
    RAISE NOTICE 'Skipping activity_logs policy updates: function public.has_permission(uuid,text) does not exist';
    RETURN;
  END IF;

  -- Drop old hardcoded policy
  DROP POLICY IF EXISTS "Only admins and managers can view activity_logs" ON public.activity_logs;

  -- Create new policy using dynamic permission check
  DROP POLICY IF EXISTS "Users with logs.view permission can view activity_logs" ON public.activity_logs;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'activity_logs'
      AND policyname = 'Users with logs.view permission can view activity_logs'
  ) THEN
    CREATE POLICY "Users with logs.view permission can view activity_logs"
      ON public.activity_logs FOR SELECT
      USING (public.has_permission(auth.uid(), 'logs.view'));
  END IF;
END $$;

-- Also update the activity_logs_view if RLS applies to it
-- (Views inherit RLS from underlying tables, so updating activity_logs is sufficient)
