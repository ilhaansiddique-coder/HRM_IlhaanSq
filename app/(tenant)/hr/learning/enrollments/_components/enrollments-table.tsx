"use client";

import { Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/ui/data-table";
import { updateProgressAction } from "../../../actions-phase2";

const statusColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  enrolled: "outline",
  in_progress: "secondary",
  completed: "default",
  dropped: "destructive",
};

export type EnrollmentRow = {
  id: string;
  employeeName: string;
  courseTitle: string;
  status: string;
  progress: number;
  certificateNumber: string | null;
};

export function EnrollmentsTable({ rows }: { rows: EnrollmentRow[] }) {
  const columns: Column<EnrollmentRow>[] = [
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
      key: "status",
      header: "Status",
      cell: (e) => (
        <Badge variant={statusColors[e.status]} className="text-[10px] capitalize">
          {e.status.replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "progress",
      header: "Progress",
      headClassName: "w-[220px]",
      cell: (e) => (
        <div className="flex items-center gap-2">
          <div className="h-2 w-28 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${e.progress}%` }} />
          </div>
          <span className="text-xs font-medium tabular-nums">{e.progress}%</span>
        </div>
      ),
    },
    {
      key: "certificate",
      header: "Certificate",
      cell: (e) =>
        e.certificateNumber ? (
          <span className="text-xs text-success flex items-center gap-1">
            <Award className="h-3 w-3" />
            {e.certificateNumber}
          </span>
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
      actionsCell={(e) =>
        e.status !== "completed" ? (
          <form action={updateProgressAction} className="flex items-center justify-end gap-2">
            <input type="hidden" name="id" value={e.id} />
            <Input
              name="progress"
              type="number"
              min="0"
              max="100"
              defaultValue={e.progress}
              aria-label="Update progress (%)"
              className="h-8 w-20"
            />
            <Button type="submit" size="sm">Update</Button>
          </form>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      }
    />
  );
}
