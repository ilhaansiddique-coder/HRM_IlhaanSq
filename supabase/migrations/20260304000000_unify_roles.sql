-- Unify role model safely across legacy and canonical values.
-- NOTE: Avoid writing newly-added enum values in this same migration transaction.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'user_role'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'user_role' AND e.enumlabel = 'superadmin'
    ) THEN
      ALTER TYPE public.user_role ADD VALUE 'superadmin';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'user_role' AND e.enumlabel = 'tenant_admin'
    ) THEN
      ALTER TYPE public.user_role ADD VALUE 'tenant_admin';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'user_role' AND e.enumlabel = 'viewer'
    ) THEN
      ALTER TYPE public.user_role ADD VALUE 'viewer';
    END IF;
  END IF;
END $$;

-- Keep has_permission aligned with both legacy and canonical roles.
-- Keep argument names stable so dependent policies do not break.
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
  SELECT role::text INTO resolved_role
  FROM public.user_roles
  WHERE public.user_roles.user_id = has_permission.user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF resolved_role IS NULL THEN
    RETURN false;
  END IF;

  -- Superadmin bypasses all permission checks.
  IF resolved_role = 'superadmin' THEN
    RETURN true;
  END IF;

  -- Canonical-to-legacy compatibility for environments that still store old roles.
  IF resolved_role = 'tenant_admin' THEN
    resolved_role := 'admin';
  ELSIF resolved_role = 'store_manager' THEN
    resolved_role := 'manager';
  ELSIF resolved_role = 'sales_associate' OR resolved_role = 'warehouse' THEN
    resolved_role := 'staff';
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
