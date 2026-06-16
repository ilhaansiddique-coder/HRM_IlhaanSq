"use client";

import { Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { publishCourseAction } from "../../../actions-phase2";

export type CourseRow = {
  id: string;
  title: string;
  category: string;
  level: string;
  duration: string;
  instructor: string;
  moduleCount: number;
  enrollmentCount: number;
  isPublished: boolean;
};

export function CoursesTable({ rows }: { rows: CourseRow[] }) {
  const columns: Column<CourseRow>[] = [
    {
      key: "title",
      header: "Title",
      className: "font-medium",
      cell: (c) => c.title,
    },
    {
      key: "category",
      header: "Category",
      className: "text-muted-foreground",
      cell: (c) => c.category,
    },
    {
      key: "level",
      header: "Level",
      className: "capitalize",
      cell: (c) => c.level,
    },
    {
      key: "duration",
      header: "Duration",
      headClassName: "text-right",
      className: "text-right",
      cell: (c) => c.duration,
    },
    {
      key: "instructor",
      header: "Instructor",
      className: "text-muted-foreground",
      cell: (c) => c.instructor,
    },
    {
      key: "modules",
      header: "Modules",
      headClassName: "text-right",
      className: "text-right",
      cell: (c) => c.moduleCount,
    },
    {
      key: "enrollments",
      header: "Enrollments",
      headClassName: "text-right",
      className: "text-right",
      cell: (c) => c.enrollmentCount,
    },
    {
      key: "status",
      header: "Status",
      cell: (c) =>
        c.isPublished ? (
          <Badge variant="default" className="text-[10px]">Published</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">Draft</Badge>
        ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(c) => c.id}
      selectable={false}
      itemNoun="courses"
      actionsCell={(c) => (
        <form action={publishCourseAction} className="inline">
          <input type="hidden" name="id" value={c.id} />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            title={c.isPublished ? "Unpublish" : "Publish"}
            aria-label={c.isPublished ? "Unpublish course" : "Publish course"}
          >
            {c.isPublished ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </Button>
        </form>
      )}
    />
  );
}
