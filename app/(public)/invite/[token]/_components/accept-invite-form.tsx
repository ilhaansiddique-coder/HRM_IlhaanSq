"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { acceptInviteAction } from "../actions";

export function AcceptInviteForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await acceptInviteAction(formData);
        // Auto-sign in after acceptance
        const result = await signIn("credentials", {
          email,
          password: formData.get("password") as string,
          redirect: false,
        });
        if (result?.error) {
          setError("Account created but sign-in failed. Please try logging in.");
          return;
        }
        router.push("/hr");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to accept invite");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <input type="hidden" name="token" value={token} />

      <div className="space-y-2">
        <Label htmlFor="fullName">Your full name</Label>
        <Input id="fullName" name="fullName" required minLength={2} placeholder="Asif Khan" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Create a password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="At least 8 characters"
        />
      </div>

      <Button type="submit" className="w-full h-11" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Accepting invite...
          </>
        ) : (
          "Accept invite & sign in"
        )}
      </Button>
    </form>
  );
}
