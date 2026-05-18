import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddComponentForm } from "./add-component-form";
import { DeleteComponentButton } from "./delete-component-button";
import { EditComponentDialog, type ComponentRow } from "./edit-component-dialog";
import { SeedAllowancesButton } from "./seed-allowances-button";

// The 5 allowance slots that drive payslip earnings (must match
// ALLOWANCE_SLOTS in payroll.service.ts).
const ALLOWANCE_CODES = ["HRENT", "HEALTH", "EDU", "SAV", "DHEXP"];

function calcLabel(row: ComponentRow): string {
  if (row.calculationType === "fixed")
    return Number(row.value).toLocaleString();
  const base = row.calculationType === "percent_of_basic" ? "basic" : "gross";
  return `${Number(row.value)}% of ${base}`;
}

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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Component</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Calculation</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead className="w-[80px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Basic anchor — not a structure rule */}
          <TableRow className="bg-muted/30">
            <TableCell className="font-medium">Basic Salary</TableCell>
            <TableCell className="font-mono text-xs">BASIC</TableCell>
            <TableCell>
              <Badge variant="default" className="text-[10px]">
                earning
              </Badge>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              Per employee (anchor)
            </TableCell>
            <TableCell className="text-right text-xs text-muted-foreground">
              set on employee
            </TableCell>
            <TableCell className="text-right text-xs text-muted-foreground">
              —
            </TableCell>
          </TableRow>

          {components.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="py-4 text-center text-xs italic text-muted-foreground"
              >
                No rules yet — earnings fall back to each employee&apos;s own
                amounts. Add the standard allowance rules or a custom rule
                below.
              </TableCell>
            </TableRow>
          ) : (
            components.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="font-mono text-xs">{c.code}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      c.type === "earning"
                        ? "default"
                        : c.type === "reimbursement"
                          ? "secondary"
                          : "destructive"
                    }
                    className="text-[10px] capitalize"
                  >
                    {c.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs capitalize">
                  {c.calculationType.replace(/_/g, " ")}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {calcLabel(c)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <EditComponentDialog row={c} />
                    <DeleteComponentButton componentId={c.id} />
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

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