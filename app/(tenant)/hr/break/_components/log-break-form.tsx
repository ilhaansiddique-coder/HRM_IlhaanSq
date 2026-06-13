"use client";

// Manual break entry — record a break "from this time to that time" instead of
// the live Start/End flow. Reusable in two modes:
//   • employees prop  → admin picks any employee (shows a Select)
//   • employeeId prop → an employee logs their own past break (no Select)
// Combines the chosen date + start/end times into local Date objects and
// submits them to logBreakAction, which stores a completed session.

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
import { Loader2, Clock, Truck, User } from "lucide-react";
import { logBreakAction } from "../../actions";
import { useRouter } from "next/navigation";

export function LogBreakForm({
  employees,
  employeeId: fixedEmployeeId,
  onSuccess,
}: {
  employees?: { id: string; name: string; code: string }[];
  employeeId?: string;
  onSuccess?: () => void;
}) {
  const [employeeId, setEmployeeId] = useState(fixedEmployeeId ?? "");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const isDuty = /courier/i.test(note);

  // Live preview of the computed duration so the user sees the window length.
  let previewMin: number | null = null;
  if (date && startTime && endTime) {
    const s = new Date(`${date}T${startTime}`).getTime();
    const e = new Date(`${date}T${endTime}`).getTime();
    if (!isNaN(s) && !isNaN(e) && e > s) previewMin = Math.round((e - s) / 60000);
  }

  function handleSubmit() {
    setError(null);
    if (!employeeId) return setError("Please select an employee.");
    if (!date) return setError("Please choose the break date.");
    if (!startTime) return setError("Please enter the break start time.");
    if (!endTime) return setError("Please enter the break end time.");
    if (!note.trim()) return setError("Please enter a reason for the break.");

    const breakStart = new Date(`${date}T${startTime}`);
    const breakEnd = new Date(`${date}T${endTime}`);
    if (isNaN(breakStart.getTime()) || isNaN(breakEnd.getTime())) {
      return setError("Please enter valid start and end times.");
    }
    if (breakEnd.getTime() <= breakStart.getTime()) {
      return setError("Break end time must be after the start time.");
    }

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("employeeId", employeeId);
        fd.set("breakStart", breakStart.toISOString());
        fd.set("breakEnd", breakEnd.toISOString());
        fd.set("note", note);
        await logBreakAction(fd);
        setDate("");
        setStartTime("");
        setEndTime("");
        setNote("");
        if (!fixedEmployeeId) setEmployeeId("");
        router.refresh();
        onSuccess?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to log break");
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {employees && (
        <div className="space-y-1.5">
          <Label className="text-xs">Employee</Label>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger>
              <SelectValue placeholder="Select employee..." />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name} ({e.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Date</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">From (start time)</Label>
          <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">To (end time)</Label>
          <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>

      {previewMin !== null && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Duration: <span className="font-medium text-foreground">{previewMin} min</span>
        </p>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Reason for taking break</Label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="e.g. Deliver parcel to courier office"
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {isDuty ? <Truck className="h-3 w-3" /> : <User className="h-3 w-3" />}
          {isDuty
            ? "Courier — counts as working/duty time."
            : "Mention courier if it's a work errand; otherwise it's an out-of-duty break."}
        </p>
      </div>

      <Button onClick={handleSubmit} disabled={pending} className="w-full">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
        Log Break
      </Button>
    </div>
  );
}
