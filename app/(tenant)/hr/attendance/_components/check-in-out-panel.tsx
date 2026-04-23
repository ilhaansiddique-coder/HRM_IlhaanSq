"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogIn, LogOut, Loader2 } from "lucide-react";
import { checkInAction, checkOutAction } from "../../actions";

export function CheckInOutPanel({
  employees,
}: {
  employees: { id: string; name: string; code: string }[];
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCheckIn() {
    if (!employeeId) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("employeeId", employeeId);
      try {
        await checkInAction(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  function handleCheckOut() {
    if (!employeeId) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("employeeId", employeeId);
      try {
        await checkOutAction(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs">Employee</Label>
        <Select value={employeeId} onValueChange={setEmployeeId}>
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
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={handleCheckIn} disabled={!employeeId || pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          Check In
        </Button>
        <Button onClick={handleCheckOut} disabled={!employeeId || pending} variant="outline">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Check Out
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Records use the current time and today&apos;s date.
      </p>
    </div>
  );
}
