import type { ReactNode } from "react";
import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import {
  getPerformanceStats,
  listGoals,
  listReviewCycles,
  ensureMonthlyReviewCycle,
} from "@/lib/services/hr/performance.service";
import { getTaskDrivenGoals, getTeamPerformance } from "@/lib/services/hr/task.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard as MetricCard } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listEmployees } from "@/lib/services/hr/employee.service";
import { Target, Calendar, MessageSquare, CheckCircle2, ListChecks, Gauge } from "lucide-react";
import { NewGoalDialog } from "./goals/_components/new-goal-dialog";

function monthBounds() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export default async function PerformanceOverviewPage() {
  const session = await requireTenant();
  const isAdmin =
    session.role === "owner" || session.role === "admin" || session.isSuperAdmin;

  // Monthly automation (admins only): idempotently ensure this month's cycle +
  // a draft review per employee, pre-filled from their task score.
  if (isAdmin) {
    await ensureMonthlyReviewCycle(session.tenantId);
  }

  const [stats, goals, cycles, employees, taskGoals] = await Promise.all([
    getPerformanceStats(session.tenantId),
    listGoals(session.tenantId),
    listReviewCycles(session.tenantId),
    listEmployees(session.tenantId, { status: "active" }),
    getTaskDrivenGoals(session.tenantId),
  ]);

  // Task-derived productivity this month (admins see the whole team ranked).
  const { from, to } = monthBounds();
  const team = isAdmin
    ? await getTeamPerformance(
        session.tenantId,
        employees.map((e) => ({ id: e.id, fullName: e.fullName, empCode: e.empCode })),
        from,
        to
      )
    : [];

  const activeCycle = cycles.find((c) => c.status === "active");
  const recentGoals = goals.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* The New Goal form opens from the "+" button in the top bar (left of the
          notification bell). Cycles and Goals are now in the sidebar. */}
      <NewGoalDialog
        employees={employees.map((e) => ({ id: e.id, fullName: e.fullName, empCode: e.empCode }))}
        cycles={cycles.map((c) => ({ id: c.id, name: c.name }))}
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard icon={<Calendar className="h-4 w-4" />} title="Review Cycles" value={stats.cycleCount} hint={`${stats.activeCycles} active`} />
        <StatCard icon={<Target className="h-4 w-4" />} title="Total Goals" value={stats.goalCount} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} title="Goals Achieved" value={stats.achievedGoals} variant="success" />
        <StatCard
          icon={<MessageSquare className="h-4 w-4" />}
          title="Reviews Submitted"
          value={stats.submittedReviews}
          hint={stats.draftReviews > 0 ? `${stats.draftReviews} draft${stats.draftReviews !== 1 ? "s" : ""} pending` : undefined}
        />
      </div>

      {/* Task-derived productivity — the live engine behind performance. Unlike
          goals/reviews this needs no manual entry; it updates as tasks complete. */}
      {isAdmin && team.length > 0 && (
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-primary" />
              Team productivity this month
            </CardTitle>
            <CardDescription>
              Auto-computed from task completion · active days · on-time delivery. No manual entry.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {team.map((p, i) => (
              <div
                key={p.employeeId}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2"
              >
                <span className="w-5 text-center text-xs font-semibold text-muted-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.fullName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.completed}/{p.assigned} due done · {p.throughput} completed · {p.activeDays}{" "}
                    active days
                  </p>
                </div>
                <div className="hidden w-40 sm:block">
                  <Progress value={p.taskCompletionRate} className="h-1.5" />
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {p.taskCompletionRate}% done · on-time {p.onTimeRatio}%
                  </p>
                </div>
                <div className="w-12 text-right">
                  <span className={`text-lg font-bold ${scoreTone(p.score)}`}>{p.score}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase"
                      title={g.type === "kpi" ? "KPI — Key Performance Indicator" : "OKR — Objectives & Key Results"}
                    >
                      {g.type}
                    </Badge>
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
              <p className="text-sm font-medium">
                {stats.submittedReviews} submitted
              </p>
              {stats.draftReviews > 0 && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  {stats.draftReviews} auto-draft{stats.draftReviews !== 1 ? "s" : ""} awaiting review
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Task→Performance bridge: goals whose progress is driven by linked tasks. */}
      {taskGoals.length > 0 && (
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              Task-driven goals
            </CardTitle>
            <CardDescription>
              Progress rolls up automatically from completed &amp; in-progress tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {taskGoals.map((g) => (
              <div key={g.id} className="rounded-lg border border-border/60 bg-background/40 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{g.title}</p>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {g.taskCount} task{g.taskCount !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{g.employeeName}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-all" style={{ width: `${g.progress}%` }} />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {g.progress}% · {g.status.replace("_", " ")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
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
