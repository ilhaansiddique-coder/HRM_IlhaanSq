"use client";

// Run-payroll launcher + a WIDE dialog hosting the Run Payroll workflow
// (per-employee adjustments table). Two render modes:
//   • "topbar"  (default) — a "+" button portaled into the global TopBar
//     (#topbar-action-slot), sitting just left of the notification bell.
//   • "inline"  — a labelled "Run Payroll" button rendered in the page body,
//     for a prominent launcher on the Payroll Overview.
// The form navigates back to the Payroll Overview on success, closing the dialog.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  variant = "topbar",
}: {
  hasStructure: boolean;
  hasSalary: boolean;
  prep: PrepRow[];
  variant?: "topbar" | "inline";
}) {
  const disabled = !hasStructure || !hasSalary;
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "inline" ? (
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Run Payroll
          </Button>
        ) : (
          <button
            type="button"
            aria-label="Run payroll"
            title="Run payroll"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground transition-colors hover:bg-muted"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
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
                  <span className="text-primary underline">
                    use the Assign Salary form on this page
                  </span>
                </>
              )}
            </p>
          </div>
        )}
        <RunPayrollForm disabled={disabled} prep={prep} />
      </DialogContent>
    </Dialog>
  );

  // Inline launcher renders straight into the page body.
  if (variant === "inline") return dialog;

  // Topbar launcher portals into the global action slot once mounted.
  if (!mounted) return null;
  const slot = document.getElementById("topbar-action-slot");
  if (!slot) return null;
  return createPortal(dialog, slot);
}
