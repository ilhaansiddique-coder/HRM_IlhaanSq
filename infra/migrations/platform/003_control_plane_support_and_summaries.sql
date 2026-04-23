-- v8 platform control-plane migration pack
-- File 003: support tables, provider catalog, audit, summaries

CREATE TABLE IF NOT EXISTS public.super_admin_users (
  user_id      uuid PRIMARY KEY,
  role         text NOT NULL DEFAULT 'super_admin',
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  notes        text
);

CREATE TABLE IF NOT EXISTS public.tenant_support_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  super_admin_id  uuid NOT NULL,
  reason          text NOT NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  ended_at        timestamptz,
  status          text NOT NULL DEFAULT 'active',
  CONSTRAINT tenant_support_sessions_status_check CHECK (status IN ('active', 'expired', 'ended', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_tenant_support_sessions_tenant
  ON public.tenant_support_sessions (tenant_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.courier_providers (
  code         text PRIMARY KEY,
  name         text NOT NULL,
  region       text,
  is_active    boolean NOT NULL DEFAULT true,
  docs_url     text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.courier_provider_capabilities (
  provider_code  text NOT NULL REFERENCES public.courier_providers(code) ON DELETE CASCADE,
  capability     text NOT NULL,
  PRIMARY KEY (provider_code, capability)
);

CREATE TABLE IF NOT EXISTS public.platform_audit_logs (
  id            bigserial PRIMARY KEY,
  actor_user_id uuid,
  tenant_id     uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  action        text NOT NULL,
  category      text NOT NULL DEFAULT 'platform',
  ip_address    inet,
  user_agent    text,
  old_data      jsonb,
  new_data      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_tenant
  ON public.platform_audit_logs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_audit_actor
  ON public.platform_audit_logs (actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.tenant_sales_daily_summary (
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sale_date      date NOT NULL,
  total_orders   int NOT NULL DEFAULT 0,
  gross_revenue  numeric(18,2) NOT NULL DEFAULT 0,
  net_revenue    numeric(18,2) NOT NULL DEFAULT 0,
  paid_revenue   numeric(18,2) NOT NULL DEFAULT 0,
  outstanding    numeric(18,2) NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, sale_date)
);

CREATE TABLE IF NOT EXISTS public.tenant_order_daily_summary (
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_date     date NOT NULL,
  total_orders   int NOT NULL DEFAULT 0,
  delivered      int NOT NULL DEFAULT 0,
  cancelled      int NOT NULL DEFAULT 0,
  returned       int NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, order_date)
);

CREATE TABLE IF NOT EXISTS public.tenant_usage_summary (
  tenant_id            uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  users_count          int NOT NULL DEFAULT 0,
  products_count       int NOT NULL DEFAULT 0,
  customers_count      int NOT NULL DEFAULT 0,
  storage_bytes        bigint NOT NULL DEFAULT 0,
  api_calls_today      int NOT NULL DEFAULT 0,
  api_calls_this_month bigint NOT NULL DEFAULT 0,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_job_health_summary (
  tenant_id               uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  failed_jobs_24h         int NOT NULL DEFAULT 0,
  last_job_failed_at      timestamptz,
  last_job_succeeded_at   timestamptz,
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_courier_health_summary (
  tenant_id          uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  active_accounts    int NOT NULL DEFAULT 0,
  failed_syncs_24h   int NOT NULL DEFAULT 0,
  last_tracking_sync timestamptz,
  last_webhook_at    timestamptz,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_tenant_sales_daily_summary_updated_at ON public.tenant_sales_daily_summary;
CREATE TRIGGER trg_tenant_sales_daily_summary_updated_at
  BEFORE UPDATE ON public.tenant_sales_daily_summary
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tenant_order_daily_summary_updated_at ON public.tenant_order_daily_summary;
CREATE TRIGGER trg_tenant_order_daily_summary_updated_at
  BEFORE UPDATE ON public.tenant_order_daily_summary
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tenant_usage_summary_updated_at ON public.tenant_usage_summary;
CREATE TRIGGER trg_tenant_usage_summary_updated_at
  BEFORE UPDATE ON public.tenant_usage_summary
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tenant_job_health_summary_updated_at ON public.tenant_job_health_summary;
CREATE TRIGGER trg_tenant_job_health_summary_updated_at
  BEFORE UPDATE ON public.tenant_job_health_summary
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tenant_courier_health_summary_updated_at ON public.tenant_courier_health_summary;
CREATE TRIGGER trg_tenant_courier_health_summary_updated_at
  BEFORE UPDATE ON public.tenant_courier_health_summary
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.super_admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_support_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_provider_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_sales_daily_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_order_daily_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_usage_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_job_health_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_courier_health_summary ENABLE ROW LEVEL SECURITY;
