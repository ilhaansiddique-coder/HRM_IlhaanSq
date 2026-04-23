import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/core/auth/useAuth";
import { useUserRole } from "@/core/auth/useUserRole";
import { useTenantMembership } from "@/core/tenants/useTenantMembership";
import { Loader2 } from "lucide-react";
import { AdminRecovery } from "./AdminRecovery";
import { useRef } from "react";
import { toast } from "@/utils/toast";
import type { Role } from "@/types/roles";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredRole?: Role | Role[];
  fallbackPath?: string;
  allowWithoutTenant?: boolean;
}

export const ProtectedRoute = ({
  children,
  requiredPermission,
  requiredRole,
  fallbackPath,
  allowWithoutTenant = false,
}: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const { userRole, needsRecovery, isLoading: roleLoading, hasPermission, isSuperAdmin, isTenantAdmin } = useUserRole();
  const { hasTenant, isLoading: tenantLoading } = useTenantMembership();
  const location = useLocation();
  const hasShownInitialRedirect = useRef(false);

  const routeOrder: Array<{ path: string; permission?: string }> = [
    { path: "/dashboard", permission: "access.dashboard" },
    { path: "/products", permission: "products.view" },
    { path: "/sales", permission: "sales.view" },
    { path: "/customers", permission: "customers.view" },
    { path: "/hr-management", permission: "hr.view" },
    { path: "/reports", permission: "reports.view" },
    { path: "/invoices", permission: "invoices.view" },
    { path: "/alerts", permission: "access.alerts" },
    { path: "/settings", permission: "settings.view_business" },
    { path: "/admin", permission: "admin.manage_roles" },
  ];

  const getFallbackPath = () => {
    if (isSuperAdmin) {
      return "/super-admin";
    }

    if (isTenantAdmin) {
      return "/admin";
    }

    const match = routeOrder.find((route) => {
      if (!route.permission) return true;
      return hasPermission(route.permission);
    });

    return match?.path || "/auth";
  };

  if (loading || roleLoading || tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!allowWithoutTenant && !hasTenant && !isSuperAdmin) {
    return <Navigate to="/onboarding" replace />;
  }

  if (allowWithoutTenant && location.pathname === "/onboarding") {
    if (isSuperAdmin) {
      return <Navigate to="/super-admin" replace />;
    }

    if (hasTenant) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Only show recovery screen if user has NO role at all
  if (needsRecovery && !allowWithoutTenant && !isSuperAdmin) {
    return <AdminRecovery />;
  }

  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!userRole || !allowedRoles.includes(userRole)) {
      const fallback = fallbackPath ?? getFallbackPath();
      return <Navigate to={fallback} replace />;
    }
  }

  // Check permission if required
  if (requiredPermission && !hasPermission(requiredPermission)) {
    const fallback = fallbackPath ?? getFallbackPath();

    // Don't show toast if this is the initial redirect from dashboard after login
    // (user landing on "/dashboard" without dashboard access should silently redirect)
    const isInitialDashboardRedirect = location.pathname === "/dashboard" && !hasShownInitialRedirect.current;

    if (!isInitialDashboardRedirect) {
      // Show toast only for explicit navigation to restricted pages
      setTimeout(() => {
        toast.error("You don't have permission to access this page");
      }, 100);
    }

    // Mark that we've handled the initial redirect
    hasShownInitialRedirect.current = true;

    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
};
