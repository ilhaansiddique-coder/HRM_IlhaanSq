"use client";

import { useState, useTransition } from "react";
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
import { Plus, Loader2 } from "lucide-react";
import { createLeaveRequestAction } from "../../actions";

export function LeaveRequestForm({
  employees,
  types,
  isAdmin = true,
  selfEmployee = null,
  onSuccess,
}: {
  employees: { id: string; name: string; code: string }[];
  types: { id: string; name: string; code: string }[];
  // Admins pick any employee from the dropdown. Employees file for themselves:
  // the picker is replaced by a fixed, read-only display of their own record.
  isAdmin?: boolean;
  selfEmployee?: { id: string; name: string; code: string } | null;
  // Optional: called after a successful submit (e.g. to close a host dialog).
  onSuccess?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // A non-admin with no linked employee record can't file leave — there's no
  // employee to attach the request to.
  const unlinked = !isAdmin && !selfEmployee;

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createLeaveRequestAction(formData);
        (document.getElementById("leave-request-form") as HTMLFormElement)?.reset();
        onSuccess?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to submit");
      }
    });
  }

  return (
    <form id="leave-request-form" action={handleSubmit} className="space-y-3">
      {error && (
        <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
      {unlinked ? (
        <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Your account isn&apos;t linked to an employee record, so a leave request
          can&apos;t be filed. Ask an admin to link your account to an employee
          profile.
        </div>
      ) : isAdmin ? (
        <div className="space-y-1.5">
          <Label htmlFor="employeeId" className="text-xs">
            Employee <span className="text-destructive">*</span>
          </Label>
          <Select name="employeeId" required>
            <SelectTrigger>
              <SelectValue placeholder="Select employee..." />
            </SelectTrigger>
            <SelectContent>
              {employees.length === 0 ? (
                <SelectItem value="_none" disabled>No employees</SelectItem>
              ) : (
                employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name} ({e.code})</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      ) : (
        // Employee view — the request is fixed to their own record.
        <div className="space-y-1.5">
          <Label className="text-xs">Employee</Label>
          <input type="hidden" name="employeeId" value={selfEmployee!.id} />
          <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm">
            {selfEmployee!.name}{" "}
            <span className="text-muted-foreground">({selfEmployee!.code})</span>
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="leaveTypeId" className="text-xs">
          Leave Type <span className="text-destructive">*</span>
        </Label>
        <Select name="leaveTypeId" required>
          <SelectTrigger>
            <SelectValue placeholder="Select type..." />
          </SelectTrigger>
          <SelectContent>
            {types.length === 0 ? (
              <SelectItem value="_none" disabled>No leave types — create one first</SelectItem>
            ) : (
              types.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="startDate" className="text-xs">From</Label>
          <Input id="startDate" name="startDate" type="date" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate" className="text-xs">To</Label>
          <Input id="endDate" name="endDate" type="date" required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reason" className="text-xs">Reason</Label>
        <Textarea id="reason" name="reason" rows={2} placeholder="Optional..." />
      </div>
      <Button type="submit" className="w-full" disabled={pending || unlinked}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Submit Request
      </Button>
    </form>
  );
}
