-- -----------------------------------------------------------------------------
-- Purpose:
--   Create tenant-scoped product_categories table used by the product dialog
--   to persist garment-industry category codes/labels on the fly (created as
--   needed during product CRUD rather than via a dedicated admin UI).
--
-- RLS follows the same pattern as public.products (permissions: products.view /
-- products.add / products.edit / products.delete) since category management is
-- an implicit side-effect of product CRUD.
-- -----------------------------------------------------------------------------

BEGIN;

CREATE TABLE IF NOT EXISTS public.product_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code       text NOT NULL,
  label      text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_categories_tenant_code_key UNIQUE (tenant_id, code),
  CONSTRAINT product_categories_tenant_label_key UNIQUE (tenant_id, label)
);

CREATE INDEX IF NOT EXISTS product_categories_tenant_id_idx
  ON public.product_categories (tenant_id);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_product_categories_select" ON public.product_categories;
DROP POLICY IF EXISTS "tenant_product_categories_insert" ON public.product_categories;
DROP POLICY IF EXISTS "tenant_product_categories_update" ON public.product_categories;
DROP POLICY IF EXISTS "tenant_product_categories_delete" ON public.product_categories;

CREATE POLICY "tenant_product_categories_select"
  ON public.product_categories
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.view')
  );

CREATE POLICY "tenant_product_categories_insert"
  ON public.product_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.add')
  );

CREATE POLICY "tenant_product_categories_update"
  ON public.product_categories
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

CREATE POLICY "tenant_product_categories_delete"
  ON public.product_categories
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission(auth.uid(), 'products.delete')
  );

COMMIT;
