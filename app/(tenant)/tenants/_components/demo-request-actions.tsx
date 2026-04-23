"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Check,
  X,
  Loader2,
  Copy,
  Sparkles,
  Eye,
  EyeOff,
  RotateCcw,
  Mail,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  approveRequestAction,
  rejectRequestAction,
  resetRequestAction,
} from "../actions";

// Generate a 12-char temporary password (no confusing chars like 0/O/l/1)
function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 12; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

export function DemoRequestActions({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [pwdCopied, setPwdCopied] = useState(false);
  const [approval, setApproval] = useState<{
    email: string;
    password: string;
    tenantName: string;
    emailDelivered: boolean;
    emailError?: string;
  } | null>(null);

  function openApprove() {
    setPassword(generatePassword());
    setShowPwd(true);
    setShowApprove(true);
  }

  function regeneratePassword() {
    setPassword(generatePassword());
    setPwdCopied(false);
  }

  function copyPassword() {
    navigator.clipboard.writeText(password);
    setPwdCopied(true);
    setTimeout(() => setPwdCopied(false), 1500);
  }

  function handleApprove() {
    if (password.length < 8) {
      alert("Password must be at least 8 characters");
      return;
    }
    startTransition(async () => {
      try {
        const result = await approveRequestAction(requestId, password);
        setShowApprove(false);
        setApproval(result);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to approve");
      }
    });
  }

  function handleReject(formData: FormData) {
    startTransition(async () => {
      try {
        await rejectRequestAction(requestId, formData.get("reason") as string);
        setShowReject(false);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to reject");
      }
    });
  }

  return (
    <>
      <div className="flex gap-2 shrink-0">
        <Button onClick={openApprove} disabled={pending} size="sm">
          <Check className="h-3.5 w-3.5" />
          Approve
        </Button>
        <Button
          onClick={() => setShowReject(true)}
          disabled={pending}
          variant="outline"
          size="sm"
        >
          <X className="h-3.5 w-3.5" />
          Decline
        </Button>
      </div>

      {/* APPROVE — set password dialog */}
      <Dialog open={showApprove} onOpenChange={setShowApprove}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve & set password</DialogTitle>
            <DialogDescription>
              The user will receive this password by email and will be required to
              change it on their first sign-in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label htmlFor="approve-password" className="text-xs">
                  Temporary password <span className="text-destructive">*</span>
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={regeneratePassword}
                  className="h-7 text-xs"
                >
                  <Sparkles className="h-3 w-3" />
                  Generate
                </Button>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="approve-password"
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPwdCopied(false);
                    }}
                    minLength={8}
                    className="pr-10 font-mono"
                    placeholder="Type or click Generate"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPwd ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyPassword}
                  disabled={!password}
                >
                  {pwdCopied ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Min 8 characters. The user will be forced to change it on first sign-in.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowApprove(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={pending || password.length < 8}>
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Approve & send email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DECLINE dialog */}
      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline request</DialogTitle>
            <DialogDescription>
              Optionally add an internal note explaining why. The applicant won&apos;t see this.
            </DialogDescription>
          </DialogHeader>
          <form action={handleReject} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                name="reason"
                rows={3}
                placeholder="e.g., suspicious email, duplicate request..."
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowReject(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Decline
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* APPROVAL RESULT dialog */}
      <Dialog open={!!approval} onOpenChange={(o) => !o && setApproval(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>✓ Request approved</DialogTitle>
            <DialogDescription>
              Tenant <span className="font-medium">{approval?.tenantName}</span> created.
            </DialogDescription>
          </DialogHeader>
          {approval && (
            <div className="space-y-3">
              {/* Email status */}
              {approval.emailDelivered ? (
                <div className="flex items-start gap-2 rounded-lg border border-success/35 bg-success/5 p-3 text-sm">
                  <Mail className="h-4 w-4 text-success mt-0.5" />
                  <div>
                    <p className="font-medium">Email sent</p>
                    <p className="text-xs text-muted-foreground">
                      Welcome email with password delivered to{" "}
                      <span className="font-mono">{approval.email}</span>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-lg border border-warning/35 bg-warning/5 p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium">Email NOT sent</p>
                    <p className="text-xs text-muted-foreground">
                      {approval.emailError ?? "SMTP not configured."} Send the
                      credentials below manually.
                    </p>
                  </div>
                </div>
              )}

              {/* Credentials backup */}
              <div className="rounded-xl border border-border/60 bg-background/40 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{approval.email}</span>
                </div>
                <div className="flex justify-between border-t border-border/60 pt-2">
                  <span className="text-muted-foreground">Password:</span>
                  <span className="font-mono font-bold">{approval.password}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setApproval(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Reset Button (for approved/declined requests) ──────────

export function ResetRequestButton({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);

  function handleReset() {
    startTransition(async () => {
      try {
        await resetRequestAction(requestId);
        setShowConfirm(false);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to reset");
      }
    });
  }

  return (
    <>
      <Button
        onClick={() => setShowConfirm(true)}
        disabled={pending}
        variant="outline"
        size="sm"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Reset to pending
      </Button>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset this request?</DialogTitle>
            <DialogDescription>
              This moves the request back to <strong>pending</strong> so you can
              re-review it. Any tenant workspace already created stays intact and
              will be reused on re-approval.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={handleReset} disabled={pending}>
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Yes, move to pending
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
