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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertTriangle } from "lucide-react";
import { createBreakPenaltyAction } from "../../actions";

export function PenaltyForm({
  employees,
  breakSessions,
  thresholdMin,
  onSuccess,
}: {
  employees: { id: string; name: string; code: string }[];
  breakSessions: { id: string; employeeId: string; employee?: { fullName: string }; breakStart: string; durationMin: number }[];
  thresholdMin: number;
  onSuccess?: () => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [breakSessionId, setBreakSessionId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const eligibleSessions = breakSessions.filter(
    (s) => s.employeeId === employeeId && s.durationMin > thresholdMin
  );

  function handleSubmit() {
    if (!employeeId || !amount || !reason) return;
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("employeeId", employeeId);
        if (breakSessionId) fd.set("breakSessionId", breakSessionId);
        fd.set("amount", amount);
        fd.set("reason", reason);
        const exceeded = breakSessionId
          ? eligibleSessions.find((s) => s.id === breakSessionId)?.durationMin ?? 0
          : 0;
        fd.set("exceededMinutes", String(Math.round(exceeded - thresholdMin)));
        await createBreakPenaltyAction(fd);
        setEmployeeId("");
        setBreakSessionId("");
        setAmount("");
        setReason("");
        onSuccess?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create penalty");
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
      {/* Employee + Break Session + Penalty Amount share one row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Employee</Label>
          <Select value={employeeId} onValueChange={(v) => { setEmployeeId(v); setBreakSessionId(""); }}>
            <SelectTrigger>
              <SelectValue placeholder="Select employee..." />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name} ({e.code})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Break Session (optional)</Label>
          <Select value={breakSessionId} onValueChange={setBreakSessionId} disabled={!employeeId}>
            <SelectTrigger>
              <SelectValue placeholder="Select exceeded break..." />
            </SelectTrigger>
            <SelectContent>
              {eligibleSessions.length === 0 ? (
                <SelectItem value="_none" disabled>No exceeded breaks</SelectItem>
              ) : (
                eligibleSessions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {new Date(s.breakStart).toLocaleDateString()} — {s.durationMin} min
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Penalty Amount (BDT)</Label>
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="e.g. 500"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Reason</Label>
        <Textarea
          placeholder="Explain why this penalty is being applied..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
        />
      </div>
      <Button
        onClick={handleSubmit}
        disabled={!employeeId || !amount || !reason || pending}
        className="ml-auto flex w-[200px] max-w-full"
        variant="destructive"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
        Add Penalty
      </Button>
    </div>
  );
}
