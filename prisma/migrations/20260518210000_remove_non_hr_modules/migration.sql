-- DropForeignKey
ALTER TABLE "courier_providers" DROP CONSTRAINT "courier_providers_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "courier_webhook_settings" DROP CONSTRAINT "courier_webhook_settings_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "inventory_logs" DROP CONSTRAINT "inventory_logs_created_by_fkey";

-- DropForeignKey
ALTER TABLE "inventory_logs" DROP CONSTRAINT "inventory_logs_product_id_fkey";

-- DropForeignKey
ALTER TABLE "inventory_logs" DROP CONSTRAINT "inventory_logs_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "payment_logs" DROP CONSTRAINT "payment_logs_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "payment_logs" DROP CONSTRAINT "payment_logs_paid_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "payment_logs" DROP CONSTRAINT "payment_logs_sale_id_fkey";

-- DropForeignKey
ALTER TABLE "payment_logs" DROP CONSTRAINT "payment_logs_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "payment_methods" DROP CONSTRAINT "payment_methods_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "product_attribute_values" DROP CONSTRAINT "product_attribute_values_attribute_id_fkey";

-- DropForeignKey
ALTER TABLE "product_attributes" DROP CONSTRAINT "product_attributes_product_id_fkey";

-- DropForeignKey
ALTER TABLE "product_categories" DROP CONSTRAINT "product_categories_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "product_variants" DROP CONSTRAINT "product_variants_product_id_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "sale_items" DROP CONSTRAINT "sale_items_product_id_fkey";

-- DropForeignKey
ALTER TABLE "sale_items" DROP CONSTRAINT "sale_items_sale_id_fkey";

-- DropForeignKey
ALTER TABLE "sale_items" DROP CONSTRAINT "sale_items_variant_id_fkey";

-- DropForeignKey
ALTER TABLE "sale_payments" DROP CONSTRAINT "sale_payments_sale_id_fkey";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_created_by_fkey";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_tenant_id_fkey";

-- AlterTable
ALTER TABLE "business_settings" DROP COLUMN "invoice_footer_message",
DROP COLUMN "invoice_prefix",
DROP COLUMN "low_stock_alert_quantity";

-- DropTable
DROP TABLE "courier_providers";

-- DropTable
DROP TABLE "courier_webhook_settings";

-- DropTable
DROP TABLE "customers";

-- DropTable
DROP TABLE "dismissed_alerts";

-- DropTable
DROP TABLE "inventory_logs";

-- DropTable
DROP TABLE "payment_logs";

-- DropTable
DROP TABLE "payment_methods";

-- DropTable
DROP TABLE "product_attribute_values";

-- DropTable
DROP TABLE "product_attributes";

-- DropTable
DROP TABLE "product_categories";

-- DropTable
DROP TABLE "product_variants";

-- DropTable
DROP TABLE "products";

-- DropTable
DROP TABLE "reusable_attributes";

-- DropTable
DROP TABLE "sale_items";

-- DropTable
DROP TABLE "sale_payments";

-- DropTable
DROP TABLE "sales";
