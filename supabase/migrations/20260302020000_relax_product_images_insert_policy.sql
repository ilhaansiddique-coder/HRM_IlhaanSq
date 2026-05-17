-- Hotfix: prevent product image upload failures for authenticated users.
-- Reason: "new row violates row-level security policy" on storage.objects insert.

DROP POLICY IF EXISTS "product_images_insert_authenticated" ON storage.objects;
CREATE POLICY "product_images_insert_authenticated"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (SELECT auth.uid()) IS NOT NULL
);
