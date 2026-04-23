-- Allow superadmin browser fallbacks to read the cross-tenant registry
-- when the local protected API is unavailable.

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NOT NULL THEN
    DROP POLICY IF EXISTS "superadmin_read_all_tenants" ON public.tenants;
    CREATE POLICY "superadmin_read_all_tenants"
      ON public.tenants
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid()
            AND lower(COALESCE(role::text, '')) IN ('superadmin', 'super_admin')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.tenant_members') IS NOT NULL THEN
    DROP POLICY IF EXISTS "superadmin_read_all_tenant_members" ON public.tenant_members;
    CREATE POLICY "superadmin_read_all_tenant_members"
      ON public.tenant_members
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid()
            AND lower(COALESCE(role::text, '')) IN ('superadmin', 'super_admin')
        )
      );
  END IF;
END $$;
