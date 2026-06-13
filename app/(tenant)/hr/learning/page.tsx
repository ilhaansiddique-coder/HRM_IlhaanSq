import type { ReactNode } from "react";
import { requireTenant } from "@/lib/auth";
import { getLearningStats, listEnrollments } from "@/lib/services/hr/learning.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GraduationCap, Award, BookOpen, TrendingUp } from "lucide-react";
import { NewCourseDialog } from "./courses/_components/new-course-dialog";

export default async function LearningOverviewPage() {
  const session = await requireTenant();
  const [stats, enrollments] = await Promise.all([
    getLearningStats(session.tenantId),
    listEnrollments(session.tenantId),
  ]);

  return (
    <div className="space-y-6">
      {/* New-course form opens from the "+" button in the top bar (left of the
          notification bell). Enrollments now lives in the sidebar under Learning. */}
      <NewCourseDialog />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard icon={<BookOpen className="h-4 w-4" />} title="Total Courses" value={stats.courseCount} hint={`${stats.publishedCount} published`} />
        <StatCard icon={<GraduationCap className="h-4 w-4" />} title="Enrollments" value={stats.enrollmentCount} />
        <StatCard icon={<Award className="h-4 w-4" />} title="Completed" value={stats.completedCount} variant="success" />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} title="Completion Rate" value={`${stats.completionRate}%`} />
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Recent Enrollments</h2>
          <p className="text-sm text-muted-foreground">Latest course assignments</p>
        </div>
        {enrollments.length === 0 ? (
          <Card className="border-border/70 bg-card/40">
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">No enrollments yet</p>
            </CardContent>
          </Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Course</TableHead>
                <TableHead className="w-[220px]">Progress</TableHead>
                <TableHead>Certificate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.slice(0, 8).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.employee.fullName}</TableCell>
                  <TableCell className="text-muted-foreground">{e.course.title}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-28 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${e.progress}%` }} />
                      </div>
                      <span className="text-xs font-medium tabular-nums">{e.progress}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {e.certification ? (
                      <Award className="h-4 w-4 text-success" />
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
    </div>
  );
}

function StatCard({ icon, title, value, hint, variant }: { icon: ReactNode; title: string; value: number | string; hint?: string; variant?: "success" }) {
  const iconBg = variant === "success" ? "bg-success/10 text-success" : "bg-primary/10 text-primary";
  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${iconBg}`}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}
