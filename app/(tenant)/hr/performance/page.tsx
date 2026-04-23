import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { getPerformanceStats, listGoals, listReviewCycles } from "@/lib/services/hr/performance.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, Plus, Calendar, MessageSquare, CheckCircle2 } from "lucide-react";

export default async function PerformanceOverviewPage() {
  const session = await requireTenant();
  const [stats, goals, cycles] = await Promise.all([
    getPerformanceStats(session.tenantId),
    listGoals(session.tenantId),
    listReviewCycles(session.tenantId),
  ]);

  const activeCycle = cycles.find((c) => c.status === "active");
  const recentGoals = goals.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <div className="flex gap-2">
          <Link href="/hr/performance/cycles"><Button variant="outline"><Calendar className="h-4 w-4" />Cycles</Button></Link>
          <Link href="/hr/performance/goals"><Button><Plus className="h-4 w-4" />New Goal</Button></Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard icon={<Calendar className="h-4 w-4" />} title="Review Cycles" value={stats.cycleCount} hint={`${stats.activeCycles} active`} />
        <StatCard icon={<Target className="h-4 w-4" />} title="Total Goals" value={stats.goalCount} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} title="Goals Achieved" value={stats.achievedGoals} variant="success" />
        <StatCard icon={<MessageSquare className="h-4 w-4" />} title="Reviews Submitted" value={stats.reviewCount} />
      </div>

      {activeCycle && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><Calendar className="h-5 w-5 text-primary" />Active cycle: {activeCycle.name}</CardTitle>
                <CardDescription>{new Date(activeCycle.startDate).toLocaleDateString()} → {new Date(activeCycle.endDate).toLocaleDateString()}</CardDescription>
              </div>
              <Badge variant="default">Active</Badge>
            </div>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" />Recent Goals</CardTitle>
              <CardDescription>{goals.length} total</CardDescription>
            </div>
            <Link href="/hr/performance/goals"><Button variant="ghost" size="sm">View all</Button></Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentGoals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No goals yet</p>
            ) : (
              recentGoals.map((g) => (
                <div key={g.id} className="rounded-lg border border-border/60 bg-background/40 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">{g.title}</p>
                    <Badge variant="outline" className="text-[10px] uppercase">{g.type}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{g.employee.fullName}</p>
                  <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${g.progress}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{g.progress}% complete</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary" />Reviews</CardTitle>
              <CardDescription>Performance feedback</CardDescription>
            </div>
            <Link href="/hr/performance/reviews"><Button variant="ghost" size="sm">View all</Button></Link>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <MessageSquare className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{stats.reviewCount} review{stats.reviewCount !== 1 ? "s" : ""} submitted</p>
            </div>
          </CardContent>
        </Card>
      </div>
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
        <div className="text-2xl font-semibold">{typeof value === "number" ? value.toLocaleString() : value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}
