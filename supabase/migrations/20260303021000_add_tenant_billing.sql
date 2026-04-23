-- Add tenant billing metadata for Stripe subscriptions

CREATE TABLE IF NOT EXISTS public.tenant_billing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_key text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_billing_tenant_id
  ON public.tenant_billing (tenant_id);

DROP TRIGGER IF EXISTS update_tenant_billing_updated_at ON public.tenant_billing;
CREATE TRIGGER update_tenant_billing_updated_at
  BEFORE UPDATE ON public.tenant_billing
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tenant_billing ENABLE ROW LEVEL SECURITY;

INSERT INTO public.tenant_billing (tenant_id, plan_key, status)
SELECT t.id, 'free', 'inactive'
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_billing tb WHERE tb.tenant_id = t.id
);

DROP POLICY IF EXISTS "Admins can view tenant billing" ON public.tenant_billing;
CREATE POLICY "Admins can view tenant billing"
  ON public.tenant_billing
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.tenant_members tm
      WHERE tm.tenant_id = public.tenant_billing.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
        AND tm.role IN ('owner', 'admin')
    )
  );
