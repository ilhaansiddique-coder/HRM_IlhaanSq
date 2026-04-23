-- RLS policies for multi-tenant core tables

-- TENANTS
DROP POLICY IF EXISTS "Users can view current tenant" ON public.tenants;
CREATE POLICY "Users can view current tenant"
  ON public.tenants
  FOR SELECT
  TO authenticated
  USING (id = public.current_tenant_id());

DROP POLICY IF EXISTS "Users can create tenant" ON public.tenants;
CREATE POLICY "Users can create tenant"
  ON public.tenants
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Admins can update tenant" ON public.tenants;
CREATE POLICY "Admins can update tenant"
  ON public.tenants
  FOR UPDATE
  TO authenticated
  USING (
    id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.tenant_members tm
      WHERE tm.tenant_id = public.tenants.id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
        AND tm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.tenant_members tm
      WHERE tm.tenant_id = public.tenants.id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
        AND tm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Owners can delete tenant" ON public.tenants;
CREATE POLICY "Owners can delete tenant"
  ON public.tenants
  FOR DELETE
  TO authenticated
  USING (
    id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.tenant_members tm
      WHERE tm.tenant_id = public.tenants.id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
        AND tm.role = 'owner'
    )
  );

-- TENANT MEMBERS
DROP POLICY IF EXISTS "Users can view own or current tenant members" ON public.tenant_members;
CREATE POLICY "Users can view own or current tenant members"
  ON public.tenant_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS "Admins can insert tenant members" ON public.tenant_members;
CREATE POLICY "Admins can insert tenant members"
  ON public.tenant_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.tenant_members tm
      WHERE tm.tenant_id = tenant_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
        AND tm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update tenant members" ON public.tenant_members;
CREATE POLICY "Admins can update tenant members"
  ON public.tenant_members
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.tenant_members tm
      WHERE tm.tenant_id = tenant_id
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
      WHERE tm.tenant_id = tenant_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
        AND tm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can delete tenant members" ON public.tenant_members;
CREATE POLICY "Admins can delete tenant members"
  ON public.tenant_members
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.tenant_members tm
      WHERE tm.tenant_id = tenant_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
        AND tm.role IN ('owner', 'admin')
    )
  );

-- TENANT INVITES
DROP POLICY IF EXISTS "Admins can view tenant invites" ON public.tenant_invites;
CREATE POLICY "Admins can view tenant invites"
  ON public.tenant_invites
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.tenant_members tm
      WHERE tm.tenant_id = tenant_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
        AND tm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Invitees can view their invite" ON public.tenant_invites;
CREATE POLICY "Invitees can view their invite"
  ON public.tenant_invites
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') IS NOT NULL
    AND lower(email) = lower(auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "Admins can insert tenant invites" ON public.tenant_invites;
CREATE POLICY "Admins can insert tenant invites"
  ON public.tenant_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.tenant_members tm
      WHERE tm.tenant_id = tenant_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
        AND tm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update tenant invites" ON public.tenant_invites;
CREATE POLICY "Admins can update tenant invites"
  ON public.tenant_invites
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.tenant_members tm
      WHERE tm.tenant_id = tenant_id
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
      WHERE tm.tenant_id = tenant_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
        AND tm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can delete tenant invites" ON public.tenant_invites;
CREATE POLICY "Admins can delete tenant invites"
  ON public.tenant_invites
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.tenant_members tm
      WHERE tm.tenant_id = tenant_id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
        AND tm.role IN ('owner', 'admin')
    )
  );
