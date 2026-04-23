-- Allow superadmins to manage tenant role permissions across tenants from the browser
-- and make tenant_admin permission overrides effective in the database permission function.

DO $$
BEGIN
  IF to_regclass('public.tenant_role_permissions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "superadmin_manage_all_tenant_role_permissions" ON public.tenant_role_permissions;
    CREATE POLICY "superadmin_manage_all_tenant_role_permissions"
      ON public.tenant_role_permissions
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid()
            AND lower(COALESCE(role::text, '')) IN ('superadmin', 'super_admin')
        )
        OR EXISTS (
          SELECT 1
          FROM public.user_roles
          WHERE user_id = auth.uid()
            AND lower(COALESCE(role::text, '')) IN ('superadmin', 'super_admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid()
            AND lower(COALESCE(role::text, '')) IN ('superadmin', 'super_admin')
        )
        OR EXISTS (
          SELECT 1
          FROM public.user_roles
          WHERE user_id = auth.uid()
            AND lower(COALESCE(role::text, '')) IN ('superadmin', 'super_admin')
        )
      );
  END IF;
END $$;

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
  IF permission_role IN ('owner', 'admin') THEN
    permission_role := 'tenant_admin';
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
      AND trp.permission_key IN (has_permission.permission_key, '*')
    ORDER BY
      CASE WHEN trp.role::text = permission_role THEN 0 ELSE 1 END,
      CASE WHEN trp.permission_key = has_permission.permission_key THEN 0 ELSE 1 END,
      trp.updated_at DESC NULLS LAST,
      trp.created_at DESC NULLS LAST
    LIMIT 1;

    IF is_allowed IS NOT NULL THEN
      RETURN is_allowed;
    END IF;

    IF permission_role = 'tenant_admin' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.tenant_role_permissions trp
        WHERE trp.tenant_id = current_tenant
          AND trp.role::text = ANY(permission_roles)
      ) THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  SELECT rp.allowed
  INTO is_allowed
  FROM public.role_permissions rp
  WHERE rp.role::text = ANY(permission_roles)
    AND rp.permission_key IN (has_permission.permission_key, '*')
  ORDER BY
    CASE WHEN rp.role::text = permission_role THEN 0 ELSE 1 END,
    CASE WHEN rp.permission_key = has_permission.permission_key THEN 0 ELSE 1 END,
    rp.updated_at DESC NULLS LAST,
    rp.created_at DESC NULLS LAST
  LIMIT 1;

  IF is_allowed IS NOT NULL THEN
    RETURN is_allowed;
  END IF;

  RETURN permission_role = 'tenant_admin';
END;
$function$;

GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
