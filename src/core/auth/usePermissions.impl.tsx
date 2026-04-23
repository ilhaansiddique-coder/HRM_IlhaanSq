import { type Role } from "@/types/roles";
import { useUserRole } from "@/core/auth/useUserRole";

export const usePermissions = () => {
  const { userRole, hasPermission, isLoading, isSuperAdmin, isTenantAdmin } = useUserRole();

  const hasRole = (requiredRole: Role) => {
    return userRole === requiredRole;
  };

  const permissions = isSuperAdmin || isTenantAdmin ? ["*"] : [];

  return {
    permissions,
    hasPermission,
    hasRole,
    role: userRole,
    isLoading,
  };
};
