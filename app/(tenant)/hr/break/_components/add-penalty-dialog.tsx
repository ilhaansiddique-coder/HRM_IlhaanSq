"use client";

// "+" add-penalty action for the Break Time page. Renders the trigger + dialog
// into the global TopBar (portal into #topbar-action-slot) so the button sits
// just left of the notification bell, but only while this page is mounted. The
// penalty form lives ONLY here now — it was removed from the page body.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PenaltyForm } from "./penalty-form";

export function AddPenaltyDialog({
  employees,
  breakSessions,
  thresholdMin,
}: {
  employees: { id: string; name: string; code: string }[];
  breakSessions: { id: string; employeeId: string; breakStart: string; durationMin: number }[];
  thresholdMin: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const slot = document.getElementById("topbar-action-slot");
  if (!slot) return null;

  return createPortal(
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Add penalty"
          title="Add penalty"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground transition-colors hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="!h-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Add Penalty
          </DialogTitle>
          <DialogDescription>
            Penalize an employee for exceeding break time (threshold: {thresholdMin} min).
          </DialogDescription>
        </DialogHeader>
        <PenaltyForm
          employees={employees}
          breakSessions={breakSessions}
          thresholdMin={thresholdMin}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>,
    slot
  );
}
