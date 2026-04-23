"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { runPayrollAction } from "../../../../actions-phase2";

export function RunPayrollForm({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await runPayrollAction(formData);
        router.push("/hr/payroll/runs");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      {error && <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-xs">Period name *</Label>
        <Input id="name" name="name" required defaultValue={`${today.toLocaleString("default", { month: "long" })} ${today.getFullYear()}`} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="periodStart" className="text-xs">From</Label>
          <Input id="periodStart" name="periodStart" type="date" required defaultValue={monthStart.toISOString().slice(0, 10)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="periodEnd" className="text-xs">To</Label>
          <Input id="periodEnd" name="periodEnd" type="date" required defaultValue={monthEnd.toISOString().slice(0, 10)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="payDate" className="text-xs">Pay date</Label>
        <Input id="payDate" name="payDate" type="date" required defaultValue={monthEnd.toISOString().slice(0, 10)} />
      </div>
      <Button type="submit" className="w-full" disabled={pending || disabled}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Process Payroll Run
      </Button>
      {disabled && <p className="text-xs text-muted-foreground text-center">Setup required first ↑</p>}
    </form>
  );
}
