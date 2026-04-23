import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { getLearningStats, listEnrollments } from "@/lib/services/hr/learning.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Plus, Award, BookOpen, TrendingUp } from "lucide-react";

export default async function LearningOverviewPage() {
  const session = await requireTenant();
  const [stats, enrollments] = await Promise.all([
    getLearningStats(session.tenantId),
    listEnrollments(session.tenantId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Learning</h1>
          <p className="text-sm text-muted-foreground">Courses, enrollments and certifications</p>
        </div>
        <div className="flex gap-2">
          <Link href="/hr/learning/enrollments"><Button variant="outline"><Award className="h-4 w-4" />Enrollments</Button></Link>
          <Link href="/hr/learning/courses"><Button><Plus className="h-4 w-4" />New Course</Button></Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard icon={<BookOpen className="h-4 w-4" />} title="Total Courses" value={stats.courseCount} hint={`${stats.publishedCount} published`} />
        <StatCard icon={<GraduationCap className="h-4 w-4" />} title="Enrollments" value={stats.enrollmentCount} />
        <StatCard icon={<Award className="h-4 w-4" />} title="Completed" value={stats.completedCount} variant="success" />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} title="Completion Rate" value={`${stats.completionRate}%`} />
      </div>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle>Recent Enrollments</CardTitle>
          <CardDescription>Latest course assignments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No enrollments yet</p>
          ) : (
            enrollments.slice(0, 8).map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{e.employee.fullName}</p>
                  <p className="text-xs text-muted-foreground">{e.course.title}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-20">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${e.progress}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground text-right mt-0.5">{e.progress}%</p>
                  </div>
                  {e.certification && <Award className="h-4 w-4 text-success" />}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, title, value, hint, variant }: { icon: React.ReactNode; title: string; value: number | string; hint?: string; variant?: "success" }) {
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
