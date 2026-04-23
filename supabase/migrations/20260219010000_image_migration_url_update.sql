-- Image Migration: Update image URLs from old Supabase instances to self-hosted
-- Run this on the self-hosted Supabase (supabase.inventra.site)
-- Wrapped in DO blocks so it skips gracefully on a fresh local DB reset

DO $$
BEGIN
  -- Replace FIRST old Supabase URL (czkffssrltgsinzxxhja)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
    UPDATE products
    SET image_url = REPLACE(image_url, 'https://czkffssrltgsinzxxhja.supabase.co', 'https://supabase.inventra.site')
    WHERE image_url LIKE '%czkffssrltgsinzxxhja.supabase.co%';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_variants') THEN
    UPDATE product_variants
    SET image_url = REPLACE(image_url, 'https://czkffssrltgsinzxxhja.supabase.co', 'https://supabase.inventra.site')
    WHERE image_url LIKE '%czkffssrltgsinzxxhja.supabase.co%';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sale_items' AND column_name = 'product_image_url'
  ) THEN
    UPDATE sale_items
    SET product_image_url = REPLACE(product_image_url, 'https://czkffssrltgsinzxxhja.supabase.co', 'https://supabase.inventra.site')
    WHERE product_image_url LIKE '%czkffssrltgsinzxxhja.supabase.co%';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sale_items' AND column_name = 'variant_image_url'
  ) THEN
    UPDATE sale_items
    SET variant_image_url = REPLACE(variant_image_url, 'https://czkffssrltgsinzxxhja.supabase.co', 'https://supabase.inventra.site')
    WHERE variant_image_url LIKE '%czkffssrltgsinzxxhja.supabase.co%';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business_settings' AND column_name = 'logo_url'
  ) THEN
    UPDATE business_settings
    SET logo_url = REPLACE(logo_url, 'https://czkffssrltgsinzxxhja.supabase.co', 'https://supabase.inventra.site')
    WHERE logo_url LIKE '%czkffssrltgsinzxxhja.supabase.co%';
  END IF;

  -- Replace SECOND old Supabase URL (smopyfuaijaklmtpwgws)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
    UPDATE products
    SET image_url = REPLACE(image_url, 'https://smopyfuaijaklmtpwgws.supabase.co', 'https://supabase.inventra.site')
    WHERE image_url LIKE '%smopyfuaijaklmtpwgws.supabase.co%';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_variants') THEN
    UPDATE product_variants
    SET image_url = REPLACE(image_url, 'https://smopyfuaijaklmtpwgws.supabase.co', 'https://supabase.inventra.site')
    WHERE image_url LIKE '%smopyfuaijaklmtpwgws.supabase.co%';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sale_items' AND column_name = 'product_image_url'
  ) THEN
    UPDATE sale_items
    SET product_image_url = REPLACE(product_image_url, 'https://smopyfuaijaklmtpwgws.supabase.co', 'https://supabase.inventra.site')
    WHERE product_image_url LIKE '%smopyfuaijaklmtpwgws.supabase.co%';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sale_items' AND column_name = 'variant_image_url'
  ) THEN
    UPDATE sale_items
    SET variant_image_url = REPLACE(variant_image_url, 'https://smopyfuaijaklmtpwgws.supabase.co', 'https://supabase.inventra.site')
    WHERE variant_image_url LIKE '%smopyfuaijaklmtpwgws.supabase.co%';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business_settings' AND column_name = 'logo_url'
  ) THEN
    UPDATE business_settings
    SET logo_url = REPLACE(logo_url, 'https://smopyfuaijaklmtpwgws.supabase.co', 'https://supabase.inventra.site')
    WHERE logo_url LIKE '%smopyfuaijaklmtpwgws.supabase.co%';
  END IF;
END $$;
