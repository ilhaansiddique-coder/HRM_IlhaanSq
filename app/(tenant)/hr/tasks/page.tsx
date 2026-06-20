import { requireTenant } from "@/lib/auth";
import { listEmployees } from "@/lib/services/hr/employee.service";
import { listGoals } from "@/lib/services/hr/performance.service";
import {
  listTasks,
  getDashboardStats,
  getEmployeePerformance,
  getTeamPerformance,
  resolveScope,
} from "@/lib/services/hr/task.service";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ListTodo, AlertTriangle, CheckCircle2, Loader2, Gauge } from "lucide-react";
import { NewTaskDialog } from "./_components/new-task-dialog";
import { type TaskRow } from "./_components/tasks-table";
import { TasksTabs } from "./_components/tasks-tabs";
import { resolveDateBounds } from "@/lib/date-range";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

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

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const session = await requireTenant();

  // full (admin) / team (manager: self + direct reports) / self scope.
  const { isAdmin, isManager, employeeId, scopeIds } = await resolveScope(
    session.tenantId,
    session.userId,
    session.role
  );
  const canAssign = isAdmin || isManager;
  const editableSet = new Set(scopeIds ?? []);

  // Top-bar date filter (all-time default). Bounds the task list + operational
  // cards by due date; feeds the productivity widget (month fallback below).
  const sp = await searchParams;
  const { start, end } = resolveDateBounds(sp.range, sp.from, sp.to, "all_time");
  const dueRange = { from: start, to: end };

  const [stats, tasks, allActive, goals] = await Promise.all([
    getDashboardStats(
      session.tenantId,
      scopeIds ? { assigneeIds: scopeIds } : undefined,
      dueRange
    ),
    listTasks(session.tenantId, {
      ...(scopeIds ? { assigneeIds: scopeIds } : {}),
      ...(start && { dueFrom: start }),
      ...(end && { dueTo: end }),
    }),
    canAssign ? listEmployees(session.tenantId, { status: "active" }) : Promise.resolve([]),
    isAdmin ? listGoals(session.tenantId) : Promise.resolve([]),
  ]);

  // Assignee picker: admins → everyone; managers → self + direct reports.
  const employees = isAdmin ? allActive : allActive.filter((e) => editableSet.has(e.id));

  // Productivity (spec §11.3 / §12). Admins & managers see a ranked team table;
  // an individual sees their own. The productivity engine needs a concrete
  // window, so honor the top-bar range when set, else fall back to this month.
  const month = monthBounds();
  const from = start ?? month.from;
  const to = end ?? month.to;
  const team = canAssign
    ? await getTeamPerformance(
        session.tenantId,
        employees.map((e) => ({ id: e.id, fullName: e.fullName, empCode: e.empCode })),
        from,
        to
      )
    : [];
  const myPerf =
    !canAssign && employeeId
      ? await getEmployeePerformance(session.tenantId, employeeId, from, to)
      : null;

  const todayMs = startOfToday().getTime();
  const rows: TaskRow[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    assigneeId: t.assigneeId,
    assigneeName: t.assignee?.fullName ?? null,
    assigneeCode: t.assignee?.empCode ?? null,
    priority: t.priority,
    status: t.status,
    progressPct: t.progressPct,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    startDate: t.startDate ? t.startDate.toISOString() : null,
    overdue:
      !!t.dueDate &&
      t.dueDate.getTime() < todayMs &&
      t.status !== "done" &&
      t.status !== "cancelled",
    goalId: t.goalId,
    goalTitle: t.goal?.title ?? null,
    // Admins edit any; managers their team; employees only their own tasks.
    canEdit: isAdmin || (t.assigneeId ? editableSet.has(t.assigneeId) : false),
    checklist: t.checklist.map((c) => ({ id: c.id, label: c.label, isChecked: c.isChecked })),
    comments: t.comments.map((c) => ({
      id: c.id,
      body: c.body,
      authorName: c.authorName,
      authorId: c.authorId,
      createdAt: c.createdAt.toISOString(),
    })),
    proofUrl: t.proofUrl,
    proofNote: t.proofNote,
  }));

  const cards = [
    { label: "Open tasks", value: stats.open, icon: ListTodo, tone: "text-foreground" },
    { label: "Overdue", value: stats.overdue, icon: AlertTriangle, tone: "text-red-600 dark:text-red-400" },
    { label: "In progress", value: stats.byStatus.in_progress ?? 0, icon: Loader2, tone: "text-sky-600 dark:text-sky-400" },
    { label: "Done this week", value: stats.completedThisWeek, icon: CheckCircle2, tone: "text-emerald-600 dark:text-emerald-400" },
  ];

  const employeeOptions = employees.map((e) => ({
    id: e.id,
    fullName: e.fullName,
    empCode: e.empCode,
  }));

  const goalOptions = goals.map((g) => ({
    id: g.id,
    title: g.title,
    employeeName: g.employee?.fullName ?? "—",
  }));

  return (
    <div className="space-y-6">
      <NewTaskDialog
        employees={employeeOptions}
        goals={goalOptions}
        isAdmin={isAdmin}
        canAssign={canAssign}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <c.icon className={`h-5 w-5 ${c.tone}`} />
            </div>
            <div>
              <p className="text-2xl font-semibold leading-none">{c.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Productivity this month — the Task→Performance engine made visible */}
      {canAssign ? (
        team.length > 0 && (
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Gauge className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-semibold">Productivity this month</p>
                <p className="text-xs text-muted-foreground">
                  Score = task completion · active days · on-time. Drills back to logged activity.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {team.map((p) => (
                <div
                  key={p.employeeId}
                  className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2"
                >
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
                      {p.taskCompletionRate}% on-time {p.onTimeRatio}%
                    </p>
                  </div>
                  <div className="w-12 text-right">
                    <span className={`text-lg font-bold ${scoreTone(p.score)}`}>{p.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )
      ) : myPerf ? (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-semibold">My productivity this month</p>
                <p className="text-[11px] text-muted-foreground">
                  {myPerf.completed}/{myPerf.assigned} due done · {myPerf.throughput} completed ·{" "}
                  {myPerf.activeDays} active days · on-time {myPerf.onTimeRatio}%
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-3xl font-bold ${scoreTone(myPerf.score)}`}>{myPerf.score}</span>
              <p className="text-[10px] text-muted-foreground">score</p>
            </div>
          </div>
          <Progress value={myPerf.taskCompletionRate} className="mt-3 h-2" />
          <p className="mt-1 text-[11px] text-muted-foreground">
            {myPerf.taskCompletionRate}% of this month&apos;s due tasks completed
          </p>
        </Card>
      ) : null}

      <TasksTabs
        rows={rows}
        employees={employeeOptions}
        goals={goalOptions}
        isAdmin={isAdmin}
        canAssign={canAssign}
        currentEmployeeId={employeeId}
      />
    </div>
  );
}