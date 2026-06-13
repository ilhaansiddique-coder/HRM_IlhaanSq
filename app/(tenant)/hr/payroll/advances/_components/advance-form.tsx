"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Loader2, CheckCircle2 } from "lucide-react";
import { createAdvanceAction } from "../../../actions-phase2";
import { RecoveryWindowField } from "./recovery-window-field";

export function AdvanceForm({
  employees,
  onSuccess,
}: {
  employees: { id: string; name: string; code: string }[];
  // Optional: called after a successful submit (e.g. to close a host dialog).
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        await createAdvanceAction(formData);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
        (document.getElementById("advance-form") as HTMLFormElement)?.reset();
        router.refresh();
        onSuccess?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <form id="advance-form" action={handleSubmit} className="space-y-3">
      {error && (
        <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-success/35 bg-success/10 px-3 py-2 text-xs text-success flex items-center gap-2">
          <CheckCircle2 className="h-3 w-3" />
          Advance recorded
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs">Employee *</Label>
        <Select name="employeeId" required>
          <SelectTrigger><SelectValue placeholder="Select employee..." /></SelectTrigger>
          <SelectContent>
            {employees.length === 0 ? (
              <SelectItem value="_none" disabled>No employees</SelectItem>
            ) : (
              employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name} ({e.code})
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="amount" className="text-xs">Advance amount *</Label>
          <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="installment" className="text-xs">Monthly recovery</Label>
          <Input
            id="installment"
            name="installment"
            type="number"
            step="0.01"
            min="0"
            placeholder="Leave blank — set later"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Or recover over a period (calendar)</Label>
        <RecoveryWindowField />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="issuedAt" className="text-xs">Issued on</Label>
        <Input
          id="issuedAt"
          name="issuedAt"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reason" className="text-xs">Reason</Label>
        <Textarea id="reason" name="reason" rows={2} placeholder="Optional" />
      </div>
      <Button
        type="submit"
        className="w-full"
        disabled={pending || employees.length === 0}
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Record Advance
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Both recovery options are optional. Set a fixed{" "}
        <strong>Monthly recovery</strong>, OR pick a{" "}
        <strong>recovery period</strong> on the calendar (installment = amount ÷
        months in that range, and recovery only runs within those months). With
        neither, nothing is recovered until set via the Edit pencil; with no
        period, recovery defaults to starting the month after the issue date.
      </p>
    </form>
  );
}
