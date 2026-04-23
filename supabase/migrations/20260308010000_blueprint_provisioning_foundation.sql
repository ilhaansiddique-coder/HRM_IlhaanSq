-- Blueprint provisioning foundation:
-- tenant_usage, notification_templates, and tenant-scoped role permission copies.

CREATE TABLE IF NOT EXISTS public.tenant_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  users_count integer NOT NULL DEFAULT 0,
  products_count integer NOT NULL DEFAULT 0,
  customers_count integer NOT NULL DEFAULT 0,
  orders_count integer NOT NULL DEFAULT 0,
  storage_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key text NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  subject text NOT NULL,
  body_html text,
  body_text text,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_templates_channel_check CHECK (channel = ANY (ARRAY['email', 'sms', 'whatsapp'])),
  CONSTRAINT notification_templates_tenant_key_channel_unique UNIQUE (tenant_id, key, channel)
);

CREATE TABLE IF NOT EXISTS public.tenant_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.user_role NOT NULL,
  permission_key text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'system_seed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_role_permissions_unique UNIQUE (tenant_id, role, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_tenant_id
  ON public.notification_templates (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_role_permissions_tenant_id
  ON public.tenant_role_permissions (tenant_id);

DROP TRIGGER IF EXISTS update_tenant_usage_updated_at ON public.tenant_usage;
CREATE TRIGGER update_tenant_usage_updated_at
  BEFORE UPDATE ON public.tenant_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_templates_updated_at ON public.notification_templates;
CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_role_permissions_updated_at ON public.tenant_role_permissions;
CREATE TRIGGER update_tenant_role_permissions_updated_at
  BEFORE UPDATE ON public.tenant_role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tenant_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_role_permissions ENABLE ROW LEVEL SECURITY;

INSERT INTO public.tenant_usage (tenant_id)
SELECT t.id
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tenant_usage tu
  WHERE tu.tenant_id = t.id
);

INSERT INTO public.notification_templates (tenant_id, key, channel, subject, body_html, body_text)
SELECT
  t.id,
  seed.key,
  seed.channel,
  seed.subject,
  seed.body_html,
  seed.body_text
FROM public.tenants t
CROSS JOIN (
  VALUES
    (
      'welcome_email',
      'email',
      'Welcome to {{workspace_name}}',
      '<h1>Welcome to {{workspace_name}}</h1><p>Hello {{owner_name}}, your workspace is ready.</p><p>Sign in at <a href="{{login_url}}">{{login_url}}</a>.</p>',
      'Welcome to {{workspace_name}}. Hello {{owner_name}}, your workspace is ready. Sign in at {{login_url}}.'
    ),
    (
      'tenant_invite',
      'email',
      'You have been invited to {{workspace_name}}',
      '<p>Hello {{owner_name}}, you have been invited to {{workspace_name}}.</p><p>Open {{login_url}} to continue.</p>',
      'You have been invited to {{workspace_name}}. Open {{login_url}} to continue.'
    ),
    (
      'billing_status',
      'email',
      'Billing update for {{workspace_name}}',
      '<p>Your billing status changed for {{workspace_name}}.</p>',
      'Your billing status changed for {{workspace_name}}.'
    )
) AS seed(key, channel, subject, body_html, body_text)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.notification_templates nt
  WHERE nt.tenant_id = t.id
    AND nt.key = seed.key
    AND nt.channel = seed.channel
);

INSERT INTO public.tenant_role_permissions (tenant_id, role, permission_key, allowed, source)
SELECT
  t.id,
  rp.role,
  rp.permission_key,
  rp.allowed,
  'system_seed'
FROM public.tenants t
JOIN public.role_permissions rp ON true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tenant_role_permissions trp
  WHERE trp.tenant_id = t.id
    AND trp.role = rp.role
    AND trp.permission_key = rp.permission_key
);

DROP POLICY IF EXISTS "Admins can view tenant usage" ON public.tenant_usage;
CREATE POLICY "Admins can view tenant usage"
  ON public.tenant_usage
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.tenant_members tm
      WHERE tm.tenant_id = public.tenant_usage.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
        AND tm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update tenant usage" ON public.tenant_usage;
CREATE POLICY "Admins can update tenant usage"
  ON public.tenant_usage
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.tenant_members tm
      WHERE tm.tenant_id = public.tenant_usage.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
        AND tm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.tenant_members tm
      WHERE tm.tenant_id = public.tenant_usage.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
        AND tm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can view notification templates in tenant" ON public.notification_templates;
CREATE POLICY "Users can view notification templates in tenant"
  ON public.notification_templates
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Admins can manage notification templates in tenant" ON public.notification_templates;
CREATE POLICY "Admins can manage notification templates in tenant"
  ON public.notification_templates
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.tenant_members tm
      WHERE tm.tenant_id = public.notification_templates.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
        AND tm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.tenant_members tm
      WHERE tm.tenant_id = public.notification_templates.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
        AND tm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can view tenant role permissions in tenant" ON public.tenant_role_permissions;
CREATE POLICY "Users can view tenant role permissions in tenant"
  ON public.tenant_role_permissions
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Admins can manage tenant role permissions in tenant" ON public.tenant_role_permissions;
CREATE POLICY "Admins can manage tenant role permissions in tenant"
  ON public.tenant_role_permissions
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.tenant_members tm
      WHERE tm.tenant_id = public.tenant_role_permissions.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
        AND tm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.tenant_members tm
      WHERE tm.tenant_id = public.tenant_role_permissions.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
        AND tm.role IN ('owner', 'admin')
    )
  );
