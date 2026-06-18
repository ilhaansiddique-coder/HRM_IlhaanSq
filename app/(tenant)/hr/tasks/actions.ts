"use server";

import { requireTenant } from "@/lib/auth";
import { setRequestActor } from "@/lib/request-actor";
import { revalidatePath } from "next/cache";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import {
  createTask,
  updateTask,
  setTaskStatus,
  reassignTask,
  deleteTasks,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  addComment,
  deleteComment,
  resolveScope,
  submitTaskForReview,
  reviewTask,
} from "@/lib/services/hr/task.service";

type ActionResult = { ok: boolean; error?: string };

/** Resolve the acting employee + role scope (admin / manager reports) from the session. */
async function resolveActor(tenantId: string, userId: string, role: string | null) {
  const s = await resolveScope(tenantId, userId, role);
  return {
    isAdmin: s.isAdmin,
    isManager: s.isManager,
    employeeId: s.employeeId,
    name: s.name,
    reportIds: s.reportIds,
  };
}

function parseDate(v: FormDataEntryValue | null): Date | null {
  const s = (v as string | null)?.trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export async function createTaskAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireTenant();
    // Stamp the actor HERE in the action body — enterWith only propagates to the
    // notification middleware from the action's own async context, not from deep
    // inside the React-cache-wrapped requireAuth (see lib/request-actor.ts).
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    const actor = await resolveActor(session.tenantId, session.userId, session.role);

    // Admins assign to anyone; managers to themselves or a direct report;
    // everyone else only to themselves.
    let assigneeId = ((formData.get("assigneeId") as string | null) ?? "").trim() || null;
    if (!actor.isAdmin) {
      if (!actor.employeeId) throw new Error("Your account isn't linked to an employee record.");
      const allowed = [actor.employeeId, ...(actor.reportIds ?? [])];
      if (!assigneeId || !allowed.includes(assigneeId)) assigneeId = actor.employeeId;
    }

    // Only admins may bind a task to a goal (strategic linkage). The dialog
    // posts "_standalone" when the admin deliberately opts out of a goal link.
    const rawGoalId = ((formData.get("goalId") as string | null) ?? "").trim();
    const goalId = actor.isAdmin && rawGoalId && rawGoalId !== "_standalone" ? rawGoalId : null;

    // Checklist sub-items arrive as repeated "checklist" fields.
    const checklist = formData
      .getAll("checklist")
      .map((v) => (v as string).trim())
      .filter(Boolean);

    await createTask(
      session.tenantId,
      {
        title: (formData.get("title") as string) ?? "",
        description: (formData.get("description") as string) || undefined,
        assigneeId,
        goalId,
        checklist,
        priority: ((formData.get("priority") as string) || "medium") as TaskPriority,
        dueDate: parseDate(formData.get("dueDate")),
        startDate: parseDate(formData.get("startDate")),
        estimateMins: formData.get("estimateMins")
          ? Number(formData.get("estimateMins"))
          : null,
      },
      actor
    );

    revalidatePath("/hr/tasks");
    revalidatePath("/hr");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create task" };
  }
}

export async function updateTaskAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireTenant();
    // Stamp the actor HERE in the action body — enterWith only propagates to the
    // notification middleware from the action's own async context, not from deep
    // inside the React-cache-wrapped requireAuth (see lib/request-actor.ts).
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    const actor = await resolveActor(session.tenantId, session.userId, session.role);
    const id = formData.get("id") as string;

    await updateTask(
      session.tenantId,
      id,
      {
        title: (formData.get("title") as string) ?? undefined,
        description: (formData.get("description") as string) ?? null,
        priority: ((formData.get("priority") as string) || "medium") as TaskPriority,
        dueDate: parseDate(formData.get("dueDate")),
        startDate: parseDate(formData.get("startDate")),
        estimateMins: formData.get("estimateMins")
          ? Number(formData.get("estimateMins"))
          : null,
      },
      actor
    );

    revalidatePath("/hr/tasks");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update task" };
  }
}

export async function setTaskStatusAction(
  id: string,
  status: TaskStatus
): Promise<ActionResult> {
  try {
    const session = await requireTenant();
    // Stamp the actor HERE in the action body — enterWith only propagates to the
    // notification middleware from the action's own async context, not from deep
    // inside the React-cache-wrapped requireAuth (see lib/request-actor.ts).
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    const actor = await resolveActor(session.tenantId, session.userId, session.role);
    await setTaskStatus(session.tenantId, id, status, actor);
    revalidatePath("/hr/tasks");
    revalidatePath("/hr");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update status" };
  }
}

export async function reassignTaskAction(
  id: string,
  assigneeId: string | null
): Promise<ActionResult> {
  try {
    const session = await requireTenant();
    // Stamp the actor HERE in the action body — enterWith only propagates to the
    // notification middleware from the action's own async context, not from deep
    // inside the React-cache-wrapped requireAuth (see lib/request-actor.ts).
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    const actor = await resolveActor(session.tenantId, session.userId, session.role);
    await reassignTask(session.tenantId, id, assigneeId, actor);
    revalidatePath("/hr/tasks");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to reassign task" };
  }
}

export async function deleteTasksAction(ids: string[]): Promise<ActionResult> {
  try {
    const session = await requireTenant();
    // Stamp the actor HERE in the action body — enterWith only propagates to the
    // notification middleware from the action's own async context, not from deep
    // inside the React-cache-wrapped requireAuth (see lib/request-actor.ts).
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    const actor = await resolveActor(session.tenantId, session.userId, session.role);
    await deleteTasks(session.tenantId, ids, actor);
    revalidatePath("/hr/tasks");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete tasks" };
  }
}

// ─── Checklist sub-items ────────────────────────────────────

export async function addChecklistItemAction(
  taskId: string,
  label: string
): Promise<ActionResult> {
  try {
    const session = await requireTenant();
    // Stamp the actor HERE in the action body — enterWith only propagates to the
    // notification middleware from the action's own async context, not from deep
    // inside the React-cache-wrapped requireAuth (see lib/request-actor.ts).
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    const actor = await resolveActor(session.tenantId, session.userId, session.role);
    await addChecklistItem(session.tenantId, taskId, label, actor);
    revalidatePath("/hr/tasks");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to add item" };
  }
}

export async function toggleChecklistItemAction(
  itemId: string,
  checked: boolean
): Promise<ActionResult> {
  try {
    const session = await requireTenant();
    // Stamp the actor HERE in the action body — enterWith only propagates to the
    // notification middleware from the action's own async context, not from deep
    // inside the React-cache-wrapped requireAuth (see lib/request-actor.ts).
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    const actor = await resolveActor(session.tenantId, session.userId, session.role);
    await toggleChecklistItem(session.tenantId, itemId, checked, actor);
    revalidatePath("/hr/tasks");
    revalidatePath("/hr/performance");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update item" };
  }
}

export async function deleteChecklistItemAction(itemId: string): Promise<ActionResult> {
  try {
    const session = await requireTenant();
    // Stamp the actor HERE in the action body — enterWith only propagates to the
    // notification middleware from the action's own async context, not from deep
    // inside the React-cache-wrapped requireAuth (see lib/request-actor.ts).
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    const actor = await resolveActor(session.tenantId, session.userId, session.role);
    await deleteChecklistItem(session.tenantId, itemId, actor);
    revalidatePath("/hr/tasks");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete item" };
  }
}

// ─── Completion proof + verification ────────────────────────

export async function submitTaskAction(
  taskId: string,
  proofUrl: string,
  proofNote: string
): Promise<ActionResult> {
  try {
    const session = await requireTenant();
    // Stamp the actor HERE in the action body — enterWith only propagates to the
    // notification middleware from the action's own async context, not from deep
    // inside the React-cache-wrapped requireAuth (see lib/request-actor.ts).
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    const actor = await resolveActor(session.tenantId, session.userId, session.role);
    await submitTaskForReview(
      session.tenantId,
      taskId,
      { proofUrl: proofUrl || null, proofNote: proofNote || null },
      actor
    );
    revalidatePath("/hr/tasks");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to submit task" };
  }
}

export async function reviewTaskAction(
  taskId: string,
  decision: "approve" | "reject",
  feedback: string
): Promise<ActionResult> {
  try {
    const session = await requireTenant();
    // Stamp the actor HERE in the action body — enterWith only propagates to the
    // notification middleware from the action's own async context, not from deep
    // inside the React-cache-wrapped requireAuth (see lib/request-actor.ts).
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    const actor = await resolveActor(session.tenantId, session.userId, session.role);
    await reviewTask(session.tenantId, taskId, decision, feedback || null, {
      ...actor,
      name: actor.name,
    });
    revalidatePath("/hr/tasks");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to review task" };
  }
}

// ─── Comments ───────────────────────────────────────────────

export async function addCommentAction(taskId: string, body: string): Promise<ActionResult> {
  try {
    const session = await requireTenant();
    // Stamp the actor HERE in the action body — enterWith only propagates to the
    // notification middleware from the action's own async context, not from deep
    // inside the React-cache-wrapped requireAuth (see lib/request-actor.ts).
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    const actor = await resolveActor(session.tenantId, session.userId, session.role);
    await addComment(session.tenantId, taskId, body, { ...actor, name: actor.name });
    revalidatePath("/hr/tasks");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to add comment" };
  }
}

export async function deleteCommentAction(commentId: string): Promise<ActionResult> {
  try {
    const session = await requireTenant();
    // Stamp the actor HERE in the action body — enterWith only propagates to the
    // notification middleware from the action's own async context, not from deep
    // inside the React-cache-wrapped requireAuth (see lib/request-actor.ts).
    setRequestActor({ userId: session.userId, userName: session.name || session.email || null });
    const actor = await resolveActor(session.tenantId, session.userId, session.role);
    await deleteComment(session.tenantId, commentId, actor);
    revalidatePath("/hr/tasks");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete comment" };
  }
}