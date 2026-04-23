-- Packaging queue support for tenant admin operations.
-- This keeps packing independent from payment, courier, and inventory logic.

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS packaged boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_sales_packaged_status
  ON public.sales (packaged, status);

DO $$
BEGIN
  IF to_regclass('public.role_permissions') IS NOT NULL THEN
    INSERT INTO public.role_permissions (role, permission_key, allowed)
    SELECT
      seed.role_name::public.user_role,
      seed.permission_key,
      seed.allowed
    FROM (
      VALUES
        ('admin'::public.user_role, 'packaging.view', true),
        ('admin'::public.user_role, 'packaging.confirm', true),
        ('admin'::public.user_role, 'packaging.unpack', true),
        ('tenant_admin'::public.user_role, 'packaging.view', true),
        ('tenant_admin'::public.user_role, 'packaging.confirm', true),
        ('tenant_admin'::public.user_role, 'packaging.unpack', true),
        ('manager'::public.user_role, 'packaging.view', false),
        ('manager'::public.user_role, 'packaging.confirm', false),
        ('manager'::public.user_role, 'packaging.unpack', false),
        ('staff'::public.user_role, 'packaging.view', false),
        ('staff'::public.user_role, 'packaging.confirm', false),
        ('staff'::public.user_role, 'packaging.unpack', false),
        ('viewer'::public.user_role, 'packaging.view', false),
        ('viewer'::public.user_role, 'packaging.confirm', false),
        ('viewer'::public.user_role, 'packaging.unpack', false)
    ) AS seed(role_name, permission_key, allowed)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.role_permissions existing
      WHERE existing.role = seed.role_name
        AND existing.permission_key = seed.permission_key
    );
  END IF;

  IF to_regclass('public.tenant_role_permissions') IS NOT NULL
     AND to_regclass('public.role_permissions') IS NOT NULL
     AND to_regclass('public.tenants') IS NOT NULL THEN
    INSERT INTO public.tenant_role_permissions (tenant_id, role, permission_key, allowed, source)
    SELECT
      t.id,
      rp.role,
      rp.permission_key,
      rp.allowed,
      'system_seed'
    FROM public.tenants t
    JOIN public.role_permissions rp
      ON rp.permission_key IN ('packaging.view', 'packaging.confirm', 'packaging.unpack')
    ON CONFLICT (tenant_id, role, permission_key) DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_packaging_packable_status(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT coalesce(p_status, '') !~* '(cancelled|returned|lost)';
$function$;

CREATE OR REPLACE FUNCTION public.get_packaging_queue(p_search text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  normalized_search text := nullif(btrim(p_search), '');
  result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_permission(auth.uid(), 'packaging.view') THEN
    RAISE EXCEPTION 'Missing packaging.view permission'
      USING ERRCODE = '42501';
  END IF;

  WITH queue_rows AS (
    SELECT
      s.id AS sale_id,
      s.invoice_number,
      s.status,
      s.packaged,
      s.created_at,
      coalesce(s.updated_at, s.created_at) AS updated_at,
      s.created_by,
      coalesce(c.name, s.customer_name) AS canonical_customer_name,
      coalesce(c.alias_names, '{}'::text[]) AS alias_names,
      coalesce(seller.full_name, 'Unknown User') AS seller_name
    FROM public.sales s
    LEFT JOIN public.customers c
      ON c.id = s.customer_id
     AND c.tenant_id = s.tenant_id
     AND coalesce(c.is_deleted, false) = false
    LEFT JOIN LATERAL (
      SELECT guwr.full_name
      FROM public.get_all_users_with_roles() guwr
      WHERE guwr.id = s.created_by
      LIMIT 1
    ) seller ON true
    WHERE s.tenant_id = public.current_tenant_id()
      AND coalesce(s.is_deleted, false) = false
      AND public.is_packaging_packable_status(s.status)
      AND (
        normalized_search IS NULL
        OR s.invoice_number ILIKE '%' || normalized_search || '%'
        OR coalesce(c.name, s.customer_name, '') ILIKE '%' || normalized_search || '%'
        OR coalesce(seller.full_name, '') ILIKE '%' || normalized_search || '%'
        OR EXISTS (
          SELECT 1
          FROM unnest(coalesce(c.alias_names, '{}'::text[])) AS alias_name
          WHERE alias_name ILIKE '%' || normalized_search || '%'
        )
      )
  )
  SELECT jsonb_build_object(
    'packaging_supported', true,
    'read_only', false,
    'items',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'sale_id', qr.sale_id,
          'invoice_number', qr.invoice_number,
          'status', qr.status,
          'packaged', qr.packaged,
          'created_at', qr.created_at,
          'updated_at', qr.updated_at,
          'created_by', qr.created_by,
          'canonical_customer_name', qr.canonical_customer_name,
          'alias_names', qr.alias_names,
          'seller_name', qr.seller_name
        )
        ORDER BY qr.packaged ASC, qr.updated_at DESC NULLS LAST, qr.created_at DESC NULLS LAST
      ),
      '[]'::jsonb
    )
  )
  INTO result
  FROM queue_rows qr;

  RETURN coalesce(
    result,
    jsonb_build_object(
      'packaging_supported', true,
      'read_only', false,
      'items', '[]'::jsonb
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_packaging_history(p_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  current_tenant uuid;
  result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_permission(auth.uid(), 'packaging.view') THEN
    RAISE EXCEPTION 'Missing packaging.view permission'
      USING ERRCODE = '42501';
  END IF;

  current_tenant := public.current_tenant_id();
  IF current_tenant IS NULL THEN
    RAISE EXCEPTION 'No active tenant context'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sales s
    WHERE s.id = p_sale_id
      AND s.tenant_id = current_tenant
      AND coalesce(s.is_deleted, false) = false
  ) THEN
    RAISE EXCEPTION 'Sale not found in current tenant'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT jsonb_build_object(
    'sale_id', p_sale_id,
    'items',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', al.id,
          'user_id', al.user_id,
          'action', al.action,
          'summary', al.summary,
          'details', al.details,
          'created_at', al.created_at,
          'full_name', al.full_name,
          'email', al.email
        )
        ORDER BY al.created_at DESC NULLS LAST
      ),
      '[]'::jsonb
    )
  )
  INTO result
  FROM public.activity_logs_view al
  WHERE al.tenant_id = current_tenant
    AND al.entity_type = 'sales'
    AND al.entity_id = p_sale_id::text
    AND coalesce(al.details ->> 'context', '') = 'packaging';

  RETURN coalesce(
    result,
    jsonb_build_object(
      'sale_id', p_sale_id,
      'items', '[]'::jsonb
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_packaging_state(p_sale_id uuid, p_packaged boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  current_tenant uuid;
  required_permission text := CASE WHEN p_packaged THEN 'packaging.confirm' ELSE 'packaging.unpack' END;
  sale_row public.sales%ROWTYPE;
  changed_at timestamptz;
  action_name text := CASE WHEN p_packaged THEN 'packaging_packed' ELSE 'packaging_unpacked' END;
  summary_text text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_permission(auth.uid(), required_permission) THEN
    RAISE EXCEPTION 'Missing % permission', required_permission
      USING ERRCODE = '42501';
  END IF;

  current_tenant := public.current_tenant_id();
  IF current_tenant IS NULL THEN
    RAISE EXCEPTION 'No active tenant context'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO sale_row
  FROM public.sales s
  WHERE s.id = p_sale_id
    AND s.tenant_id = current_tenant
    AND coalesce(s.is_deleted, false) = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found in current tenant'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.is_packaging_packable_status(sale_row.status) THEN
    RAISE EXCEPTION 'Sale is not packable'
      USING ERRCODE = 'P0001';
  END IF;

  IF sale_row.packaged IS NOT DISTINCT FROM p_packaged THEN
    RETURN jsonb_build_object(
      'sale_id', sale_row.id,
      'packaged', sale_row.packaged,
      'changed', false,
      'idempotent', true,
      'updated_at', coalesce(sale_row.updated_at, sale_row.created_at)
    );
  END IF;

  UPDATE public.sales
  SET
    packaged = p_packaged,
    updated_at = now()
  WHERE id = sale_row.id
  RETURNING updated_at INTO changed_at;

  summary_text := CASE
    WHEN p_packaged THEN format('Marked sale %s as packed', coalesce(sale_row.invoice_number, sale_row.id::text))
    ELSE format('Reversed packed state for sale %s', coalesce(sale_row.invoice_number, sale_row.id::text))
  END;

  INSERT INTO public.activity_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    summary,
    details,
    tenant_id
  )
  VALUES (
    auth.uid(),
    action_name,
    'sales',
    sale_row.id::text,
    summary_text,
    jsonb_build_object(
      'context', 'packaging',
      'invoice_number', sale_row.invoice_number,
      'before', jsonb_build_object('packaged', sale_row.packaged),
      'after', jsonb_build_object('packaged', p_packaged)
    ),
    sale_row.tenant_id
  );

  RETURN jsonb_build_object(
    'sale_id', sale_row.id,
    'packaged', p_packaged,
    'changed', true,
    'idempotent', false,
    'updated_at', changed_at
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.is_packaging_packable_status(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_packaging_queue(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_packaging_history(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_packaging_state(uuid, boolean) TO authenticated;
