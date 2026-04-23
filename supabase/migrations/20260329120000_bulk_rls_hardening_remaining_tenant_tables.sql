-- REVIEW-READY MIGRATION ONLY
-- -----------------------------------------------------------------------------
-- Purpose:
--   Harden the remaining tenant-scoped tables that still rely on permission-only
--   RLS without an explicit row tenant check.
--
-- Important:
--   1) Do not apply this blind to production.
--   2) Run the companion audit SQL first:
--      supabase/queries/20260329_tenant_isolation_audit.sql
--   3) This migration assumes these foundations already exist:
--      - 20260303000000_phase1_multi_tenant_foundation.sql
--      - 20260313170000_strict_tenant_isolation_and_permissions.sql
--      - 20260313110000_fix_sales_edit_rls_for_tenant_members.sql
--
-- Intent:
--   Keep the current public schema intact, but ensure that every protected row
--   requires both:
--     - tenant_id = public.current_tenant_id()
--     - the appropriate permission check for the action
--
-- Notes:
--   - This pass intentionally excludes sales / sales_items / sale_payments because
--     those were already hardened in 20260313110000_fix_sales_edit_rls_for_tenant_members.sql.
--   - This pass also leaves activity_logs and WooCommerce tables for a later, more
--     tailored hardening pass because their read semantics are broader and deserve
--     dedicated review.
-- -----------------------------------------------------------------------------

BEGIN;

-- -----------------------------------------------------------------------------
-- Ensure the target tables are under RLS before we replace policies.
-- -----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.custom_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.courier_webhook_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.product_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.product_attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reusable_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.courier_payment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_methods ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- BUSINESS SETTINGS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view business_settings" ON public.business_settings;
DROP POLICY IF EXISTS "Admins and managers can insert business_settings" ON public.business_settings;
DROP POLICY IF EXISTS "Admins and managers can update business_settings" ON public.business_settings;
DROP POLICY IF EXISTS "Only admins can delete business_settings" ON public.business_settings;
DROP POLICY IF EXISTS "tenant_business_settings_select" ON public.business_settings;
DROP POLICY IF EXISTS "tenant_business_settings_insert" ON public.business_settings;
DROP POLICY IF EXISTS "tenant_business_settings_update" ON public.business_settings;
DROP POLICY IF EXISTS "tenant_business_settings_delete" ON public.business_settings;

CREATE POLICY "tenant_business_settings_select"
  ON public.business_settings
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission(auth.uid(), 'settings.view_business')
      OR public.has_permission(auth.uid(), 'settings.edit_business')
    )
  );

CREATE POLICY "tenant_business_settings_insert"
  ON public.business_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'settings.edit_business')
  );

CREATE POLICY "tenant_business_settings_update"
  ON public.business_settings
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'settings.edit_business')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'settings.edit_business')
  );

CREATE POLICY "tenant_business_settings_delete"
  ON public.business_settings
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'settings.edit_business')
  );

-- -----------------------------------------------------------------------------
-- CUSTOM SETTINGS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view custom_settings" ON public.custom_settings;
DROP POLICY IF EXISTS "Only admins can insert custom_settings" ON public.custom_settings;
DROP POLICY IF EXISTS "Only admins can update custom_settings" ON public.custom_settings;
DROP POLICY IF EXISTS "Only admins can delete custom_settings" ON public.custom_settings;
DROP POLICY IF EXISTS "tenant_custom_settings_select" ON public.custom_settings;
DROP POLICY IF EXISTS "tenant_custom_settings_insert" ON public.custom_settings;
DROP POLICY IF EXISTS "tenant_custom_settings_update" ON public.custom_settings;
DROP POLICY IF EXISTS "tenant_custom_settings_delete" ON public.custom_settings;

CREATE POLICY "tenant_custom_settings_select"
  ON public.custom_settings
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission(auth.uid(), 'settings.view_business')
      OR public.has_permission(auth.uid(), 'settings.edit_business')
      OR public.has_permission(auth.uid(), 'settings.manage_appearance')
    )
  );

CREATE POLICY "tenant_custom_settings_insert"
  ON public.custom_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission(auth.uid(), 'settings.edit_business')
      OR public.has_permission(auth.uid(), 'settings.manage_appearance')
    )
  );

CREATE POLICY "tenant_custom_settings_update"
  ON public.custom_settings
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission(auth.uid(), 'settings.edit_business')
      OR public.has_permission(auth.uid(), 'settings.manage_appearance')
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission(auth.uid(), 'settings.edit_business')
      OR public.has_permission(auth.uid(), 'settings.manage_appearance')
    )
  );

CREATE POLICY "tenant_custom_settings_delete"
  ON public.custom_settings
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission(auth.uid(), 'settings.edit_business')
      OR public.has_permission(auth.uid(), 'settings.manage_appearance')
    )
  );

-- -----------------------------------------------------------------------------
-- SYSTEM SETTINGS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Only admins can insert system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Only admins can update system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Only admins can delete system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "tenant_system_settings_select" ON public.system_settings;
DROP POLICY IF EXISTS "tenant_system_settings_insert" ON public.system_settings;
DROP POLICY IF EXISTS "tenant_system_settings_update" ON public.system_settings;
DROP POLICY IF EXISTS "tenant_system_settings_delete" ON public.system_settings;

CREATE POLICY "tenant_system_settings_select"
  ON public.system_settings
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission(auth.uid(), 'settings.view_business')
      OR public.has_permission(auth.uid(), 'settings.edit_business')
    )
  );

CREATE POLICY "tenant_system_settings_insert"
  ON public.system_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'settings.edit_business')
  );

CREATE POLICY "tenant_system_settings_update"
  ON public.system_settings
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'settings.edit_business')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'settings.edit_business')
  );

CREATE POLICY "tenant_system_settings_delete"
  ON public.system_settings
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'settings.edit_business')
  );

-- -----------------------------------------------------------------------------
-- COURIER WEBHOOK SETTINGS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Only admins can view courier_webhook_settings" ON public.courier_webhook_settings;
DROP POLICY IF EXISTS "Only admins can insert courier_webhook_settings" ON public.courier_webhook_settings;
DROP POLICY IF EXISTS "Only admins can update courier_webhook_settings" ON public.courier_webhook_settings;
DROP POLICY IF EXISTS "Only admins can delete courier_webhook_settings" ON public.courier_webhook_settings;
DROP POLICY IF EXISTS "Users with courier permission can view courier_webhook_settings" ON public.courier_webhook_settings;
DROP POLICY IF EXISTS "tenant_courier_webhook_settings_select" ON public.courier_webhook_settings;
DROP POLICY IF EXISTS "tenant_courier_webhook_settings_insert" ON public.courier_webhook_settings;
DROP POLICY IF EXISTS "tenant_courier_webhook_settings_update" ON public.courier_webhook_settings;
DROP POLICY IF EXISTS "tenant_courier_webhook_settings_delete" ON public.courier_webhook_settings;

CREATE POLICY "tenant_courier_webhook_settings_select"
  ON public.courier_webhook_settings
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission(auth.uid(), 'settings.view_business')
      OR public.has_permission(auth.uid(), 'settings.edit_business')
      OR public.has_permission(auth.uid(), 'courier.send')
      OR public.has_permission(auth.uid(), 'courier.refresh')
    )
  );

CREATE POLICY "tenant_courier_webhook_settings_insert"
  ON public.courier_webhook_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'settings.edit_business')
  );

CREATE POLICY "tenant_courier_webhook_settings_update"
  ON public.courier_webhook_settings
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'settings.edit_business')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'settings.edit_business')
  );

CREATE POLICY "tenant_courier_webhook_settings_delete"
  ON public.courier_webhook_settings
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'settings.edit_business')
  );

-- -----------------------------------------------------------------------------
-- PRODUCTS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users with permission can view products" ON public.products;
DROP POLICY IF EXISTS "Users with permission can add products" ON public.products;
DROP POLICY IF EXISTS "Users with permission can update products" ON public.products;
DROP POLICY IF EXISTS "Users with permission can delete products" ON public.products;
DROP POLICY IF EXISTS "tenant_products_select" ON public.products;
DROP POLICY IF EXISTS "tenant_products_insert" ON public.products;
DROP POLICY IF EXISTS "tenant_products_update" ON public.products;
DROP POLICY IF EXISTS "tenant_products_delete" ON public.products;

CREATE POLICY "tenant_products_select"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.view')
  );

CREATE POLICY "tenant_products_insert"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.add')
  );

CREATE POLICY "tenant_products_update"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.edit')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.edit')
  );

CREATE POLICY "tenant_products_delete"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.delete')
  );

-- -----------------------------------------------------------------------------
-- PRODUCT VARIANTS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users with permission can view variants" ON public.product_variants;
DROP POLICY IF EXISTS "Users with permission can add variants" ON public.product_variants;
DROP POLICY IF EXISTS "Users with permission can update variants" ON public.product_variants;
DROP POLICY IF EXISTS "Users with permission can delete variants" ON public.product_variants;
DROP POLICY IF EXISTS "tenant_product_variants_select" ON public.product_variants;
DROP POLICY IF EXISTS "tenant_product_variants_insert" ON public.product_variants;
DROP POLICY IF EXISTS "tenant_product_variants_update" ON public.product_variants;
DROP POLICY IF EXISTS "tenant_product_variants_delete" ON public.product_variants;

CREATE POLICY "tenant_product_variants_select"
  ON public.product_variants
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.view')
  );

CREATE POLICY "tenant_product_variants_insert"
  ON public.product_variants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.add')
  );

CREATE POLICY "tenant_product_variants_update"
  ON public.product_variants
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.edit')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.edit')
  );

CREATE POLICY "tenant_product_variants_delete"
  ON public.product_variants
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.delete')
  );

-- -----------------------------------------------------------------------------
-- PRODUCT ATTRIBUTES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view product_attributes" ON public.product_attributes;
DROP POLICY IF EXISTS "Users can insert product_attributes" ON public.product_attributes;
DROP POLICY IF EXISTS "Users can update product_attributes" ON public.product_attributes;
DROP POLICY IF EXISTS "Users can delete product_attributes" ON public.product_attributes;
DROP POLICY IF EXISTS "tenant_product_attributes_select" ON public.product_attributes;
DROP POLICY IF EXISTS "tenant_product_attributes_insert" ON public.product_attributes;
DROP POLICY IF EXISTS "tenant_product_attributes_update" ON public.product_attributes;
DROP POLICY IF EXISTS "tenant_product_attributes_delete" ON public.product_attributes;

CREATE POLICY "tenant_product_attributes_select"
  ON public.product_attributes
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.view')
  );

CREATE POLICY "tenant_product_attributes_insert"
  ON public.product_attributes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.add')
  );

CREATE POLICY "tenant_product_attributes_update"
  ON public.product_attributes
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.edit')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.edit')
  );

CREATE POLICY "tenant_product_attributes_delete"
  ON public.product_attributes
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.delete')
  );

-- -----------------------------------------------------------------------------
-- PRODUCT ATTRIBUTE VALUES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view product_attribute_values" ON public.product_attribute_values;
DROP POLICY IF EXISTS "Users can insert product_attribute_values" ON public.product_attribute_values;
DROP POLICY IF EXISTS "Users can update product_attribute_values" ON public.product_attribute_values;
DROP POLICY IF EXISTS "Users can delete product_attribute_values" ON public.product_attribute_values;
DROP POLICY IF EXISTS "tenant_product_attribute_values_select" ON public.product_attribute_values;
DROP POLICY IF EXISTS "tenant_product_attribute_values_insert" ON public.product_attribute_values;
DROP POLICY IF EXISTS "tenant_product_attribute_values_update" ON public.product_attribute_values;
DROP POLICY IF EXISTS "tenant_product_attribute_values_delete" ON public.product_attribute_values;

CREATE POLICY "tenant_product_attribute_values_select"
  ON public.product_attribute_values
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.view')
  );

CREATE POLICY "tenant_product_attribute_values_insert"
  ON public.product_attribute_values
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.add')
  );

CREATE POLICY "tenant_product_attribute_values_update"
  ON public.product_attribute_values
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.edit')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.edit')
  );

CREATE POLICY "tenant_product_attribute_values_delete"
  ON public.product_attribute_values
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.delete')
  );

-- -----------------------------------------------------------------------------
-- REUSABLE ATTRIBUTES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view reusable_attributes" ON public.reusable_attributes;
DROP POLICY IF EXISTS "Admins can insert reusable_attributes" ON public.reusable_attributes;
DROP POLICY IF EXISTS "Admins can update reusable_attributes" ON public.reusable_attributes;
DROP POLICY IF EXISTS "Admins can delete reusable_attributes" ON public.reusable_attributes;
DROP POLICY IF EXISTS "tenant_reusable_attributes_select" ON public.reusable_attributes;
DROP POLICY IF EXISTS "tenant_reusable_attributes_insert" ON public.reusable_attributes;
DROP POLICY IF EXISTS "tenant_reusable_attributes_update" ON public.reusable_attributes;
DROP POLICY IF EXISTS "tenant_reusable_attributes_delete" ON public.reusable_attributes;

CREATE POLICY "tenant_reusable_attributes_select"
  ON public.reusable_attributes
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.view')
  );

CREATE POLICY "tenant_reusable_attributes_insert"
  ON public.reusable_attributes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.add')
  );

CREATE POLICY "tenant_reusable_attributes_update"
  ON public.reusable_attributes
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.edit')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.edit')
  );

CREATE POLICY "tenant_reusable_attributes_delete"
  ON public.reusable_attributes
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.delete')
  );

-- -----------------------------------------------------------------------------
-- CUSTOMERS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users with customers.add can create customers" ON public.customers;
DROP POLICY IF EXISTS "Users with permission can add customers" ON public.customers;
DROP POLICY IF EXISTS "Managers and admins can update customers" ON public.customers;
DROP POLICY IF EXISTS "Managers and admins can delete customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can read customers" ON public.customers;
DROP POLICY IF EXISTS "tenant_customers_select" ON public.customers;
DROP POLICY IF EXISTS "tenant_customers_insert" ON public.customers;
DROP POLICY IF EXISTS "tenant_customers_update" ON public.customers;
DROP POLICY IF EXISTS "tenant_customers_delete" ON public.customers;

CREATE POLICY "tenant_customers_select"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'customers.view')
  );

CREATE POLICY "tenant_customers_insert"
  ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'customers.add')
  );

CREATE POLICY "tenant_customers_update"
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'customers.edit')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'customers.edit')
  );

CREATE POLICY "tenant_customers_delete"
  ON public.customers
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'customers.delete')
  );

-- -----------------------------------------------------------------------------
-- INVENTORY LOGS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can manage inventory logs" ON public.inventory_logs;
DROP POLICY IF EXISTS "Users with permission can add inventory_logs" ON public.inventory_logs;
DROP POLICY IF EXISTS "tenant_inventory_logs_select" ON public.inventory_logs;
DROP POLICY IF EXISTS "tenant_inventory_logs_insert" ON public.inventory_logs;

CREATE POLICY "tenant_inventory_logs_select"
  ON public.inventory_logs
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission(auth.uid(), 'inventory.view')
      OR public.has_permission(auth.uid(), 'inventory.adjust_stock')
      OR public.has_permission(auth.uid(), 'products.view')
    )
  );

CREATE POLICY "tenant_inventory_logs_insert"
  ON public.inventory_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission(auth.uid(), 'inventory.adjust_stock')
      OR public.has_permission(auth.uid(), 'products.edit')
    )
  );

-- -----------------------------------------------------------------------------
-- LEGACY SALE ITEMS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Users with permission can insert sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "tenant_sale_items_select" ON public.sale_items;
DROP POLICY IF EXISTS "tenant_sale_items_insert" ON public.sale_items;
DROP POLICY IF EXISTS "tenant_sale_items_update" ON public.sale_items;
DROP POLICY IF EXISTS "tenant_sale_items_delete" ON public.sale_items;

CREATE POLICY "tenant_sale_items_select"
  ON public.sale_items
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'sales.view')
  );

CREATE POLICY "tenant_sale_items_insert"
  ON public.sale_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission(auth.uid(), 'sales.create')
      OR public.has_permission(auth.uid(), 'sales.edit')
    )
  );

CREATE POLICY "tenant_sale_items_update"
  ON public.sale_items
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

CREATE POLICY "tenant_sale_items_delete"
  ON public.sale_items
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission(auth.uid(), 'sales.edit')
      OR public.has_permission(auth.uid(), 'sales.delete')
    )
  );

-- -----------------------------------------------------------------------------
-- COURIER PAYMENT RULES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and managers can insert courier_payment_rules" ON public.courier_payment_rules;
DROP POLICY IF EXISTS "tenant_courier_payment_rules_select" ON public.courier_payment_rules;
DROP POLICY IF EXISTS "tenant_courier_payment_rules_insert" ON public.courier_payment_rules;
DROP POLICY IF EXISTS "tenant_courier_payment_rules_update" ON public.courier_payment_rules;
DROP POLICY IF EXISTS "tenant_courier_payment_rules_delete" ON public.courier_payment_rules;

CREATE POLICY "tenant_courier_payment_rules_select"
  ON public.courier_payment_rules
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission(auth.uid(), 'settings.view_business')
      OR public.has_permission(auth.uid(), 'settings.edit_business')
    )
  );

CREATE POLICY "tenant_courier_payment_rules_insert"
  ON public.courier_payment_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'settings.edit_business')
  );

CREATE POLICY "tenant_courier_payment_rules_update"
  ON public.courier_payment_rules
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'settings.edit_business')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'settings.edit_business')
  );

CREATE POLICY "tenant_courier_payment_rules_delete"
  ON public.courier_payment_rules
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'settings.edit_business')
  );

-- -----------------------------------------------------------------------------
-- PAYMENT METHODS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and managers can insert payment_methods" ON public.payment_methods;
DROP POLICY IF EXISTS "tenant_payment_methods_select" ON public.payment_methods;
DROP POLICY IF EXISTS "tenant_payment_methods_insert" ON public.payment_methods;
DROP POLICY IF EXISTS "tenant_payment_methods_update" ON public.payment_methods;
DROP POLICY IF EXISTS "tenant_payment_methods_delete" ON public.payment_methods;

CREATE POLICY "tenant_payment_methods_select"
  ON public.payment_methods
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission(auth.uid(), 'settings.view_business')
      OR public.has_permission(auth.uid(), 'settings.edit_business')
    )
  );

CREATE POLICY "tenant_payment_methods_insert"
  ON public.payment_methods
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'settings.edit_business')
  );

CREATE POLICY "tenant_payment_methods_update"
  ON public.payment_methods
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'settings.edit_business')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'settings.edit_business')
  );

CREATE POLICY "tenant_payment_methods_delete"
  ON public.payment_methods
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'settings.edit_business')
  );

COMMIT;
