import { prisma } from "../../db";
import type { Prisma, TaskStatus, TaskPriority } from "@prisma/client";
import { assertTenantOwns } from "./_shared";
import { getWorkingDayChecker } from "./holiday.service";

// ─── Helpers ────────────────────────────────────────────────

/** Midnight-today as a Date (Prisma @db.Date truncates the time). */
function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const OPEN_STATUSES: TaskStatus[] = ["todo", "in_progress", "blocked"];

type Actor = {
  employeeId?: string | null;
  name?: string | null;
  isAdmin: boolean;
  isManager?: boolean;
  /** Direct-report employee ids (managers only); empty for everyone else. */
  reportIds?: string[];
};

/** A UUID that never matches a real row — used to scope unlinked users to nothing. */
const NO_MATCH = "00000000-0000-0000-0000-000000000000";

/**
 * Resolve a caller's task-management scope from their session.
 *   - full  (owner/admin/superadmin): sees & acts on every task.
 *   - team  (manager): sees self + direct reports (Employee.managerId).
 *   - self  (everyone else): sees only their own tasks.
 * `scopeIds` is undefined for full access, or the list of assignee ids the
 * caller may see for team/self.
 */
export async function resolveScope(tenantId: string, userId: string, role: string | null) {
  const isAdmin = ["owner", "admin", "superadmin"].includes(role ?? "");
  const isManager = role === "manager";
  const me = await prisma.employee.findFirst({
    where: { tenantId, userId },
    select: { id: true, fullName: true },
  });

  let reportIds: string[] = [];
  if (isManager && me) {
    const reports = await prisma.employee.findMany({
      where: { tenantId, managerId: me.id },
      select: { id: true },
    });
    reportIds = reports.map((r) => r.id);
  }

  const scopeIds = isAdmin
    ? undefined
    : me
      ? [me.id, ...reportIds]
      : [NO_MATCH];

  return {
    isAdmin,
    isManager,
    employeeId: me?.id ?? null,
    name: me?.fullName ?? null,
    reportIds,
    scopeIds,
  };
}

/** Append a single immutable row to the task activity log. */
async function logActivity(
  tx: Prisma.TransactionClient | typeof prisma,
  tenantId: string,
  data: {
    type: Prisma.TaskActivityCreateInput["type"];
    taskId?: string | null;
    employeeId?: string | null;
    actorId?: string | null;
    fromStatus?: TaskStatus | null;
    toStatus?: TaskStatus | null;
    detail?: string | null;
    occurredOn?: Date;
  }
) {
  await tx.taskActivity.create({
    data: {
      tenantId,
      type: data.type,
      taskId: data.taskId ?? null,
      employeeId: data.employeeId ?? null,
      actorId: data.actorId ?? null,
      fromStatus: data.fromStatus ?? null,
      toStatus: data.toStatus ?? null,
      detail: data.detail ?? null,
      occurredOn: data.occurredOn ?? today(),
    },
  });
}

// ─── Tasks: read ────────────────────────────────────────────

export type TaskFilter = {
  assigneeId?: string;
  /** Restrict to this set of assignees (team scope). undefined = no restriction. */
  assigneeIds?: string[];
  status?: TaskStatus;
  open?: boolean; // only todo/in_progress/blocked
  dueBefore?: Date;
  q?: string;
};

export async function listTasks(tenantId: string, filter: TaskFilter = {}) {
  const where: Prisma.TaskWhereInput = { tenantId };
  if (filter.assigneeId) where.assigneeId = filter.assigneeId;
  if (filter.assigneeIds) where.assigneeId = { in: filter.assigneeIds };
  if (filter.status) where.status = filter.status;
  if (filter.open) where.status = { in: OPEN_STATUSES };
  if (filter.dueBefore) where.dueDate = { lt: filter.dueBefore };
  if (filter.q) where.title = { contains: filter.q, mode: "insensitive" };

  return prisma.task.findMany({
    where,
    include: {
      assignee: { select: { id: true, fullName: true, empCode: true } },
      goal: { select: { id: true, title: true } },
      checklist: {
        select: { id: true, label: true, isChecked: true, position: true },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      },
      comments: {
        select: { id: true, body: true, authorName: true, authorId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });
}

export async function getTask(tenantId: string, id: string) {
  return prisma.task.findFirst({
    where: { id, tenantId },
    include: {
      assignee: { select: { id: true, fullName: true, empCode: true } },
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
}

// ─── Tasks: write ───────────────────────────────────────────

export type CreateTaskInput = {
  title: string;
  description?: string;
  assigneeId?: string | null;
  goalId?: string | null;
  priority?: TaskPriority;
  dueDate?: Date | null;
  startDate?: Date | null;
  estimateMins?: number | null;
  /** Optional initial checklist sub-items. */
  checklist?: string[];
};

export async function createTask(tenantId: string, input: CreateTaskInput, actor: Actor) {
  if (!input.title?.trim()) throw new Error("Title is required");
  if (input.assigneeId) await assertTenantOwns(tenantId, "employee", [input.assigneeId]);
  if (input.goalId) await assertTenantOwns(tenantId, "goal", [input.goalId]);

  const items = (input.checklist ?? []).map((s) => s.trim()).filter(Boolean);

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        tenantId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        assigneeId: input.assigneeId ?? null,
        goalId: input.goalId ?? null,
        createdById: actor.employeeId ?? null,
        priority: input.priority ?? "medium",
        dueDate: input.dueDate ?? null,
        startDate: input.startDate ?? null,
        estimateMins: input.estimateMins ?? null,
      },
    });
    if (items.length > 0) {
      await tx.checklistItem.createMany({
        data: items.map((label, i) => ({ tenantId, taskId: created.id, label, position: i })),
      });
    }
    await logActivity(tx, tenantId, {
      type: "created",
      taskId: created.id,
      employeeId: created.assigneeId,
      actorId: actor.employeeId,
      detail: created.title,
    });
    if (created.assigneeId) {
      await logActivity(tx, tenantId, {
        type: "assigned",
        taskId: created.id,
        employeeId: created.assigneeId,
        actorId: actor.employeeId,
      });
    }
    await recomputeTaskProgress(tx, tenantId, created.id);
    return created;
  });
  return task;
}

export type UpdateTaskPatch = {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  dueDate?: Date | null;
  startDate?: Date | null;
  estimateMins?: number | null;
  goalId?: string | null;
};

export async function updateTask(
  tenantId: string,
  id: string,
  patch: UpdateTaskPatch,
  actor: Actor
) {
  const task = await prisma.task.findFirst({ where: { id, tenantId } });
  if (!task) throw new Error("Task not found");
  assertCanActOn(actor, task.assigneeId);

  const goalChanged = patch.goalId !== undefined && patch.goalId !== task.goalId;
  if (goalChanged && patch.goalId) await assertTenantOwns(tenantId, "goal", [patch.goalId]);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id },
      data: {
        title: patch.title?.trim() ?? task.title,
        description: patch.description === undefined ? task.description : patch.description?.trim() || null,
        priority: patch.priority ?? task.priority,
        dueDate: patch.dueDate === undefined ? task.dueDate : patch.dueDate,
        startDate: patch.startDate === undefined ? task.startDate : patch.startDate,
        estimateMins: patch.estimateMins === undefined ? task.estimateMins : patch.estimateMins,
        goalId: patch.goalId === undefined ? task.goalId : patch.goalId,
      },
    });
    // Re-link affects both the old and the new goal's rollup.
    if (goalChanged && task.goalId) await recomputeGoalFromTasks(tx, tenantId, task.goalId);
    if (updated.goalId) await recomputeGoalFromTasks(tx, tenantId, updated.goalId);
    return updated;
  });
}

export async function setTaskStatus(
  tenantId: string,
  id: string,
  status: TaskStatus,
  actor: Actor
) {
  const task = await prisma.task.findFirst({ where: { id, tenantId } });
  if (!task) throw new Error("Task not found");
  assertCanActOn(actor, task.assigneeId);

  // An assignee who can't verify their own work doesn't "complete" a task —
  // they submit it for review. Verifiers (admin / their manager) complete it.
  if (status === "done" && !canVerify(actor, task)) {
    return submitTaskForReview(tenantId, id, {}, actor);
  }
  if (task.status === status) return task;

  const becomingDone = status === "done" && task.status !== "done";
  const leavingDone = task.status === "done" && status !== "done";

  return prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id },
      data: {
        status,
        completedAt: becomingDone ? new Date() : leavingDone ? null : task.completedAt,
      },
    });
    await logActivity(tx, tenantId, {
      type: becomingDone ? "completed" : leavingDone ? "reopened" : "status_changed",
      taskId: id,
      employeeId: task.assigneeId,
      actorId: actor.employeeId,
      fromStatus: task.status,
      toStatus: status,
    });
    // Mark Complete auto-checks any remaining checklist items (spec §6.2).
    if (becomingDone) {
      await tx.checklistItem.updateMany({
        where: { tenantId, taskId: id, isChecked: false },
        data: { isChecked: true, checkedAt: new Date(), checkedById: actor.employeeId ?? null },
      });
    }
    await recomputeTaskProgress(tx, tenantId, id);
    return updated;
  });
}

export async function reassignTask(
  tenantId: string,
  id: string,
  assigneeId: string | null,
  actor: Actor
) {
  const task = await prisma.task.findFirst({ where: { id, tenantId } });
  if (!task) throw new Error("Task not found");
  // Caller must manage the current assignee, and (for managers) may only hand
  // it to someone in their team. Admins may reassign anything to anyone.
  if (!canActOnAssignee(actor, task.assigneeId)) {
    throw new Error("You can't reassign this task");
  }
  if (!actor.isAdmin && assigneeId && !canActOnAssignee(actor, assigneeId)) {
    throw new Error("You can only assign tasks within your team");
  }
  if (assigneeId) await assertTenantOwns(tenantId, "employee", [assigneeId]);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({ where: { id }, data: { assigneeId } });
    await logActivity(tx, tenantId, {
      type: "assigned",
      taskId: id,
      employeeId: assigneeId,
      actorId: actor.employeeId,
    });
    return updated;
  });
}

export async function deleteTasks(tenantId: string, ids: string[], actor: Actor) {
  // Admins delete anything; managers delete tasks within their team. We filter
  // the requested ids down to those the caller may actually delete.
  const candidates = await prisma.task.findMany({
    where: { id: { in: ids }, tenantId },
    select: { id: true, assigneeId: true, goalId: true },
  });
  const deletable = actor.isAdmin
    ? candidates
    : candidates.filter((t) => canDeleteAssignee(actor, t.assigneeId));
  if (deletable.length === 0) throw new Error("You can't delete these tasks");

  const goalIds = [...new Set(deletable.map((t) => t.goalId).filter(Boolean) as string[])];
  const { count } = await prisma.task.deleteMany({
    where: { id: { in: deletable.map((t) => t.id) }, tenantId },
  });
  for (const gid of goalIds) await recomputeGoalFromTasks(prisma, tenantId, gid);
  return count;
}

/**
 * Can the actor act on a task assigned to `assigneeId`?
 *   admin → any · self → own · manager → own + direct reports.
 */
function canActOnAssignee(actor: Actor, assigneeId: string | null): boolean {
  if (actor.isAdmin) return true;
  if (actor.employeeId && actor.employeeId === assigneeId) return true;
  if (assigneeId && (actor.reportIds ?? []).includes(assigneeId)) return true;
  return false;
}

/**
 * Can the actor *delete* a task / subtask assigned to `assigneeId`? Stricter than
 * canActOnAssignee: deletion is reserved for admins (any) and managers (own +
 * direct reports). Plain employees can never delete — not even their own work —
 * so accidental loss of a task or subtask is impossible from the employee side.
 */
function canDeleteAssignee(actor: Actor, assigneeId: string | null): boolean {
  if (actor.isAdmin) return true;
  if (actor.isManager) return canActOnAssignee(actor, assigneeId);
  return false;
}

function assertCanActOn(actor: Actor, assigneeId: string | null) {
  if (!canActOnAssignee(actor, assigneeId)) {
    throw new Error("You can only update tasks within your scope");
  }
}

/**
 * Can the actor *verify* (approve/reject) this task? Admins always; a manager
 * for their reports' tasks — but never your own work (no self-approval).
 */
function canVerify(actor: Actor, task: { assigneeId: string | null }): boolean {
  if (actor.isAdmin) return true;
  if (task.assigneeId && task.assigneeId === actor.employeeId) return false;
  return !!(task.assigneeId && (actor.reportIds ?? []).includes(task.assigneeId));
}

// ─── Completion proof + verification ────────────────────────

/** Assignee submits a finished task for review, optionally with proof. */
export async function submitTaskForReview(
  tenantId: string,
  id: string,
  input: { proofUrl?: string | null; proofNote?: string | null },
  actor: Actor
) {
  const task = await prisma.task.findFirst({ where: { id, tenantId } });
  if (!task) throw new Error("Task not found");
  assertCanActOn(actor, task.assigneeId);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id },
      data: {
        status: "submitted",
        submittedAt: new Date(),
        completedAt: null,
        proofUrl: input.proofUrl?.trim() || task.proofUrl,
        proofNote: input.proofNote?.trim() || task.proofNote,
      },
    });
    await logActivity(tx, tenantId, {
      type: "submitted",
      taskId: id,
      employeeId: task.assigneeId,
      actorId: actor.employeeId,
      fromStatus: task.status,
      toStatus: "submitted",
      detail: input.proofNote?.trim() || null,
    });
    return updated;
  });
}

/** A verifier approves (→ done) or rejects (→ in_progress + feedback) a submission. */
export async function reviewTask(
  tenantId: string,
  id: string,
  decision: "approve" | "reject",
  feedback: string | null,
  actor: Actor & { name?: string | null }
) {
  const task = await prisma.task.findFirst({ where: { id, tenantId } });
  if (!task) throw new Error("Task not found");
  if (!canVerify(actor, task)) throw new Error("You can't review this task");
  if (task.status !== "submitted") throw new Error("This task isn't awaiting review");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id },
      data:
        decision === "approve"
          ? { status: "done", completedAt: new Date(), reviewedById: actor.employeeId, reviewedAt: new Date() }
          : { status: "in_progress", reviewedById: actor.employeeId, reviewedAt: new Date() },
    });
    await logActivity(tx, tenantId, {
      type: decision === "approve" ? "approved" : "rejected",
      taskId: id,
      employeeId: task.assigneeId,
      actorId: actor.employeeId,
      fromStatus: "submitted",
      toStatus: decision === "approve" ? "done" : "in_progress",
      detail: feedback?.trim() || null,
    });
    // A rejection's feedback is also surfaced as a comment for the assignee.
    if (decision === "reject" && feedback?.trim()) {
      await tx.taskComment.create({
        data: {
          tenantId,
          taskId: id,
          authorId: actor.employeeId ?? null,
          authorName: actor.name ?? null,
          body: `Rejected: ${feedback.trim()}`,
        },
      });
    }
    await recomputeTaskProgress(tx, tenantId, id);
    return updated;
  });
}

// ─── Progress % + Goal rollup bridge ────────────────────────

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Recompute a task's progress_pct.
 *   - With a checklist: progress = round(checked / total * 100).
 *   - No checklist: progress follows status (todo 0 / in_progress 50 / done 100;
 *     blocked & cancelled keep their last value — spec §6.2).
 * Then cascade into the linked goal's rollup, if any.
 */
async function recomputeTaskProgress(tx: Db, tenantId: string, taskId: string) {
  const task = await tx.task.findFirst({
    where: { id: taskId, tenantId },
    select: { id: true, status: true, progressPct: true, goalId: true },
  });
  if (!task) return;

  const items = await tx.checklistItem.findMany({
    where: { tenantId, taskId },
    select: { isChecked: true },
  });

  let progress = task.progressPct;
  if (items.length > 0) {
    const checked = items.filter((i) => i.isChecked).length;
    progress = Math.round((checked / items.length) * 100);
  } else {
    progress =
      task.status === "done"
        ? 100
        : task.status === "in_progress"
          ? 50
          : task.status === "todo"
            ? 0
            : task.progressPct; // blocked / cancelled frozen
  }

  if (progress !== task.progressPct) {
    await tx.task.update({ where: { id: taskId }, data: { progressPct: progress } });
  }
  if (task.goalId) await recomputeGoalFromTasks(tx, tenantId, task.goalId);
}

/**
 * The Task→Goal bridge. A goal with linked tasks derives its progress from them:
 *   GoalProgress = round(mean(progressPct) over linked, non-cancelled tasks).
 * A goal with NO linked tasks is left untouched (manual entry preserved).
 */
async function recomputeGoalFromTasks(tx: Db, tenantId: string, goalId: string) {
  const linked = await tx.task.findMany({
    where: { tenantId, goalId, status: { not: "cancelled" } },
    select: { progressPct: true },
  });
  if (linked.length === 0) return; // hybrid: don't clobber a manual goal

  const avg = Math.round(linked.reduce((s, t) => s + t.progressPct, 0) / linked.length);
  const status: "achieved" | "in_progress" | "not_started" =
    avg >= 100 ? "achieved" : avg > 0 ? "in_progress" : "not_started";

  await tx.goal.updateMany({
    where: { id: goalId, tenantId },
    data: { progress: avg, status },
  });
}

// ─── Comments ───────────────────────────────────────────────

export async function listComments(tenantId: string, taskId: string) {
  return prisma.taskComment.findMany({
    where: { tenantId, taskId },
    orderBy: { createdAt: "asc" },
  });
}

export async function addComment(
  tenantId: string,
  taskId: string,
  body: string,
  actor: Actor & { name?: string | null }
) {
  if (!body?.trim()) throw new Error("Comment cannot be empty");
  const task = await prisma.task.findFirst({ where: { id: taskId, tenantId } });
  if (!task) throw new Error("Task not found");
  // Anyone who can see the task (admin, or the assignee) may comment.
  assertCanActOn(actor, task.assigneeId);

  return prisma.$transaction(async (tx) => {
    const comment = await tx.taskComment.create({
      data: {
        tenantId,
        taskId,
        authorId: actor.employeeId ?? null,
        authorName: actor.name ?? null,
        body: body.trim(),
      },
    });
    await logActivity(tx, tenantId, {
      type: "commented",
      taskId,
      employeeId: task.assigneeId,
      actorId: actor.employeeId,
      detail: body.trim().slice(0, 140),
    });
    return comment;
  });
}

export async function deleteComment(tenantId: string, commentId: string, actor: Actor) {
  const comment = await prisma.taskComment.findFirst({ where: { id: commentId, tenantId } });
  if (!comment) throw new Error("Comment not found");
  if (!actor.isAdmin && comment.authorId !== actor.employeeId) {
    throw new Error("You can only delete your own comments");
  }
  await prisma.taskComment.delete({ where: { id: commentId } });
}

// ─── Checklist sub-items ────────────────────────────────────

export async function listChecklist(tenantId: string, taskId: string) {
  return prisma.checklistItem.findMany({
    where: { tenantId, taskId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
}

export async function addChecklistItem(
  tenantId: string,
  taskId: string,
  label: string,
  actor: Actor
) {
  if (!label?.trim()) throw new Error("Label is required");
  const task = await prisma.task.findFirst({ where: { id: taskId, tenantId } });
  if (!task) throw new Error("Task not found");
  assertCanActOn(actor, task.assigneeId);

  return prisma.$transaction(async (tx) => {
    const max = await tx.checklistItem.aggregate({
      where: { tenantId, taskId },
      _max: { position: true },
    });
    const item = await tx.checklistItem.create({
      data: {
        tenantId,
        taskId,
        label: label.trim(),
        position: (max._max.position ?? -1) + 1,
      },
    });
    await recomputeTaskProgress(tx, tenantId, taskId);
    return item;
  });
}

export async function toggleChecklistItem(
  tenantId: string,
  itemId: string,
  checked: boolean,
  actor: Actor
) {
  const item = await prisma.checklistItem.findFirst({
    where: { id: itemId, tenantId },
    include: { task: { select: { id: true, assigneeId: true } } },
  });
  if (!item) throw new Error("Checklist item not found");
  assertCanActOn(actor, item.task.assigneeId);

  return prisma.$transaction(async (tx) => {
    await tx.checklistItem.update({
      where: { id: itemId },
      data: {
        isChecked: checked,
        checkedAt: checked ? new Date() : null,
        checkedById: checked ? actor.employeeId ?? null : null,
      },
    });
    await logActivity(tx, tenantId, {
      type: checked ? "checklist_checked" : "checklist_unchecked",
      taskId: item.taskId,
      employeeId: item.task.assigneeId,
      actorId: actor.employeeId,
      detail: item.label,
    });
    await recomputeTaskProgress(tx, tenantId, item.taskId);
  });
}

export async function deleteChecklistItem(tenantId: string, itemId: string, actor: Actor) {
  const item = await prisma.checklistItem.findFirst({
    where: { id: itemId, tenantId },
    include: { task: { select: { assigneeId: true } } },
  });
  if (!item) throw new Error("Checklist item not found");
  // Deletion is admin/manager-only — employees cannot delete subtasks, even
  // their own (they tick/untick to report progress; deletion is a manager act).
  if (!canDeleteAssignee(actor, item.task.assigneeId)) {
    throw new Error("Only a manager or admin can delete subtasks");
  }

  return prisma.$transaction(async (tx) => {
    await tx.checklistItem.delete({ where: { id: itemId } });
    await recomputeTaskProgress(tx, tenantId, item.taskId);
  });
}

// ─── Analytics ──────────────────────────────────────────────

export async function getDashboardStats(
  tenantId: string,
  scope?: { assigneeIds?: string[] }
) {
  const base: Prisma.TaskWhereInput = { tenantId };
  if (scope?.assigneeIds) base.assigneeId = { in: scope.assigneeIds };

  const weekAgo = today();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [open, overdue, completedThisWeek, byStatus] = await Promise.all([
    prisma.task.count({ where: { ...base, status: { in: OPEN_STATUSES } } }),
    prisma.task.count({
      where: { ...base, status: { in: OPEN_STATUSES }, dueDate: { lt: today() } },
    }),
    prisma.task.count({ where: { ...base, status: "done", completedAt: { gte: weekAgo } } }),
    prisma.task.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
  ]);

  return {
    open,
    overdue,
    completedThisWeek,
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])) as Record<
      TaskStatus,
      number
    >,
  };
}

/** Paginated activity feed for the History page. */
export async function getActivityHistory(
  tenantId: string,
  filter: {
    employeeId?: string;
    employeeIds?: string[];
    from?: Date;
    to?: Date;
    take?: number;
  } = {}
) {
  const where: Prisma.TaskActivityWhereInput = { tenantId };
  if (filter.employeeId) where.employeeId = filter.employeeId;
  if (filter.employeeIds) where.employeeId = { in: filter.employeeIds };
  if (filter.from || filter.to) {
    where.occurredOn = {};
    if (filter.from) where.occurredOn.gte = filter.from;
    if (filter.to) where.occurredOn.lte = filter.to;
  }
  return prisma.taskActivity.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: filter.take ?? 200,
  });
}

// ─── Productivity engine (Performance bridge, read-only) ─────

// Tasks-only score weights (re-normalised from spec §12.2 after the Habit
// pillar was removed): completion 0.40, active-days 0.15, on-time 0.15.
const SCORE_WEIGHTS = { task: 0.4, activeDays: 0.15, onTime: 0.15 };

export type EmployeePerformance = {
  assigned: number;
  completed: number;
  taskCompletionRate: number; // %  completed / assigned (by due_date in period)
  throughput: number; //  tasks whose completedAt falls in the period
  onTimeRatio: number; // %  completed on/before due / completed
  activeDays: number; // distinct days with >=1 logged action
  periodDays: number; // calendar days in the window
  activeDaysRatio: number; // %  activeDays / periodDays (approx; no work-cal yet)
  score: number; // composite 0–100
};

/**
 * Compute one employee's productivity metrics over [from, to] from the
 * TaskActivity log + tasks. Every figure traces back to recorded events
 * (spec acceptance criterion). Habit compliance is null until Habits land.
 */
export async function getEmployeePerformance(
  tenantId: string,
  employeeId: string,
  from: Date,
  to: Date,
  isWorkingDay?: (d: Date) => boolean
): Promise<EmployeePerformance> {
  const [assignedTasks, throughputTasks, activeDayRows] = await Promise.all([
    // Assigned in period = due_date in [from,to], excluding cancelled.
    prisma.task.findMany({
      where: {
        tenantId,
        assigneeId: employeeId,
        status: { not: "cancelled" },
        dueDate: { gte: from, lte: to },
      },
      select: { status: true, dueDate: true, completedAt: true },
    }),
    // Throughput = completedAt in [from,to].
    prisma.task.findMany({
      where: {
        tenantId,
        assigneeId: employeeId,
        status: "done",
        completedAt: { gte: from, lte: to },
      },
      select: { dueDate: true, completedAt: true },
    }),
    prisma.taskActivity.findMany({
      where: { tenantId, employeeId, occurredOn: { gte: from, lte: to } },
      select: { occurredOn: true },
    }),
  ]);

  const assigned = assignedTasks.length;
  const completed = assignedTasks.filter((t) => t.status === "done").length;
  const taskCompletionRate = assigned === 0 ? 0 : Math.round((completed / assigned) * 100);

  const throughput = throughputTasks.length;
  const onTimeCount = throughputTasks.filter(
    (t) => t.dueDate && t.completedAt && t.completedAt <= endOfDay(t.dueDate)
  ).length;
  const onTimeRatio = throughput === 0 ? 0 : Math.round((onTimeCount / throughput) * 100);

  const activeDays = new Set(activeDayRows.map((r) => r.occurredOn.toISOString().slice(0, 10))).size;
  // Denominator = working days in the window (excludes weekend + holidays) when
  // a checker is supplied; otherwise calendar days.
  let periodDays: number;
  if (isWorkingDay) {
    let n = 0;
    for (let d = startOfDay(from); d <= endOfDay(to); d.setDate(d.getDate() + 1)) {
      if (isWorkingDay(new Date(d))) n++;
    }
    periodDays = Math.max(1, n);
  } else {
    periodDays = Math.max(
      1,
      Math.round((endOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000)
    );
  }
  const activeDaysRatio = Math.min(100, Math.round((activeDays / periodDays) * 100));

  // Composite score — weighted blend of completion, active-days and on-time.
  const w = SCORE_WEIGHTS;
  const liveWeight = w.task + w.activeDays + w.onTime;
  const weighted =
    w.task * taskCompletionRate + w.activeDays * activeDaysRatio + w.onTime * onTimeRatio;
  const score = Math.round(weighted / liveWeight);

  return {
    assigned,
    completed,
    taskCompletionRate,
    throughput,
    onTimeRatio,
    activeDays,
    periodDays,
    activeDaysRatio,
    score: Math.min(100, Math.max(0, score)),
  };
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Productivity for several employees over one period (sorted by score desc). */
export async function getTeamPerformance(
  tenantId: string,
  employees: { id: string; fullName: string; empCode: string }[],
  from: Date,
  to: Date
) {
  const wd = await getWorkingDayChecker(tenantId);
  const rows = await Promise.all(
    employees.map(async (e) => ({
      employeeId: e.id,
      fullName: e.fullName,
      empCode: e.empCode,
      ...(await getEmployeePerformance(tenantId, e.id, from, to, wd.isWorkingDay)),
    }))
  );
  return rows.sort((a, b) => b.score - a.score);
}

/** ISO week (Mon–Sun) containing `d`. */
function isoWeekBounds(d: Date) {
  const day = startOfDay(d);
  const dow = (day.getDay() + 6) % 7; // 0=Mon..6=Sun
  const from = new Date(day);
  from.setDate(day.getDate() - dow);
  const to = new Date(from);
  to.setDate(from.getDate() + 6);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export type MonthlyReportRow = {
  employeeId: string;
  fullName: string;
  empCode: string;
  todayRate: number;
  weekRate: number;
  monthRate: number;
  completed: number;
  assigned: number;
  onTimeRatio: number;
  activeDays: number;
  score: number;
};

/**
 * Monthly report: today / week / month completion %, throughput, on-time and
 * composite score per employee, sorted by score.
 */
export async function getMonthlyReport(
  tenantId: string,
  employees: { id: string; fullName: string; empCode: string }[],
  refDate = new Date()
): Promise<MonthlyReportRow[]> {
  const todayFrom = startOfDay(refDate);
  const todayTo = endOfDay(refDate);
  const week = isoWeekBounds(refDate);
  const monthFrom = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
  const monthTo = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0, 23, 59, 59, 999);

  const wd = await getWorkingDayChecker(tenantId);
  const rows = await Promise.all(
    employees.map(async (e) => {
      const [today, wk, month] = await Promise.all([
        getEmployeePerformance(tenantId, e.id, todayFrom, todayTo, wd.isWorkingDay),
        getEmployeePerformance(tenantId, e.id, week.from, week.to, wd.isWorkingDay),
        getEmployeePerformance(tenantId, e.id, monthFrom, monthTo, wd.isWorkingDay),
      ]);
      return {
        employeeId: e.id,
        fullName: e.fullName,
        empCode: e.empCode,
        todayRate: today.taskCompletionRate,
        weekRate: wk.taskCompletionRate,
        monthRate: month.taskCompletionRate,
        completed: month.completed,
        assigned: month.assigned,
        onTimeRatio: month.onTimeRatio,
        activeDays: month.activeDays,
        score: month.score,
      };
    })
  );
  return rows.sort((a, b) => b.score - a.score);
}

/** Goals in this tenant that are driven by linked tasks, with live rollup %. */
export async function getTaskDrivenGoals(tenantId: string) {
  const goals = await prisma.goal.findMany({
    where: { tenantId, tasks: { some: {} } },
    select: {
      id: true,
      title: true,
      progress: true,
      status: true,
      employee: { select: { fullName: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return goals.map((g) => ({
    id: g.id,
    title: g.title,
    progress: g.progress,
    status: g.status,
    employeeName: g.employee.fullName,
    taskCount: g._count.tasks,
  }));
}