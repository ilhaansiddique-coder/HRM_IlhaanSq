-- Add minimum sale price support for products and enforce it on sales items.

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS minimum_sale_price numeric;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_minimum_sale_price_non_negative'
  ) THEN
    ALTER TABLE public.products
    ADD CONSTRAINT products_minimum_sale_price_non_negative
    CHECK (minimum_sale_price IS NULL OR minimum_sale_price >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.products.minimum_sale_price IS
'Minimum allowed unit sale price for this product. Null means no minimum.';

CREATE OR REPLACE FUNCTION public.enforce_minimum_sale_price_on_sales_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  min_price numeric;
  unit_sale_price numeric;
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT minimum_sale_price
  INTO min_price
  FROM public.products
  WHERE id = NEW.product_id;

  IF min_price IS NULL THEN
    RETURN NEW;
  END IF;

  unit_sale_price := COALESCE(NEW.sale_price, NEW.rate);

  IF unit_sale_price < min_price THEN
    RAISE EXCEPTION
      'Sale price (%) cannot be lower than minimum sale price (%) for product "%".',
      unit_sale_price,
      min_price,
      COALESCE(NEW.product_name, NEW.product_id::text);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_items_enforce_minimum_sale_price ON public.sales_items;
CREATE TRIGGER trg_sales_items_enforce_minimum_sale_price
BEFORE INSERT OR UPDATE OF product_id, sale_price, rate
ON public.sales_items
FOR EACH ROW
EXECUTE FUNCTION public.enforce_minimum_sale_price_on_sales_items();
