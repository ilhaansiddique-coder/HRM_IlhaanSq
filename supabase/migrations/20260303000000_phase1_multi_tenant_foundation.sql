-- Phase 1: Multi-tenant foundation (non-breaking)
-- Adds tenant model + tenant_id columns + backfill + safe defaults/triggers.

-- 1) Core tenant tables
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_members_role_check CHECK (role = ANY (ARRAY['owner', 'admin', 'manager', 'staff', 'member']))
);

CREATE TABLE IF NOT EXISTS public.tenant_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  token text NOT NULL UNIQUE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_invites_role_check CHECK (role = ANY (ARRAY['owner', 'admin', 'manager', 'staff', 'member']))
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_members_tenant_user_unique
  ON public.tenant_members (tenant_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_members_one_default_per_user
  ON public.tenant_members (user_id)
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_tenant_members_user_id
  ON public.tenant_members (user_id);

CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant_id
  ON public.tenant_members (tenant_id);

-- 2) Updated-at trigger for new tables
DROP TRIGGER IF EXISTS update_tenants_updated_at ON public.tenants;
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_members_updated_at ON public.tenant_members;
CREATE TRIGGER update_tenant_members_updated_at
  BEFORE UPDATE ON public.tenant_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Tenant context helpers
CREATE OR REPLACE FUNCTION public.get_default_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id
  FROM public.tenants t
  ORDER BY t.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_claims jsonb;
  jwt_tenant_text text;
  resolved_tenant_id uuid;
BEGIN
  BEGIN
    jwt_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  EXCEPTION WHEN others THEN
    jwt_claims := NULL;
  END;

  jwt_tenant_text := COALESCE(jwt_claims ->> 'tenant_id', jwt_claims -> 'app_metadata' ->> 'tenant_id');
  IF jwt_tenant_text IS NOT NULL AND btrim(jwt_tenant_text) <> '' THEN
    BEGIN
      RETURN jwt_tenant_text::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      -- Ignore malformed claim and continue with membership resolution
      NULL;
    END;
  END IF;

  SELECT tm.tenant_id
  INTO resolved_tenant_id
  FROM public.tenant_members tm
  WHERE tm.user_id = (SELECT auth.uid())
    AND tm.is_active = true
  ORDER BY tm.is_default DESC, tm.created_at ASC
  LIMIT 1;

  RETURN resolved_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_tenant_id_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;

  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.get_default_tenant_id();
  END IF;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_default_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;

-- 4) Ensure one default tenant and bootstrap memberships
DO $$
DECLARE
  v_tenant_id uuid;
  v_owner_id uuid;
  v_business_name text;
BEGIN
  SELECT id INTO v_tenant_id
  FROM public.tenants
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    SELECT bs.created_by, bs.business_name
    INTO v_owner_id, v_business_name
    FROM public.business_settings bs
    ORDER BY bs.created_at ASC
    LIMIT 1;

    IF v_owner_id IS NULL THEN
      SELECT ur.user_id
      INTO v_owner_id
      FROM public.user_roles ur
      WHERE ur.role = 'admin'
      ORDER BY ur.created_at ASC
      LIMIT 1;
    END IF;

    IF v_owner_id IS NULL THEN
      SELECT p.id
      INTO v_owner_id
      FROM public.profiles p
      ORDER BY p.created_at ASC
      LIMIT 1;
    END IF;

    INSERT INTO public.tenants (name, slug, created_by)
    VALUES (
      COALESCE(NULLIF(btrim(v_business_name), ''), 'Default Workspace'),
      'default-workspace',
      v_owner_id
    )
    ON CONFLICT (slug) DO UPDATE
      SET name = EXCLUDED.name
    RETURNING id INTO v_tenant_id;
  END IF;

  INSERT INTO public.tenant_members (tenant_id, user_id, role, is_default, is_active, invited_by)
  SELECT
    v_tenant_id,
    u.id,
    CASE
      WHEN ur.role = 'admin' THEN 'owner'
      WHEN ur.role = 'manager' THEN 'admin'
      WHEN ur.role = 'staff' THEN 'staff'
      ELSE 'member'
    END AS role,
    true,
    true,
    v_owner_id
  FROM auth.users u
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  ON CONFLICT (tenant_id, user_id) DO UPDATE
    SET is_active = true;

  UPDATE public.tenant_members tm
  SET is_default = true
  WHERE tm.tenant_id = v_tenant_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.tenant_members tm2
      WHERE tm2.user_id = tm.user_id
        AND tm2.is_default = true
    );
END;
$$;

-- 5) Add tenant_id to business tables
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'activity_logs',
    'auto_refresh_runs',
    'business_settings',
    'courier_payment_rules',
    'courier_webhook_settings',
    'custom_settings',
    'customers',
    'dismissed_alerts',
    'inventory_logs',
    'payment_methods',
    'product_attributes',
    'product_attribute_values',
    'product_variants',
    'products',
    'reusable_attributes',
    'sale_items',
    'sale_payments',
    'sales',
    'sales_items',
    'system_settings',
    'user_preferences',
    'woocommerce_connections',
    'woocommerce_import_logs',
    'woocommerce_sync_logs',
    'woocommerce_sync_schedules'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid;', t);
  END LOOP;
END;
$$;

-- 6) Backfill tenant_id (parent-first where available)
DO $$
DECLARE
  v_default_tenant uuid;
BEGIN
  SELECT public.get_default_tenant_id() INTO v_default_tenant;

  -- Root-level tables
  UPDATE public.business_settings SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;
  UPDATE public.custom_settings SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;
  UPDATE public.system_settings SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;
  UPDATE public.payment_methods SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;
  UPDATE public.courier_webhook_settings SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;
  UPDATE public.courier_payment_rules SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;
  UPDATE public.products SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;
  UPDATE public.customers SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;
  UPDATE public.sales SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;
  UPDATE public.reusable_attributes SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;
  UPDATE public.activity_logs SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;
  UPDATE public.auto_refresh_runs SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;
  UPDATE public.dismissed_alerts SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;
  UPDATE public.user_preferences SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;
  UPDATE public.woocommerce_connections SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;
  UPDATE public.woocommerce_import_logs SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;
  UPDATE public.woocommerce_sync_logs SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;
  UPDATE public.woocommerce_sync_schedules SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;

  -- Child tables
  UPDATE public.product_variants pv
  SET tenant_id = p.tenant_id
  FROM public.products p
  WHERE pv.product_id = p.id AND pv.tenant_id IS NULL;

  UPDATE public.product_attributes pa
  SET tenant_id = p.tenant_id
  FROM public.products p
  WHERE pa.product_id = p.id AND pa.tenant_id IS NULL;

  UPDATE public.product_attribute_values pav
  SET tenant_id = pa.tenant_id
  FROM public.product_attributes pa
  WHERE pav.attribute_id = pa.id AND pav.tenant_id IS NULL;

  UPDATE public.inventory_logs il
  SET tenant_id = p.tenant_id
  FROM public.products p
  WHERE il.product_id = p.id AND il.tenant_id IS NULL;

  UPDATE public.sales_items si
  SET tenant_id = s.tenant_id
  FROM public.sales s
  WHERE si.sale_id = s.id AND si.tenant_id IS NULL;

  UPDATE public.sale_items si
  SET tenant_id = s.tenant_id
  FROM public.sales s
  WHERE si.sale_id = s.id AND si.tenant_id IS NULL;

  UPDATE public.sale_payments sp
  SET tenant_id = s.tenant_id
  FROM public.sales s
  WHERE sp.sale_id = s.id AND sp.tenant_id IS NULL;

  -- Final fallback
  UPDATE public.product_variants SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;
  UPDATE public.product_attributes SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;
  UPDATE public.product_attribute_values SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;
  UPDATE public.inventory_logs SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;
  UPDATE public.sales_items SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;
  UPDATE public.sale_items SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;
  UPDATE public.sale_payments SET tenant_id = COALESCE(tenant_id, v_default_tenant) WHERE tenant_id IS NULL;
END;
$$;

-- 7) Defaults + not-null + fk + index + insert trigger
DO $$
DECLARE
  t text;
  c_name text;
  idx_name text;
  trg_name text;
  tenant_tables text[] := ARRAY[
    'activity_logs',
    'auto_refresh_runs',
    'business_settings',
    'courier_payment_rules',
    'courier_webhook_settings',
    'custom_settings',
    'customers',
    'dismissed_alerts',
    'inventory_logs',
    'payment_methods',
    'product_attributes',
    'product_attribute_values',
    'product_variants',
    'products',
    'reusable_attributes',
    'sale_items',
    'sale_payments',
    'sales',
    'sales_items',
    'system_settings',
    'user_preferences',
    'woocommerce_connections',
    'woocommerce_import_logs',
    'woocommerce_sync_logs',
    'woocommerce_sync_schedules'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL;', t);

    c_name := format('%s_tenant_id_fkey', t);
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = c_name) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);',
        t, c_name
      );
    END IF;

    idx_name := format('idx_%s_tenant_id', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id);', idx_name, t);

    trg_name := format('trg_set_tenant_id_%s', t);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I;', trg_name, t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();',
      trg_name, t
    );
  END LOOP;
END;
$$;

-- 8) Switch key uniqueness from global to tenant-scoped
ALTER TABLE public.custom_settings DROP CONSTRAINT IF EXISTS custom_settings_setting_type_key;
ALTER TABLE public.custom_settings
  ADD CONSTRAINT custom_settings_setting_type_key UNIQUE (tenant_id, setting_type);

ALTER TABLE public.payment_methods DROP CONSTRAINT IF EXISTS payment_methods_key_key;
ALTER TABLE public.payment_methods
  ADD CONSTRAINT payment_methods_key_key UNIQUE (tenant_id, key);

ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS product_variants_sku_key;
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_sku_key UNIQUE (tenant_id, sku);

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_sku_key;
ALTER TABLE public.products
  ADD CONSTRAINT products_sku_key UNIQUE (tenant_id, sku);

ALTER TABLE public.reusable_attributes DROP CONSTRAINT IF EXISTS reusable_attributes_name_key;
ALTER TABLE public.reusable_attributes
  ADD CONSTRAINT reusable_attributes_name_key UNIQUE (tenant_id, name);

ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_invoice_number_key;
ALTER TABLE public.sales
  ADD CONSTRAINT sales_invoice_number_key UNIQUE (tenant_id, invoice_number);

-- 9) Enable RLS on new tables (policies introduced in phase 2)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_invites ENABLE ROW LEVEL SECURITY;
