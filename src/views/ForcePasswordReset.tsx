import { useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/utils/toast";

const getPasswordStrength = (password: string) => {
  let score = 0;
  if (password.length >= 8) score += 35;
  if (/[A-Z]/.test(password)) score += 25;
  if (/[0-9]/.test(password)) score += 20;
  if (/[^A-Za-z0-9]/.test(password)) score += 20;
  return Math.min(score, 100);
};

const ForcePasswordReset = () => {
  const { user, loading, requiresPasswordReset, refreshPasswordResetStatus } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const forced = searchParams.get("forced") === "true";

  const strength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasMinLength = newPassword.length >= 8;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!requiresPasswordReset && forced) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!hasMinLength || !hasUpper || !hasNumber) {
      toast.error("Password must be at least 8 characters with 1 uppercase and 1 number");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
      if (authError) throw authError;

      const { error: profileError } = await (supabase as any)
        .from("profiles")
        .update({
          force_password_reset: false,
          last_login: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (profileError && !/force_password_reset|last_login/i.test(profileError.message)) {
        throw profileError;
      }

      await refreshPasswordResetStatus();
      toast.success("Password updated successfully");
      navigate("/", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update password";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-medium">Security Required</span>
          </div>
          <CardTitle>Set a New Password</CardTitle>
          <CardDescription>
            You must set a new password before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {(forced || requiresPasswordReset) && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Temporary Password Still Active</AlertTitle>
                <AlertDescription>
                  Your current password is temporary. Set a new password of your own now to unlock the rest of the system.
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <PasswordInput
                id="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <Progress value={strength} className="h-2" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <ul className="text-xs text-muted-foreground space-y-1">
              <li className={hasMinLength ? "text-green-600" : ""}>Minimum 8 characters</li>
              <li className={hasUpper ? "text-green-600" : ""}>At least 1 uppercase letter</li>
              <li className={hasNumber ? "text-green-600" : ""}>At least 1 number</li>
            </ul>

            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Save New Password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForcePasswordReset;
