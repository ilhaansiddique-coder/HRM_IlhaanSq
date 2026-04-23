-- SaaS hardening: tenant safety, drift compatibility, and missing courier status log support

-- 1) Missing table used by app code
CREATE TABLE IF NOT EXISTS public.courier_status_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL,
  status text NOT NULL,
  notes text,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courier_status_logs_sale_id_fkey'
  ) THEN
    ALTER TABLE public.courier_status_logs
      ADD CONSTRAINT courier_status_logs_sale_id_fkey
      FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courier_status_logs_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.courier_status_logs
      ADD CONSTRAINT courier_status_logs_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_courier_status_logs_sale_id
  ON public.courier_status_logs (sale_id);

CREATE INDEX IF NOT EXISTS idx_courier_status_logs_tenant_id
  ON public.courier_status_logs (tenant_id);

CREATE INDEX IF NOT EXISTS idx_courier_status_logs_updated_at
  ON public.courier_status_logs (updated_at DESC);

ALTER TABLE public.courier_status_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view courier_status_logs in tenant" ON public.courier_status_logs;
CREATE POLICY "Users can view courier_status_logs in tenant"
  ON public.courier_status_logs FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Users can insert courier_status_logs in tenant" ON public.courier_status_logs;
CREATE POLICY "Users can insert courier_status_logs in tenant"
  ON public.courier_status_logs FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Users can update courier_status_logs in tenant" ON public.courier_status_logs;
CREATE POLICY "Users can update courier_status_logs in tenant"
  ON public.courier_status_logs FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS trg_set_tenant_id_courier_status_logs ON public.courier_status_logs;
CREATE TRIGGER trg_set_tenant_id_courier_status_logs
  BEFORE INSERT ON public.courier_status_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

-- 2) Resolve schema drift between sales_items and sale_items by dual-write sync
DO $$
BEGIN
  IF to_regclass('public.sales_items') IS NOT NULL AND to_regclass('public.sale_items') IS NOT NULL THEN
    INSERT INTO public.sale_items (
      id,
      sale_id,
      product_id,
      variant_id,
      product_name,
      quantity,
      unit_price,
      total_price,
      product_image_url,
      variant_image_url,
      created_at,
      updated_at,
      tenant_id
    )
    SELECT
      si.id,
      si.sale_id,
      si.product_id,
      si.variant_id,
      si.product_name,
      si.quantity,
      COALESCE(si.sale_price, si.rate),
      si.total,
      si.product_image_url,
      si.variant_image_url,
      si.created_at,
      COALESCE(si.created_at, now()),
      si.tenant_id
    FROM public.sales_items si
    ON CONFLICT (id) DO UPDATE
      SET sale_id = EXCLUDED.sale_id,
          product_id = EXCLUDED.product_id,
          variant_id = EXCLUDED.variant_id,
          product_name = EXCLUDED.product_name,
          quantity = EXCLUDED.quantity,
          unit_price = EXCLUDED.unit_price,
          total_price = EXCLUDED.total_price,
          product_image_url = EXCLUDED.product_image_url,
          variant_image_url = EXCLUDED.variant_image_url,
          tenant_id = EXCLUDED.tenant_id,
          updated_at = now();

    INSERT INTO public.sales_items (
      id,
      sale_id,
      product_id,
      variant_id,
      product_name,
      quantity,
      rate,
      sale_price,
      total,
      product_image_url,
      variant_image_url,
      created_at,
      tenant_id
    )
    SELECT
      si.id,
      si.sale_id,
      si.product_id,
      si.variant_id,
      si.product_name,
      si.quantity,
      si.unit_price,
      si.unit_price,
      si.total_price,
      si.product_image_url,
      si.variant_image_url,
      si.created_at,
      si.tenant_id
    FROM public.sale_items si
    ON CONFLICT (id) DO UPDATE
      SET sale_id = EXCLUDED.sale_id,
          product_id = EXCLUDED.product_id,
          variant_id = EXCLUDED.variant_id,
          product_name = EXCLUDED.product_name,
          quantity = EXCLUDED.quantity,
          rate = EXCLUDED.rate,
          sale_price = EXCLUDED.sale_price,
          total = EXCLUDED.total,
          product_image_url = EXCLUDED.product_image_url,
          variant_image_url = EXCLUDED.variant_image_url,
          tenant_id = EXCLUDED.tenant_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_sales_items_to_sale_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.sale_items WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO public.sale_items (
    id,
    sale_id,
    product_id,
    variant_id,
    product_name,
    quantity,
    unit_price,
    total_price,
    product_image_url,
    variant_image_url,
    created_at,
    updated_at,
    tenant_id
  )
  VALUES (
    NEW.id,
    NEW.sale_id,
    NEW.product_id,
    NEW.variant_id,
    NEW.product_name,
    NEW.quantity,
    COALESCE(NEW.sale_price, NEW.rate),
    NEW.total,
    NEW.product_image_url,
    NEW.variant_image_url,
    NEW.created_at,
    now(),
    NEW.tenant_id
  )
  ON CONFLICT (id) DO UPDATE
    SET sale_id = EXCLUDED.sale_id,
        product_id = EXCLUDED.product_id,
        variant_id = EXCLUDED.variant_id,
        product_name = EXCLUDED.product_name,
        quantity = EXCLUDED.quantity,
        unit_price = EXCLUDED.unit_price,
        total_price = EXCLUDED.total_price,
        product_image_url = EXCLUDED.product_image_url,
        variant_image_url = EXCLUDED.variant_image_url,
        tenant_id = EXCLUDED.tenant_id,
        updated_at = now();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_sale_items_to_sales_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.sales_items WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO public.sales_items (
    id,
    sale_id,
    product_id,
    variant_id,
    product_name,
    quantity,
    rate,
    sale_price,
    total,
    product_image_url,
    variant_image_url,
    created_at,
    tenant_id
  )
  VALUES (
    NEW.id,
    NEW.sale_id,
    NEW.product_id,
    NEW.variant_id,
    NEW.product_name,
    NEW.quantity,
    NEW.unit_price,
    NEW.unit_price,
    NEW.total_price,
    NEW.product_image_url,
    NEW.variant_image_url,
    NEW.created_at,
    NEW.tenant_id
  )
  ON CONFLICT (id) DO UPDATE
    SET sale_id = EXCLUDED.sale_id,
        product_id = EXCLUDED.product_id,
        variant_id = EXCLUDED.variant_id,
        product_name = EXCLUDED.product_name,
        quantity = EXCLUDED.quantity,
        rate = EXCLUDED.rate,
        sale_price = EXCLUDED.sale_price,
        total = EXCLUDED.total,
        product_image_url = EXCLUDED.product_image_url,
        variant_image_url = EXCLUDED.variant_image_url,
        tenant_id = EXCLUDED.tenant_id;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.sales_items') IS NOT NULL AND to_regclass('public.sale_items') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_sync_sales_items_to_sale_items ON public.sales_items;
    CREATE TRIGGER trg_sync_sales_items_to_sale_items
      AFTER INSERT OR UPDATE OR DELETE ON public.sales_items
      FOR EACH ROW EXECUTE FUNCTION public.sync_sales_items_to_sale_items();

    DROP TRIGGER IF EXISTS trg_sync_sale_items_to_sales_items ON public.sale_items;
    CREATE TRIGGER trg_sync_sale_items_to_sales_items
      AFTER INSERT OR UPDATE OR DELETE ON public.sale_items
      FOR EACH ROW EXECUTE FUNCTION public.sync_sale_items_to_sales_items();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.try_parse_uuid(value text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF value IS NULL OR btrim(value) = '' THEN
    RETURN NULL;
  END IF;
  RETURN value::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.try_parse_inet(value text)
RETURNS inet
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF value IS NULL OR btrim(value) = '' THEN
    RETURN NULL;
  END IF;
  RETURN value::inet;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- 3) Resolve schema drift between security_audit_log and security_audit_logs by bidirectional sync
DO $$
BEGIN
  IF to_regclass('public.security_audit_log') IS NOT NULL AND to_regclass('public.security_audit_logs') IS NOT NULL THEN
    INSERT INTO public.security_audit_log (
      id,
      user_id,
      action,
      table_name,
      record_id,
      ip_address,
      user_agent,
      created_at
    )
    SELECT
      sal.id,
      sal.user_id,
      sal.action,
      sal.table_name,
      public.try_parse_uuid(sal.record_id::text),
      public.try_parse_inet(sal.ip_address::text),
      sal.user_agent,
      sal.created_at
    FROM public.security_audit_logs sal
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.security_audit_logs (
      id,
      user_id,
      action,
      table_name,
      record_id,
      ip_address,
      user_agent,
      created_at
    )
    SELECT
      sal.id,
      sal.user_id,
      sal.action,
      sal.table_name,
      public.try_parse_uuid(sal.record_id::text),
      public.try_parse_inet(sal.ip_address::text),
      sal.user_agent,
      sal.created_at
    FROM public.security_audit_log sal
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_security_audit_log_to_legacy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.security_audit_logs (
    id,
    user_id,
    action,
    table_name,
    record_id,
    ip_address,
    user_agent,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.user_id,
    NEW.action,
    NEW.table_name,
    public.try_parse_uuid(NEW.record_id::text),
    public.try_parse_inet(NEW.ip_address::text),
    NEW.user_agent,
    NEW.created_at
  )
  ON CONFLICT (id) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        action = EXCLUDED.action,
        table_name = EXCLUDED.table_name,
        record_id = EXCLUDED.record_id,
        ip_address = EXCLUDED.ip_address,
        user_agent = EXCLUDED.user_agent,
        created_at = EXCLUDED.created_at;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_security_audit_logs_to_canonical()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.security_audit_log (
    id,
    user_id,
    action,
    table_name,
    record_id,
    ip_address,
    user_agent,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.user_id,
    NEW.action,
    NEW.table_name,
    public.try_parse_uuid(NEW.record_id::text),
    public.try_parse_inet(NEW.ip_address::text),
    NEW.user_agent,
    NEW.created_at
  )
  ON CONFLICT (id) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        action = EXCLUDED.action,
        table_name = EXCLUDED.table_name,
        record_id = EXCLUDED.record_id,
        ip_address = EXCLUDED.ip_address,
        user_agent = EXCLUDED.user_agent,
        created_at = EXCLUDED.created_at;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.security_audit_log') IS NOT NULL AND to_regclass('public.security_audit_logs') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_sync_security_audit_log_to_legacy ON public.security_audit_log;
    CREATE TRIGGER trg_sync_security_audit_log_to_legacy
      AFTER INSERT OR UPDATE ON public.security_audit_log
      FOR EACH ROW EXECUTE FUNCTION public.sync_security_audit_log_to_legacy();

    DROP TRIGGER IF EXISTS trg_sync_security_audit_logs_to_canonical ON public.security_audit_logs;
    CREATE TRIGGER trg_sync_security_audit_logs_to_canonical
      AFTER INSERT OR UPDATE ON public.security_audit_logs
      FOR EACH ROW EXECUTE FUNCTION public.sync_security_audit_logs_to_canonical();
  END IF;
END $$;

-- 4) Tenant consistency hardening using composite id+tenant_id foreign keys

-- Align tenant ids before adding composite foreign keys
DO $$
BEGIN
  UPDATE public.sales_items si
  SET tenant_id = s.tenant_id
  FROM public.sales s
  WHERE si.sale_id = s.id
    AND si.tenant_id IS DISTINCT FROM s.tenant_id;

  UPDATE public.sale_items si
  SET tenant_id = s.tenant_id
  FROM public.sales s
  WHERE si.sale_id = s.id
    AND si.tenant_id IS DISTINCT FROM s.tenant_id;

  UPDATE public.sale_payments sp
  SET tenant_id = s.tenant_id
  FROM public.sales s
  WHERE sp.sale_id = s.id
    AND sp.tenant_id IS DISTINCT FROM s.tenant_id;

  UPDATE public.product_variants pv
  SET tenant_id = p.tenant_id
  FROM public.products p
  WHERE pv.product_id = p.id
    AND pv.tenant_id IS DISTINCT FROM p.tenant_id;

  UPDATE public.product_attributes pa
  SET tenant_id = p.tenant_id
  FROM public.products p
  WHERE pa.product_id = p.id
    AND pa.tenant_id IS DISTINCT FROM p.tenant_id;

  UPDATE public.product_attribute_values pav
  SET tenant_id = pa.tenant_id
  FROM public.product_attributes pa
  WHERE pav.attribute_id = pa.id
    AND pav.tenant_id IS DISTINCT FROM pa.tenant_id;

  UPDATE public.inventory_logs il
  SET tenant_id = p.tenant_id
  FROM public.products p
  WHERE il.product_id = p.id
    AND il.tenant_id IS DISTINCT FROM p.tenant_id;

  UPDATE public.inventory_logs il
  SET tenant_id = pv.tenant_id
  FROM public.product_variants pv
  WHERE il.variant_id = pv.id
    AND il.tenant_id IS DISTINCT FROM pv.tenant_id;

  UPDATE public.sales s
  SET tenant_id = c.tenant_id
  FROM public.customers c
  WHERE s.customer_id = c.id
    AND s.tenant_id IS DISTINCT FROM c.tenant_id;

  UPDATE public.woocommerce_import_logs wil
  SET tenant_id = wc.tenant_id
  FROM public.woocommerce_connections wc
  WHERE wil.connection_id = wc.id
    AND wil.tenant_id IS DISTINCT FROM wc.tenant_id;

  UPDATE public.woocommerce_sync_logs wsl
  SET tenant_id = wc.tenant_id
  FROM public.woocommerce_connections wc
  WHERE wsl.connection_id = wc.id
    AND wsl.tenant_id IS DISTINCT FROM wc.tenant_id;

  UPDATE public.woocommerce_sync_schedules wss
  SET tenant_id = wc.tenant_id
  FROM public.woocommerce_connections wc
  WHERE wss.connection_id = wc.id
    AND wss.tenant_id IS DISTINCT FROM wc.tenant_id;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_id_tenant_unique') THEN
    ALTER TABLE public.customers ADD CONSTRAINT customers_id_tenant_unique UNIQUE (id, tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_id_tenant_unique') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_id_tenant_unique UNIQUE (id, tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_id_tenant_unique') THEN
    ALTER TABLE public.product_variants ADD CONSTRAINT product_variants_id_tenant_unique UNIQUE (id, tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_attributes_id_tenant_unique') THEN
    ALTER TABLE public.product_attributes ADD CONSTRAINT product_attributes_id_tenant_unique UNIQUE (id, tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_id_tenant_unique') THEN
    ALTER TABLE public.sales ADD CONSTRAINT sales_id_tenant_unique UNIQUE (id, tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'woocommerce_connections_id_tenant_unique') THEN
    ALTER TABLE public.woocommerce_connections ADD CONSTRAINT woocommerce_connections_id_tenant_unique UNIQUE (id, tenant_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_customer_tenant_fkey') THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_customer_tenant_fkey
      FOREIGN KEY (customer_id, tenant_id)
      REFERENCES public.customers(id, tenant_id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_items_sale_tenant_fkey') THEN
    ALTER TABLE public.sales_items
      ADD CONSTRAINT sales_items_sale_tenant_fkey
      FOREIGN KEY (sale_id, tenant_id)
      REFERENCES public.sales(id, tenant_id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_items_product_tenant_fkey') THEN
    ALTER TABLE public.sales_items
      ADD CONSTRAINT sales_items_product_tenant_fkey
      FOREIGN KEY (product_id, tenant_id)
      REFERENCES public.products(id, tenant_id)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_items_variant_tenant_fkey') THEN
    ALTER TABLE public.sales_items
      ADD CONSTRAINT sales_items_variant_tenant_fkey
      FOREIGN KEY (variant_id, tenant_id)
      REFERENCES public.product_variants(id, tenant_id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_items_sale_tenant_fkey') THEN
    ALTER TABLE public.sale_items
      ADD CONSTRAINT sale_items_sale_tenant_fkey
      FOREIGN KEY (sale_id, tenant_id)
      REFERENCES public.sales(id, tenant_id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_items_product_tenant_fkey') THEN
    ALTER TABLE public.sale_items
      ADD CONSTRAINT sale_items_product_tenant_fkey
      FOREIGN KEY (product_id, tenant_id)
      REFERENCES public.products(id, tenant_id)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_items_variant_tenant_fkey') THEN
    ALTER TABLE public.sale_items
      ADD CONSTRAINT sale_items_variant_tenant_fkey
      FOREIGN KEY (variant_id, tenant_id)
      REFERENCES public.product_variants(id, tenant_id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_payments_sale_tenant_fkey') THEN
    ALTER TABLE public.sale_payments
      ADD CONSTRAINT sale_payments_sale_tenant_fkey
      FOREIGN KEY (sale_id, tenant_id)
      REFERENCES public.sales(id, tenant_id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_product_tenant_fkey') THEN
    ALTER TABLE public.product_variants
      ADD CONSTRAINT product_variants_product_tenant_fkey
      FOREIGN KEY (product_id, tenant_id)
      REFERENCES public.products(id, tenant_id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_attributes_product_tenant_fkey') THEN
    ALTER TABLE public.product_attributes
      ADD CONSTRAINT product_attributes_product_tenant_fkey
      FOREIGN KEY (product_id, tenant_id)
      REFERENCES public.products(id, tenant_id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_attribute_values_attribute_tenant_fkey') THEN
    ALTER TABLE public.product_attribute_values
      ADD CONSTRAINT product_attribute_values_attribute_tenant_fkey
      FOREIGN KEY (attribute_id, tenant_id)
      REFERENCES public.product_attributes(id, tenant_id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_logs_product_tenant_fkey') THEN
    ALTER TABLE public.inventory_logs
      ADD CONSTRAINT inventory_logs_product_tenant_fkey
      FOREIGN KEY (product_id, tenant_id)
      REFERENCES public.products(id, tenant_id)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_logs_variant_tenant_fkey') THEN
    ALTER TABLE public.inventory_logs
      ADD CONSTRAINT inventory_logs_variant_tenant_fkey
      FOREIGN KEY (variant_id, tenant_id)
      REFERENCES public.product_variants(id, tenant_id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'woocommerce_import_logs_connection_tenant_fkey') THEN
    ALTER TABLE public.woocommerce_import_logs
      ADD CONSTRAINT woocommerce_import_logs_connection_tenant_fkey
      FOREIGN KEY (connection_id, tenant_id)
      REFERENCES public.woocommerce_connections(id, tenant_id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'woocommerce_sync_logs_connection_tenant_fkey') THEN
    ALTER TABLE public.woocommerce_sync_logs
      ADD CONSTRAINT woocommerce_sync_logs_connection_tenant_fkey
      FOREIGN KEY (connection_id, tenant_id)
      REFERENCES public.woocommerce_connections(id, tenant_id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'woocommerce_sync_schedules_connection_tenant_fkey') THEN
    ALTER TABLE public.woocommerce_sync_schedules
      ADD CONSTRAINT woocommerce_sync_schedules_connection_tenant_fkey
      FOREIGN KEY (connection_id, tenant_id)
      REFERENCES public.woocommerce_connections(id, tenant_id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;
