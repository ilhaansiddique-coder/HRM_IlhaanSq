"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { resetPasswordWithTokenAction } from "../actions";

export function SetNewPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    formData.set("token", token);
    startTransition(async () => {
      try {
        await resetPasswordWithTokenAction(formData);
        setSuccess(true);
        setTimeout(() => router.push("/login"), 1500);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to reset password");
      }
    });
  }

  if (success) {
    return (
      <div className="text-center py-6 space-y-3">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
          <CheckCircle2 className="h-7 w-7 text-success" />
        </div>
        <p className="font-medium">Password updated</p>
        <p className="text-sm text-muted-foreground">Taking you to sign in...</p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <div className="relative">
          <Input
            id="newPassword"
            name="newPassword"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            className="pr-10"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          placeholder="Re-enter your password"
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" className="w-full h-11" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Updating...
          </>
        ) : (
          "Set new password"
        )}
      </Button>
    </form>
  );
}
