"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
import { submitPublicApplication } from "../../actions";

export function ApplyForm({
  jobId,
  tenantId,
  jobTitle,
}: {
  jobId: string;
  tenantId: string;
  jobTitle: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message?: string; error?: string } | null>(null);

  if (result?.ok) {
    return (
      <Card className="border-border/70 bg-card/80">
        <CardContent className="py-10 text-center">
          <CheckCircle2 className="h-12 w-12 text-success animate-in zoom-in mx-auto" />
          <p className="mt-4 text-lg font-semibold">Application Submitted!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Thank you for applying for {jobTitle}. We will review your application and get back to you.
          </p>
        </CardContent>
      </Card>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setResult(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await submitPublicApplication(fd);
      setResult(res);
      if (res.ok) formRef.current?.reset();
    } catch {
      setResult({ ok: false, error: "Something went wrong. Please try again." });
    }
    setPending(false);
  }

  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader>
        <CardTitle className="text-base">Apply for this position</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
          <input type="hidden" name="jobId" value={jobId} />
          <input type="hidden" name="tenantId" value={tenantId} />

          {result?.error && (
            <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {result.error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-xs">Full Name *</Label>
            <Input id="fullName" name="fullName" required minLength={2} placeholder="Your full name" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">Email *</Label>
            <Input id="email" name="email" type="email" required placeholder="you@example.com" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-xs">Phone</Label>
            <Input id="phone" name="phone" type="tel" placeholder="+880 1XXX-XXXXXX" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="currentRole" className="text-xs">Current Role</Label>
              <Input id="currentRole" name="currentRole" placeholder="e.g. Sales Manager" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currentCompany" className="text-xs">Current Company</Label>
              <Input id="currentCompany" name="currentCompany" placeholder="Current employer" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="resumeUrl" className="text-xs">Resume / CV Link</Label>
            <Input id="resumeUrl" name="resumeUrl" type="url" placeholder="https://drive.google.com/your-resume" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="linkedinUrl" className="text-xs">LinkedIn URL</Label>
            <Input id="linkedinUrl" name="linkedinUrl" type="url" placeholder="https://linkedin.com/in/your-profile" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs">Cover Note</Label>
            <Textarea id="notes" name="notes" rows={3} placeholder="Tell us why you are a great fit..." />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {pending ? "Submitting..." : "Submit Application"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
