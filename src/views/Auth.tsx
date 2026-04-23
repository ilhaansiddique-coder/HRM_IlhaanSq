import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/core/auth/useAuth";
import { useUserRole } from "@/core/auth/useUserRole";
import { useBusinessSettings } from "@/core/settings/useBusinessSettings";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Loader2, Package } from "lucide-react";
import { toast } from "@/utils/toast";
import { resolveAppBaseUrl } from "@/lib/runtimeUrls";
import { clearAuthBridgeCookies } from "@/lib/authBridge";

const Auth = () => {
  const { user, loading, signIn } = useAuth();
  const { isSuperAdmin, isLoading: roleLoading } = useUserRole();
  const { businessSettings } = useBusinessSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isPreparingTenantLogin, setIsPreparingTenantLogin] = useState(false);
  const [signInEmail, setSignInEmail] = useState("");
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("token") ?? searchParams.get("invite") ?? "";
  const authSource = searchParams.get("source") ?? "";
  const verified = searchParams.get("verified") === "1";
  const tenantLogin = searchParams.get("tenant_login") === "1";
  const isInviteSignup = Boolean(inviteToken);
  const canRegister = isInviteSignup;
  const isTenantLoginIntent =
    tenantLogin ||
    authSource === "tenant-access-approved" ||
    authSource === "tenant-created-by-superadmin" ||
    authSource === "tenant-welcome";
  const showTemporaryPasswordAlert =
    authSource === "tenant-access-approved" ||
    authSource === "tenant-created-by-superadmin" ||
    authSource === "tenant-welcome";

  useEffect(() => {
    let cancelled = false;

    const prepareTenantLoginWindow = async () => {
      if (!isTenantLoginIntent || loading || !user) {
        if (!cancelled) {
          setIsPreparingTenantLogin(false);
        }
        return;
      }

      setIsPreparingTenantLogin(true);
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // Best-effort only. We still want the login window.
      } finally {
        clearAuthBridgeCookies();
        if (!cancelled) {
          setIsPreparingTenantLogin(false);
        }
      }
    };

    void prepareTenantLoginWindow();

    return () => {
      cancelled = true;
    };
  }, [isTenantLoginIntent, loading, user]);

  // Redirect if already authenticated
  if (user && !loading && !roleLoading && !isTenantLoginIntent) {
    return <Navigate to={isSuperAdmin ? "/super-admin" : "/dashboard"} replace />;
  }

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      await signIn(
        formData.get("email") as string,
        formData.get("password") as string
      );
    } catch (error) {
      // Error handled in useAuth
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = signInEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error("Enter your email first, then click Forgot password.");
      return;
    }

    setIsResettingPassword(true);
    try {
      const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VITE_APP_URL || "";
      const appUrl = resolveAppBaseUrl(configuredAppUrl);

      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${appUrl.replace(/\/+$/, "")}/reset-password`,
      });

      if (error) {
        throw error;
      }

      toast.success("Password reset email sent. Please check your inbox.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send password reset email";
      toast.error(message);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      const fullName = String(formData.get("fullName") || "").trim();
      const workspaceName = String(formData.get("workspaceName") || "").trim();
      const email = String(formData.get("email") || "").trim().toLowerCase();
      const password = String(formData.get("password") || "");
      const confirmPassword = String(formData.get("confirmPassword") || "");

      if (!fullName || !email || !password) {
        throw new Error("All fields are required");
      }
      if (!isInviteSignup) {
        throw new Error("Direct signup is disabled. Use a valid invite link.");
      }
      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }
      if (password !== confirmPassword) {
        throw new Error("Passwords do not match");
      }

      const { data, error } = await supabase.functions.invoke("demo-signup", {
        body: {
          action: "signup",
          full_name: fullName,
          workspace_name: workspaceName || `${fullName}'s Workspace`,
          email,
          password,
          invite_token: inviteToken || undefined,
        },
      });

      if (error) {
        throw new Error(error.message || "Signup failed");
      }
      if (!data?.success) {
        throw new Error(data?.error || "Signup failed");
      }

      toast.success(
        data?.email_resent
          ? "Verification email resent. Check your inbox to finish accepting the invite."
          : "Check your email to verify your account before signing in.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Signup failed";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading || roleLoading || isPreparingTenantLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <Card className="w-full max-w-md">
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
            Wholesale clothing inventory management system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={isInviteSignup ? "signup" : "signin"} className="w-full">
            {isInviteSignup && (
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Accept Invite</TabsTrigger>
              </TabsList>
            )}
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                {showTemporaryPasswordAlert && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Temporary Password Required</AlertTitle>
                    <AlertDescription>
                      {verified
                        ? "Your email is verified. Sign in with the temporary password from your approval email, then change it from your dashboard security page."
                        : "Use the temporary password sent to your email, then change it from your dashboard security page after your first sign-in."}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    name="email"
                    type="email"
                    placeholder="your@email.com"
                    value={signInEmail}
                    onChange={(event) => setSignInEmail(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <PasswordInput
                    id="signin-password"
                    name="password"
                    placeholder="••••••••"
                    required
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto px-0 text-xs"
                      onClick={handleForgotPassword}
                      disabled={isResettingPassword}
                    >
                      {isResettingPassword ? "Sending..." : "Forgot password?"}
                    </Button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
                {!isInviteSignup && (
                  <div className="rounded-md border border-amber-300/40 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
                    New tenant creation is reviewed by the superadmin. Submit a tenant access request to be approved.
                    <div className="mt-3">
                      <Button asChild variant="outline" size="sm">
                        <Link to="/request-demo">Request for demo</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              {!canRegister ? (
                <div className="rounded-md border border-amber-300/40 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
                  Account creation is by invitation only. Use the link from your invitation email, or request a demo to get started.
                </div>
              ) : (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-fullName">Full Name</Label>
                    <Input
                      id="signup-fullName"
                      name="fullName"
                      type="text"
                      placeholder="Your full name"
                      required
                    />
                  </div>
                  {!isInviteSignup && (
                    <div className="space-y-2">
                      <Label htmlFor="signup-workspaceName">Workspace Name</Label>
                      <Input
                        id="signup-workspaceName"
                        name="workspaceName"
                        type="text"
                        placeholder="My Demo Workspace"
                        required
                      />
                    </div>
                  )}
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    name="email"
                    type="email"
                    placeholder="your@email.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <PasswordInput
                    id="signup-password"
                    name="password"
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirmPassword">Confirm Password</Label>
                  <PasswordInput
                    id="signup-confirmPassword"
                    name="confirmPassword"
                    placeholder="Re-enter password"
                    required
                    minLength={8}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending verification email...
                    </>
                  ) : (
                    "Accept Invitation"
                  )}
                </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
