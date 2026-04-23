-- Fix has_permission() to respect tenant_members when user_roles is empty.
-- This prevents RLS false negatives for tenant-scoped roles.

CREATE OR REPLACE FUNCTION public.has_permission(user_id uuid, permission_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  resolved_role text;
  is_allowed boolean;
BEGIN
  -- Prefer explicit user_roles
  SELECT role::text INTO resolved_role
  FROM public.user_roles
  WHERE public.user_roles.user_id = has_permission.user_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Fallback to tenant membership role
  IF resolved_role IS NULL THEN
    SELECT tm.role::text INTO resolved_role
    FROM public.tenant_members tm
    WHERE tm.user_id = has_permission.user_id
      AND tm.is_active = true
      AND tm.tenant_id = public.current_tenant_id()
    ORDER BY tm.is_default DESC, tm.created_at DESC
    LIMIT 1;
  END IF;

  IF resolved_role IS NULL THEN
    RETURN false;
  END IF;

  -- Superadmin bypasses all permission checks.
  IF resolved_role = 'superadmin' THEN
    RETURN true;
  END IF;

  -- Normalize tenant and legacy roles to match role_permissions.
  IF resolved_role = 'tenant_admin' THEN
    resolved_role := 'admin';
  ELSIF resolved_role = 'owner' THEN
    resolved_role := 'admin';
  ELSIF resolved_role = 'store_manager' THEN
    resolved_role := 'manager';
  ELSIF resolved_role = 'sales_associate' OR resolved_role = 'warehouse' THEN
    resolved_role := 'staff';
  ELSIF resolved_role = 'member' THEN
    resolved_role := 'viewer';
  END IF;

  SELECT allowed INTO is_allowed
  FROM public.role_permissions
  WHERE public.role_permissions.role::text = resolved_role
    AND public.role_permissions.permission_key = has_permission.permission_key
  ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1;

  RETURN COALESCE(is_allowed, false);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
