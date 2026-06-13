"use client";

// "+" new-advance action for the Advances page. Renders the trigger + dialog
// into the global TopBar (portal into #topbar-action-slot) so the button sits
// just left of the notification bell, but only while this page is mounted. The
// advance form lives ONLY here now — it was removed from the page body.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AdvanceForm } from "./advance-form";

export function AdvanceDialog({
  employees,
}: {
  employees: { id: string; name: string; code: string }[];
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
          aria-label="New advance"
          title="New advance"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/80 text-foreground transition-colors hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Advance</DialogTitle>
          <DialogDescription>Record a salary advance for an employee.</DialogDescription>
        </DialogHeader>
        <AdvanceForm employees={employees} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>,
    slot
  );
}
