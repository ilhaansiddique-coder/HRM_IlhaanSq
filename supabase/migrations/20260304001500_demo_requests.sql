CREATE TABLE IF NOT EXISTS public.demo_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  business_type TEXT NOT NULL,
  expected_users TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_requests_status_created_at
  ON public.demo_requests(status, created_at DESC);

ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_demo_requests_public" ON public.demo_requests;
CREATE POLICY "insert_demo_requests_public"
  ON public.demo_requests FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "read_demo_requests_admin" ON public.demo_requests;
CREATE POLICY "read_demo_requests_admin"
  ON public.demo_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND role IN ('superadmin', 'tenant_admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "update_demo_requests_superadmin" ON public.demo_requests;
CREATE POLICY "update_demo_requests_superadmin"
  ON public.demo_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

DROP TRIGGER IF EXISTS update_demo_requests_updated_at ON public.demo_requests;
CREATE TRIGGER update_demo_requests_updated_at
  BEFORE UPDATE ON public.demo_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
