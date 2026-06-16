"use client";

// "+" submit-leave-request action for the Leave page. Renders the trigger +
// dialog into the global TopBar (portal into #topbar-action-slot) so the button
// sits just left of the notification bell, but only while this page is mounted.
// The request form lives ONLY here now — it was removed from the page body.

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
import { LeaveRequestForm } from "./leave-request-form";

export function SubmitLeaveDialog({
  employees,
  types,
  isAdmin = true,
  selfEmployee = null,
}: {
  employees: { id: string; name: string; code: string }[];
  types: { id: string; name: string; code: string }[];
  // Admins pick any employee; employees file for themselves only.
  isAdmin?: boolean;
  selfEmployee?: { id: string; name: string; code: string } | null;
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
          aria-label="Submit leave request"
          title="Submit leave request"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground transition-colors hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Submit Leave Request</DialogTitle>
          <DialogDescription>
            {isAdmin
              ? "Apply for leave on behalf of an employee."
              : "Apply for your own leave."}
          </DialogDescription>
        </DialogHeader>
        <LeaveRequestForm
          employees={employees}
          types={types}
          isAdmin={isAdmin}
          selfEmployee={selfEmployee}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>,
    slot
  );
}
