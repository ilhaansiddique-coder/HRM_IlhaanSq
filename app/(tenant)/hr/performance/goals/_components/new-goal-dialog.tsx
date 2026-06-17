"use client";

// "+" new-goal action. Renders the trigger + dialog into the global TopBar
// (portal into #topbar-action-slot) so the button sits just left of the
// notification bell, but only while the host page is mounted. Used on both the
// Performance overview and the Goals page; the inline form was removed from Goals.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Target } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { createGoalAction } from "../../../actions-phase2";

type EmployeeOption = { id: string; fullName: string; empCode: string };
type CycleOption = { id: string; name: string };

export function NewGoalDialog({
  employees,
  cycles,
}: {
  employees: EmployeeOption[];
  cycles: CycleOption[];
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  // Portal target lives in the (client) TopBar; only available after mount.
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const slot = document.getElementById("topbar-action-slot");
  if (!slot) return null;

  return createPortal(
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="New goal"
          title="New goal"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground transition-colors hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="!h-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            New Goal
          </DialogTitle>
        </DialogHeader>
        <form
          action={async (formData) => {
            await createGoalAction(formData);
            setOpen(false);
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Employee *</Label>
            <Select name="employeeId" required>
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.fullName} ({e.empCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select name="type" defaultValue="okr">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="okr">OKR</SelectItem>
                <SelectItem value="kpi">KPI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs">
              Title *
            </Label>
            <Input id="title" name="title" required minLength={2} placeholder="Increase sales by 30%" />
          </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="targetValue" className="text-xs">
                Target
              </Label>
              <Input id="targetValue" name="targetValue" type="number" step="0.01" placeholder="100" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit" className="text-xs">
                Unit
              </Label>
              <Input id="unit" name="unit" placeholder="%, $, units" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cycle (optional)</Label>
              <Select name="cycleId">
                <SelectTrigger>
                  <SelectValue placeholder="No cycle" />
                </SelectTrigger>
                <SelectContent>
                  {cycles.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      No cycles
                    </SelectItem>
                  ) : (
                    cycles.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs">
              Description
            </Label>
            <Textarea id="description" name="description" rows={2} />
          </div>
          <Button type="submit" className="w-full">
            <Plus className="h-4 w-4" />
            Create Goal
          </Button>
        </form>
      </DialogContent>
    </Dialog>,
    slot
  );
}
