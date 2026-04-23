import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package } from "lucide-react";

interface InviteDetails {
  email: string;
  role: string;
  tenant_name: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  is_expired: boolean;
}

const formatRole = (role: string) => {
  if (!role) return "Member";
  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
};

const Invite = () => {
  const { user, loading } = useAuth();
  const { businessSettings } = useBusinessSettings();
  const [searchParams] = useSearchParams();
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  const inviteToken = useMemo(() => {
    return searchParams.get("invite") ?? searchParams.get("token") ?? "";
  }, [searchParams]);

  useEffect(() => {
    let isMounted = true;

    const fetchInvite = async () => {
      if (!inviteToken) {
        if (isMounted) {
          setError("Missing invite token");
          setIsLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("tenant-invite-details", {
          body: { token: inviteToken },
        });

        if (error) {
          throw new Error(error.message || "Failed to load invite details");
        }
        if (!data?.success || !data?.invite) {
          throw new Error(data?.error || "Invite not found");
        }

        if (isMounted) {
          setInvite(data.invite as InviteDetails);
          setError("");
        }
      } catch (err) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : "Failed to load invite";
          setError(message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    setIsLoading(true);
    setError("");
    setInvite(null);
    void fetchInvite();

    return () => {
      isMounted = false;
    };
  }, [inviteToken]);

  if (user && !loading) {
    return <Navigate to="/" replace />;
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const isExpired = invite?.is_expired ?? false;
  const isAccepted = Boolean(invite?.accepted_at);
  const isValid = Boolean(invite && !error);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            {businessSettings?.logo_url ? (
              <img
                src={businessSettings.logo_url}
                alt={businessSettings.business_name || "Business Logo"}
                className="h-12 w-12 rounded-full object-contain"
              />
            ) : (
              <div className="p-3 rounded-full bg-primary">
                <Package className="h-6 w-6 text-primary-foreground" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl font-bold">
            {businessSettings?.business_name || "Rahedeen Productions"}
          </CardTitle>
          <CardDescription>
            Invite details for your workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isValid && (
            <div className="space-y-4 text-center">
              <Badge variant="destructive">Invalid invite</Badge>
              <p className="text-sm text-muted-foreground">
                {error || "This invite is not valid or has expired."}
              </p>
              <Button asChild className="w-full">
                <Link to="/auth">Go to sign in</Link>
              </Button>
            </div>
          )}

          {isValid && invite && (
            <>
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Workspace</span>
                  <span className="font-medium">{invite.tenant_name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Invited email</span>
                  <span className="font-medium">{invite.email}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Role</span>
                  <span className="font-medium">{formatRole(invite.role)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Expires</span>
                  <span className="font-medium">{formatDateTime(invite.expires_at)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  {isAccepted ? (
                    <Badge variant="secondary">Already used</Badge>
                  ) : isExpired ? (
                    <Badge variant="destructive">Expired</Badge>
                  ) : (
                    <Badge variant="default">Active</Badge>
                  )}
                </div>
              </div>

              {isAccepted && (
                <p className="text-sm text-muted-foreground text-center">
                  This invite has already been used. If you need access, ask an admin to send a new invite.
                </p>
              )}

              {isExpired && !isAccepted && (
                <p className="text-sm text-muted-foreground text-center">
                  This invite has expired. Ask your admin to send a new one.
                </p>
              )}

              {!isExpired && !isAccepted && (
                <Button asChild className="w-full">
                  <Link to={`/auth?invite=${inviteToken}`}>Continue to sign up</Link>
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Invite;
