CREATE TABLE IF NOT EXISTS public.system_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB DEFAULT 'false'::jsonb,
  set_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, key)
);

ALTER TABLE public.system_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_own_flags" ON public.system_flags;
CREATE POLICY "tenant_own_flags" ON public.system_flags
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "superadmin_all_flags" ON public.system_flags;
CREATE POLICY "superadmin_all_flags" ON public.system_flags
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );
