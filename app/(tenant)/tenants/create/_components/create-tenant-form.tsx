"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Sparkles, Eye, EyeOff, Copy, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { createTenantAction } from "../../actions";

function generatePassword() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let pwd = "";
  for (let i = 0; i < 14; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

export function CreateTenantForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [success, setSuccess] = useState<{
    email: string;
    tenantName: string;
    tenantSlug: string;
    emailDelivered?: boolean;
    emailError?: string;
  } | null>(null);

  function handleGenerate() {
    const newPwd = generatePassword();
    setPassword(newPwd);
    setShowPassword(true);
  }

  function handleCopy() {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    if (!password) {
      setError("Password is required");
      return;
    }
    formData.set("ownerPassword", password);

    startTransition(async () => {
      try {
        const result = await createTenantAction(formData);
        setSuccess(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create tenant");
      }
    });
  }

  return (
    <>
      <form action={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Workspace */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Workspace
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="businessName">
                Business Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="businessName"
                name="businessName"
                required
                minLength={2}
                placeholder="Khan Trading Co."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">
                URL Slug <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="slug"
                name="slug"
                pattern="[a-z0-9-]*"
                placeholder="khan-trading (auto-generated if blank)"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="plan">Billing Plan</Label>
              <Select name="plan" defaultValue="starter">
                <SelectTrigger id="plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter (Free)</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Owner */}
        <div className="space-y-3 pt-3 border-t border-border/60">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Owner Account
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ownerName">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input id="ownerName" name="ownerName" required minLength={2} placeholder="Asif Khan" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownerEmail">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ownerEmail"
                name="ownerEmail"
                type="email"
                required
                placeholder="owner@example.com"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ownerPhone">
                Phone <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input id="ownerPhone" name="ownerPhone" type="tel" placeholder="+8801712345678" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="ownerPassword">
                  Password <span className="text-destructive">*</span>
                </Label>
                <Button type="button" variant="ghost" size="sm" onClick={handleGenerate}>
                  <Sparkles className="h-3 w-3" />
                  Generate
                </Button>
              </div>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="ownerPassword"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Click 'Generate' or type a password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? (
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
                  onClick={handleCopy}
                  disabled={!password}
                >
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum 8 characters. Use Generate for a strong random password.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-border/60">
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating tenant...
              </>
            ) : (
              "Create Tenant & Owner"
            )}
          </Button>
        </div>
      </form>

      {/* Success dialog */}
      <Dialog
        open={!!success}
        onOpenChange={(o) => {
          if (!o) {
            setSuccess(null);
            router.push("/tenants");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>✓ Tenant created</DialogTitle>
            <DialogDescription>
              Workspace <span className="font-medium">{success?.tenantName}</span> is ready.
              {success?.emailDelivered
                ? " The welcome email with credentials has been sent to the owner."
                : " Send the credentials below to the owner manually."}
            </DialogDescription>
          </DialogHeader>
          {success && (
            <div className="space-y-2 rounded-xl border border-success/35 bg-success/5 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Workspace URL:</span>
                <span className="font-mono">rahedeen.app/{success.tenantSlug}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Login email:</span>
                <span className="font-medium">{success.email}</span>
              </div>
              <div className="flex justify-between border-t border-border/60 pt-2 mt-2">
                <span className="text-muted-foreground">Password:</span>
                <span className="font-mono">{password}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border/60 pt-2 mt-2 text-xs">
                <span className="text-muted-foreground">Welcome email:</span>
                {success.emailDelivered ? (
                  <span className="text-success">✓ Delivered</span>
                ) : (
                  <span className="text-warning">
                    Not sent{success.emailError ? ` — ${success.emailError}` : ""}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                ⚠ Copy the password now — it won&apos;t be shown again.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => router.push("/tenants")}>
              Go to Tenants
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
