import { supabase } from "@/integrations/supabase/client";
import { normalizeRole, ROLES, type Role } from "@/types/roles";

export interface TenantUserRecord {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: Role;
  created_at: string;
  last_sign_in_at: string | null;
}

const membershipRoleToAppRole = (role?: string | null): Role => {
  switch (role) {
    case "owner":
    case "admin":
      return ROLES.TENANT_ADMIN;
    case "manager":
      return ROLES.MANAGER;
    case "member":
      return ROLES.VIEWER;
    case "staff":
    default:
      return ROLES.STAFF;
  }
};

export const appRoleToMembershipRole = (role?: string | null): string => {
  const normalizedRole = normalizeRole(role);

  switch (normalizedRole) {
    case ROLES.TENANT_ADMIN:
      return "admin";
    case ROLES.MANAGER:
      return "manager";
    case ROLES.VIEWER:
      return "member";
    case ROLES.STAFF:
    default:
      return "staff";
  }
};

export const listTenantUsers = async (tenantId: string): Promise<TenantUserRecord[]> => {
  const { data: memberships, error: membershipsError } = await (supabase as any)
    .from("tenant_members")
    .select("user_id, role, created_at")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (membershipsError) {
    throw new Error(membershipsError.message || "Failed to fetch tenant members");
  }

  const memberRows = (memberships ?? []) as Array<{
    user_id: string;
    role: string | null;
    created_at: string;
  }>;

  if (memberRows.length === 0) {
    return [];
  }

  const userIds = memberRows.map((member) => member.user_id);
  const { data: profiles, error: profilesError } = await (supabase as any)
    .from("profiles")
    .select("id, full_name, email, phone, created_at")
    .in("id", userIds);

  if (profilesError) {
    throw new Error(profilesError.message || "Failed to fetch tenant user profiles");
  }

  const profilesById = new Map(
    ((profiles ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string | null;
      phone: string | null;
      created_at: string | null;
    }>).map((profile) => [profile.id, profile]),
  );

  return memberRows.map((member) => {
    const profile = profilesById.get(member.user_id);

    return {
      id: member.user_id,
      full_name: profile?.full_name?.trim() || "Unknown User",
      email: profile?.email?.trim() || "N/A",
      phone: profile?.phone ?? null,
      role: membershipRoleToAppRole(member.role),
      created_at: profile?.created_at || member.created_at || new Date().toISOString(),
      last_sign_in_at: null,
    };
  });
};

export const getTenantUserById = async (
  tenantId: string,
  userId: string,
): Promise<TenantUserRecord | null> => {
  const users = await listTenantUsers(tenantId);
  return users.find((user) => user.id === userId) ?? null;
};
