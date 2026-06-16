import type { ReactNode } from "react";
import { requireTenant } from "@/lib/auth";
import { getLearningStats, listEnrollments } from "@/lib/services/hr/learning.service";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard as MetricCard } from "@/components/ui/stat-card";
import { GraduationCap, Award, BookOpen, TrendingUp } from "lucide-react";
import { NewCourseDialog } from "./courses/_components/new-course-dialog";
import {
  RecentEnrollmentsTable,
  type RecentEnrollmentRow,
} from "./_components/recent-enrollments-table";

export default async function LearningOverviewPage() {
  const session = await requireTenant();
  const [stats, enrollments] = await Promise.all([
    getLearningStats(session.tenantId),
    listEnrollments(session.tenantId),
  ]);

  // Plain, serializable rows for the client DataTable (latest 8).
  const recentRows: RecentEnrollmentRow[] = enrollments.slice(0, 8).map((e) => ({
    id: e.id,
    employeeName: e.employee.fullName,
    courseTitle: e.course.title,
    progress: e.progress,
    hasCertificate: Boolean(e.certification),
  }));

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
        {/* Desktop: the project-wide DataTable. Mobile uses the card stack below. */}
        <div className="hidden md:block">
          <RecentEnrollmentsTable rows={recentRows} />
        </div>

        {/* Mobile: same data as a compact card stack. */}
        <div className="md:hidden space-y-3">
          {recentRows.length === 0 ? (
            <Card className="border-border/70 bg-card/40">
              <CardContent className="py-10 text-center">
                <p className="text-sm text-muted-foreground">No enrollments yet</p>
              </CardContent>
            </Card>
          ) : (
            recentRows.map((e) => (
              <Card key={e.id} className="rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-tight">{e.employeeName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{e.courseTitle}</p>
                  </div>
                  {e.hasCertificate && <Award className="h-4 w-4 shrink-0 text-success" />}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${e.progress}%` }} />
                  </div>
                  <span className="text-xs font-medium tabular-nums">{e.progress}%</span>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, hint, variant }: { icon: ReactNode; title: string; value: number | string; hint?: string; variant?: "success" }) {
  return (
    <MetricCard
      icon={icon}
      label={title}
      value={typeof value === "number" ? value.toLocaleString() : value}
      subtitle={hint}
      tone={variant === "success" ? "success" : "primary"}
    />
  );
}
