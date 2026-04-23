DROP POLICY IF EXISTS "read_demo_requests_admin" ON public.demo_requests;
CREATE POLICY "read_demo_requests_superadmin"
  ON public.demo_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

DO $$
DECLARE
  suspicious_user_ids uuid[];
BEGIN
  SELECT COALESCE(array_agg(id), '{}'::uuid[])
  INTO suspicious_user_ids
  FROM auth.users
  WHERE lower(email) <> lower('elsiddique@gmail.com')
    AND (
      COALESCE(is_anonymous, false) = true
      OR lower(email) LIKE '%@example.net'
      OR lower(email) LIKE 'jwt.%'
      OR lower(email) LIKE 'e2e.%'
    );

  IF array_length(suspicious_user_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.tenant_members
  WHERE user_id = ANY(suspicious_user_ids);

  DELETE FROM public.user_roles
  WHERE user_id = ANY(suspicious_user_ids);

  DELETE FROM public.profiles
  WHERE id = ANY(suspicious_user_ids);

  UPDATE public.demo_requests
  SET reviewed_by = NULL,
      approved_user_id = NULL
  WHERE reviewed_by = ANY(suspicious_user_ids)
     OR approved_user_id = ANY(suspicious_user_ids);

  UPDATE public.registration_requests
  SET reviewed_by = NULL
  WHERE reviewed_by = ANY(suspicious_user_ids);

  DELETE FROM auth.users
  WHERE id = ANY(suspicious_user_ids);
END $$;
