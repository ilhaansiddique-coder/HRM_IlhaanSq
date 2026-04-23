-- Ensure one business_settings row per tenant and fix activity_logs_view tenant_id

-- 1) Deduplicate business_settings by tenant_id, keep most recent row
WITH ranked AS (
  SELECT
    id,
    tenant_id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    ) AS rn
  FROM public.business_settings
)
DELETE FROM public.business_settings bs
USING ranked r
WHERE bs.id = r.id
  AND r.rn > 1;

-- 2) Enforce single row per tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'business_settings_tenant_id_key'
  ) THEN
    ALTER TABLE public.business_settings
      ADD CONSTRAINT business_settings_tenant_id_key UNIQUE (tenant_id);
  END IF;
END $$;

-- 3) Add tenant_id to activity_logs_view for tenant-scoped queries
DO $$
BEGIN
  EXECUTE 'DROP VIEW IF EXISTS public.activity_logs_view';
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE $sql$
      CREATE OR REPLACE VIEW public.activity_logs_view AS
      SELECT
        al.id,
        al.user_id,
        al.action,
        al.entity_type,
        al.entity_id,
        al.summary,
        al.details,
        al.created_at,
        al.tenant_id,
        p.full_name,
        p.email
      FROM public.activity_logs al
      LEFT JOIN public.profiles p ON p.id = al.user_id
    $sql$;
  ELSE
    EXECUTE $sql$
      CREATE OR REPLACE VIEW public.activity_logs_view AS
      SELECT
        al.id,
        al.user_id,
        al.action,
        al.entity_type,
        al.entity_id,
        al.summary,
        al.details,
        al.created_at,
        al.tenant_id,
        NULL::text AS full_name,
        NULL::text AS email
      FROM public.activity_logs al
    $sql$;
  END IF;
END $$;

ALTER VIEW public.activity_logs_view SET (security_invoker = on);
