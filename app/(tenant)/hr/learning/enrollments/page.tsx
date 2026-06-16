import { requireTenant } from "@/lib/auth";
import { listEnrollments, listCourses } from "@/lib/services/hr/learning.service";
import { listEmployees } from "@/lib/services/hr/employee.service";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Award, GraduationCap } from "lucide-react";
import { updateProgressAction } from "../../actions-phase2";
import { EnrollEmployeeDialog } from "./_components/enroll-employee-dialog";
import { EnrollmentsTable, type EnrollmentRow } from "./_components/enrollments-table";

const statusColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  enrolled: "outline",
  in_progress: "secondary",
  completed: "default",
  dropped: "destructive",
};

export default async function EnrollmentsPage() {
  const session = await requireTenant();
  const [enrollments, courses, employees] = await Promise.all([
    listEnrollments(session.tenantId),
    listCourses(session.tenantId),
    listEmployees(session.tenantId, { status: "active" }),
  ]);

  const publishedCourses = courses.filter((c) => c.isPublished);

  // Plain, serializable rows for the client DataTable.
  const rows: EnrollmentRow[] = enrollments.map((e) => ({
    id: e.id,
    employeeName: e.employee.fullName,
    courseTitle: e.course.title,
    status: e.status,
    progress: e.progress,
    certificateNumber: e.certification?.certificateNumber ?? null,
  }));

  return (
    <div className="space-y-6">
      {/* The enroll form opens from the "+" button in the top bar (left of the
          notification bell). This portals into the TopBar and renders nothing
          inline here. */}
      <EnrollEmployeeDialog
        courses={publishedCourses.map((c) => ({ id: c.id, title: c.title }))}
        employees={employees.map((e) => ({ id: e.id, fullName: e.fullName, empCode: e.empCode }))}
      />

      {/* Desktop: the project-wide DataTable. Mobile uses the card stack below. */}
      <div className="hidden md:block">
        <EnrollmentsTable rows={rows} />
      </div>

      {/* Mobile: same data as a card stack. */}
      <div className="md:hidden space-y-3">
        {rows.length === 0 ? (
          <Card className="border-border/70 bg-card/40">
            <CardContent className="py-12 text-center">
              <GraduationCap className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No enrollments yet</p>
            </CardContent>
          </Card>
        ) : (
          rows.map((e) => (
            <Card key={e.id} className="rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-tight">{e.employeeName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{e.courseTitle}</p>
                </div>
                <Badge variant={statusColors[e.status]} className="rounded-lg text-[10px] capitalize">
                  {e.status.replace("_", " ")}
                </Badge>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${e.progress}%` }} />
                </div>
                <span className="text-xs font-medium tabular-nums">{e.progress}%</span>
              </div>

              {e.certificateNumber && (
                <p className="mt-2 text-xs text-success flex items-center gap-1">
                  <Award className="h-3 w-3" />
                  {e.certificateNumber}
                </p>
              )}

              {e.status !== "completed" && (
                <div className="mt-3 border-t border-border/60 pt-3">
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
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
