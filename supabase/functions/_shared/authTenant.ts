import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'

type ServiceClient = ReturnType<typeof createClient>

export interface TenantAuthContext {
  userId: string
  email: string | null
  tenantId: string
  role: string | null
}

const normalizeRole = (role: string | null | undefined): string | null => {
  const normalized = String(role ?? '').trim().toLowerCase()
  if (!normalized) return null
  if (normalized === 'super_admin') return 'superadmin'
  if (normalized === 'owner' || normalized === 'admin') return 'tenant_admin'
  if (normalized === 'member') return 'viewer'
  if (normalized === 'store_manager') return 'manager'
  if (normalized === 'sales_associate' || normalized === 'warehouse') return 'staff'
  return normalized
}

const getPermissionRoleCandidates = (role: string): string[] => {
  if (role === 'tenant_admin') {
    return ['tenant_admin', 'admin']
  }

  return [role]
}

const hasAnyPermissionEntries = async (
  supabase: ServiceClient,
  table: 'tenant_role_permissions' | 'role_permissions',
  roleCandidates: string[],
  tenantId?: string | null,
): Promise<boolean> => {
  let query = supabase
    .from(table)
    .select('permission_key', { head: true, count: 'exact' })
    .in('role', roleCandidates)

  if (table === 'tenant_role_permissions' && tenantId) {
    query = query.eq('tenant_id', tenantId)
  }

  const { count, error } = await query
  if (error) {
    throw new Error(`Failed to inspect permission rows: ${error.message}`)
  }

  return (count ?? 0) > 0
}

const findPermissionValue = async (
  supabase: ServiceClient,
  table: 'tenant_role_permissions' | 'role_permissions',
  roleCandidates: string[],
  permissionKey: string,
  tenantId?: string | null,
): Promise<boolean | null> => {
  for (const role of roleCandidates) {
    let query = supabase
      .from(table)
      .select('allowed')
      .eq('role', role)
      .eq('permission_key', permissionKey)
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (table === 'tenant_role_permissions' && tenantId) {
      query = query.eq('tenant_id', tenantId)
    }

    const { data, error } = await query
    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to resolve ${permissionKey}: ${error.message}`)
    }

    if (data) {
      return Boolean((data as { allowed?: boolean | null }).allowed)
    }

    let wildcardQuery = supabase
      .from(table)
      .select('allowed')
      .eq('role', role)
      .eq('permission_key', '*')
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (table === 'tenant_role_permissions' && tenantId) {
      wildcardQuery = wildcardQuery.eq('tenant_id', tenantId)
    }

    const wildcard = await wildcardQuery
    if (wildcard.error && wildcard.error.code !== 'PGRST116') {
      throw new Error(`Failed to resolve wildcard permission for ${permissionKey}: ${wildcard.error.message}`)
    }

    if (wildcard.data) {
      return Boolean((wildcard.data as { allowed?: boolean | null }).allowed)
    }
  }

  return null
}

export const createServiceClient = (): ServiceClient => {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export const extractAccessToken = (req: Request): string | null => {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization')

  if (authHeader) {
    return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  }

  return null
}

export const resolveTenantAuthContext = async (
  supabase: ServiceClient,
  accessToken: string,
  requestedTenantId?: string | null,
): Promise<TenantAuthContext> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken)

  if (userError || !user) {
    throw new Error('Invalid token')
  }

  const claimedTenantId =
    String(user.app_metadata?.tenant_id ?? user.user_metadata?.tenant_id ?? '').trim() || null
  const preferredTenantId = String(requestedTenantId ?? '').trim() || claimedTenantId

  const [userRoleRow, profileRoleRow] = await Promise.all([
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .limit(1)
      .maybeSingle(),
  ])

  const globalUserRole = normalizeRole(userRoleRow.data?.role)
  const globalProfileRole = normalizeRole((profileRoleRow.data as { role?: string | null } | null)?.role)
  const isSuperAdmin = globalUserRole === 'superadmin' || globalProfileRole === 'superadmin'

  if (isSuperAdmin && preferredTenantId) {
    return {
      userId: user.id,
      email: user.email ?? null,
      tenantId: preferredTenantId,
      role: 'superadmin',
    }
  }

  let membershipQuery = supabase
    .from('tenant_members')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)

  if (preferredTenantId) {
    membershipQuery = membershipQuery.eq('tenant_id', preferredTenantId)
  }

  let { data: membership, error: membershipError } = await membershipQuery.maybeSingle()

  if ((!membership || membershipError?.code === 'PGRST116') && claimedTenantId && !requestedTenantId) {
    const fallback = await supabase
      .from('tenant_members')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    membership = fallback.data
    membershipError = fallback.error
  }

  if (membershipError) {
    throw new Error(`Failed to resolve tenant membership: ${membershipError.message}`)
  }

  if (!membership?.tenant_id) {
    throw new Error('No active tenant membership found for user')
  }

  const membershipRole = normalizeRole((membership as { role?: string | null }).role)

  return {
    userId: user.id,
    email: user.email ?? null,
    tenantId: membership.tenant_id,
    role: membershipRole ?? globalUserRole ?? globalProfileRole,
  }
}

export const ensureRolePermission = async (
  supabase: ServiceClient,
  role: string | null,
  permissionKey: string,
  tenantId?: string | null,
): Promise<boolean> => {
  const resolvedRole = normalizeRole(role)
  if (!resolvedRole) return false

  if (resolvedRole === 'superadmin') {
    return true
  }

  const roleCandidates = getPermissionRoleCandidates(resolvedRole)
  const isTenantAdmin = resolvedRole === 'tenant_admin'

  if (tenantId) {
    const tenantHasExplicitPermissions = isTenantAdmin
      ? await hasAnyPermissionEntries(supabase, 'tenant_role_permissions', roleCandidates, tenantId)
      : false

    const tenantPermission = await findPermissionValue(
      supabase,
      'tenant_role_permissions',
      roleCandidates,
      permissionKey,
      tenantId,
    )
    if (tenantPermission !== null) {
      return tenantPermission
    }

    if (isTenantAdmin && !tenantHasExplicitPermissions) {
      return true
    }
  }

  const legacyPermission = await findPermissionValue(
    supabase,
    'role_permissions',
    roleCandidates,
    permissionKey,
  )

  if (legacyPermission !== null) {
    return legacyPermission
  }

  return isTenantAdmin
}
