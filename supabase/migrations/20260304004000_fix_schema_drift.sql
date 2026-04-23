-- Resolve sales_items/sale_items naming drift and add profile lookup indexes.

DO $$
DECLARE
  has_sales_items boolean := to_regclass('public.sales_items') IS NOT NULL;
  has_sale_items boolean := to_regclass('public.sale_items') IS NOT NULL;
  sales_items_kind char := NULL;
  sale_items_kind char := NULL;
  sales_items_count bigint := 0;
  sale_items_count bigint := 0;
BEGIN
  IF has_sales_items THEN
    SELECT c.relkind
    INTO sales_items_kind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'sales_items'
    LIMIT 1;
  END IF;

  IF has_sale_items THEN
    SELECT c.relkind
    INTO sale_items_kind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'sale_items'
    LIMIT 1;
  END IF;

  IF has_sales_items THEN
    EXECUTE 'SELECT COUNT(*) FROM public.sales_items' INTO sales_items_count;
  END IF;

  IF has_sale_items THEN
    EXECUTE 'SELECT COUNT(*) FROM public.sale_items' INTO sale_items_count;
  END IF;

  IF has_sales_items AND NOT has_sale_items THEN
    EXECUTE 'CREATE OR REPLACE VIEW public.sale_items AS SELECT * FROM public.sales_items';
  ELSIF has_sale_items AND NOT has_sales_items THEN
    EXECUTE 'CREATE OR REPLACE VIEW public.sales_items AS SELECT * FROM public.sale_items';
  ELSIF has_sales_items AND has_sale_items THEN
    IF sales_items_kind = 'v' AND sale_items_kind <> 'v' THEN
      EXECUTE 'CREATE OR REPLACE VIEW public.sales_items AS SELECT * FROM public.sale_items';
    ELSIF sale_items_kind = 'v' AND sales_items_kind <> 'v' THEN
      EXECUTE 'CREATE OR REPLACE VIEW public.sale_items AS SELECT * FROM public.sales_items';
    ELSIF sales_items_kind = 'v' AND sale_items_kind = 'v' THEN
      IF sales_items_count >= sale_items_count THEN
        EXECUTE 'CREATE OR REPLACE VIEW public.sale_items AS SELECT * FROM public.sales_items';
      ELSE
        EXECUTE 'CREATE OR REPLACE VIEW public.sales_items AS SELECT * FROM public.sale_items';
      END IF;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'tenant_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles(tenant_id);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_active'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);
  END IF;
END $$;
