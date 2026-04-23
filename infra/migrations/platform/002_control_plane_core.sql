-- v8 platform control-plane migration pack
-- File 002: core control-plane schema

CREATE TABLE IF NOT EXISTS public.tenants (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  name              text NOT NULL,
  legal_name        text,
  status            text NOT NULL DEFAULT 'trialing',
  plan              text NOT NULL DEFAULT 'free',
  plan_status       text NOT NULL DEFAULT 'trialing',
  trial_ends_at     timestamptz,
  locale            text NOT NULL DEFAULT 'en',
  currency          text NOT NULL DEFAULT 'BDT',
  timezone          text NOT NULL DEFAULT 'Asia/Dhaka',
  logo_url          text,
  custom_domain     text UNIQUE,
  white_label       boolean NOT NULL DEFAULT false,
  features_override jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  CONSTRAINT tenants_status_check CHECK (status IN ('trialing', 'active', 'suspended', 'canceled')),
  CONSTRAINT tenants_plan_status_check CHECK (plan_status IN ('trialing', 'active', 'past_due', 'canceled', 'inactive'))
);

CREATE INDEX IF NOT EXISTS idx_tenants_status
  ON public.tenants (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_slug
  ON public.tenants (slug)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.tenant_domains (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain              text NOT NULL UNIQUE,
  is_primary          boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'pending',
  verified_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_domains_verification_status_check CHECK (verification_status IN ('pending', 'verified', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant
  ON public.tenant_domains (tenant_id);

CREATE TABLE IF NOT EXISTS public.tenant_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL,
  role         text NOT NULL DEFAULT 'staff',
  status       text NOT NULL DEFAULT 'active',
  invited_by   uuid,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  UNIQUE (tenant_id, user_id),
  CONSTRAINT tenant_members_status_check CHECK (status IN ('invited', 'active', 'suspended', 'removed'))
);

CREATE INDEX IF NOT EXISTS idx_tenant_members_user
  ON public.tenant_members (user_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant
  ON public.tenant_members (tenant_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.tenant_database_registry (
  tenant_id              uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  db_key                 text NOT NULL UNIQUE,
  db_host                text NOT NULL,
  db_port                int NOT NULL DEFAULT 5432,
  db_name                text NOT NULL,
  db_user                text NOT NULL,
  db_password_ciphertext text NOT NULL,
  db_region              text,
  db_status              text NOT NULL DEFAULT 'active',
  migration_version      text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_database_registry_db_status_check CHECK (db_status IN ('provisioning', 'active', 'suspended', 'failed', 'archived'))
);

CREATE TABLE IF NOT EXISTS public.tenant_modules (
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_code  text NOT NULL,
  is_enabled   boolean NOT NULL DEFAULT true,
  config       jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled_at   timestamptz NOT NULL DEFAULT now(),
  disabled_at  timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, module_code)
);

CREATE TABLE IF NOT EXISTS public.tenant_billing (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  stripe_customer_id     text UNIQUE,
  stripe_subscription_id text UNIQUE,
  stripe_price_id        text,
  plan                   text NOT NULL DEFAULT 'free',
  status                 text NOT NULL DEFAULT 'trialing',
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean NOT NULL DEFAULT false,
  trial_end              timestamptz,
  seats_used             int NOT NULL DEFAULT 1,
  seats_limit            int NOT NULL DEFAULT 3,
  billing_email          text,
  lifetime_value         numeric(15,2) NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_billing_status_check CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'inactive'))
);

CREATE TABLE IF NOT EXISTS public.tenant_service_controls (
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_code  text NOT NULL,
  is_enabled    boolean NOT NULL DEFAULT true,
  reason        text,
  updated_by    uuid,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, service_code)
);

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON public.tenants;
CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tenant_database_registry_updated_at ON public.tenant_database_registry;
CREATE TRIGGER trg_tenant_database_registry_updated_at
  BEFORE UPDATE ON public.tenant_database_registry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tenant_modules_updated_at ON public.tenant_modules;
CREATE TRIGGER trg_tenant_modules_updated_at
  BEFORE UPDATE ON public.tenant_modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tenant_billing_updated_at ON public.tenant_billing;
CREATE TRIGGER trg_tenant_billing_updated_at
  BEFORE UPDATE ON public.tenant_billing
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tenant_service_controls_updated_at ON public.tenant_service_controls;
CREATE TRIGGER trg_tenant_service_controls_updated_at
  BEFORE UPDATE ON public.tenant_service_controls
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_database_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_service_controls ENABLE ROW LEVEL SECURITY;
