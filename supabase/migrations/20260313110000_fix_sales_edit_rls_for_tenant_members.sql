-- Fix sale edit flow RLS to respect tenant membership roles and tenant scope.
-- The frontend already falls back to tenant_members for roles, but the old sales
-- UPDATE/DELETE policies still rely on legacy has_role(user_roles-only) checks.
-- That causes false "blocked by permissions" errors when editing sales.

DO $$
BEGIN
  IF to_regclass('public.sales') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Managers and admins can update sales" ON public.sales;
    DROP POLICY IF EXISTS "Staff and above can update sales" ON public.sales;
    DROP POLICY IF EXISTS "Users with permission can update sales" ON public.sales;

    CREATE POLICY "Users with permission can update sales"
      ON public.sales
      FOR UPDATE
      TO authenticated
      USING (
        tenant_id = public.current_tenant_id()
        AND public.has_permission(auth.uid(), 'sales.edit')
      )
      WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND public.has_permission(auth.uid(), 'sales.edit')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.sales_items') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Managers and admins can delete sales items" ON public.sales_items;
    DROP POLICY IF EXISTS "Users with permission can delete sales_items" ON public.sales_items;

    CREATE POLICY "Users with permission can delete sales_items"
      ON public.sales_items
      FOR DELETE
      TO authenticated
      USING (
        tenant_id = public.current_tenant_id()
        AND (
          public.has_permission(auth.uid(), 'sales.edit')
          OR public.has_permission(auth.uid(), 'sales.delete')
        )
      );

    DROP POLICY IF EXISTS "Users with permission can insert sales_items" ON public.sales_items;
    CREATE POLICY "Users with permission can insert sales_items"
      ON public.sales_items
      FOR INSERT
      TO authenticated
      WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND (
          public.has_permission(auth.uid(), 'sales.create')
          OR public.has_permission(auth.uid(), 'sales.edit')
        )
      );

    DROP POLICY IF EXISTS "Users with permission can view sales_items" ON public.sales_items;
    CREATE POLICY "Users with permission can view sales_items"
      ON public.sales_items
      FOR SELECT
      TO authenticated
      USING (
        tenant_id = public.current_tenant_id()
        AND public.has_permission(auth.uid(), 'sales.view')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.sale_payments') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users with permission can view sale_payments" ON public.sale_payments;
    CREATE POLICY "Users with permission can view sale_payments"
      ON public.sale_payments
      FOR SELECT
      TO authenticated
      USING (
        tenant_id = public.current_tenant_id()
        AND public.has_permission(auth.uid(), 'sales.view')
      );

    DROP POLICY IF EXISTS "Users with permission can insert sale_payments" ON public.sale_payments;
    CREATE POLICY "Users with permission can insert sale_payments"
      ON public.sale_payments
      FOR INSERT
      TO authenticated
      WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND (
          public.has_permission(auth.uid(), 'sales.create')
          OR public.has_permission(auth.uid(), 'sales.edit')
        )
      );

    DROP POLICY IF EXISTS "Users with permission can delete sale_payments" ON public.sale_payments;
    CREATE POLICY "Users with permission can delete sale_payments"
      ON public.sale_payments
      FOR DELETE
      TO authenticated
      USING (
        tenant_id = public.current_tenant_id()
        AND (
          public.has_permission(auth.uid(), 'sales.edit')
          OR public.has_permission(auth.uid(), 'sales.delete')
        )
      );
  END IF;
END $$;
