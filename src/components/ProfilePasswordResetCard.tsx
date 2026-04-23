import { useEffect, useMemo, useState } from "react";
import { KeyRound, Loader2, Mail, Phone, ShieldAlert, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/utils/toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

interface PhoneFactorSummary {
  id: string;
  factor_type?: string;
  status?: string;
  friendly_name?: string | null;
  phone?: string | null;
}

interface ProfilePasswordResetCardProps {
  savedPhone: string;
}

const E164_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;
const GENERATED_PASSWORD_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";

const normalizePhone = (value: string) => value.trim();

const isE164Phone = (value: string) => E164_PHONE_REGEX.test(normalizePhone(value));

const generateStrongPassword = (length = 14) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => GENERATED_PASSWORD_CHARSET[value % GENERATED_PASSWORD_CHARSET.length]).join("");
};

const maskPhone = (value: string | null | undefined) => {
  const phone = String(value ?? "").trim();
  if (phone.length <= 4) return phone || "your enrolled phone";
  return `${phone.slice(0, 4)}${"*".repeat(Math.max(0, phone.length - 6))}${phone.slice(-2)}`;
};

const getReadableAuthError = (message: string) => {
  if (/mfa_phone_enroll_not_enabled|mfa_phone_verify_not_enabled|phone_provider_disabled/i.test(message)) {
    return "Phone OTP is not enabled in Supabase yet. Enable the phone provider and phone MFA, then try again.";
  }

  if (/unsupported phone number/i.test(message)) {
    return "Use a valid phone number in E.164 format, for example +8801XXXXXXXXX.";
  }

  if (/reauth_nonce_missing|invalid nonce|nonce/i.test(message)) {
    return "The email verification code is missing or invalid. Request a new code and try again.";
  }

  return message;
};

export const ProfilePasswordResetCard = ({ savedPhone }: ProfilePasswordResetCardProps) => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailNonce, setEmailNonce] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneFactors, setPhoneFactors] = useState<PhoneFactorSummary[]>([]);
  const [phoneChallengeId, setPhoneChallengeId] = useState<string | null>(null);
  const [activePhoneFactorId, setActivePhoneFactorId] = useState<string | null>(null);
  const [phoneVerifiedForChange, setPhoneVerifiedForChange] = useState(false);
  const [readinessMessage, setReadinessMessage] = useState<string | null>(null);
  const [isLoadingFactors, setIsLoadingFactors] = useState(false);
  const [isSendingEmailCode, setIsSendingEmailCode] = useState(false);
  const [isSendingPhoneCode, setIsSendingPhoneCode] = useState(false);
  const [isVerifyingPhoneCode, setIsVerifyingPhoneCode] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isVerifyingCurrentPassword, setIsVerifyingCurrentPassword] = useState(false);
  const [currentPasswordVerified, setCurrentPasswordVerified] = useState(false);
  const [currentPasswordError, setCurrentPasswordError] = useState<string>("");

  const normalizedSavedPhone = useMemo(() => normalizePhone(savedPhone), [savedPhone]);
  const hasConfirmedEmail = Boolean(user?.email && user?.email_confirmed_at);

  const verifiedPhoneFactor = useMemo(
    () => phoneFactors.find((factor) => factor.factor_type === "phone" && factor.status === "verified") ?? null,
    [phoneFactors],
  );

  const pendingPhoneFactor = useMemo(() => {
    const pendingFactors = phoneFactors.filter(
      (factor) => factor.factor_type === "phone" && factor.status !== "verified",
    );

    if (!pendingFactors.length) {
      return null;
    }

    if (normalizedSavedPhone) {
      return (
        pendingFactors.find(
          (factor) => normalizePhone(String(factor.phone ?? "")) === normalizedSavedPhone,
        ) ?? null
      );
    }

    return pendingFactors[0] ?? null;
  }, [normalizedSavedPhone, phoneFactors]);

  const stalePendingPhoneFactor = useMemo(() => {
    if (!normalizedSavedPhone) {
      return null;
    }

    return (
      phoneFactors.find(
        (factor) =>
          factor.factor_type === "phone" &&
          factor.status !== "verified" &&
          normalizePhone(String(factor.phone ?? "")) !== normalizedSavedPhone,
      ) ?? null
    );
  }, [normalizedSavedPhone, phoneFactors]);

  const activePhoneFactor = verifiedPhoneFactor ?? pendingPhoneFactor ?? null;
  const phoneMismatch =
    Boolean(verifiedPhoneFactor?.phone) &&
    Boolean(normalizedSavedPhone) &&
    normalizePhone(String(verifiedPhoneFactor?.phone ?? "")) !== normalizedSavedPhone;

  const canAttemptPasswordChange =
    hasConfirmedEmail &&
    currentPasswordVerified &&
    phoneVerifiedForChange &&
    currentPassword.trim().length > 0 &&
    emailNonce.trim().length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword;

  const refreshPhoneFactors = async () => {
    setIsLoadingFactors(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        throw error;
      }

      const factors = (data?.all ?? []).filter((factor) => factor.factor_type === "phone") as PhoneFactorSummary[];
      setPhoneFactors(factors);
      setReadinessMessage(null);

      if (!factors.length) {
        setActivePhoneFactorId(null);
        setPhoneVerifiedForChange(false);
        return;
      }

      const preferredFactor = factors.find((factor) => factor.status === "verified") ?? factors[0];
      setActivePhoneFactorId(preferredFactor?.id ?? null);
    } catch (error) {
      const message = error instanceof Error ? getReadableAuthError(error.message) : "Failed to load phone OTP status.";
      setReadinessMessage(message);
    } finally {
      setIsLoadingFactors(false);
    }
  };

  useEffect(() => {
    void refreshPhoneFactors();
  }, []);

  const ensureCurrentPasswordVerified = async () => {
    if (currentPasswordVerified) {
      return true;
    }

    if (!user?.email) {
      setCurrentPasswordError("Your account email is missing.");
      toast.error("Your account email is missing.");
      return false;
    }

    if (!currentPassword.trim()) {
      setCurrentPasswordError("Enter your current password first.");
      toast.error("Enter your current password first.");
      return false;
    }

    setIsVerifyingCurrentPassword(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (error) {
        throw error;
      }

      setCurrentPasswordVerified(true);
      setCurrentPasswordError("");
      toast.success("Current password verified.");
      return true;
    } catch (error) {
      const message = error instanceof Error ? getReadableAuthError(error.message) : "Current password could not be verified.";
      setCurrentPasswordVerified(false);
      setCurrentPasswordError(message);
      toast.error(message);
      return false;
    } finally {
      setIsVerifyingCurrentPassword(false);
    }
  };

  const requestEmailVerificationCode = async () => {
    if (!hasConfirmedEmail) {
      toast.error("A verified email is required before you can reset your password here.");
      return;
    }

    const isCurrentPasswordReady = await ensureCurrentPasswordVerified();
    if (!isCurrentPasswordReady) {
      return;
    }

    setIsSendingEmailCode(true);
    try {
      const { error } = await supabase.auth.reauthenticate();
      if (error) {
        throw error;
      }

      toast.success(`A verification code has been sent to ${user?.email}.`);
    } catch (error) {
      const message = error instanceof Error ? getReadableAuthError(error.message) : "Failed to send email verification code.";
      toast.error(message);
    } finally {
      setIsSendingEmailCode(false);
    }
  };

  const sendPhoneOtp = async (factorId: string) => {
    const isCurrentPasswordReady = await ensureCurrentPasswordVerified();
    if (!isCurrentPasswordReady) {
      return;
    }

    setIsSendingPhoneCode(true);
    setPhoneVerifiedForChange(false);
    try {
      const { data, error } = await supabase.auth.mfa.challenge({
        factorId,
        channel: "sms",
      });

      if (error) {
        throw error;
      }

      setPhoneChallengeId(data.id);
      setActivePhoneFactorId(factorId);
      toast.success(`A phone OTP has been sent to ${maskPhone(activePhoneFactor?.phone ?? normalizedSavedPhone)}.`);
    } catch (error) {
      const message = error instanceof Error ? getReadableAuthError(error.message) : "Failed to send phone OTP.";
      setReadinessMessage(message);
      toast.error(message);
    } finally {
      setIsSendingPhoneCode(false);
    }
  };

  const enrollPhoneOtp = async () => {
    if (!normalizedSavedPhone) {
      setReadinessMessage("Save your phone number in the profile form first.");
      return;
    }

    if (!isE164Phone(normalizedSavedPhone)) {
      setReadinessMessage("Your saved phone number must be in E.164 format, for example +8801XXXXXXXXX.");
      return;
    }

    const isCurrentPasswordReady = await ensureCurrentPasswordVerified();
    if (!isCurrentPasswordReady) {
      return;
    }

    setIsSendingPhoneCode(true);
    setPhoneVerifiedForChange(false);
    try {
      const existingPendingFactorId = pendingPhoneFactor?.id ?? null;
      if (existingPendingFactorId) {
        setActivePhoneFactorId(existingPendingFactorId);
        await sendPhoneOtp(existingPendingFactorId);
        return;
      }

      if (stalePendingPhoneFactor?.id) {
        const { error: staleFactorError } = await supabase.auth.mfa.unenroll({
          factorId: stalePendingPhoneFactor.id,
        });

        if (staleFactorError) {
          throw staleFactorError;
        }
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "phone",
        phone: normalizedSavedPhone,
        friendlyName: "Profile phone",
      });

      if (error) {
        throw error;
      }

      setActivePhoneFactorId(data.id);
      await refreshPhoneFactors();
      await sendPhoneOtp(data.id);
    } catch (error) {
      const message = error instanceof Error ? getReadableAuthError(error.message) : "Failed to prepare phone OTP.";
      setReadinessMessage(message);
      toast.error(message);
    } finally {
      setIsSendingPhoneCode(false);
    }
  };

  const verifyPhoneOtp = async () => {
    const factorId = activePhoneFactorId ?? activePhoneFactor?.id ?? null;
    if (!factorId || !phoneChallengeId) {
      toast.error("Request a phone OTP first.");
      return;
    }

    if (!phoneCode.trim()) {
      toast.error("Enter the phone OTP code.");
      return;
    }

    setIsVerifyingPhoneCode(true);
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: phoneChallengeId,
        code: phoneCode.trim(),
      });

      if (error) {
        throw error;
      }

      setPhoneChallengeId(null);
      setPhoneCode("");
      setPhoneVerifiedForChange(true);
      setReadinessMessage(null);
      await refreshPhoneFactors();
      toast.success("Phone OTP verified.");
    } catch (error) {
      const message = error instanceof Error ? getReadableAuthError(error.message) : "Failed to verify phone OTP.";
      toast.error(message);
    } finally {
      setIsVerifyingPhoneCode(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      toast.error("Enter your new password and retype it.");
      return;
    }

    if (!currentPassword.trim()) {
      setCurrentPasswordError("Enter your current password first.");
      toast.error("Enter your current password first.");
      return;
    }

    if (!currentPasswordVerified) {
      setCurrentPasswordError("Current password verification is required before continuing.");
      toast.error("Verify your current password before requesting email and phone confirmation.");
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

    if (!hasConfirmedEmail) {
      toast.error("Your email must be verified before you can change the password here.");
      return;
    }

    if (!emailNonce.trim()) {
      toast.error("Enter the email verification code that was sent to you.");
      return;
    }

    if (!phoneVerifiedForChange) {
      toast.error("Verify the phone OTP before changing the password.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        nonce: emailNonce.trim(),
      });

      if (error) {
        throw error;
      }

      setNewPassword("");
      setConfirmPassword("");
      setEmailNonce("");
      setPhoneVerifiedForChange(false);
      setPhoneChallengeId(null);
      setPhoneCode("");
      toast.success("Password updated successfully.");
    } catch (error) {
      const message = error instanceof Error ? getReadableAuthError(error.message) : "Failed to update password.";
      toast.error(message);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleGeneratePassword = () => {
    const nextPassword = generateStrongPassword();
    setNewPassword(nextPassword);
    setConfirmPassword(nextPassword);
    toast.success("A strong password was generated and filled in.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Password Reset & Verification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Two-step confirmation before password change</AlertTitle>
          <AlertDescription>
            This password reset section requires both an email verification code and a phone OTP confirmation before the new password is saved.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="profile-current-password">Current Password</Label>
            <PasswordInput
              id="profile-current-password"
              value={currentPassword}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                setCurrentPasswordVerified(false);
                setCurrentPasswordError("");
                setPhoneVerifiedForChange(false);
                setPhoneChallengeId(null);
                setPhoneCode("");
                setEmailNonce("");
              }}
              placeholder="Type your current password"
              aria-invalid={currentPasswordError ? "true" : "false"}
              aria-describedby={currentPasswordError ? "profile-current-password-error" : undefined}
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {currentPasswordVerified ? <Badge variant="default">Verified</Badge> : <Badge variant="secondary">Needs Verification</Badge>}
              <span>We verify this before sending the email code and phone OTP.</span>
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
              <Button type="button" variant="ghost" className="h-auto px-0 text-xs" onClick={handleGeneratePassword}>
                Auto Generate Password
              </Button>
            </div>
            <PasswordInput
              id="profile-new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Type your new password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-confirm-password">Retype Password</Label>
            <PasswordInput
              id="profile-confirm-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Retype your new password"
            />
          </div>
          <div className="md:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void ensureCurrentPasswordVerified()}
              disabled={isVerifyingCurrentPassword || !currentPassword.trim()}
            >
              {isVerifyingCurrentPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verify Current Password
            </Button>
          </div>
        </div>

        <div className="rounded-xl border p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <p className="font-medium">Email Verification</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Send a verification code to {user?.email || "your email"}, then enter it below.
              </p>
            </div>
            <Badge variant={hasConfirmedEmail ? "default" : "destructive"}>
              {hasConfirmedEmail ? "Email Verified" : "Email Not Verified"}
            </Badge>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={emailNonce}
              onChange={(event) => setEmailNonce(event.target.value)}
              placeholder="Enter email verification code"
              inputMode="numeric"
              autoComplete="one-time-code"
              disabled={!hasConfirmedEmail}
            />
            <Button
              type="button"
              variant="outline"
              onClick={requestEmailVerificationCode}
              disabled={isSendingEmailCode || !hasConfirmedEmail}
            >
              {isSendingEmailCode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send Email Code
            </Button>
          </div>
        </div>

        <div className="rounded-xl border p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <p className="font-medium">Phone OTP</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Phone OTP uses your saved profile phone number. Save it in E.164 format, for example +8801XXXXXXXXX.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {verifiedPhoneFactor ? <Badge>Phone OTP Active</Badge> : <Badge variant="secondary">Phone OTP Ready to Set Up</Badge>}
              {phoneVerifiedForChange ? <Badge variant="default">Verified for This Change</Badge> : null}
            </div>
          </div>

          {phoneMismatch ? (
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Saved phone and enrolled OTP phone differ</AlertTitle>
              <AlertDescription>
                Password reset will use the enrolled OTP phone {maskPhone(verifiedPhoneFactor?.phone)} until you replace that factor.
              </AlertDescription>
            </Alert>
          ) : null}

          {!normalizedSavedPhone ? (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Phone OTP is not ready yet</AlertTitle>
              <AlertDescription>
                Add and save your phone number in the profile form first.
              </AlertDescription>
            </Alert>
          ) : !isE164Phone(normalizedSavedPhone) ? (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Phone format is not ready for OTP</AlertTitle>
              <AlertDescription>
                Use an E.164 phone number like +8801XXXXXXXXX in your saved profile phone field.
              </AlertDescription>
            </Alert>
          ) : null}

          {readinessMessage ? (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Phone OTP readiness</AlertTitle>
              <AlertDescription>{readinessMessage}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {verifiedPhoneFactor ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void sendPhoneOtp(verifiedPhoneFactor.id)}
                disabled={isSendingPhoneCode || isLoadingFactors}
              >
                {isSendingPhoneCode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send Phone OTP
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => void enrollPhoneOtp()}
                disabled={isSendingPhoneCode || isLoadingFactors || !isE164Phone(normalizedSavedPhone)}
              >
                {isSendingPhoneCode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Set Up Phone OTP
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              onClick={() => void refreshPhoneFactors()}
              disabled={isLoadingFactors}
            >
              {isLoadingFactors ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Refresh OTP Status
            </Button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={phoneCode}
              onChange={(event) => setPhoneCode(event.target.value)}
              placeholder="Enter phone OTP"
              inputMode="numeric"
              autoComplete="one-time-code"
              disabled={!phoneChallengeId}
            />
            <Button
              type="button"
              onClick={() => void verifyPhoneOtp()}
              disabled={!phoneChallengeId || isVerifyingPhoneCode}
            >
              {isVerifyingPhoneCode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verify Phone OTP
            </Button>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => void handlePasswordChange()}
          disabled={isUpdatingPassword || !canAttemptPasswordChange}
          className="w-full sm:w-auto"
        >
          {isUpdatingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Reset Password
        </Button>
      </CardContent>
    </Card>
  );
};
