import { requireTenant } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActivityHistory, resolveScope } from "@/lib/services/hr/task.service";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  History,
  Plus,
  UserPlus,
  ArrowRightLeft,
  CheckCircle2,
  RotateCcw,
  MessageSquare,
  SquareCheck,
  Repeat,
  Upload,
  ShieldCheck,
} from "lucide-react";
import type { TaskActivityType } from "@prisma/client";

const META: Record<TaskActivityType, { label: string; icon: typeof Plus }> = {
  created: { label: "created a task", icon: Plus },
  assigned: { label: "assigned a task", icon: UserPlus },
  status_changed: { label: "changed status", icon: ArrowRightLeft },
  completed: { label: "completed a task", icon: CheckCircle2 },
  reopened: { label: "reopened a task", icon: RotateCcw },
  commented: { label: "commented", icon: MessageSquare },
  checklist_checked: { label: "checked an item", icon: SquareCheck },
  checklist_unchecked: { label: "unchecked an item", icon: SquareCheck },
  habit_checked: { label: "checked a habit", icon: Repeat },
  habit_unchecked: { label: "unchecked a habit", icon: Repeat },
  submitted: { label: "submitted for review", icon: Upload },
  approved: { label: "approved a task", icon: ShieldCheck },
  rejected: { label: "rejected a submission", icon: RotateCcw },
};

export default async function TaskHistoryPage() {
  const session = await requireTenant();
  const { isAdmin, isManager, scopeIds } = await resolveScope(
    session.tenantId,
    session.userId,
    session.role
  );

  const activities = await getActivityHistory(session.tenantId, {
    employeeIds: scopeIds, // undefined for admins → all
    take: 200,
  });
  const scopeLabel = isAdmin ? "(all employees)" : isManager ? "(my team)" : "(mine)";

  // Resolve actor/employee names in one query.
  const ids = [
    ...new Set(
      activities.flatMap((a) => [a.actorId, a.employeeId].filter(Boolean) as string[])
    ),
  ];
  const people = ids.length
    ? await prisma.employee.findMany({
        where: { tenantId: session.tenantId, id: { in: ids } },
        select: { id: true, fullName: true },
      })
    : [];
  const nameOf = new Map(people.map((p) => [p.id, p.fullName]));

  // Resolve the task title for each entry so the feed names the task.
  const taskIds = [...new Set(activities.map((a) => a.taskId).filter(Boolean) as string[])];
  const tasks = taskIds.length
    ? await prisma.task.findMany({
        where: { tenantId: session.tenantId, id: { in: taskIds } },
        select: { id: true, title: true },
      })
    : [];
  const titleOf = new Map(tasks.map((t) => [t.id, t.title]));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-primary" />
        <h2 className="text-sm font-semibold">Activity history {scopeLabel}</h2>
      </div>

      <Card className="divide-y divide-border/50 p-0">
        {activities.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          activities.map((a) => {
            const m = META[a.type];
            const Icon = m.icon;
            const actor = a.actorId ? nameOf.get(a.actorId) : null;
            const assignee = a.employeeId ? nameOf.get(a.employeeId) : null;
            const taskTitle = a.taskId ? titleOf.get(a.taskId) : null;
            // Show the assignee for events that target someone other than the actor
            // (e.g. an admin assigning/creating/approving a task for an employee).
            const showAssignee = assignee && assignee !== actor;
            return (
              <div key={a.id} className="flex items-start gap-3 px-4 py-2.5">
                <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm">
                    <span className="font-medium">{actor ?? "Someone"}</span> {m.label}
                    {showAssignee && (
                      <>
                        {" "}
                        <span className="text-muted-foreground">→</span>{" "}
                        <span className="font-medium">{assignee}</span>
                      </>
                    )}
                    {a.type === "status_changed" && a.fromStatus && a.toStatus && (
                      <Badge variant="outline" className="ml-1.5 text-[10px]">
                        {a.fromStatus} → {a.toStatus}
                      </Badge>
                    )}
                  </div>
                  {taskTitle && (
                    <p className="truncate text-xs font-medium text-foreground/80">{taskTitle}</p>
                  )}
                  {/* Free-text detail (comment body / rejection feedback) — skip when
                      it's just the task title repeated. */}
                  {a.detail && a.detail !== taskTitle && (
                    <p className="truncate text-xs text-muted-foreground">{a.detail}</p>
                  )}
                </div>
                <time className="flex-shrink-0 text-[11px] text-muted-foreground">
                  {new Date(a.createdAt).toLocaleDateString(undefined, {
                    day: "2-digit",
                    month: "short",
                  })}
                </time>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}