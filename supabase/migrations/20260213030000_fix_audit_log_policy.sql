-- Fix security_audit_log INSERT policy to be more restrictive
-- The audit log should only be written by triggers, not directly by users

DO $$
DECLARE
  target_table regclass;
  target_name text;
BEGIN
  target_table := to_regclass('public.security_audit_log');
  target_name := 'security_audit_log';

  IF target_table IS NULL THEN
    target_table := to_regclass('public.security_audit_logs');
    target_name := 'security_audit_logs';
  END IF;

  IF target_table IS NULL THEN
    RAISE NOTICE 'Skipping audit log policy updates: table public.security_audit_log(s) does not exist';
    RETURN;
  END IF;

  IF target_name = 'security_audit_logs' THEN
    RAISE NOTICE 'Applying audit log policy updates to public.security_audit_logs (table name mismatch)';
  END IF;

  EXECUTE format('DROP POLICY IF EXISTS %I ON %s', 'System can insert security_audit_log', target_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %s', 'Only system triggers can insert audit_log', target_table);

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = target_name
      AND policyname = 'Only system triggers can insert audit_log'
  ) THEN
    EXECUTE format(
      'CREATE POLICY %I ON %s FOR INSERT TO authenticated WITH CHECK (false)',
      'Only system triggers can insert audit_log',
      target_table
    );
  END IF;
END $$;

-- Note: The log_sensitive_changes() function is SECURITY DEFINER which means
-- it runs with the privileges of the function owner (superuser), bypassing RLS.
-- This ensures audit logs can still be written by triggers while preventing
-- direct manipulation by users.
