"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Zap, Copy, Check, Loader2 } from "lucide-react";
import { activateEmployeeNowAction } from "../actions";

// "Activate now (no email)" for an employee_onboarding approval. Provisions the
// account + activates the employee immediately, then shows the one-time temp
// password the admin hands over. Kept as its own client component so it can
// surface the returned password (a plain form action couldn't).
export function ActivateNowButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{
    email: string;
    tempPassword: string | null;
    reused: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function onActivate() {
    setError(null);
    start(async () => {
      const res = await activateEmployeeNowAction(id);
      if (!res.ok) {
        setError(res.error ?? "Failed to activate");
        return;
      }
      setResult({
        email: res.email ?? "",
        tempPassword: res.tempPassword ?? null,
        reused: res.reused ?? false,
      });
    });
  }

  function copy() {
    if (!result?.tempPassword) return;
    navigator.clipboard?.writeText(result.tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (result) {
    return (
      <div className="w-full rounded-md border border-success/40 bg-success/5 p-2.5 text-xs">
        <p className="font-medium text-success">Employee activated.</p>
        {result.tempPassword ? (
          <div className="mt-1.5 space-y-1.5">
            <p className="text-muted-foreground">
              Give these to the employee — they’ll set their own password on first
              login:
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-background/70 px-1.5 py-0.5">
                {result.email}
              </code>
              <code className="rounded bg-background/70 px-1.5 py-0.5 font-semibold">
                {result.tempPassword}
              </code>
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy password"}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-muted-foreground">
            An account already existed for {result.email} — they can log in with
            their current password.
          </p>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2 h-7"
          onClick={() => router.refresh()}
        >
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1"
        onClick={onActivate}
        disabled={pending}
        title="Activate immediately without email verification"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Zap className="h-3.5 w-3.5" />
        )}
        Activate now
      </Button>
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}
