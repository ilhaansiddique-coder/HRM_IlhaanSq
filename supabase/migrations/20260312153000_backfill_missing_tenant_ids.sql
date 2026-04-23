-- Backfill tenant_id for core tables to keep tenant dashboard counts accurate.
-- Uses relational links first, then falls back to default tenant where still null.

DO $$
DECLARE
  v_default_tenant uuid;
BEGIN
  SELECT public.get_default_tenant_id() INTO v_default_tenant;

  -- SALES: prefer customer tenant_id
  IF to_regclass('public.sales') IS NOT NULL AND to_regclass('public.customers') IS NOT NULL THEN
    UPDATE public.sales s
    SET tenant_id = c.tenant_id
    FROM public.customers c
    WHERE s.customer_id = c.id
      AND (s.tenant_id IS NULL OR s.tenant_id IS DISTINCT FROM c.tenant_id);
  END IF;

  -- SALES: fallback to creator membership
  IF to_regclass('public.sales') IS NOT NULL AND to_regclass('public.tenant_members') IS NOT NULL THEN
    WITH membership AS (
      SELECT DISTINCT ON (user_id) user_id, tenant_id
      FROM public.tenant_members
      WHERE is_active = true
      ORDER BY user_id, is_default DESC, created_at DESC
    )
    UPDATE public.sales s
    SET tenant_id = m.tenant_id
    FROM membership m
    WHERE s.tenant_id IS NULL
      AND s.created_by = m.user_id;
  END IF;

  -- CUSTOMERS: fallback to creator membership
  IF to_regclass('public.customers') IS NOT NULL AND to_regclass('public.tenant_members') IS NOT NULL THEN
    WITH membership AS (
      SELECT DISTINCT ON (user_id) user_id, tenant_id
      FROM public.tenant_members
      WHERE is_active = true
      ORDER BY user_id, is_default DESC, created_at DESC
    )
    UPDATE public.customers c
    SET tenant_id = m.tenant_id
    FROM membership m
    WHERE c.tenant_id IS NULL
      AND c.created_by = m.user_id;
  END IF;

  -- PRODUCTS: fallback to creator membership
  IF to_regclass('public.products') IS NOT NULL AND to_regclass('public.tenant_members') IS NOT NULL THEN
    WITH membership AS (
      SELECT DISTINCT ON (user_id) user_id, tenant_id
      FROM public.tenant_members
      WHERE is_active = true
      ORDER BY user_id, is_default DESC, created_at DESC
    )
    UPDATE public.products p
    SET tenant_id = m.tenant_id
    FROM membership m
    WHERE p.tenant_id IS NULL
      AND p.created_by = m.user_id;
  END IF;

  -- BUSINESS_SETTINGS: fallback to creator membership
  IF to_regclass('public.business_settings') IS NOT NULL AND to_regclass('public.tenant_members') IS NOT NULL THEN
    WITH membership AS (
      SELECT DISTINCT ON (user_id) user_id, tenant_id
      FROM public.tenant_members
      WHERE is_active = true
      ORDER BY user_id, is_default DESC, created_at DESC
    )
    UPDATE public.business_settings bs
    SET tenant_id = m.tenant_id
    FROM membership m
    WHERE bs.tenant_id IS NULL
      AND bs.created_by = m.user_id;
  END IF;

  -- SALES_ITEMS / SALE_ITEMS / SALE_PAYMENTS
  IF to_regclass('public.sales_items') IS NOT NULL AND to_regclass('public.sales') IS NOT NULL THEN
    UPDATE public.sales_items si
    SET tenant_id = s.tenant_id
    FROM public.sales s
    WHERE si.sale_id = s.id
      AND (si.tenant_id IS NULL OR si.tenant_id IS DISTINCT FROM s.tenant_id);
  END IF;

  IF to_regclass('public.sale_items') IS NOT NULL AND to_regclass('public.sales') IS NOT NULL THEN
    UPDATE public.sale_items si
    SET tenant_id = s.tenant_id
    FROM public.sales s
    WHERE si.sale_id = s.id
      AND (si.tenant_id IS NULL OR si.tenant_id IS DISTINCT FROM s.tenant_id);
  END IF;

  IF to_regclass('public.sale_payments') IS NOT NULL AND to_regclass('public.sales') IS NOT NULL THEN
    UPDATE public.sale_payments sp
    SET tenant_id = s.tenant_id
    FROM public.sales s
    WHERE sp.sale_id = s.id
      AND (sp.tenant_id IS NULL OR sp.tenant_id IS DISTINCT FROM s.tenant_id);
  END IF;

  -- PRODUCT VARIANTS / ATTRIBUTES / VALUES
  IF to_regclass('public.product_variants') IS NOT NULL AND to_regclass('public.products') IS NOT NULL THEN
    UPDATE public.product_variants pv
    SET tenant_id = p.tenant_id
    FROM public.products p
    WHERE pv.product_id = p.id
      AND (pv.tenant_id IS NULL OR pv.tenant_id IS DISTINCT FROM p.tenant_id);
  END IF;

  IF to_regclass('public.product_attributes') IS NOT NULL AND to_regclass('public.products') IS NOT NULL THEN
    UPDATE public.product_attributes pa
    SET tenant_id = p.tenant_id
    FROM public.products p
    WHERE pa.product_id = p.id
      AND (pa.tenant_id IS NULL OR pa.tenant_id IS DISTINCT FROM p.tenant_id);
  END IF;

  IF to_regclass('public.product_attribute_values') IS NOT NULL AND to_regclass('public.product_attributes') IS NOT NULL THEN
    UPDATE public.product_attribute_values pav
    SET tenant_id = pa.tenant_id
    FROM public.product_attributes pa
    WHERE pav.attribute_id = pa.id
      AND (pav.tenant_id IS NULL OR pav.tenant_id IS DISTINCT FROM pa.tenant_id);
  END IF;

  -- INVENTORY_LOGS: prefer product, then variant
  IF to_regclass('public.inventory_logs') IS NOT NULL AND to_regclass('public.products') IS NOT NULL THEN
    UPDATE public.inventory_logs il
    SET tenant_id = p.tenant_id
    FROM public.products p
    WHERE il.product_id = p.id
      AND (il.tenant_id IS NULL OR il.tenant_id IS DISTINCT FROM p.tenant_id);
  END IF;

  IF to_regclass('public.inventory_logs') IS NOT NULL AND to_regclass('public.product_variants') IS NOT NULL THEN
    UPDATE public.inventory_logs il
    SET tenant_id = pv.tenant_id
    FROM public.product_variants pv
    WHERE il.variant_id = pv.id
      AND (il.tenant_id IS NULL OR il.tenant_id IS DISTINCT FROM pv.tenant_id);
  END IF;

  -- Final fallback: assign any remaining NULLs to the default tenant.
  IF v_default_tenant IS NOT NULL THEN
    IF to_regclass('public.sales') IS NOT NULL THEN
      UPDATE public.sales SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    END IF;
    IF to_regclass('public.customers') IS NOT NULL THEN
      UPDATE public.customers SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    END IF;
    IF to_regclass('public.products') IS NOT NULL THEN
      UPDATE public.products SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    END IF;
    IF to_regclass('public.business_settings') IS NOT NULL THEN
      UPDATE public.business_settings SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    END IF;
  END IF;
END $$;
