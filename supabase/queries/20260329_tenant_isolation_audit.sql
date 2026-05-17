-- PRE-APPLY TENANT ISOLATION AUDIT
-- -----------------------------------------------------------------------------
-- Run this before applying the bulk RLS hardening migration.
--
-- Goal:
--   Find old rows that will disappear or behave differently after strict
--   tenant_id = public.current_tenant_id() checks are enforced everywhere.
--
-- How to use:
--   1) Run section by section in SQL editor or psql.
--   2) Any non-zero result count is a rollout risk that should be reviewed.
--   3) Pay special attention to null tenant_id, orphan tenant_id, and
--      parent/child tenant mismatches.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 1) Null tenant_id checks
-- -----------------------------------------------------------------------------
SELECT 'business_settings' AS table_name, COUNT(*) AS bad_rows FROM public.business_settings WHERE tenant_id IS NULL
UNION ALL
SELECT 'custom_settings', COUNT(*) FROM public.custom_settings WHERE tenant_id IS NULL
UNION ALL
SELECT 'system_settings', COUNT(*) FROM public.system_settings WHERE tenant_id IS NULL
UNION ALL
SELECT 'courier_webhook_settings', COUNT(*) FROM public.courier_webhook_settings WHERE tenant_id IS NULL
UNION ALL
SELECT 'products', COUNT(*) FROM public.products WHERE tenant_id IS NULL
UNION ALL
SELECT 'product_variants', COUNT(*) FROM public.product_variants WHERE tenant_id IS NULL
UNION ALL
SELECT 'product_attributes', COUNT(*) FROM public.product_attributes WHERE tenant_id IS NULL
UNION ALL
SELECT 'product_attribute_values', COUNT(*) FROM public.product_attribute_values WHERE tenant_id IS NULL
UNION ALL
SELECT 'reusable_attributes', COUNT(*) FROM public.reusable_attributes WHERE tenant_id IS NULL
UNION ALL
SELECT 'customers', COUNT(*) FROM public.customers WHERE tenant_id IS NULL
UNION ALL
SELECT 'inventory_logs', COUNT(*) FROM public.inventory_logs WHERE tenant_id IS NULL
UNION ALL
SELECT 'sales', COUNT(*) FROM public.sales WHERE tenant_id IS NULL
UNION ALL
SELECT 'sales_items', COUNT(*) FROM public.sales_items WHERE tenant_id IS NULL
UNION ALL
SELECT 'sale_items', COUNT(*) FROM public.sale_items WHERE tenant_id IS NULL
UNION ALL
SELECT 'sale_payments', COUNT(*) FROM public.sale_payments WHERE tenant_id IS NULL
UNION ALL
SELECT 'payment_methods', COUNT(*) FROM public.payment_methods WHERE tenant_id IS NULL
UNION ALL
SELECT 'courier_payment_rules', COUNT(*) FROM public.courier_payment_rules WHERE tenant_id IS NULL;

-- -----------------------------------------------------------------------------
-- 2) Orphan tenant references
-- -----------------------------------------------------------------------------
SELECT 'products' AS table_name, COUNT(*) AS bad_rows
FROM public.products p
LEFT JOIN public.tenants t ON t.id = p.tenant_id
WHERE p.tenant_id IS NOT NULL AND t.id IS NULL
UNION ALL
SELECT 'customers', COUNT(*)
FROM public.customers c
LEFT JOIN public.tenants t ON t.id = c.tenant_id
WHERE c.tenant_id IS NOT NULL AND t.id IS NULL
UNION ALL
SELECT 'sales', COUNT(*)
FROM public.sales s
LEFT JOIN public.tenants t ON t.id = s.tenant_id
WHERE s.tenant_id IS NOT NULL AND t.id IS NULL
UNION ALL
SELECT 'payment_methods', COUNT(*)
FROM public.payment_methods pm
LEFT JOIN public.tenants t ON t.id = pm.tenant_id
WHERE pm.tenant_id IS NOT NULL AND t.id IS NULL;

-- -----------------------------------------------------------------------------
-- 3) Parent/child tenant mismatch checks
-- -----------------------------------------------------------------------------
SELECT 'product_variants -> products' AS relation_name, COUNT(*) AS bad_rows
FROM public.product_variants pv
JOIN public.products p ON p.id = pv.product_id
WHERE pv.tenant_id IS DISTINCT FROM p.tenant_id
UNION ALL
SELECT 'product_attributes -> products', COUNT(*)
FROM public.product_attributes pa
JOIN public.products p ON p.id = pa.product_id
WHERE pa.tenant_id IS DISTINCT FROM p.tenant_id
UNION ALL
SELECT 'product_attribute_values -> product_attributes', COUNT(*)
FROM public.product_attribute_values pav
JOIN public.product_attributes pa ON pa.id = pav.attribute_id
WHERE pav.tenant_id IS DISTINCT FROM pa.tenant_id
UNION ALL
SELECT 'inventory_logs -> products', COUNT(*)
FROM public.inventory_logs il
JOIN public.products p ON p.id = il.product_id
WHERE il.tenant_id IS DISTINCT FROM p.tenant_id
UNION ALL
SELECT 'sales -> customers', COUNT(*)
FROM public.sales s
JOIN public.customers c ON c.id = s.customer_id
WHERE s.customer_id IS NOT NULL
  AND s.tenant_id IS DISTINCT FROM c.tenant_id
UNION ALL
SELECT 'sales_items -> sales', COUNT(*)
FROM public.sales_items si
JOIN public.sales s ON s.id = si.sale_id
WHERE si.tenant_id IS DISTINCT FROM s.tenant_id
UNION ALL
SELECT 'sale_items -> sales', COUNT(*)
FROM public.sale_items si
JOIN public.sales s ON s.id = si.sale_id
WHERE si.tenant_id IS DISTINCT FROM s.tenant_id
UNION ALL
SELECT 'sale_payments -> sales', COUNT(*)
FROM public.sale_payments sp
JOIN public.sales s ON s.id = sp.sale_id
WHERE sp.tenant_id IS DISTINCT FROM s.tenant_id;

-- -----------------------------------------------------------------------------
-- 4) Duplicate uniqueness checks inside a tenant
-- -----------------------------------------------------------------------------
SELECT 'products duplicate sku' AS check_name, tenant_id, sku AS duplicate_key, COUNT(*) AS row_count
FROM public.products
WHERE sku IS NOT NULL
GROUP BY tenant_id, sku
HAVING COUNT(*) > 1
ORDER BY row_count DESC, tenant_id
LIMIT 100;

SELECT 'product_variants duplicate sku' AS check_name, tenant_id, sku AS duplicate_key, COUNT(*) AS row_count
FROM public.product_variants
WHERE sku IS NOT NULL
GROUP BY tenant_id, sku
HAVING COUNT(*) > 1
ORDER BY row_count DESC, tenant_id
LIMIT 100;

SELECT 'reusable_attributes duplicate name' AS check_name, tenant_id, name AS duplicate_key, COUNT(*) AS row_count
FROM public.reusable_attributes
WHERE name IS NOT NULL
GROUP BY tenant_id, name
HAVING COUNT(*) > 1
ORDER BY row_count DESC, tenant_id
LIMIT 100;

SELECT 'payment_methods duplicate key' AS check_name, tenant_id, key AS duplicate_key, COUNT(*) AS row_count
FROM public.payment_methods
WHERE key IS NOT NULL
GROUP BY tenant_id, key
HAVING COUNT(*) > 1
ORDER BY row_count DESC, tenant_id
LIMIT 100;

SELECT 'sales duplicate invoice_number' AS check_name, tenant_id, invoice_number AS duplicate_key, COUNT(*) AS row_count
FROM public.sales
WHERE invoice_number IS NOT NULL
GROUP BY tenant_id, invoice_number
HAVING COUNT(*) > 1
ORDER BY row_count DESC, tenant_id
LIMIT 100;

-- -----------------------------------------------------------------------------
-- 5) Snapshot counts by tenant for the most sensitive tables
-- -----------------------------------------------------------------------------
SELECT tenant_id, 'products' AS table_name, COUNT(*) AS row_count
FROM public.products
GROUP BY tenant_id
UNION ALL
SELECT tenant_id, 'customers', COUNT(*)
FROM public.customers
GROUP BY tenant_id
UNION ALL
SELECT tenant_id, 'sales', COUNT(*)
FROM public.sales
GROUP BY tenant_id
UNION ALL
SELECT tenant_id, 'sales_items', COUNT(*)
FROM public.sales_items
GROUP BY tenant_id
UNION ALL
SELECT tenant_id, 'sale_payments', COUNT(*)
FROM public.sale_payments
GROUP BY tenant_id
ORDER BY tenant_id, table_name;

-- -----------------------------------------------------------------------------
-- 6) Rows that would become invisible under strict tenant matching because of
--    linked cross-tenant references.
-- -----------------------------------------------------------------------------
SELECT
  s.id AS sale_id,
  s.tenant_id AS sale_tenant_id,
  c.id AS customer_id,
  c.tenant_id AS customer_tenant_id
FROM public.sales s
JOIN public.customers c ON c.id = s.customer_id
WHERE s.customer_id IS NOT NULL
  AND s.tenant_id IS DISTINCT FROM c.tenant_id
ORDER BY s.created_at DESC NULLS LAST
LIMIT 100;

SELECT
  si.id AS sales_item_id,
  si.tenant_id AS item_tenant_id,
  s.id AS sale_id,
  s.tenant_id AS sale_tenant_id
FROM public.sales_items si
JOIN public.sales s ON s.id = si.sale_id
WHERE si.tenant_id IS DISTINCT FROM s.tenant_id
ORDER BY si.created_at DESC NULLS LAST
LIMIT 100;

SELECT
  sp.id AS payment_id,
  sp.tenant_id AS payment_tenant_id,
  s.id AS sale_id,
  s.tenant_id AS sale_tenant_id
FROM public.sale_payments sp
JOIN public.sales s ON s.id = sp.sale_id
WHERE sp.tenant_id IS DISTINCT FROM s.tenant_id
ORDER BY sp.created_at DESC NULLS LAST
LIMIT 100;
