CREATE TABLE IF NOT EXISTS public.registration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_registration_requests_status_created_at
  ON public.registration_requests(status, created_at DESC);

ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_registration_requests_public" ON public.registration_requests;
CREATE POLICY "insert_registration_requests_public"
  ON public.registration_requests FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "select_registration_requests_admin" ON public.registration_requests;
CREATE POLICY "select_registration_requests_admin"
  ON public.registration_requests FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND role IN ('tenant_admin', 'manager', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "update_registration_requests_admin" ON public.registration_requests;
CREATE POLICY "update_registration_requests_admin"
  ON public.registration_requests FOR UPDATE
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND role IN ('tenant_admin', 'manager', 'superadmin')
    )
  );
