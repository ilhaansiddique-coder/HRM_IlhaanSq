import { Navigate } from "react-router-dom";
import { Clock3, Loader2, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

const Onboarding = () => {
  const { loading, signOut } = useAuth();
  const { isSuperAdmin, isLoading: roleLoading } = useUserRole();

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isSuperAdmin) {
    return <Navigate to="/super-admin?tab=tenant-requests" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 rounded-full bg-primary/10 p-3">
            <Clock3 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Access Pending Superadmin Review</CardTitle>
          <CardDescription>
            Tenant creation is no longer self-service. Your account must be approved and attached to a tenant by the superadmin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-amber-300/40 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                If you were expecting access, ask the superadmin to approve your tenant request or send you an invite.
              </div>
            </div>
          </div>
          <Button type="button" variant="outline" className="w-full" onClick={signOut}>
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
