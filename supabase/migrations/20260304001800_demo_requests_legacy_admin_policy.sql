DROP POLICY IF EXISTS "read_demo_requests_admin" ON public.demo_requests;
CREATE POLICY "read_demo_requests_admin"
  ON public.demo_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'tenant_admin', 'admin', 'manager')
    )
  );
