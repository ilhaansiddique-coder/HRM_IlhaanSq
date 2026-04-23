ALTER TABLE IF EXISTS public.tenant_billing
  ADD COLUMN IF NOT EXISTS plan_label text,
  ADD COLUMN IF NOT EXISTS monthly_price_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_limit integer,
  ADD COLUMN IF NOT EXISTS customer_limit integer,
  ADD COLUMN IF NOT EXISTS sales_limit integer,
  ADD COLUMN IF NOT EXISTS package_limits_enabled boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.apply_tenant_billing_plan_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_plan text := lower(trim(coalesce(new.plan_key, 'free')));
BEGIN
  IF normalized_plan NOT IN ('free', 'starter', 'pro') THEN
    normalized_plan := 'free';
  END IF;

  new.plan_key := normalized_plan;

  CASE normalized_plan
    WHEN 'starter' THEN
      new.plan_label := 'Professional';
      new.monthly_price_cents := 1900;
      new.product_limit := 100;
      new.customer_limit := 100;
      new.sales_limit := null;
    WHEN 'pro' THEN
      new.plan_label := 'Enterprise';
      new.monthly_price_cents := 4900;
      new.product_limit := null;
      new.customer_limit := null;
      new.sales_limit := null;
    ELSE
      new.plan_label := 'Starter';
      new.monthly_price_cents := 0;
      new.product_limit := 10;
      new.customer_limit := 10;
      new.sales_limit := 10;
  END CASE;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS set_tenant_billing_plan_metadata ON public.tenant_billing;
CREATE TRIGGER set_tenant_billing_plan_metadata
  BEFORE INSERT OR UPDATE OF plan_key
  ON public.tenant_billing
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_tenant_billing_plan_metadata();

CREATE OR REPLACE FUNCTION public.get_tenant_billing_limit(
  target_tenant_id uuid,
  resource_key text
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  billing_row record;
  normalized_resource text := lower(trim(coalesce(resource_key, '')));
BEGIN
  SELECT
    package_limits_enabled,
    product_limit,
    customer_limit,
    sales_limit
  INTO billing_row
  FROM public.tenant_billing
  WHERE tenant_id = target_tenant_id
  LIMIT 1;

  IF NOT FOUND OR coalesce(billing_row.package_limits_enabled, false) = false THEN
    RETURN null;
  END IF;

  CASE normalized_resource
    WHEN 'products' THEN
      RETURN billing_row.product_limit;
    WHEN 'customers' THEN
      RETURN billing_row.customer_limit;
    WHEN 'sales' THEN
      RETURN billing_row.sales_limit;
    ELSE
      RETURN null;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_tenant_billing_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_tenant_id uuid;
  allowed_limit integer;
  existing_count integer;
  package_name text;
  resource_label text;
BEGIN
  IF tg_op = 'UPDATE'
    AND coalesce(old.is_deleted, false) = false
    AND coalesce(new.is_deleted, false) = false THEN
    RETURN new;
  END IF;

  IF coalesce(new.is_deleted, false) = true THEN
    RETURN new;
  END IF;

  resolved_tenant_id := coalesce(new.tenant_id, public.current_tenant_id());
  IF resolved_tenant_id IS NULL THEN
    RETURN new;
  END IF;

  CASE tg_table_name
    WHEN 'products' THEN
      resource_label := 'products';
      allowed_limit := public.get_tenant_billing_limit(resolved_tenant_id, 'products');
      IF allowed_limit IS NULL THEN
        RETURN new;
      END IF;

      SELECT count(*)
      INTO existing_count
      FROM public.products
      WHERE tenant_id = resolved_tenant_id
        AND coalesce(is_deleted, false) = false;
    WHEN 'customers' THEN
      resource_label := 'customers';
      allowed_limit := public.get_tenant_billing_limit(resolved_tenant_id, 'customers');
      IF allowed_limit IS NULL THEN
        RETURN new;
      END IF;

      SELECT count(*)
      INTO existing_count
      FROM public.customers
      WHERE tenant_id = resolved_tenant_id
        AND coalesce(is_deleted, false) = false;
    WHEN 'sales' THEN
      resource_label := 'sales';
      allowed_limit := public.get_tenant_billing_limit(resolved_tenant_id, 'sales');
      IF allowed_limit IS NULL THEN
        RETURN new;
      END IF;

      SELECT count(*)
      INTO existing_count
      FROM public.sales
      WHERE tenant_id = resolved_tenant_id
        AND coalesce(is_deleted, false) = false;
    ELSE
      RETURN new;
  END CASE;

  IF existing_count >= allowed_limit THEN
    SELECT coalesce(plan_label, 'Starter')
    INTO package_name
    FROM public.tenant_billing
    WHERE tenant_id = resolved_tenant_id
    LIMIT 1;

    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = format(
        '%s package limit reached: maximum %s active %s allowed. Upgrade the package to continue.',
        coalesce(package_name, 'Starter'),
        allowed_limit,
        resource_label
      );
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS enforce_product_package_limits ON public.products;
CREATE TRIGGER enforce_product_package_limits
  BEFORE INSERT OR UPDATE OF is_deleted
  ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tenant_billing_limit();

DROP TRIGGER IF EXISTS enforce_customer_package_limits ON public.customers;
CREATE TRIGGER enforce_customer_package_limits
  BEFORE INSERT OR UPDATE OF is_deleted
  ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tenant_billing_limit();

DROP TRIGGER IF EXISTS enforce_sales_package_limits ON public.sales;
CREATE TRIGGER enforce_sales_package_limits
  BEFORE INSERT OR UPDATE OF is_deleted
  ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tenant_billing_limit();

UPDATE public.tenant_billing
SET plan_key = coalesce(nullif(trim(plan_key), ''), 'free');

UPDATE public.tenant_billing
SET package_limits_enabled = true
WHERE coalesce(plan_key, 'free') IN ('starter', 'pro');

UPDATE public.tenant_billing tb
SET package_limits_enabled = true
WHERE coalesce(tb.package_limits_enabled, false) = false
  AND EXISTS (
    SELECT 1
    FROM public.demo_requests dr
    WHERE dr.tenant_id = tb.tenant_id
      AND dr.status = 'approved'
      AND dr.requested_package IN ('starter', 'professional', 'enterprise')
  );
