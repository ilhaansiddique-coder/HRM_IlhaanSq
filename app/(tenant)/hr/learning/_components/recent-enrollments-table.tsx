"use client";

import { Award } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";

export type RecentEnrollmentRow = {
  id: string;
  employeeName: string;
  courseTitle: string;
  progress: number;
  hasCertificate: boolean;
};

export function RecentEnrollmentsTable({ rows }: { rows: RecentEnrollmentRow[] }) {
  const columns: Column<RecentEnrollmentRow>[] = [
    {
      key: "employee",
      header: "Employee",
      className: "font-medium",
      cell: (e) => e.employeeName,
    },
    {
      key: "course",
      header: "Course",
      className: "text-muted-foreground",
      cell: (e) => e.courseTitle,
    },
    {
      key: "progress",
      header: "Progress",
      headClassName: "w-[220px]",
      cell: (e) => (
        <div className="flex items-center gap-2">
          <div className="h-2 w-28 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${e.progress}%` }} />
          </div>
          <span className="text-xs font-medium tabular-nums">{e.progress}%</span>
        </div>
      ),
    },
    {
      key: "certificate",
      header: "Certificate",
      cell: (e) =>
        e.hasCertificate ? (
          <Award className="h-4 w-4 text-success" />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(e) => e.id}
      selectable={false}
      itemNoun="enrollments"
    />
  );
}