"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PositionRowActions, type PositionRow } from "./position-row-actions";
import { deletePositionAction } from "../../actions";

export function PositionsTable({
  rows,
  departments,
}: {
  rows: PositionRow[];
  departments: { id: string; name: string }[];
}) {
  const router = useRouter();
  const deptName = (id: string | null) =>
    id ? departments.find((d) => d.id === id)?.name ?? null : null;

  const columns: Column<PositionRow>[] = [
    {
      key: "title",
      header: "Title",
      className: "font-medium",
      cell: (p) => (
        <span>
          {p.title}
          {p.isManager && (
            <Badge variant="secondary" className="ml-2 text-[10px]">
              Manager
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: "department",
      header: "Department",
      className: "text-sm",
      cell: (p) =>
        deptName(p.departmentId) ?? (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "grade",
      header: "Salary Grade",
      className: "text-xs text-muted-foreground",
      cell: (p) => p.grade ?? "—",
    },
    {
      key: "holders",
      header: "Holders",
      headClassName: "text-right",
      className: "text-right",
      cell: (p) => <Badge variant="outline">{p.employeeCount}</Badge>,
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(p) => p.id}
      itemNoun="positions"
      actionsCell={(p) => (
        <PositionRowActions departments={departments} position={p} />
      )}
      onBulkDelete={async (ids) => {
        await Promise.all(
          ids.map((id) => {
            const fd = new FormData();
            fd.set("id", id);
            return deletePositionAction(fd);
          })
        );
        router.refresh();
      }}
    />
  );
}
