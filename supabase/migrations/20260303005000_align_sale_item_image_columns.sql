-- Align legacy sale_items/sales_items schemas before phase2 dual-write sync.
-- Some baseline snapshots miss these display columns, but phase2 expects them.

ALTER TABLE IF EXISTS public.sale_items
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS product_image_url text,
  ADD COLUMN IF NOT EXISTS variant_image_url text;

ALTER TABLE IF EXISTS public.sales_items
  ADD COLUMN IF NOT EXISTS product_image_url text,
  ADD COLUMN IF NOT EXISTS variant_image_url text;
