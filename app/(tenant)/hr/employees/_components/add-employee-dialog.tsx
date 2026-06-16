"use client";

// "+" add-employee action for the Employees page. Renders the trigger + dialog
// into the global TopBar (portal into #topbar-action-slot) so the button sits
// just left of the notification bell, but only while this page is mounted. The
// full employee form lives here — the page no longer links to a separate
// "Add Employee" screen.

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
import { EmployeeForm } from "./employee-form";

export function AddEmployeeDialog({
  departments,
  positions,
  managers,
}: {
  departments: { id: string; name: string }[];
  positions: { id: string; title: string }[];
  managers: { id: string; fullName: string; empCode: string }[];
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
          aria-label="Add employee"
          title="Add employee"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground transition-colors hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add Employee</DialogTitle>
          <DialogDescription>
            Required fields are marked with a red asterisk.
          </DialogDescription>
        </DialogHeader>
        <EmployeeForm
          departments={departments}
          positions={positions}
          managers={managers}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>,
    slot
  );
}
