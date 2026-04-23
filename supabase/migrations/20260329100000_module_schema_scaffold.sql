-- =============================================================================
-- MODULE SCHEMA SCAFFOLD (REVIEW ONLY)
-- =============================================================================
-- Purpose:
--   1. Introduce future module schemas without changing current runtime behavior.
--   2. Document the verified current public.* table ownership for this repo.
--   3. Provide a staged move plan for later execution after service abstraction.
--
-- Important:
--   - This file is intended as a planning scaffold first.
--   - Keep the current public schema physically intact until all data access is
--     routed through stable module services and tenant-safe repositories.
--   - Do not uncomment ALTER TABLE ... SET SCHEMA statements until:
--       a) Supabase client calls are moved behind stable module services
--       b) Generated types are updated
--       c) SQL functions / Edge Functions / Nest API code no longer assume public
--       d) compatibility strategy and rollback plan are tested
--
-- Safe to execute later:
--   - CREATE SCHEMA IF NOT EXISTS ... statements are idempotent
--
-- Not active yet:
--   - All physical table moves remain commented for review
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Phase 1: Create module namespaces only
-- -----------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS inventory;
CREATE SCHEMA IF NOT EXISTS hr;
CREATE SCHEMA IF NOT EXISTS production;
CREATE SCHEMA IF NOT EXISTS accounts;

COMMENT ON SCHEMA core IS
  'Shared platform foundation: tenants, auth-adjacent metadata, billing, notifications, audit.';

COMMENT ON SCHEMA inventory IS
  'Inventory, sales, customer, courier, packaging, invoice-operational data.';

COMMENT ON SCHEMA hr IS
  'Future HR module namespace: employees, attendance, leave, payroll, policies.';

COMMENT ON SCHEMA production IS
  'Future production module namespace: BOM, work orders, routing, machine events.';

COMMENT ON SCHEMA accounts IS
  'Future accounting namespace: ledgers, journals, receivables, payables, taxes.';

-- -----------------------------------------------------------------------------
-- Phase 2: Verified current public.* table ownership (current repo state)
-- -----------------------------------------------------------------------------
-- Source of truth for this scaffold:
--   - Existing migrations in supabase/migrations
--   - Grouped here to guide future non-breaking schema transition work
--
-- CORE CANDIDATE TABLES (verified existing now in public.*)
--   tenants
--   tenant_members
--   tenant_invites
--   tenant_role_permissions
--   tenant_usage
--   tenant_billing
--   notification_templates
--   business_settings
--   custom_settings
--   system_settings
--   activity_logs
--   audit_logs
--   demo_requests
--   registration_requests
--
-- INVENTORY CANDIDATE TABLES (verified existing now in public.*)
--   products
--   product_variants
--   product_attributes
--   product_attribute_values
--   reusable_attributes
--   inventory_logs
--   customers
--   sales
--   sales_items
--   sale_items              -- legacy compatibility table, still in use
--   sale_payments
--   payment_methods
--   courier_payment_rules
--   courier_webhook_settings
--   courier_status_logs
--   woocommerce_connections
--   woocommerce_import_logs
--   woocommerce_sync_logs
--   woocommerce_sync_schedules
--
-- STAY IN INVENTORY / FULFILLMENT, NOT PRODUCTION
--   - Packaging currently lives inside inventory/sales behavior
--   - Current implementation is mainly sales.packaged + packaging functions
--   - Do not move packaging into production
--
-- INVOICES
--   - Current invoices are operational sales invoices
--   - Keep them within inventory/sales, not future financial accounts
--
-- DEFERRED / REVIEW-LATER PUBLIC TABLES
--   These exist today but should be classified in a later pass after service
--   abstraction is stable:
--   profiles
--   user_preferences
--   user_roles
--   role_permissions
--   system_flags
--   dismissed_alerts
--   security_audit_log
--   security_audit_logs

-- -----------------------------------------------------------------------------
-- Phase 3: Future physical move plan (COMMENTED / NOT ACTIVE)
-- -----------------------------------------------------------------------------
-- The statements below are intentionally commented.
-- Review and execute only after module services fully replace direct public.*
-- access in app code, API code, SQL functions, generated types, and edge code.

-- --- Move core-owned tables ---------------------------------------------------
-- ALTER TABLE public.tenants SET SCHEMA core;
-- ALTER TABLE public.tenant_members SET SCHEMA core;
-- ALTER TABLE public.tenant_invites SET SCHEMA core;
-- ALTER TABLE public.tenant_role_permissions SET SCHEMA core;
-- ALTER TABLE public.tenant_usage SET SCHEMA core;
-- ALTER TABLE public.tenant_billing SET SCHEMA core;
-- ALTER TABLE public.notification_templates SET SCHEMA core;
-- ALTER TABLE public.business_settings SET SCHEMA core;
-- ALTER TABLE public.custom_settings SET SCHEMA core;
-- ALTER TABLE public.system_settings SET SCHEMA core;
-- ALTER TABLE public.activity_logs SET SCHEMA core;
-- ALTER TABLE public.audit_logs SET SCHEMA core;
-- ALTER TABLE public.demo_requests SET SCHEMA core;
-- ALTER TABLE public.registration_requests SET SCHEMA core;

-- --- Move inventory-owned tables ---------------------------------------------
-- ALTER TABLE public.products SET SCHEMA inventory;
-- ALTER TABLE public.product_variants SET SCHEMA inventory;
-- ALTER TABLE public.product_attributes SET SCHEMA inventory;
-- ALTER TABLE public.product_attribute_values SET SCHEMA inventory;
-- ALTER TABLE public.reusable_attributes SET SCHEMA inventory;
-- ALTER TABLE public.inventory_logs SET SCHEMA inventory;
-- ALTER TABLE public.customers SET SCHEMA inventory;
-- ALTER TABLE public.sales SET SCHEMA inventory;
-- ALTER TABLE public.sales_items SET SCHEMA inventory;
-- ALTER TABLE public.sale_items SET SCHEMA inventory;
-- ALTER TABLE public.sale_payments SET SCHEMA inventory;
-- ALTER TABLE public.payment_methods SET SCHEMA inventory;
-- ALTER TABLE public.courier_payment_rules SET SCHEMA inventory;
-- ALTER TABLE public.courier_webhook_settings SET SCHEMA inventory;
-- ALTER TABLE public.courier_status_logs SET SCHEMA inventory;
-- ALTER TABLE public.woocommerce_connections SET SCHEMA inventory;
-- ALTER TABLE public.woocommerce_import_logs SET SCHEMA inventory;
-- ALTER TABLE public.woocommerce_sync_logs SET SCHEMA inventory;
-- ALTER TABLE public.woocommerce_sync_schedules SET SCHEMA inventory;

-- -----------------------------------------------------------------------------
-- Phase 4: Compatibility bridge examples (COMMENTED / REVIEW ONLY)
-- -----------------------------------------------------------------------------
-- Prefer repository/service abstraction first. Do not rely on compatibility
-- views as the primary write bridge in production.

-- Example read bridge:
-- CREATE VIEW public.products AS SELECT * FROM inventory.products;

-- Supabase client note:
--   Preferred module-schema usage after the transition:
--     supabase.schema('inventory').from('products')
--   Not:
--     from('inventory.products')

-- -----------------------------------------------------------------------------
-- Phase 5: Required prerequisites before physical moves
-- -----------------------------------------------------------------------------
-- 1. Centralize direct public.* access into stable module services:
--      src/core
--      src/modules/inventory
--      src/modules/hr
--      src/modules/production
--      src/modules/accounts
--      src/shared
-- 2. Regenerate Supabase types after schema changes.
-- 3. Update SQL functions and triggers referencing public.*
-- 4. Update Edge Functions and Nest API modules referencing public.*
-- 5. Reapply / review RLS policies in target schemas.
-- 6. Run cross-tenant leakage tests before and after each move.
-- 7. Move tables one module at a time, never all at once.

COMMIT;
