import { Shield, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/utils/toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";

interface SecurityTabProps {
  forced?: boolean;
}

export const SecurityTab = ({ forced = false }: SecurityTabProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { user, refreshPasswordResetStatus } = useAuth();
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handlePasswordUpdate = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      toast.error("New password must be different from current password");
      return;
    }

    setIsUpdating(true);
    try {
      // First verify the current password by attempting to sign in
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.email) {
        throw new Error("User email not found");
      }

      // Verify current password by attempting to sign in
      const { error: verificationError } = await supabase.auth.signInWithPassword({
        email: user.user.email,
        password: passwordForm.currentPassword
      });

      if (verificationError) {
        toast.error("Current password is incorrect");
        return;
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (error) throw error;

      if (forced && user?.user?.id) {
        const { error: profileError } = await (supabase as any)
          .from("profiles")
          .update({
            force_password_reset: false,
            last_login: new Date().toISOString(),
          })
          .eq("id", user.user.id);

        if (profileError && !/force_password_reset|last_login/i.test(profileError.message)) {
          throw profileError;
        }

        await refreshPasswordResetStatus();
      }
      
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      toast.success("Password updated successfully");
    } catch (error) {
      console.error("Error updating password:", error);
      toast.error("Failed to update password. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Security Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {forced && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Temporary Password Still Active</AlertTitle>
            <AlertDescription>
              Use your temporary password as the current password below, then set a new password of your own to unlock the rest of the tenant admin area.
            </AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label htmlFor="currentPassword">Current Password</Label>
          <PasswordInput
            id="currentPassword" 
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
            placeholder="Enter current password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password</Label>
          <PasswordInput
            id="newPassword" 
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
            placeholder="Enter new password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <PasswordInput
            id="confirmPassword" 
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
            placeholder="Confirm new password"
          />
        </div>
        <Button onClick={handlePasswordUpdate} disabled={isUpdating}>
          {isUpdating ? 'Updating...' : 'Update Password'}
        </Button>
      </CardContent>
    </Card>
  );
};
