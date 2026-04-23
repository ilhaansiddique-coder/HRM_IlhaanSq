CREATE OR REPLACE FUNCTION public.replace_tenant_role_permissions_atomic(
  target_tenant_id uuid,
  target_role text,
  permission_rows jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  normalized_role text := lower(btrim(coalesce(target_role, '')));
  role_candidates text[];
BEGIN
  IF target_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;

  IF normalized_role = '' THEN
    RAISE EXCEPTION 'role is required';
  END IF;

  IF normalized_role IN ('owner', 'admin') THEN
    normalized_role := 'tenant_admin';
  ELSIF normalized_role = 'store_manager' THEN
    normalized_role := 'manager';
  ELSIF normalized_role IN ('sales_associate', 'warehouse') THEN
    normalized_role := 'staff';
  ELSIF normalized_role = 'member' THEN
    normalized_role := 'viewer';
  END IF;

  IF jsonb_typeof(coalesce(permission_rows, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'permission_rows must be a JSON array';
  END IF;

  role_candidates := CASE
    WHEN normalized_role = 'tenant_admin' THEN ARRAY['tenant_admin', 'admin']
    ELSE ARRAY[normalized_role]
  END;

  DELETE FROM public.tenant_role_permissions
  WHERE tenant_id = target_tenant_id
    AND role::text = ANY(role_candidates);

  INSERT INTO public.tenant_role_permissions (
    tenant_id,
    role,
    permission_key,
    allowed,
    source
  )
  SELECT
    target_tenant_id,
    normalized_role,
    btrim(entry.permission_key),
    coalesce(entry.allowed, false),
    coalesce(nullif(btrim(entry.source), ''), 'tenant_admin_override')
  FROM jsonb_to_recordset(coalesce(permission_rows, '[]'::jsonb)) AS entry(
    permission_key text,
    allowed boolean,
    source text
  )
  WHERE nullif(btrim(entry.permission_key), '') IS NOT NULL;
END;
$$;
