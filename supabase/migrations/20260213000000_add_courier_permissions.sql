-- Add courier.send and courier.refresh permissions to role_permissions table
-- These control visibility of courier-related actions in the Sales page

-- Insert courier.send and courier.refresh permissions for each role (if enum values exist)
-- Admin already has all permissions via '*' wildcard
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'store_manager'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.role_permissions
      WHERE role = 'store_manager' AND permission_key = 'courier.send'
    ) THEN
      INSERT INTO public.role_permissions (role, permission_key, allowed)
      VALUES ('store_manager', 'courier.send', true);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.role_permissions
      WHERE role = 'store_manager' AND permission_key = 'courier.refresh'
    ) THEN
      INSERT INTO public.role_permissions (role, permission_key, allowed)
      VALUES ('store_manager', 'courier.refresh', true);
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'staff'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.role_permissions
      WHERE role = 'staff' AND permission_key = 'courier.send'
    ) THEN
      INSERT INTO public.role_permissions (role, permission_key, allowed)
      VALUES ('staff', 'courier.send', true);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.role_permissions
      WHERE role = 'staff' AND permission_key = 'courier.refresh'
    ) THEN
      INSERT INTO public.role_permissions (role, permission_key, allowed)
      VALUES ('staff', 'courier.refresh', true);
    END IF;
  END IF;
END $$;

-- Verify the inserted permissions
-- SELECT * FROM public.role_permissions WHERE permission_key LIKE 'courier.%';
