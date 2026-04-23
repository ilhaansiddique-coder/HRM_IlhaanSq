-- Create legacy tables expected by later migrations but missing from baseline schema.
-- Keep definitions minimal and compatible with subsequent tenantization migrations.

CREATE TABLE IF NOT EXISTS public.courier_payment_rules (
  status_key text PRIMARY KEY,
  payment_status text NOT NULL DEFAULT 'unpaid',
  amount_paid_behavior text NOT NULL DEFAULT 'preserve',
  amount_due_behavior text NOT NULL DEFAULT 'preserve',
  restore_inventory boolean NOT NULL DEFAULT false,
  use_backup boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid
);

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  label text NOT NULL,
  type text NOT NULL DEFAULT 'manual',
  enabled boolean NOT NULL DEFAULT true,
  default_terms text NOT NULL DEFAULT 'immediate',
  default_paid_behavior text NOT NULL DEFAULT 'full',
  fee_type text NOT NULL DEFAULT 'none',
  fee_value numeric,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid
);

CREATE TABLE IF NOT EXISTS public.sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  method text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid
);

CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id ON public.sale_payments (sale_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_sort_order ON public.payment_methods (sort_order);
CREATE INDEX IF NOT EXISTS idx_courier_payment_rules_status_key ON public.courier_payment_rules (status_key);

ALTER TABLE public.courier_payment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;
