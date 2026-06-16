"use client";

import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DeleteComponentButton } from "./delete-component-button";
import { EditComponentDialog, type ComponentRow } from "./edit-component-dialog";

function calcLabel(row: ComponentRow): string {
  if (row.calculationType === "fixed")
    return Number(row.value).toLocaleString();
  const base = row.calculationType === "percent_of_basic" ? "basic" : "gross";
  return `${Number(row.value)}% of ${base}`;
}

// Client wrapper rendering a structure's rules through the project-wide
// DataTable. Read-only selection (rules have their own edit/delete dialogs in
// the actions cell). The Basic anchor row is rendered separately by the host.
export function ComponentsDataTable({ rows }: { rows: ComponentRow[] }) {
  const columns: Column<ComponentRow>[] = [
    {
      key: "name",
      header: "Component",
      className: "font-medium",
      cell: (c) => c.name,
    },
    {
      key: "code",
      header: "Code",
      className: "font-mono text-xs",
      cell: (c) => c.code,
    },
    {
      key: "type",
      header: "Type",
      cell: (c) => (
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
      ),
    },
    {
      key: "calc",
      header: "Calculation",
      className: "text-xs capitalize",
      cell: (c) => c.calculationType.replace(/_/g, " "),
    },
    {
      key: "value",
      header: "Value",
      headClassName: "text-right",
      className: "text-right text-sm",
      cell: (c) => calcLabel(c),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(c) => c.id}
      selectable={false}
      itemNoun="rules"
      emptyState={
        <p className="text-xs italic text-muted-foreground">
          No rules yet — earnings fall back to each employee&apos;s own amounts.
          Add the standard allowance rules or a custom rule below.
        </p>
      }
      actionsCell={(c) => (
        <>
          <EditComponentDialog row={c} />
          <DeleteComponentButton componentId={c.id} />
        </>
      )}
    />
  );
}
