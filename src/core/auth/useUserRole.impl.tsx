import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/core/auth/useAuth";
import { useCallback, useEffect } from "react";
import { normalizeRole, ROLES } from "@/types/roles";
import { syncRoleCookie } from "@/lib/authBridge";
import { defaultPermissionsByRole } from "@/constants/permissions";
import { useTenantMembership } from "@/core/tenants/useTenantMembership";

type RoleSource = {
  role: string | null;
  rawRole: string | null;
  source: "user_roles" | "profiles" | "tenant_members" | "none";
};

type PermissionEntry = {
  permission_key: string;
  allowed: boolean;
  role: string;
};

const getPermissionRoleCandidates = (role: string | null | undefined): string[] => {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === ROLES.TENANT_ADMIN) {
    return ["tenant_admin", "admin"];
  }

  return normalizedRole ? [normalizedRole] : [];
};

export const useUserRole = () => {
  const { user } = useAuth();
  const { tenantId, isLoading: tenantLoading, error: tenantError } = useTenantMembership();
  const queryClient = useQueryClient();

  const {
    data: roleSource,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["userRole", user?.id, tenantId],
    queryFn: async (): Promise<RoleSource> => {
      if (!user?.id) throw new Error("No user found");

      const [userRoleResponse, profileResponse, membershipResponse] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        (supabase as any)
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle(),
        tenantId
          ? (supabase as any)
              .from("tenant_members")
              .select("role")
              .eq("tenant_id", tenantId)
              .eq("user_id", user.id)
              .eq("is_active", true)
              .order("is_default", { ascending: false })
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (userRoleResponse.error) throw userRoleResponse.error;
      if (profileResponse.error) throw profileResponse.error;
      if (membershipResponse.error) throw membershipResponse.error;

      const globalUserRole = normalizeRole(userRoleResponse.data?.role);
      if (globalUserRole === ROLES.SUPERADMIN) {
        return {
          role: userRoleResponse.data?.role ?? ROLES.SUPERADMIN,
          rawRole: userRoleResponse.data?.role ?? ROLES.SUPERADMIN,
          source: "user_roles",
        };
      }

      const globalProfileRole = normalizeRole((profileResponse.data as { role?: string | null } | null)?.role);
      if (globalProfileRole === ROLES.SUPERADMIN) {
        const profileRole = (profileResponse.data as { role?: string | null } | null)?.role ?? ROLES.SUPERADMIN;
        return {
          role: profileRole,
          rawRole: profileRole,
          source: "profiles",
        };
      }

      const membershipRole = (membershipResponse.data as { role?: string | null } | null)?.role ?? null;
      if (membershipRole) {
        return {
          role: membershipRole,
          rawRole: membershipRole,
          source: "tenant_members",
        };
      }

      if (userRoleResponse.data?.role) {
        return {
          role: userRoleResponse.data.role,
          rawRole: userRoleResponse.data.role,
          source: "user_roles",
        };
      }

      const profileRole = (profileResponse.data as { role?: string | null } | null)?.role ?? null;
      if (profileRole) {
        return {
          role: profileRole,
          rawRole: profileRole,
          source: "profiles",
        };
      }

      return {
        role: null,
        rawRole: null,
        source: "none",
      };
    },
    enabled: !!user?.id && !tenantLoading,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    retry: false,
  });

  const normalizedRole = normalizeRole(roleSource?.role);
  const isSuperAdmin = normalizedRole === ROLES.SUPERADMIN;
  const isTenantAdmin = normalizedRole === ROLES.TENANT_ADMIN;

  const {
    data: adminExists,
    isLoading: isLoadingAdmin,
    error: adminCheckError,
  } = useQuery({
    queryKey: ["has-admin"],
    queryFn: async () => {
      const { data, error: rpcError } = await supabase.rpc("has_admin");
      if (rpcError) throw rpcError;
      return !!data;
    },
    enabled: !!user,
    staleTime: 30000,
    refetchOnMount: false,
    retry: false,
  });

  const { data: rolePermissions, isLoading: isLoadingPermissions } = useQuery({
    queryKey: ["role-permissions", tenantId, normalizedRole],
    queryFn: async (): Promise<PermissionEntry[]> => {
      if (!tenantId || !normalizedRole || isSuperAdmin) {
        return [];
      }

      const { data, error: permissionError } = await (supabase as any)
        .from("tenant_role_permissions")
        .select("permission_key, allowed, role")
        .eq("tenant_id", tenantId)
        .in("role", getPermissionRoleCandidates(normalizedRole))
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false });

      if (permissionError) {
        throw permissionError;
      }

      return (data ?? []) as PermissionEntry[];
    },
    enabled: !!tenantId && !!normalizedRole && !isSuperAdmin,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
  });

  useEffect(() => {
    if (!user?.id) return;

    const authChannel = supabase
      .channel(`tenant-auth-${user.id}-${tenantId ?? "none"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tenant_members",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["userRole", user.id, tenantId] });
          queryClient.invalidateQueries({ queryKey: ["current-tenant-id", user.id] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_roles",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["userRole", user.id, tenantId] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["userRole", user.id, tenantId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(authChannel);
    };
  }, [queryClient, tenantId, user?.id]);

  useEffect(() => {
    if (!tenantId || !normalizedRole || isSuperAdmin) return;

    const channel = supabase
      .channel(`tenant-role-permissions-${tenantId}-${normalizedRole}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tenant_role_permissions",
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["role-permissions", tenantId, normalizedRole] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, tenantId, normalizedRole, isSuperAdmin]);

  useEffect(() => {
    if (!user) {
      syncRoleCookie(null);
      return;
    }

    if (!isLoading) {
      syncRoleCookie(normalizedRole ?? null);
    }
  }, [isLoading, normalizedRole, user]);

  const hasPermission = useCallback(
    (key: string) => {
      if (isSuperAdmin) return true;
      if (!normalizedRole) return false;

      const rolePriorities = new Map(
        getPermissionRoleCandidates(normalizedRole).map((role, index) => [role, index] as const),
      );
      const matchingEntries = (rolePermissions || [])
        .filter((entry) => entry.permission_key === key)
        .sort((left, right) => {
          const leftPriority = rolePriorities.get(left.role) ?? Number.MAX_SAFE_INTEGER;
          const rightPriority = rolePriorities.get(right.role) ?? Number.MAX_SAFE_INTEGER;
          return leftPriority - rightPriority;
        });
      if (matchingEntries.length > 0) {
        return matchingEntries[0].allowed === true;
      }

      const fallbackPermissions = new Set(defaultPermissionsByRole[normalizedRole] || []);
      return fallbackPermissions.has("*") || fallbackPermissions.has(key);
    },
    [isSuperAdmin, normalizedRole, rolePermissions],
  );

  const canManageUsers = hasPermission("admin.manage_roles");
  const canManageBusiness = hasPermission("settings.edit_business");
  const canCreateSales = hasPermission("sales.create");
  const canViewReports = hasPermission("reports.view");
  const isReadOnly = normalizedRole === ROLES.VIEWER;
  const needsRecovery = !!user && !normalizedRole && adminExists === false && !isLoadingAdmin;

  return {
    userRole: normalizedRole,
    rawUserRole: roleSource?.rawRole ?? roleSource?.role,
    isSuperAdmin,
    isTenantAdmin,
    isAdmin: isSuperAdmin || isTenantAdmin,
    isManager: normalizedRole === ROLES.MANAGER,
    isStaff: normalizedRole === ROLES.STAFF,
    isViewer: normalizedRole === ROLES.VIEWER,
    canManageUsers,
    canManageBusiness,
    canCreateSales,
    canViewReports,
    isReadOnly,
    hasPermission,
    isLoading: isLoading || isLoadingPermissions || isLoadingAdmin || tenantLoading,
    error: error || adminCheckError || tenantError,
    needsRecovery,
  };
};
