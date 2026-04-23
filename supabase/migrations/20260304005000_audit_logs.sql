CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  action TEXT NOT NULL,
  resource TEXT,
  resource_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON public.audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_logs(user_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_set_tenant_id_audit_logs ON public.audit_logs;
CREATE TRIGGER trg_set_tenant_id_audit_logs
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_user_audit" ON public.audit_logs;
CREATE POLICY "own_user_audit" ON public.audit_logs FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "tenant_admin_audit" ON public.audit_logs;
CREATE POLICY "tenant_admin_audit" ON public.audit_logs FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND role IN ('tenant_admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "superadmin_all_audit" ON public.audit_logs;
CREATE POLICY "superadmin_all_audit" ON public.audit_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

DROP POLICY IF EXISTS "insert_own" ON public.audit_logs;
CREATE POLICY "insert_own" ON public.audit_logs FOR INSERT
  WITH CHECK (COALESCE(user_id, auth.uid()) = auth.uid());
