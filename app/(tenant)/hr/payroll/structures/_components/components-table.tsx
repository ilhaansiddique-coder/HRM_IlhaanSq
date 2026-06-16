import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AddComponentForm } from "./add-component-form";
import { ComponentsDataTable } from "./components-data-table";
import { type ComponentRow } from "./edit-component-dialog";
import { SeedAllowancesButton } from "./seed-allowances-button";

// The 5 allowance slots that drive payslip earnings (must match
// ALLOWANCE_SLOTS in payroll.service.ts).
const ALLOWANCE_CODES = ["HRENT", "HEALTH", "EDU", "SAV", "DHEXP"];

// Editable table of a structure's rules + the per-employee Basic anchor.
// Server component — renders client children for the interactive bits.
export function ComponentsTable({
  structureId,
  components,
}: {
  structureId: string;
  components: ComponentRow[];
}) {
  const earningCodes = new Set(
    components.filter((c) => c.type === "earning").map((c) => c.code)
  );
  const missingAllowances = ALLOWANCE_CODES.filter(
    (c) => !earningCodes.has(c)
  );

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600" />
        <p className="text-muted-foreground">
          These rules drive the salary sheet for{" "}
          <strong>future payroll runs only</strong>. An earning rule
          overrides every assigned employee&apos;s own amount for that slot;
          a slot with no rule falls back to the per-employee amount.{" "}
          <strong>Basic</strong> is always per-employee.
        </p>
      </div>

      {/* Basic anchor — not a structure rule, so it sits above the rules table */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-medium">Basic Salary</span>
          <span className="font-mono text-muted-foreground">BASIC</span>
          <Badge variant="default" className="text-[10px]">
            earning
          </Badge>
        </div>
        <span className="text-muted-foreground">
          Per employee (anchor) · set on employee
        </span>
      </div>

      <ComponentsDataTable rows={components} />

      {missingAllowances.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            {missingAllowances.length} standard allowance rule
            {missingAllowances.length !== 1 ? "s" : ""} not added yet (
            {missingAllowances.join(", ")}).
          </p>
          <SeedAllowancesButton structureId={structureId} />
        </div>
      )}

      <div className="border-t border-border/60 pt-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Add a rule
        </p>
        <AddComponentForm structureId={structureId} />
      </div>
    </div>
  );
}