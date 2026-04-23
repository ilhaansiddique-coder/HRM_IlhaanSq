DO $$
BEGIN
  IF to_regclass('public.tenant_billing') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins can view tenant billing" ON public.tenant_billing;
    DROP POLICY IF EXISTS "Users with billing permission can view tenant billing" ON public.tenant_billing;
    CREATE POLICY "Users with billing permission can view tenant billing"
      ON public.tenant_billing
      FOR SELECT
      TO authenticated
      USING (
        tenant_id = public.current_tenant_id()
        AND (
          public.has_permission(auth.uid(), 'billing.view')
          OR public.has_permission(auth.uid(), 'billing.edit')
        )
      );

    DROP POLICY IF EXISTS "superadmin_view_all_tenant_billing" ON public.tenant_billing;
    CREATE POLICY "superadmin_view_all_tenant_billing"
      ON public.tenant_billing
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid()
            AND lower(coalesce(role::text, '')) IN ('superadmin', 'super_admin')
        )
        OR EXISTS (
          SELECT 1
          FROM public.user_roles
          WHERE user_id = auth.uid()
            AND lower(coalesce(role::text, '')) IN ('superadmin', 'super_admin')
        )
      );
  END IF;
END $$;
