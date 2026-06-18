import type { PrismaClient, Prisma } from "@prisma/client";
import { publishRealtime } from "./realtime/bus";
import { getRequestActor } from "./request-actor";

// Map a Prisma model (entityType) to the page where that activity lives, so the
// bell can deep-link straight to it. Employee has a detail route; the rest land
// on their list page. Unmapped models fall back to the HR dashboard so every
// notification is still clickable.
const LINK_BASE: Record<string, string> = {
  Employee: "/hr/employees",
  Department: "/hr/departments",
  Position: "/hr/positions",
  AttendanceRecord: "/hr/attendance",
  BreakSession: "/hr/break",
  BreakPenalty: "/hr/break",
  LeaveRequest: "/hr/leave",
  LeaveType: "/hr/leave",
  LeaveBalance: "/hr/leave",
  Task: "/hr/tasks",
  TaskComment: "/hr/tasks",
  Goal: "/hr/performance/goals",
  ReviewCycle: "/hr/performance/cycles",
  Review: "/hr/performance/reviews",
  Candidate: "/hr/recruitment/candidates",
  JobPosting: "/hr/recruitment/jobs",
  Application: "/hr/recruitment/pipeline",
  Course: "/hr/learning/courses",
  CourseModule: "/hr/learning/courses",
  Enrollment: "/hr/learning/enrollments",
  EmployeeDocument: "/hr/documents",
  DocumentCategory: "/hr/documents/categories",
  Certification: "/hr/employees",
  EmployeeSalary: "/hr/payroll",
  Holiday: "/settings",
};

function linkForEntity(model: string, entityId: string | null): string {
  // Models with a real detail route deep-link by id; others go to the list page.
  if (model === "Employee" && entityId) return `/hr/employees/${entityId}`;
  return LINK_BASE[model] ?? "/hr";
}

// Global write → notification bridge.
//
// Instead of instrumenting hundreds of call sites, a single Prisma `$use`
// middleware turns every meaningful single-row write into a persisted
// `Notification` row. That feeds the admin Notifications tab, the TopBar
// bell, and the app-wide popup poller — for ANY activity, not just the few
// flows that were wired by hand.
//
// Safety rules baked in:
//  - Only single-row create/update/delete (no bulk *Many, no reads).
//  - DENYLIST: infra models that would recurse (Notification/…), the
//    approvals model (it already emits its own rich notification), and the
//    high-volume tables payroll-recompute / sales rewrite in bulk
//    (memory: payroll built-in recompute rewrites Payslip/PayslipLine over
//    ALL runs — must never flood the feed).
//  - Tenant-scoped only: if we can't resolve a tenantId we skip, which also
//    naturally drops auth/infra tables that have no tenantId.
//  - Never throws: a notification failure must not break the real write.

const DENYLIST = new Set<string>([
  // recursion / infra
  "Notification",
  "NotificationRead",
  "ActivityLog",
  // approvals already emit their own notification explicitly
  "ApprovalRequest",
  // payroll: bulk-written during runs and tenant-wide recompute
  "Payslip",
  "PayslipLine",
  "PayslipCustomValue",
  "AdvanceRecovery",
  "EmployeeAdvance",
  "PayrollRun",
  "PayrollPeriod",
  "PayrollRecomputeBackup",
  "PayrollBaseColumnOverride",
  "PayrollCustomColumn",
  // other high-frequency per-line / log tables
  "InventoryLog",
  "PaymentLog",
  // task management: our own audit log + per-tick sub-tables would otherwise
  // spam the feed on every checklist tick / habit check-in. Task, Habit and
  // TaskComment creates still notify (meaningful events).
  "TaskActivity",
  "ChecklistItem",
  "HabitEntry",
]);

const VERB: Record<string, string> = {
  create: "created",
  update: "updated",
  delete: "deleted",
};

const SEVERITY: Record<string, string> = {
  create: "success",
  update: "info",
  delete: "warning",
};

function humanizeModel(model: string): string {
  const spaced = model.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function attachActivityNotifier(client: PrismaClient) {
  client.$use(async (params: Prisma.MiddlewareParams, next) => {
    const result = await next(params);

    try {
      const model = params.model;
      const action = params.action as string;
      if (
        !model ||
        DENYLIST.has(model) ||
        !(action === "create" || action === "update" || action === "delete")
      ) {
        return result;
      }

      const r = (result ?? {}) as Record<string, unknown>;
      const a = (params.args ?? {}) as {
        data?: Record<string, unknown>;
        where?: Record<string, unknown>;
      };

      const tenantId =
        (r.tenantId as string | undefined) ??
        (a.data?.tenantId as string | undefined) ??
        (a.where?.tenantId as string | undefined);
      if (!tenantId || typeof tenantId !== "string") return result;

      const entityId =
        (r.id as string | undefined) ?? (a.where?.id as string | undefined) ?? null;

      const label =
        (r.name as string) ??
        (r.fullName as string) ??
        (r.title as string) ??
        (r.invoiceNumber as string) ??
        (r.code as string) ??
        null;

      // Who performed this write (resolved from the request's session). null on
      // system / unauthenticated paths (cron, webhooks) → shown as "System".
      const actor = getRequestActor();
      const link = linkForEntity(model, entityId ? String(entityId) : null);

      // Separate call; `Notification` is denylisted so this does not recurse.
      await client.notification.create({
        data: {
          tenantId,
          category: "activity",
          type: `${model.toLowerCase()}.${action}`,
          title: `${humanizeModel(model)} ${VERB[action]}`,
          body: typeof label === "string" ? label : null,
          entityType: model,
          entityId: entityId ? String(entityId) : null,
          link,
          actorId: actor?.userId ?? null,
          actorName: actor?.userName ?? null,
          severity: SEVERITY[action] ?? "info",
        },
      });
      // Instant push to every open page for this tenant.
      publishRealtime({
        tenantId,
        kind: "notification",
        category: "activity",
        title: `${humanizeModel(model)} ${VERB[action]}`,
        body: typeof label === "string" ? label : null,
        severity: SEVERITY[action] ?? "info",
      });
    } catch {
      // Notifications must never break the originating write.
    }

    return result;
  });
}
