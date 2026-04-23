-- Enforce strict shared-database tenant isolation.
-- New writes must have an active tenant context and tenant-scoped permissions
-- should resolve from tenant_role_permissions before falling back to legacy
-- global role_permissions.

-- Seed canonical permission rows needed by tenant-scoped permission checks.
INSERT INTO public.role_permissions (role, permission_key, allowed)
SELECT
  'tenant_admin'::public.user_role,
  rp.permission_key,
  rp.allowed
FROM public.role_permissions rp
WHERE rp.role = 'admin'::public.user_role
  AND NOT EXISTS (
    SELECT 1
    FROM public.role_permissions existing
    WHERE existing.role = 'tenant_admin'::public.user_role
      AND existing.permission_key = rp.permission_key
  );

INSERT INTO public.role_permissions (role, permission_key, allowed)
SELECT
  'viewer'::public.user_role,
  seed.permission_key,
  true
FROM (
  VALUES
    ('access.dashboard'),
    ('access.alerts'),
    ('products.view'),
    ('inventory.view'),
    ('sales.view'),
    ('invoices.view'),
    ('customers.view'),
    ('reports.view'),
    ('settings.view_business')
) AS seed(permission_key)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.role_permissions existing
  WHERE existing.role = 'viewer'::public.user_role
    AND existing.permission_key = seed.permission_key
);

DO $$
BEGIN
  IF to_regclass('public.tenant_role_permissions') IS NOT NULL THEN
    INSERT INTO public.tenant_role_permissions (tenant_id, role, permission_key, allowed, source)
    SELECT
      t.id,
      rp.role,
      rp.permission_key,
      rp.allowed,
      'system_seed'
    FROM public.tenants t
    JOIN public.role_permissions rp
      ON rp.role IN (
        'admin'::public.user_role,
        'tenant_admin'::public.user_role,
        'manager'::public.user_role,
        'staff'::public.user_role,
        'viewer'::public.user_role
      )
    ON CONFLICT (tenant_id, role, permission_key) DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  active_user_id uuid;
  jwt_claims jsonb;
  jwt_tenant_text text;
  claimed_tenant_id uuid;
  resolved_tenant_id uuid;
BEGIN
  active_user_id := auth.uid();
  IF active_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    jwt_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  EXCEPTION WHEN others THEN
    jwt_claims := NULL;
  END;

  jwt_tenant_text := COALESCE(jwt_claims ->> 'tenant_id', jwt_claims -> 'app_metadata' ->> 'tenant_id');
  IF jwt_tenant_text IS NOT NULL AND btrim(jwt_tenant_text) <> '' THEN
    BEGIN
      claimed_tenant_id := jwt_tenant_text::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      claimed_tenant_id := NULL;
    END;

    IF claimed_tenant_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.tenant_members tm
      WHERE tm.tenant_id = claimed_tenant_id
        AND tm.user_id = active_user_id
        AND tm.is_active = true
    ) THEN
      RETURN claimed_tenant_id;
    END IF;
  END IF;

  SELECT tm.tenant_id
  INTO resolved_tenant_id
  FROM public.tenant_members tm
  WHERE tm.user_id = active_user_id
    AND tm.is_active = true
  ORDER BY tm.is_default DESC, tm.created_at ASC
  LIMIT 1;

  RETURN resolved_tenant_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_tenant_id_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  resolved_tenant_id uuid;
BEGIN
  resolved_tenant_id := public.current_tenant_id();

  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := resolved_tenant_id;
  END IF;

  IF resolved_tenant_id IS NOT NULL AND NEW.tenant_id IS DISTINCT FROM resolved_tenant_id THEN
    RAISE EXCEPTION 'Cross-tenant write blocked for table %', TG_TABLE_NAME
      USING ERRCODE = '42501';
  END IF;

  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant context is required for writes to %', TG_TABLE_NAME
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_permission(user_id uuid, permission_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  resolved_role text;
  permission_role text;
  permission_roles text[];
  current_tenant uuid;
  is_allowed boolean;
BEGIN
  SELECT role::text INTO resolved_role
  FROM public.user_roles
  WHERE public.user_roles.user_id = has_permission.user_id
  ORDER BY created_at DESC NULLS LAST
  LIMIT 1;

  IF resolved_role IS NULL THEN
    SELECT role::text INTO resolved_role
    FROM public.profiles
    WHERE id = has_permission.user_id
    LIMIT 1;
  END IF;

  resolved_role := lower(btrim(coalesce(resolved_role, '')));
  IF resolved_role IN ('superadmin', 'super_admin') THEN
    RETURN true;
  END IF;

  current_tenant := public.current_tenant_id();
  IF current_tenant IS NULL THEN
    RETURN false;
  END IF;

  SELECT tm.role::text INTO resolved_role
  FROM public.tenant_members tm
  WHERE tm.user_id = has_permission.user_id
    AND tm.tenant_id = current_tenant
    AND tm.is_active = true
  ORDER BY tm.is_default DESC, tm.created_at DESC
  LIMIT 1;

  IF resolved_role IS NULL THEN
    RETURN false;
  END IF;

  permission_role := lower(btrim(resolved_role));
  IF permission_role IN ('owner', 'admin', 'tenant_admin') THEN
    RETURN true;
  ELSIF permission_role = 'store_manager' THEN
    permission_role := 'manager';
  ELSIF permission_role IN ('sales_associate', 'warehouse') THEN
    permission_role := 'staff';
  ELSIF permission_role = 'member' THEN
    permission_role := 'viewer';
  END IF;

  IF permission_role = 'tenant_admin' THEN
    permission_roles := ARRAY['tenant_admin', 'admin'];
  ELSE
    permission_roles := ARRAY[permission_role];
  END IF;

  IF to_regclass('public.tenant_role_permissions') IS NOT NULL THEN
    SELECT trp.allowed
    INTO is_allowed
    FROM public.tenant_role_permissions trp
    WHERE trp.tenant_id = current_tenant
      AND trp.role::text = ANY(permission_roles)
      AND trp.permission_key = has_permission.permission_key
    ORDER BY
      CASE WHEN trp.role::text = permission_role THEN 0 ELSE 1 END,
      trp.updated_at DESC NULLS LAST,
      trp.created_at DESC NULLS LAST
    LIMIT 1;

    IF is_allowed IS NOT NULL THEN
      RETURN is_allowed;
    END IF;
  END IF;

  SELECT rp.allowed
  INTO is_allowed
  FROM public.role_permissions rp
  WHERE rp.role::text = ANY(permission_roles)
    AND rp.permission_key = has_permission.permission_key
  ORDER BY
    CASE WHEN rp.role::text = permission_role THEN 0 ELSE 1 END,
    rp.updated_at DESC NULLS LAST,
    rp.created_at DESC NULLS LAST
  LIMIT 1;

  RETURN COALESCE(is_allowed, false);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
