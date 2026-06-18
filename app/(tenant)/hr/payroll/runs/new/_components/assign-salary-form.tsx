"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2 } from "lucide-react";
import { assignSalaryAction } from "../../../../actions-phase2";

export function AssignSalaryForm({
  employees,
  structures,
}: {
  employees: { id: string; name: string; code: string }[];
  structures: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        await assignSalaryAction(formData);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
        (document.getElementById("assign-salary-form") as HTMLFormElement)?.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <form id="assign-salary-form" action={handleSubmit} className="space-y-3">
      {error && <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
      {success && <div className="rounded-lg border border-success/35 bg-success/10 px-3 py-2 text-xs text-success flex items-center gap-2"><CheckCircle2 className="h-3 w-3" />Salary assigned</div>}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Employee *</Label>
          <Select name="employeeId" required>
            <SelectTrigger><SelectValue placeholder="Select employee..." /></SelectTrigger>
            <SelectContent>
              {employees.length === 0 ? <SelectItem value="_none" disabled>No employees</SelectItem> : employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name} ({e.code})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Salary Structure *</Label>
          <Select name="structureId" required>
            <SelectTrigger><SelectValue placeholder="Select structure..." /></SelectTrigger>
            <SelectContent>
              {structures.length === 0 ? <SelectItem value="_none" disabled>No structures</SelectItem> : structures.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="baseSalary" className="text-xs">Base Salary *</Label>
          <Input id="baseSalary" name="baseSalary" type="number" step="0.01" min="0" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency" className="text-xs">Currency</Label>
          <Input id="currency" name="currency" defaultValue="BDT" />
        </div>
      </div>
      <div className="rounded-lg border border-border/60 p-2.5 space-y-2">
        <p className="text-[11px] text-muted-foreground">
          Allowance breakdown (per employee). Gross = Basic + these five.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="houseRent" className="text-xs">House Rent</Label>
            <Input id="houseRent" name="houseRent" type="number" step="0.01" min="0" defaultValue="0" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="health" className="text-xs">Health</Label>
            <Input id="health" name="health" type="number" step="0.01" min="0" defaultValue="0" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="education" className="text-xs">Education</Label>
            <Input id="education" name="education" type="number" step="0.01" min="0" defaultValue="0" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="savings" className="text-xs">Savings</Label>
            <Input id="savings" name="savings" type="number" step="0.01" min="0" defaultValue="0" />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="dailyHand" className="text-xs">Daily Hand Expenses</Label>
            <Input id="dailyHand" name="dailyHand" type="number" step="0.01" min="0" defaultValue="0" />
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="effectiveFrom" className="text-xs">Effective From</Label>
        <DatePicker
          id="effectiveFrom"
          name="effectiveFrom"
          required
          defaultValue={new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            .toLocaleDateString("en-CA")}
          placeholder="Select date"
          showPresets
        />
        <p className="text-[11px] text-muted-foreground">
          Use the 1st of the month (or earlier) — payroll only includes salaries
          effective on/before the period start.
        </p>
      </div>
      <Button type="submit" className="w-full" disabled={pending || employees.length === 0 || structures.length === 0}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Assign Salary
      </Button>
    </form>
  );
}
