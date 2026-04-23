-- Ensure product-images bucket exists and has proper RLS policies.
-- Fixes: "new row violates row-level security policy" during image upload.
-- Local DBs can fail ownership checks on storage.objects; this migration is
-- written to skip safely in that case.

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE 'Skipping product-images storage migration: storage schema/tables not available';
    RETURN;
  END IF;

  BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'product-images',
      'product-images',
      true,
      10485760,
      ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    )
    ON CONFLICT (id) DO UPDATE
    SET
      public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping storage.buckets upsert: insufficient privilege';
  END;

  BEGIN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "product_images_select_authenticated" ON storage.objects;
    CREATE POLICY "product_images_select_authenticated"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'product-images'
      AND (
        public.user_has_role(ARRAY['admin'])
        OR public.has_permission((SELECT auth.uid()), 'products.view')
      )
    );

    DROP POLICY IF EXISTS "product_images_insert_authenticated" ON storage.objects;
    CREATE POLICY "product_images_insert_authenticated"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'product-images'
      AND (
        public.user_has_role(ARRAY['admin'])
        OR public.has_permission((SELECT auth.uid()), 'products.add')
        OR public.has_permission((SELECT auth.uid()), 'products.edit')
      )
    );

    DROP POLICY IF EXISTS "product_images_update_authenticated" ON storage.objects;
    CREATE POLICY "product_images_update_authenticated"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'product-images'
      AND (
        public.user_has_role(ARRAY['admin'])
        OR public.has_permission((SELECT auth.uid()), 'products.edit')
      )
    )
    WITH CHECK (
      bucket_id = 'product-images'
      AND (
        public.user_has_role(ARRAY['admin'])
        OR public.has_permission((SELECT auth.uid()), 'products.edit')
      )
    );

    DROP POLICY IF EXISTS "product_images_delete_authenticated" ON storage.objects;
    CREATE POLICY "product_images_delete_authenticated"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'product-images'
      AND (
        public.user_has_role(ARRAY['admin'])
        OR public.has_permission((SELECT auth.uid()), 'products.delete')
        OR public.has_permission((SELECT auth.uid()), 'products.edit')
      )
    );
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping storage.objects RLS/policy changes: insufficient privilege';
    WHEN undefined_function THEN
      RAISE NOTICE 'Skipping storage.objects RLS/policy changes: required helper functions are missing';
  END;
END $$;
