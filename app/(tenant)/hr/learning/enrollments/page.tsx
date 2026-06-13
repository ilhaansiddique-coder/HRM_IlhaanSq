import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { listEnrollments, listCourses } from "@/lib/services/hr/learning.service";
import { listEmployees } from "@/lib/services/hr/employee.service";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Award, GraduationCap } from "lucide-react";
import { updateProgressAction } from "../../actions-phase2";
import { EnrollEmployeeDialog } from "./_components/enroll-employee-dialog";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/hr/learning"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
      </div>

      {/* The enroll form opens from the "+" button in the top bar (left of the
          notification bell). This portals into the TopBar and renders nothing
          inline here. */}
      <EnrollEmployeeDialog
        courses={publishedCourses.map((c) => ({ id: c.id, title: c.title }))}
        employees={employees.map((e) => ({ id: e.id, fullName: e.fullName, empCode: e.empCode }))}
      />

      {enrollments.length === 0 ? (
        <Card className="border-border/70 bg-card/40">
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No enrollments yet</p>
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[220px]">Progress</TableHead>
              <TableHead>Certificate</TableHead>
              <TableHead className="text-right">Update progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enrollments.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.employee.fullName}</TableCell>
                <TableCell className="text-muted-foreground">{e.course.title}</TableCell>
                <TableCell>
                  <Badge variant={statusColors[e.status]} className="text-[10px] capitalize">
                    {e.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-28 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${e.progress}%` }} />
                    </div>
                    <span className="text-xs font-medium tabular-nums">{e.progress}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  {e.certification ? (
                    <span className="text-xs text-success flex items-center gap-1">
                      <Award className="h-3 w-3" />
                      {e.certification.certificateNumber}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {e.status !== "completed" ? (
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
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
