import { FormEvent, useEffect, useRef, useState } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/utils/toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

const GENERATED_PASSWORD_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";

const generateStrongPassword = (length = 14) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => GENERATED_PASSWORD_CHARSET[value % GENERATED_PASSWORD_CHARSET.length]).join("");
};

const getReadableAuthError = (message: string) => {
  if (/invalid login credentials/i.test(message)) {
    return "Current password is incorrect.";
  }

  return message;
};

export const ProfilePasswordResetForm = () => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isVerifyingCurrentPassword, setIsVerifyingCurrentPassword] = useState(false);
  const [currentPasswordStatus, setCurrentPasswordStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [currentPasswordError, setCurrentPasswordError] = useState("");
  const validationRequestRef = useRef(0);
  const passwordsMatch =
    newPassword.trim().length > 0 &&
    confirmPassword.trim().length > 0 &&
    newPassword === confirmPassword;
  const hasPasswordMismatch = confirmPassword.trim().length > 0 && newPassword !== confirmPassword;

  const verifyCurrentPassword = async (
    password: string,
    options?: { requestId?: number; silent?: boolean },
  ) => {
    const trimmedPassword = password.trim();
    if (!trimmedPassword) {
      setCurrentPasswordStatus("idle");
      setCurrentPasswordError("");
      return false;
    }

    if (!user?.email) {
      setCurrentPasswordStatus("invalid");
      setCurrentPasswordError("Your account email is missing.");
      return false;
    }

    setIsVerifyingCurrentPassword(true);
    setCurrentPasswordStatus("checking");
    setCurrentPasswordError("");

    try {
      const { data: authUser, error: authUserError } = await supabase.auth.getUser();
      if (authUserError) {
        throw authUserError;
      }

      const email = authUser.user?.email ?? user.email;
      if (!email) {
        throw new Error("Your account email is missing.");
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: trimmedPassword,
      });

      if (options?.requestId && options.requestId !== validationRequestRef.current) {
        return false;
      }

      if (error) {
        throw error;
      }

      setCurrentPasswordStatus("valid");
      setCurrentPasswordError("");
      return true;
    } catch (error) {
      if (options?.requestId && options.requestId !== validationRequestRef.current) {
        return false;
      }

      const message = error instanceof Error ? getReadableAuthError(error.message) : "Current password is incorrect.";
      setCurrentPasswordStatus("invalid");
      setCurrentPasswordError(message);
      if (!options?.silent) {
        toast.error(message);
      }
      return false;
    } finally {
      if (!options?.requestId || options.requestId === validationRequestRef.current) {
        setIsVerifyingCurrentPassword(false);
      }
    }
  };

  useEffect(() => {
    const nextValue = currentPassword.trim();
    validationRequestRef.current += 1;
    const requestId = validationRequestRef.current;

    if (!nextValue) {
      setCurrentPasswordStatus("idle");
      setCurrentPasswordError("");
      setIsVerifyingCurrentPassword(false);
      return;
    }

    if (!user?.email) {
      setCurrentPasswordStatus("invalid");
      setCurrentPasswordError("Your account email is missing.");
      setIsVerifyingCurrentPassword(false);
      return;
    }

    if (nextValue.length < 6) {
      setCurrentPasswordStatus("idle");
      setCurrentPasswordError("");
      setIsVerifyingCurrentPassword(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      await verifyCurrentPassword(nextValue, { requestId, silent: true });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [currentPassword, user?.email]);

  const handleGeneratePassword = () => {
    const generatedPassword = generateStrongPassword();
    setNewPassword(generatedPassword);
    setConfirmPassword(generatedPassword);
    setIsNewPasswordVisible(true);
    setIsConfirmPasswordVisible(true);
    toast.success("A strong password was generated and filled in.");
  };

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentPassword.trim()) {
      setCurrentPasswordStatus("invalid");
      setCurrentPasswordError("Enter your current password first.");
      return;
    }

    const isCurrentPasswordValid =
      currentPasswordStatus === "valid"
        ? true
        : await verifyCurrentPassword(currentPassword, { silent: false });

    if (!isCurrentPasswordValid) {
      return;
    }

    if (!newPassword.trim() || !confirmPassword.trim()) {
      toast.error("Enter your new password and retype it.");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Retyped password does not match.");
      return;
    }

    if (newPassword === currentPassword) {
      toast.error("New password must be different from the current password.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsNewPasswordVisible(false);
      setIsConfirmPasswordVisible(false);
      setCurrentPasswordStatus("idle");
      setCurrentPasswordError("");
      toast.success("Password updated successfully. Your browser may offer to save it on this device.");
    } catch (error) {
      const message = error instanceof Error ? getReadableAuthError(error.message) : "Failed to update password.";
      toast.error(message);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Password Reset
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Update password from your profile</AlertTitle>
          <AlertDescription>
            Enter your current password, set a new one, and your browser can save the updated password on this device.
          </AlertDescription>
        </Alert>

        <form onSubmit={handlePasswordChange} autoComplete="on" className="mt-6 space-y-5">
          <input
            type="email"
            name="email"
            value={user?.email ?? ""}
            autoComplete="username"
            readOnly
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
          />

          <div className="space-y-2">
            <Label htmlFor="profile-current-password">Current Password</Label>
            <PasswordInput
              id="profile-current-password"
              name="currentPassword"
              value={currentPassword}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                setCurrentPasswordStatus(event.target.value.trim() ? "checking" : "idle");
                setCurrentPasswordError("");
              }}
              placeholder="Type your current password"
              autoComplete="current-password"
              aria-invalid={currentPasswordError ? "true" : "false"}
              aria-describedby={currentPasswordError ? "profile-current-password-error" : "profile-current-password-status"}
            />
            <div id="profile-current-password-status" className="min-h-5 text-xs text-muted-foreground">
              {isVerifyingCurrentPassword
                ? "Checking current password..."
                : currentPasswordStatus === "valid"
                  ? "Current password verified."
                  : currentPasswordStatus === "invalid"
                    ? "Current password could not be verified."
                  : currentPasswordStatus === "idle"
                    ? "We verify the current password automatically while you type."
                    : ""}
            </div>
            {currentPasswordError ? (
              <p id="profile-current-password-error" className="text-sm text-destructive">
                {currentPasswordError}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="profile-new-password">New Password</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-md px-3 text-xs font-medium"
                onClick={handleGeneratePassword}
              >
                Auto Generate Password
              </Button>
            </div>
            <PasswordInput
              id="profile-new-password"
              name="newPassword"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              visible={isNewPasswordVisible}
              onVisibleChange={setIsNewPasswordVisible}
              placeholder="Type your new password"
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-confirm-password">Retype Password</Label>
            <PasswordInput
              id="profile-confirm-password"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              visible={isConfirmPasswordVisible}
              onVisibleChange={setIsConfirmPasswordVisible}
              placeholder="Retype your new password"
              autoComplete="new-password"
              aria-invalid={hasPasswordMismatch ? "true" : "false"}
              aria-describedby="profile-confirm-password-status"
            />
            <div
              id="profile-confirm-password-status"
              className={
                hasPasswordMismatch
                  ? "min-h-5 text-sm text-destructive"
                  : passwordsMatch
                    ? "min-h-5 text-sm text-emerald-600 dark:text-emerald-400"
                    : "min-h-5 text-sm text-muted-foreground"
              }
            >
              {hasPasswordMismatch
                ? "Retyped password does not match the new password."
                : passwordsMatch
                  ? "New password and retype password match."
                  : "Retype the same password to confirm it."}
            </div>
          </div>

          <div className="pt-2">
            <Button type="submit" disabled={isUpdatingPassword}>
              {isUpdatingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
