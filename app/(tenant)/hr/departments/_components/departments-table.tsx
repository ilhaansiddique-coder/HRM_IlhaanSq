"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DepartmentRowActions, type DepartmentRow } from "./department-row-actions";
import { deleteDepartmentAction } from "../../actions";

export function DepartmentsTable({ rows }: { rows: DepartmentRow[] }) {
  const router = useRouter();

  const columns: Column<DepartmentRow>[] = [
    { key: "name", header: "Name", className: "font-medium", cell: (d) => d.name },
    {
      key: "description",
      header: "Description",
      className: "max-w-[420px] truncate text-xs text-muted-foreground",
      cell: (d) => d.description ?? "—",
    },
    {
      key: "employees",
      header: "Employees",
      headClassName: "text-right",
      className: "text-right",
      cell: (d) => <Badge variant="outline">{d.employeeCount}</Badge>,
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(d) => d.id}
      itemNoun="departments"
      actionsCell={(d) => <DepartmentRowActions department={d} />}
      onBulkDelete={async (ids) => {
        await Promise.all(
          ids.map((id) => {
            const fd = new FormData();
            fd.set("id", id);
            return deleteDepartmentAction(fd);
          })
        );
        router.refresh();
      }}
    />
  );
}
