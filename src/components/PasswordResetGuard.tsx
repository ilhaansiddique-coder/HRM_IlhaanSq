import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

interface PasswordResetGuardProps {
  children: ReactNode;
}

export const PasswordResetGuard = ({ children }: PasswordResetGuardProps) => {
  const { user, loading, requiresPasswordReset } = useAuth();
  const { isSuperAdmin, isLoading: roleLoading } = useUserRole();
  const location = useLocation();

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <>{children}</>;
  }

  if (requiresPasswordReset) {
    if (isSuperAdmin) {
      if (!location.pathname.startsWith("/reset-password")) {
        return <Navigate to="/reset-password?forced=true" replace />;
      }
      return <>{children}</>;
    }

    if (!location.pathname.startsWith("/settings")) {
      return <Navigate to="/settings?tab=security&forced=true" replace />;
    }
  }

  return <>{children}</>;
};
