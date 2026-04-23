-- Make packaging queue compatible with older customer schemas that do not
-- have customers.alias_names yet.

CREATE OR REPLACE FUNCTION public.get_packaging_queue(p_search text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  normalized_search text := nullif(btrim(p_search), '');
  current_tenant uuid;
  has_customer_alias_names boolean;
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

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customers'
      AND column_name = 'alias_names'
  )
  INTO has_customer_alias_names;

  IF has_customer_alias_names THEN
    WITH queue_rows AS (
      SELECT
        s.id AS sale_id,
        s.invoice_number,
        coalesce(s.courier_status, s.status, s.order_status) AS status,
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
      WHERE s.tenant_id = current_tenant
        AND coalesce(s.is_deleted, false) = false
        AND public.is_packaging_packable_status(coalesce(s.courier_status, s.status, s.order_status))
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
  ELSE
    WITH queue_rows AS (
      SELECT
        s.id AS sale_id,
        s.invoice_number,
        coalesce(s.courier_status, s.status, s.order_status) AS status,
        s.packaged,
        s.created_at,
        coalesce(s.updated_at, s.created_at) AS updated_at,
        s.created_by,
        coalesce(c.name, s.customer_name) AS canonical_customer_name,
        '{}'::text[] AS alias_names,
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
      WHERE s.tenant_id = current_tenant
        AND coalesce(s.is_deleted, false) = false
        AND public.is_packaging_packable_status(coalesce(s.courier_status, s.status, s.order_status))
        AND (
          normalized_search IS NULL
          OR s.invoice_number ILIKE '%' || normalized_search || '%'
          OR coalesce(c.name, s.customer_name, '') ILIKE '%' || normalized_search || '%'
          OR coalesce(seller.full_name, '') ILIKE '%' || normalized_search || '%'
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
  END IF;

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

GRANT EXECUTE ON FUNCTION public.get_packaging_queue(text) TO authenticated;
