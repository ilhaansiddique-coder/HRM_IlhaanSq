"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { submitDemoRequestAction } from "../actions";

const BUSINESS_TYPES = [
  { value: "wholesale", label: "Wholesale" },
  { value: "retail", label: "Retail" },
  { value: "distribution", label: "Distribution" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "other", label: "Other" },
];

const PLANS = [
  { value: "starter", label: "Starter (Free)" },
  { value: "professional", label: "Professional" },
  { value: "enterprise", label: "Enterprise" },
];

export function RequestDemoForm() {
  const searchParams = useSearchParams();
  const planFromUrl = searchParams.get("plan") ?? "starter";
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await submitDemoRequestAction(formData);
        setSuccess(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to submit request");
      }
    });
  }

  if (success) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Request submitted</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Thanks! We&apos;ll review your request and email you within 24 hours with
          login details.
        </p>
        <Link href="/" className="inline-block">
          <Button variant="outline">Back to home</Button>
        </Link>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">
            Full Name <span className="text-destructive">*</span>
          </Label>
          <Input id="fullName" name="fullName" required minLength={2} placeholder="Asif Khan" />
        </div>
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
          <Label htmlFor="email">
            Work Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@business.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">
            Phone <span className="text-destructive">*</span>
          </Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            required
            minLength={5}
            placeholder="+8801712345678"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="businessType">
            Business Type <span className="text-destructive">*</span>
          </Label>
          <Select name="businessType" defaultValue="wholesale" required>
            <SelectTrigger id="businessType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="requestedPlan">Plan</Label>
          <Select name="requestedPlan" defaultValue={planFromUrl}>
            <SelectTrigger id="requestedPlan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLANS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="requestedSlug">
            Preferred URL <span className="text-muted-foreground">(optional)</span>
          </Label>
          <div className="flex">
            <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-input bg-muted text-sm text-muted-foreground">
              rahedeen.app/
            </span>
            <Input
              id="requestedSlug"
              name="requestedSlug"
              placeholder="khan-trading"
              className="rounded-l-none"
              pattern="[a-z0-9-]*"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Lowercase letters, numbers and hyphens only. We&apos;ll suggest one if you
            leave it blank.
          </p>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="message">
            Message <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="message"
            name="message"
            rows={3}
            placeholder="Tell us about your business or any specific requirements..."
          />
        </div>
      </div>

      <Button type="submit" className="w-full h-11" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            Submit request
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        By submitting, you agree to be contacted by our team for review purposes.
      </p>
    </form>
  );
}
