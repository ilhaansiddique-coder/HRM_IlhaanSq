"use client";

// "+" run-payroll action. Renders the trigger + a WIDE dialog into the global
// TopBar (portal into #topbar-action-slot) so the button sits just left of the
// notification bell, but only while the host page is mounted. The Run Payroll
// workflow (per-employee adjustments table) lives here now — it was removed
// from the /hr/payroll/runs/new page body. The form navigates to the runs list
// on success, which closes the dialog.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RunPayrollForm, type PrepRow } from "../runs/new/_components/run-payroll-form";

export function RunPayrollDialog({
  hasStructure,
  hasSalary,
  prep,
}: {
  hasStructure: boolean;
  hasSalary: boolean;
  prep: PrepRow[];
}) {
  const disabled = !hasStructure || !hasSalary;
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
          aria-label="Run payroll"
          title="Run payroll"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/80 text-foreground transition-colors hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Run Payroll</DialogTitle>
          <DialogDescription>
            Calculates payslips for all active employees — gross, absence,
            advance, payable &amp; paid.
          </DialogDescription>
        </DialogHeader>
        {disabled && (
          <div className="space-y-1.5 rounded-lg border border-warning/35 bg-warning/5 px-3 py-2 text-xs">
            <p className="font-medium text-foreground">
              Two things are needed before you can run payroll:
            </p>
            <p className={hasStructure ? "text-success" : "text-muted-foreground"}>
              {hasStructure ? "✓" : "①"} A salary structure
              {!hasStructure && (
                <>
                  {" — "}
                  <Link href="/settings" className="text-primary underline">
                    create one in Settings → Salary Structure
                  </Link>
                </>
              )}
            </p>
            <p className={hasSalary ? "text-success" : "text-muted-foreground"}>
              {hasSalary ? "✓" : "②"} At least one employee with a salary assigned
              {!hasSalary && (
                <>
                  {" — "}
                  <Link href="/hr/payroll/runs/new" className="text-primary underline">
                    assign a salary
                  </Link>
                </>
              )}
            </p>
          </div>
        )}
        <RunPayrollForm disabled={disabled} prep={prep} />
      </DialogContent>
    </Dialog>,
    slot
  );
}
