-- Fix RLS performance: wrap auth.uid() in (select auth.uid()) so it's evaluated
-- once per query instead of re-evaluated for every row.
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

DO $$
DECLARE
  has_permission_exists boolean := to_regprocedure('public.has_permission(uuid,text)') IS NOT NULL;
  user_has_role_exists boolean := to_regprocedure('public.user_has_role(text[])') IS NOT NULL;
BEGIN
  -- 1-2. activity_logs policies
  IF to_regclass('public.activity_logs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated users can insert activity_logs" ON public.activity_logs;
    CREATE POLICY "Authenticated users can insert activity_logs"
      ON public.activity_logs FOR INSERT TO authenticated
      WITH CHECK ((select auth.uid()) IS NOT NULL);

    DROP POLICY IF EXISTS "Users can view activity_logs based on entity permissions" ON public.activity_logs;
    IF has_permission_exists THEN
      CREATE POLICY "Users can view activity_logs based on entity permissions"
        ON public.activity_logs FOR SELECT
        USING (
          public.has_permission((select auth.uid()), 'logs.view')
          OR
          (entity_type = 'sales' AND public.has_permission((select auth.uid()), 'sales.view'))
        );
    ELSE
      RAISE NOTICE 'Skipping activity_logs SELECT policy: function public.has_permission(uuid,text) does not exist';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping activity_logs policies: table public.activity_logs does not exist';
  END IF;

  -- 3. business_settings
  IF to_regclass('public.business_settings') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated users can view business_settings" ON public.business_settings;
    CREATE POLICY "Authenticated users can view business_settings"
      ON public.business_settings FOR SELECT TO authenticated
      USING ((select auth.uid()) IS NOT NULL);
  END IF;

  -- 4. custom_settings
  IF to_regclass('public.custom_settings') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated users can view custom_settings" ON public.custom_settings;
    CREATE POLICY "Authenticated users can view custom_settings"
      ON public.custom_settings FOR SELECT TO authenticated
      USING ((select auth.uid()) IS NOT NULL);
  END IF;

  -- 5. system_settings
  IF to_regclass('public.system_settings') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated users can view system_settings" ON public.system_settings;
    CREATE POLICY "Authenticated users can view system_settings"
      ON public.system_settings FOR SELECT TO authenticated
      USING ((select auth.uid()) IS NOT NULL);
  END IF;

  -- 6. woocommerce_import_logs
  IF to_regclass('public.woocommerce_import_logs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "System can insert woocommerce_import_logs" ON public.woocommerce_import_logs;
    CREATE POLICY "System can insert woocommerce_import_logs"
      ON public.woocommerce_import_logs FOR INSERT TO authenticated
      WITH CHECK ((select auth.uid()) IS NOT NULL);
  END IF;

  -- 7. woocommerce_sync_logs
  IF to_regclass('public.woocommerce_sync_logs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "System can insert woocommerce_sync_logs" ON public.woocommerce_sync_logs;
    CREATE POLICY "System can insert woocommerce_sync_logs"
      ON public.woocommerce_sync_logs FOR INSERT TO authenticated
      WITH CHECK ((select auth.uid()) IS NOT NULL);
  END IF;

  -- 8,11,13,16. product_attribute_values policies
  IF to_regclass('public.product_attribute_values') IS NOT NULL THEN
    IF has_permission_exists THEN
      DROP POLICY IF EXISTS "Users can delete product_attribute_values" ON public.product_attribute_values;
      CREATE POLICY "Users can delete product_attribute_values"
        ON public.product_attribute_values FOR DELETE TO authenticated
        USING (public.has_permission((select auth.uid()), 'products.delete'));

      DROP POLICY IF EXISTS "Users can insert product_attribute_values" ON public.product_attribute_values;
      CREATE POLICY "Users can insert product_attribute_values"
        ON public.product_attribute_values FOR INSERT TO authenticated
        WITH CHECK (public.has_permission((select auth.uid()), 'products.add'));

      DROP POLICY IF EXISTS "Users can update product_attribute_values" ON public.product_attribute_values;
      CREATE POLICY "Users can update product_attribute_values"
        ON public.product_attribute_values FOR UPDATE TO authenticated
        USING (public.has_permission((select auth.uid()), 'products.edit'));

      DROP POLICY IF EXISTS "Users can view product_attribute_values" ON public.product_attribute_values;
      CREATE POLICY "Users can view product_attribute_values"
        ON public.product_attribute_values FOR SELECT TO authenticated
        USING (public.has_permission((select auth.uid()), 'products.view'));
    ELSE
      RAISE NOTICE 'Skipping product_attribute_values policies: function public.has_permission(uuid,text) does not exist';
    END IF;
  END IF;

  -- 9,12,14,17. product_attributes policies
  IF to_regclass('public.product_attributes') IS NOT NULL THEN
    IF has_permission_exists THEN
      DROP POLICY IF EXISTS "Users can delete product_attributes" ON public.product_attributes;
      CREATE POLICY "Users can delete product_attributes"
        ON public.product_attributes FOR DELETE TO authenticated
        USING (public.has_permission((select auth.uid()), 'products.delete'));

      DROP POLICY IF EXISTS "Users can insert product_attributes" ON public.product_attributes;
      CREATE POLICY "Users can insert product_attributes"
        ON public.product_attributes FOR INSERT TO authenticated
        WITH CHECK (public.has_permission((select auth.uid()), 'products.add'));

      DROP POLICY IF EXISTS "Users can update product_attributes" ON public.product_attributes;
      CREATE POLICY "Users can update product_attributes"
        ON public.product_attributes FOR UPDATE TO authenticated
        USING (public.has_permission((select auth.uid()), 'products.edit'));

      DROP POLICY IF EXISTS "Users can view product_attributes" ON public.product_attributes;
      CREATE POLICY "Users can view product_attributes"
        ON public.product_attributes FOR SELECT TO authenticated
        USING (public.has_permission((select auth.uid()), 'products.view'));
    ELSE
      RAISE NOTICE 'Skipping product_attributes policies: function public.has_permission(uuid,text) does not exist';
    END IF;
  END IF;

  -- 10. profiles policy
  IF to_regclass('public.profiles') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can insert own profile or admins can insert any" ON public.profiles;
    IF user_has_role_exists THEN
      CREATE POLICY "Users can insert own profile or admins can insert any"
        ON public.profiles FOR INSERT TO authenticated
        WITH CHECK ((id = (select auth.uid())) OR public.user_has_role(ARRAY['admin']));
    ELSE
      RAISE NOTICE 'Skipping profiles INSERT policy: function public.user_has_role(text[]) does not exist';
    END IF;
  END IF;

  -- 15. user_roles policy
  IF to_regclass('public.user_roles') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
    IF user_has_role_exists THEN
      CREATE POLICY "Users can view own role"
        ON public.user_roles FOR SELECT TO authenticated
        USING ((user_id = (select auth.uid())) OR public.user_has_role(ARRAY['admin', 'manager']));
    ELSE
      RAISE NOTICE 'Skipping user_roles SELECT policy: function public.user_has_role(text[]) does not exist';
    END IF;
  END IF;

  -- 18. reusable_attributes policy
  IF to_regclass('public.reusable_attributes') IS NOT NULL THEN
    IF has_permission_exists THEN
      DROP POLICY IF EXISTS "Users can view reusable_attributes" ON public.reusable_attributes;
      CREATE POLICY "Users can view reusable_attributes"
        ON public.reusable_attributes FOR SELECT TO authenticated
        USING (public.has_permission((select auth.uid()), 'products.view'));
    ELSE
      RAISE NOTICE 'Skipping reusable_attributes SELECT policy: function public.has_permission(uuid,text) does not exist';
    END IF;
  END IF;

  -- 19. courier_webhook_settings policy
  IF to_regclass('public.courier_webhook_settings') IS NOT NULL THEN
    IF has_permission_exists AND user_has_role_exists THEN
      DROP POLICY IF EXISTS "Users with courier permission can view courier_webhook_settings" ON public.courier_webhook_settings;
      CREATE POLICY "Users with courier permission can view courier_webhook_settings"
        ON public.courier_webhook_settings FOR SELECT TO authenticated
        USING (
          public.user_has_role(ARRAY['admin'])
          OR public.has_permission((select auth.uid()), 'courier.send')
          OR public.has_permission((select auth.uid()), 'courier.refresh')
        );
    ELSE
      RAISE NOTICE 'Skipping courier_webhook_settings SELECT policy: required helper functions are missing';
    END IF;
  END IF;

  -- 20. customers add policy
  IF to_regclass('public.customers') IS NOT NULL THEN
    IF has_permission_exists THEN
      DROP POLICY IF EXISTS "Users with permission can add customers" ON public.customers;
      CREATE POLICY "Users with permission can add customers"
        ON public.customers FOR INSERT TO authenticated
        WITH CHECK (public.has_permission((select auth.uid()), 'customers.add'));
    ELSE
      RAISE NOTICE 'Skipping customers INSERT policy: function public.has_permission(uuid,text) does not exist';
    END IF;
  END IF;

  -- 21. inventory_logs add policy
  IF to_regclass('public.inventory_logs') IS NOT NULL THEN
    IF has_permission_exists THEN
      DROP POLICY IF EXISTS "Users with permission can add inventory_logs" ON public.inventory_logs;
      CREATE POLICY "Users with permission can add inventory_logs"
        ON public.inventory_logs FOR INSERT TO authenticated
        WITH CHECK (
          public.has_permission((select auth.uid()), 'inventory.adjust_stock')
          OR public.has_permission((select auth.uid()), 'products.edit')
        );
    ELSE
      RAISE NOTICE 'Skipping inventory_logs INSERT policy: function public.has_permission(uuid,text) does not exist';
    END IF;
  END IF;

  -- 22 and 28. products policies
  IF to_regclass('public.products') IS NOT NULL THEN
    IF has_permission_exists THEN
      DROP POLICY IF EXISTS "Users with permission can add products" ON public.products;
      CREATE POLICY "Users with permission can add products"
        ON public.products FOR INSERT TO authenticated
        WITH CHECK (public.has_permission((select auth.uid()), 'products.add'));

      DROP POLICY IF EXISTS "Users with permission can view products" ON public.products;
      CREATE POLICY "Users with permission can view products"
        ON public.products FOR SELECT TO authenticated
        USING (public.has_permission((select auth.uid()), 'products.view'));
    ELSE
      RAISE NOTICE 'Skipping products policies: function public.has_permission(uuid,text) does not exist';
    END IF;
  END IF;

  -- 23 and 30. product_variants policies
  IF to_regclass('public.product_variants') IS NOT NULL THEN
    IF has_permission_exists THEN
      DROP POLICY IF EXISTS "Users with permission can add variants" ON public.product_variants;
      CREATE POLICY "Users with permission can add variants"
        ON public.product_variants FOR INSERT TO authenticated
        WITH CHECK (public.has_permission((select auth.uid()), 'products.add'));

      DROP POLICY IF EXISTS "Users with permission can view variants" ON public.product_variants;
      CREATE POLICY "Users with permission can view variants"
        ON public.product_variants FOR SELECT TO authenticated
        USING (public.has_permission((select auth.uid()), 'products.view'));
    ELSE
      RAISE NOTICE 'Skipping product_variants policies: function public.has_permission(uuid,text) does not exist';
    END IF;
  END IF;

  -- 24. sales create policy
  IF to_regclass('public.sales') IS NOT NULL THEN
    IF has_permission_exists THEN
      DROP POLICY IF EXISTS "Users with permission can create sales" ON public.sales;
      CREATE POLICY "Users with permission can create sales"
        ON public.sales FOR INSERT TO authenticated
        WITH CHECK (public.has_permission((select auth.uid()), 'sales.create'));
    ELSE
      RAISE NOTICE 'Skipping sales INSERT policy: function public.has_permission(uuid,text) does not exist';
    END IF;
  END IF;

  -- 25. sale_items insert policy
  IF to_regclass('public.sale_items') IS NOT NULL THEN
    IF has_permission_exists THEN
      DROP POLICY IF EXISTS "Users with permission can insert sale_items" ON public.sale_items;
      CREATE POLICY "Users with permission can insert sale_items"
        ON public.sale_items FOR INSERT TO authenticated
        WITH CHECK (
          public.has_permission((select auth.uid()), 'sales.create')
          OR public.has_permission((select auth.uid()), 'sales.edit')
        );
    ELSE
      RAISE NOTICE 'Skipping sale_items INSERT policy: function public.has_permission(uuid,text) does not exist';
    END IF;
  END IF;

  -- 26. sale_payments insert policy
  IF to_regclass('public.sale_payments') IS NOT NULL THEN
    IF has_permission_exists THEN
      DROP POLICY IF EXISTS "Users with permission can insert sale_payments" ON public.sale_payments;
      CREATE POLICY "Users with permission can insert sale_payments"
        ON public.sale_payments FOR INSERT TO authenticated
        WITH CHECK (
          public.has_permission((select auth.uid()), 'sales.create')
          OR public.has_permission((select auth.uid()), 'sales.edit')
        );
    ELSE
      RAISE NOTICE 'Skipping sale_payments INSERT policy: function public.has_permission(uuid,text) does not exist';
    END IF;
  END IF;

  -- 27 and 29. sales_items policies
  IF to_regclass('public.sales_items') IS NOT NULL THEN
    IF has_permission_exists THEN
      DROP POLICY IF EXISTS "Users with permission can insert sales_items" ON public.sales_items;
      CREATE POLICY "Users with permission can insert sales_items"
        ON public.sales_items FOR INSERT TO authenticated
        WITH CHECK (public.has_permission((select auth.uid()), 'sales.create'));

      DROP POLICY IF EXISTS "Users with permission can view sales_items" ON public.sales_items;
      CREATE POLICY "Users with permission can view sales_items"
        ON public.sales_items FOR SELECT TO authenticated
        USING (public.has_permission((select auth.uid()), 'sales.view'));
    ELSE
      RAISE NOTICE 'Skipping sales_items policies: function public.has_permission(uuid,text) does not exist';
    END IF;
  END IF;
END $$;
